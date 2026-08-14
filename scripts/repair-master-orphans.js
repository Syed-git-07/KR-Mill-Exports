#!/usr/bin/env node

const path = require('node:path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true, quiet: true })

const { PrismaClient } = require('@prisma/client')
const { machineModules, referentialRelations } = require('./master-integrity-config')

const prisma = new PrismaClient()
const shouldApply = process.argv.includes('--apply')
const expectedDatabase = process.argv
  .find(argument => argument.startsWith('--database='))
  ?.slice('--database='.length)

function hasValue(value) {
  return value !== null && value !== undefined
}

async function orphanCount(client, relation) {
  const [children, parents] = await Promise.all([
    client[relation.childTable].findMany({
      select: { [relation.childColumn]: true }
    }),
    client[relation.parentTable].findMany({
      select: { [relation.parentColumn]: true }
    })
  ])
  const parentIds = new Set(parents.map(parent => parent[relation.parentColumn]))
  return children.filter(child =>
    hasValue(child[relation.childColumn]) && !parentIds.has(child[relation.childColumn])
  ).length
}

async function inspect() {
  const databaseRows = await prisma.$queryRaw`SELECT DATABASE() AS databaseName`
  const databaseName = databaseRows[0]?.databaseName
  const relations = []

  for (const relation of referentialRelations) {
    const count = await orphanCount(prisma, relation)
    if (count > 0) relations.push({ constraint: relation.constraint, count })
  }

  return {
    mode: shouldApply ? 'apply' : 'dry-run',
    databaseName,
    orphanRelationships: relations,
    totalOrphanRelationships: relations.reduce((sum, item) => sum + item.count, 0)
  }
}

async function executeCleanup(tx) {
  const operations = []
  const record = (name, affected) => {
    operations.push({ name, affected })
  }

  const [
    supervisorRows,
    stoppageCodeRows,
    countRows,
    departmentRows,
    stoppageHeadRows,
    hokHeadRows,
    spinningMachineRows
  ] = await Promise.all([
    tx.supervisors.findMany({ select: { id: true } }),
    tx.stoppage_details.findMany({ select: { id: true } }),
    tx.spinning_counts.findMany({ select: { id: true } }),
    tx.departments.findMany({ select: { id: true } }),
    tx.stoppage_heads.findMany({ select: { id: true } }),
    tx.hok_strength_head.findMany({ select: { hok_id: true } }),
    tx.spinning_machines.findMany({ select: { id: true } })
  ])
  const supervisorIds = new Set(supervisorRows.map(row => row.id))
  const stoppageCodeIds = new Set(stoppageCodeRows.map(row => row.id))
  const countIds = new Set(countRows.map(row => row.id))
  const departmentIds = new Set(departmentRows.map(row => row.id))
  const stoppageHeadIds = new Set(stoppageHeadRows.map(row => row.id))
  const hokHeadIds = new Set(hokHeadRows.map(row => row.hok_id))
  const spinningMachineIds = new Set(spinningMachineRows.map(row => row.id))

  for (const moduleConfig of machineModules) {
    const setupSelect = { id: true, machine_id: true }
    const detailSelect = { id: true, machine_id: true, header_id: true }
    if (moduleConfig.hasCountReferences) {
      setupSelect.count_id = true
      detailSelect.count_id = true
    }
    const stoppageSelect = { id: true, production_detail_id: true, total_stoppage_time: true }
    for (let index = 1; index <= 4; index += 1) {
      stoppageSelect[`stoppage${index}_id`] = true
      stoppageSelect[`stoppage${index}_time`] = true
    }
    const headerSelect = { id: true, supervisor_id: true }
    if (moduleConfig.hasMaisitry) headerSelect.maisitry_id = true

    const [machines, headers, setups, details, stoppages] = await Promise.all([
      tx[moduleConfig.machine].findMany({ select: { id: true } }),
      tx[moduleConfig.header].findMany({ select: headerSelect }),
      tx[moduleConfig.setup].findMany({ select: setupSelect }),
      tx[moduleConfig.detail].findMany({ select: detailSelect }),
      tx[moduleConfig.stoppage].findMany({ select: stoppageSelect })
    ])
    const machineIds = new Set(machines.map(row => row.id))
    const headerIds = new Set(headers.map(row => row.id))
    const invalidDetailIds = details
      .filter(row => !machineIds.has(row.machine_id) || !headerIds.has(row.header_id))
      .map(row => row.id)
    const invalidDetailIdSet = new Set(invalidDetailIds)
    const validDetailIds = new Set(
      details.filter(row => !invalidDetailIdSet.has(row.id)).map(row => row.id)
    )
    const invalidStoppageIds = stoppages
      .filter(row => !validDetailIds.has(row.production_detail_id))
      .map(row => row.id)
    const invalidSetupIds = setups
      .filter(row => !machineIds.has(row.machine_id))
      .map(row => row.id)

    if (invalidStoppageIds.length > 0) {
      const result = await tx[moduleConfig.stoppage].deleteMany({ where: { id: { in: invalidStoppageIds } } })
      record(`${moduleConfig.key}.deleteInvalidStoppages`, result.count)
    }
    if (invalidDetailIds.length > 0) {
      const result = await tx[moduleConfig.detail].deleteMany({ where: { id: { in: invalidDetailIds } } })
      record(`${moduleConfig.key}.deleteInvalidProductionDetails`, result.count)
    }
    if (invalidSetupIds.length > 0) {
      const result = await tx[moduleConfig.setup].deleteMany({ where: { id: { in: invalidSetupIds } } })
      record(`${moduleConfig.key}.deleteInvalidSetups`, result.count)
    }

    const invalidSupervisorHeaderIds = headers
      .filter(row => hasValue(row.supervisor_id) && !supervisorIds.has(row.supervisor_id))
      .map(row => row.id)
    if (invalidSupervisorHeaderIds.length > 0) {
      const result = await tx[moduleConfig.header].updateMany({
        where: { id: { in: invalidSupervisorHeaderIds } },
        data: { supervisor_id: null }
      })
      record(`${moduleConfig.key}.clearInvalidSupervisors`, result.count)
    }
    if (moduleConfig.hasMaisitry) {
      const invalidMaisitryHeaderIds = headers
        .filter(row => hasValue(row.maisitry_id) && !supervisorIds.has(row.maisitry_id))
        .map(row => row.id)
      if (invalidMaisitryHeaderIds.length > 0) {
        const result = await tx[moduleConfig.header].updateMany({
          where: { id: { in: invalidMaisitryHeaderIds } },
          data: { maisitry_id: null }
        })
        record(`${moduleConfig.key}.clearInvalidMaisitries`, result.count)
      }
    }

    for (const stoppage of stoppages.filter(row => validDetailIds.has(row.production_detail_id))) {
      const invalidIndexes = [1, 2, 3, 4].filter(index => {
        const value = stoppage[`stoppage${index}_id`]
        return hasValue(value) && !stoppageCodeIds.has(value)
      })
      if (invalidIndexes.length === 0) continue

      const data = {}
      for (const index of invalidIndexes) {
        data[`stoppage${index}_id`] = null
        data[`stoppage${index}_time`] = 0
      }
      data.total_stoppage_time = [1, 2, 3, 4].reduce((sum, index) =>
        sum + (invalidIndexes.includes(index) ? 0 : Number(stoppage[`stoppage${index}_time`] || 0)), 0)
      await tx[moduleConfig.stoppage].update({ where: { id: stoppage.id }, data })
      record(`${moduleConfig.key}.clearInvalidStoppageCodes`, 1)
    }

    if (moduleConfig.hasCountReferences) {
      const invalidSetupCountIds = setups
        .filter(row => !invalidSetupIds.includes(row.id) && hasValue(row.count_id) && !countIds.has(row.count_id))
        .map(row => row.id)
      const invalidDetailCountIds = details
        .filter(row => !invalidDetailIdSet.has(row.id) && hasValue(row.count_id) && !countIds.has(row.count_id))
        .map(row => row.id)
      if (invalidSetupCountIds.length > 0) {
        const result = await tx[moduleConfig.setup].updateMany({
          where: { id: { in: invalidSetupCountIds } },
          data: { count_id: null }
        })
        record(`${moduleConfig.key}.clearInvalidSetupCounts`, result.count)
      }
      if (invalidDetailCountIds.length > 0) {
        const result = await tx[moduleConfig.detail].updateMany({
          where: { id: { in: invalidDetailCountIds } },
          data: { count_id: null }
        })
        record(`${moduleConfig.key}.clearInvalidProductionCounts`, result.count)
      }
    }
  }

  const supervisors = await tx.supervisors.findMany({ select: { id: true, department_id: true } })
  const invalidSupervisorIds = supervisors
    .filter(row => hasValue(row.department_id) && !departmentIds.has(row.department_id))
    .map(row => row.id)
  if (invalidSupervisorIds.length > 0) {
    const result = await tx.supervisors.updateMany({
      where: { id: { in: invalidSupervisorIds } },
      data: { department_id: null }
    })
    record('masters.clearInvalidSupervisorDepartments', result.count)
  }

  const stoppageDetails = await tx.stoppage_details.findMany({
    select: { id: true, stoppage_head_id: true, department_id: true }
  })
  const invalidHeadIds = stoppageDetails
    .filter(row => hasValue(row.stoppage_head_id) && !stoppageHeadIds.has(row.stoppage_head_id))
    .map(row => row.id)
  const invalidDepartmentDetailIds = stoppageDetails
    .filter(row => hasValue(row.department_id) && !departmentIds.has(row.department_id))
    .map(row => row.id)
  if (invalidHeadIds.length > 0) {
    const result = await tx.stoppage_details.updateMany({
      where: { id: { in: invalidHeadIds } },
      data: { stoppage_head_id: null }
    })
    record('masters.clearInvalidStoppageHeads', result.count)
  }
  if (invalidDepartmentDetailIds.length > 0) {
    const result = await tx.stoppage_details.updateMany({
      where: { id: { in: invalidDepartmentDetailIds } },
      data: { department_id: null }
    })
    record('masters.clearInvalidStoppageDepartments', result.count)
  }

  const hokDetails = await tx.hok_strength_detail.findMany({
    select: { id: true, hok_id: true, department_id: true }
  })
  const invalidHokDetailIds = hokDetails
    .filter(row => !hokHeadIds.has(row.hok_id) || !departmentIds.has(row.department_id))
    .map(row => row.id)
  if (invalidHokDetailIds.length > 0) {
    const result = await tx.hok_strength_detail.deleteMany({
      where: { id: { in: invalidHokDetailIds } }
    })
    record('masters.deleteInvalidHokDetails', result.count)
  }

  for (const table of ['tpi_entries', 'twc_entries']) {
    const entries = await tx[table].findMany({
      select: { id: true, spinning_count_id: true, machine_id: true }
    })
    const invalidCountEntryIds = entries
      .filter(row => hasValue(row.spinning_count_id) && !countIds.has(row.spinning_count_id))
      .map(row => row.id)
    const invalidMachineEntryIds = entries
      .filter(row => hasValue(row.machine_id) && !spinningMachineIds.has(row.machine_id))
      .map(row => row.id)
    if (invalidCountEntryIds.length > 0) {
      const result = await tx[table].updateMany({
        where: { id: { in: invalidCountEntryIds } },
        data: { spinning_count_id: null }
      })
      record(`${table}.clearInvalidCounts`, result.count)
    }
    if (invalidMachineEntryIds.length > 0) {
      const result = await tx[table].updateMany({
        where: { id: { in: invalidMachineEntryIds } },
        data: { machine_id: null }
      })
      record(`${table}.clearInvalidMachines`, result.count)
    }
  }

  return operations
}

async function main() {
  const inspection = await inspect()
  console.log(JSON.stringify(inspection, null, 2))
  if (!shouldApply) return

  if (!expectedDatabase) {
    throw new Error('Apply mode requires --database=<exact database name>')
  }
  if (inspection.databaseName !== expectedDatabase) {
    throw new Error(`Database confirmation mismatch: connected to ${inspection.databaseName}`)
  }

  const operations = await prisma.$transaction(async tx => {
    const results = await executeCleanup(tx)
    await tx.audit_logs.create({
      data: {
        username: 'maintenance-script',
        event_type: 'MASTER_MAINTENANCE',
        outcome: 'SUCCESS',
        action: 'REMOVE_LEGACY_ORPHANS',
        resource: 'master.referential-integrity',
        details: {
          database: inspection.databaseName,
          affectedRows: results.reduce((sum, item) => sum + item.affected, 0),
          operations: results.filter(item => item.affected > 0)
        }
      }
    })
    return results
  }, {
    maxWait: 10_000,
    timeout: 120_000
  })

  console.log(JSON.stringify({
    applied: true,
    affectedRows: operations.reduce((sum, item) => sum + item.affected, 0),
    operations: operations.filter(item => item.affected > 0)
  }, null, 2))
}

main()
  .catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
