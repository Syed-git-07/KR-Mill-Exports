const path = require('node:path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true, quiet: true })

const { PrismaClient } = require('@prisma/client')
const { machineModules, referentialRelations } = require('./master-integrity-config')
const prisma = new PrismaClient()
const summaryOnly = process.argv.includes('--summary')
const checkOnly = process.argv.includes('--check')

const expectedActiveMachineIndexes = [
  'uq_autoconer_active_machine_no',
  'uq_carding_active_machine_no',
  'uq_breaker_active_machine_no',
  'uq_comber_active_machine_no',
  'uq_finisher_active_machine_no',
  'uq_lap_former_active_machine_no',
  'uq_simplex_active_machine_no',
  'uq_spinning_active_machine_no'
]

const moduleConfigs = machineModules.map(moduleConfig => [
  moduleConfig.key,
  moduleConfig.machine,
  moduleConfig.setup,
  moduleConfig.detail,
  moduleConfig.stoppage
])

const expectedForeignKeys = referentialRelations.map(relation => relation.constraint)

function normalize(value) {
  return String(value || '').trim().toUpperCase()
}

function duplicateGroups(rows, key, filter = () => true) {
  const groups = new Map()
  for (const row of rows.filter(filter)) {
    const normalized = normalize(row[key])
    if (!normalized) continue
    if (!groups.has(normalized)) groups.set(normalized, [])
    groups.get(normalized).push(row)
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([value, records]) => ({ value, records }))
}

function orphanRows(rows, referenceField, validIds) {
  return rows.filter(row => row[referenceField] && !validIds.has(row[referenceField]))
}

async function auditRelation(relation) {
  const [children, parents] = await Promise.all([
    prisma[relation.childTable].findMany({
      select: { id: true, [relation.childColumn]: true }
    }),
    prisma[relation.parentTable].findMany({
      select: { [relation.parentColumn]: true }
    })
  ])
  const parentIds = new Set(parents.map(parent => parent[relation.parentColumn]))

  return children
    .filter(child => {
      const referencedId = child[relation.childColumn]
      return referencedId !== null && referencedId !== undefined && !parentIds.has(referencedId)
    })
    .map(child => ({ id: child.id, referencedId: child[relation.childColumn] }))
}

function duplicateGroupsBy(rows, keyForRow) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyForRow(row)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([value, records]) => ({ value, records }))
}

async function auditMachineModule([name, machineModel, setupModel, detailModel, stoppageModel], stoppageDetailIds) {
  const [machines, setups, productionDetails, stoppages] = await Promise.all([
    prisma[machineModel].findMany({
      select: {
        id: true,
        machine_no: true,
        is_active: true,
        activated_at: true,
        deactivated_at: true
      }
    }),
    prisma[setupModel].findMany({ select: { id: true, machine_id: true } }),
    prisma[detailModel].findMany({ select: { id: true, machine_id: true } }),
    prisma[stoppageModel].findMany({
      select: {
        id: true,
        production_detail_id: true,
        stoppage1_id: true,
        stoppage2_id: true,
        stoppage3_id: true,
        stoppage4_id: true
      }
    })
  ])

  const machineIds = new Set(machines.map(row => row.id))
  const productionDetailIds = new Set(productionDetails.map(row => row.id))
  const setupMachineIds = new Set(setups.map(row => row.machine_id))
  const orphanStoppageCodes = []

  for (const row of stoppages) {
    for (const field of ['stoppage1_id', 'stoppage2_id', 'stoppage3_id', 'stoppage4_id']) {
      if (row[field] && !stoppageDetailIds.has(row[field])) {
        orphanStoppageCodes.push({ id: row.id, field, referencedId: row[field] })
      }
    }
  }

  return {
    totals: {
      machines: machines.length,
      activeMachines: machines.filter(row => row.is_active).length,
      setups: setups.length,
      productionDetails: productionDetails.length,
      stoppages: stoppages.length
    },
    duplicateActiveMachineNumbers: duplicateGroups(
      machines,
      'machine_no',
      row => row.is_active === true
    ),
    lifecycleProblems: machines.filter(row =>
      (row.is_active && row.deactivated_at) ||
      (!row.is_active && !row.deactivated_at) ||
      !row.activated_at
    ),
    activeMachinesWithoutSetup: machines.filter(row => row.is_active && !setupMachineIds.has(row.id)),
    orphanSetups: orphanRows(setups, 'machine_id', machineIds),
    orphanProductionDetails: orphanRows(productionDetails, 'machine_id', machineIds),
    orphanStoppageProductionDetails: orphanRows(stoppages, 'production_detail_id', productionDetailIds),
    orphanStoppageCodes
  }
}

async function main() {
  const [departments, supervisors, stoppageHeads, stoppageDetails, counts, hokHeaders, hokDetails, tpiEntries, twcEntries] = await Promise.all([
    prisma.departments.findMany({ select: { id: true, dept_name: true, code: true, sl_no: true } }),
    prisma.supervisors.findMany({ select: { id: true, supervisor_name: true, code: true, department_id: true } }),
    prisma.stoppage_heads.findMany({ select: { id: true, stoppage_head_name: true, code: true } }),
    prisma.stoppage_details.findMany({ select: { id: true, stoppage_name: true, code: true, stoppage_head_id: true, department_id: true } }),
    prisma.spinning_counts.findMany({ select: { id: true, count_name: true } }),
    prisma.hok_strength_head.findMany({ select: { hok_id: true, date: true } }),
    prisma.hok_strength_detail.findMany({ select: { id: true, hok_id: true, department_id: true } }),
    prisma.tpi_entries.findMany({ select: { id: true, spinning_count_id: true } }),
    prisma.twc_entries.findMany({ select: { id: true, spinning_count_id: true } })
  ])

  const departmentIds = new Set(departments.map(row => row.id))
  const stoppageHeadIds = new Set(stoppageHeads.map(row => row.id))
  const stoppageDetailIds = new Set(stoppageDetails.map(row => row.id))
  const countIds = new Set(counts.map(row => row.id))
  const hokIds = new Set(hokHeaders.map(row => row.hok_id))

  const modules = Object.fromEntries(await Promise.all(
    moduleConfigs.map(async config => [config[0], await auditMachineModule(config, stoppageDetailIds)])
  ))
  const [installedGuardRows, installedForeignKeyRows, relationAudits] = await Promise.all([
    prisma.$queryRaw`
      SELECT DISTINCT INDEX_NAME AS indexName
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND INDEX_NAME LIKE 'uq_%_active_machine_no'
    `,
    prisma.$queryRaw`
      SELECT DISTINCT CONSTRAINT_NAME AS constraintName
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
    `,
    Promise.all(referentialRelations.map(async relation => [
      relation.constraint,
      await auditRelation(relation)
    ]))
  ])
  const installedGuards = installedGuardRows.map(row => row.indexName)
  const installedForeignKeys = installedForeignKeyRows.map(row => row.constraintName)
  const orphanReferences = Object.fromEntries(relationAudits)

  const report = {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    masters: {
      duplicateDepartmentNames: duplicateGroups(departments, 'dept_name'),
      duplicateSupervisorNames: duplicateGroups(supervisors, 'supervisor_name'),
      duplicateStoppageHeadNames: duplicateGroups(stoppageHeads, 'stoppage_head_name'),
      duplicateStoppageDetailsByContext: duplicateGroupsBy(
        stoppageDetails,
        row => [normalize(row.stoppage_name), row.stoppage_head_id || '', row.department_id || ''].join('|')
      ),
      duplicateCountNames: duplicateGroups(counts, 'count_name'),
      orphanSupervisors: orphanRows(supervisors, 'department_id', departmentIds),
      orphanStoppageHeadLinks: orphanRows(stoppageDetails, 'stoppage_head_id', stoppageHeadIds),
      orphanStoppageDepartmentLinks: orphanRows(stoppageDetails, 'department_id', departmentIds),
      orphanHOKHeaders: orphanRows(hokDetails, 'hok_id', hokIds),
      orphanHOKDepartments: orphanRows(hokDetails, 'department_id', departmentIds),
      orphanTPICounts: orphanRows(tpiEntries, 'spinning_count_id', countIds),
      orphanTWCCounts: orphanRows(twcEntries, 'spinning_count_id', countIds)
    },
    databaseGuards: {
      expectedActiveMachineIndexes,
      installedActiveMachineIndexes: installedGuards,
      missingActiveMachineIndexes: expectedActiveMachineIndexes.filter(name => !installedGuards.includes(name)),
      expectedForeignKeys,
      installedForeignKeys: expectedForeignKeys.filter(name => installedForeignKeys.includes(name)),
      missingForeignKeys: expectedForeignKeys.filter(name => !installedForeignKeys.includes(name))
    },
    relationalIntegrity: { orphanReferences },
    modules
  }

  const output = summaryOnly ? {
    mode: report.mode,
    generatedAt: report.generatedAt,
    masters: Object.fromEntries(
      Object.entries(report.masters).map(([key, rows]) => [key, rows.length])
    ),
    databaseGuards: report.databaseGuards,
    relationalIntegrity: {
      orphanReferences: Object.fromEntries(
        Object.entries(report.relationalIntegrity.orphanReferences)
          .map(([key, rows]) => [key, rows.length])
      )
    },
    modules: Object.fromEntries(
      Object.entries(report.modules).map(([key, module]) => [key, {
        ...module.totals,
        duplicateActiveMachineNumbers: module.duplicateActiveMachineNumbers.length,
        lifecycleProblems: module.lifecycleProblems.length,
        activeMachinesWithoutSetup: module.activeMachinesWithoutSetup.length,
        orphanSetups: module.orphanSetups.length,
        orphanProductionDetails: module.orphanProductionDetails.length,
        orphanStoppageProductionDetails: module.orphanStoppageProductionDetails.length,
        orphanStoppageCodes: module.orphanStoppageCodes.length
      }])
    )
  } : report

  process.stdout.write(`${JSON.stringify(output, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2)}\n`)

  if (checkOnly) {
    const masterIssues = Object.values(report.masters).some(rows => rows.length > 0)
    const moduleIssueKeys = [
      'duplicateActiveMachineNumbers',
      'lifecycleProblems',
      'activeMachinesWithoutSetup',
      'orphanSetups',
      'orphanProductionDetails',
      'orphanStoppageProductionDetails',
      'orphanStoppageCodes'
    ]
    const moduleIssues = Object.values(report.modules).some(module =>
      moduleIssueKeys.some(key => module[key].length > 0)
    )
    const relationIssues = Object.values(report.relationalIntegrity.orphanReferences)
      .some(rows => rows.length > 0)
    const guardIssues = report.databaseGuards.missingActiveMachineIndexes.length > 0 ||
      report.databaseGuards.missingForeignKeys.length > 0

    if (masterIssues || moduleIssues || relationIssues || guardIssues) {
      process.stderr.write('Master integrity check failed. Review the report above.\n')
      process.exitCode = 2
    }
  }
}

main()
  .catch(error => {
    console.error('Master integrity report failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
