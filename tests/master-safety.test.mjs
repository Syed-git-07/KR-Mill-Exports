import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { runBulkActions } from '../src/lib/actionResults.js'
import { buildTypedSearchWhere } from '../src/lib/masterSearch.js'
import {
  getActiveMasterRecordCount,
  getMasterRecordRowClassName,
  orderMasterRecords
} from '../src/lib/masterRecordDisplay.js'
import { softDeleteMasterRecord } from '../src/lib/queries/masterSoftDelete.js'
import {
  autoconerMachineCreateSchema,
  cardingMachineUpdateSchema,
  comberMachineUpdateSchema,
  departmentCreateSchema,
  hokEntrySchema,
  tpiEntryCreateSchema
} from '../src/lib/validation/masterSchemas.js'

const protectedDeleteActions = [
  'department',
  'supervisor',
  'stoppage-head',
  'stoppage-detail',
  'spinning-count',
  'spinning-machine',
  'autoconer',
  'carding-machine',
  'drawing-breaker',
  'comber-machine',
  'drawing-finisher',
  'lap-former',
  'simplex-machine'
]

const protectedDeleteQueries = {
  department: ['queries.js', 'deleteDepartment'],
  supervisor: ['supervisorQueries.js', 'deleteSupervisor'],
  'stoppage-head': ['stoppageHeadQueries.js', 'deleteStoppageHead'],
  'stoppage-detail': ['stoppageDetailQueries.js', 'deleteStoppageDetail'],
  'spinning-count': ['spinningCountQueries.js', 'deleteSpinningCount'],
  'spinning-machine': ['spinningMachineQueries.js', 'deleteSpinningMachine'],
  autoconer: ['autoconerQueries.js', 'deleteAutoconerMachine'],
  'carding-machine': ['cardingMachineQueries.js', 'deleteCardingMachine'],
  'drawing-breaker': ['drawingBreakerQueries.js', 'deleteDrawingBreakerMachine'],
  'comber-machine': ['comberMachineQueries.js', 'deleteComberMachine'],
  'drawing-finisher': ['drawingFinisherQueries.js', 'deleteDrawingFinisherMachine'],
  'lap-former': ['lapFormerQueries.js', 'deleteLapFormerMachine'],
  'simplex-machine': ['simplexMachineQueries.js', 'deleteSimplexMachine']
}

const softDeleteMasterPages = [
  'masters/department/page.jsx',
  'masters/supervisor/page.jsx',
  'masters/stoppage-head/page.jsx',
  'masters/stoppage-detail/page.jsx',
  'masters/spinning-count/page.jsx',
  'masters/spinning-machine/page.jsx',
  'masters/autoconer/page.jsx',
  'preparatory-master/carding-machine/page.jsx',
  'preparatory-master/comber/page.jsx',
  'preparatory-master/drawing-breaker/page.jsx',
  'preparatory-master/drawing-finisher/page.jsx',
  'preparatory-master/lap-former/page.jsx',
  'preparatory-master/simplex/page.jsx'
]

test('soft-deleted Master records are displayed last in red without an active status column', async () => {
  const records = [
    { id: 'deleted-first', is_active: false },
    { id: 'active-first', is_active: true },
    { id: 'unknown-status' },
    { id: 'deleted-second', is_active: false }
  ]

  assert.deepEqual(
    orderMasterRecords(records).map(record => record.id),
    ['active-first', 'unknown-status', 'deleted-first', 'deleted-second']
  )
  assert.equal(getMasterRecordRowClassName({ is_active: false }), '!bg-red-100 hover:!bg-red-200 text-red-700')
  assert.equal(getMasterRecordRowClassName({ is_active: true }), '!bg-white hover:!bg-yellow-100')
  assert.equal(getActiveMasterRecordCount(records), 2)

  for (const pagePath of softDeleteMasterPages) {
    const source = await readFile(new URL(`../src/app/${pagePath}`, import.meta.url), 'utf8')
    assert.match(source, /orderMasterRecords\(/, `${pagePath} must place deleted records last`)
    assert.match(source, /getRowClassName=\{getMasterRecordRowClassName\}/, `${pagePath} must render deleted records in red`)
  }

  const supervisorSource = await readFile(
    new URL('../src/app/masters/supervisor/page.jsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(supervisorSource, /role_status|Role Status|Active'\s*:\s*'Inactive/)
})

test('referenced Master deletion is authenticated, audited, and soft-only', async () => {
  for (const actionName of protectedDeleteActions) {
    const source = await readFile(new URL(`../src/app/actions/${actionName}.js`, import.meta.url), 'utf8')
    const deleteAction = source.match(/export async function delete[\s\S]*?\n}/)?.[0]

    assert.ok(deleteAction, `${actionName} must export a delete action`)
    assert.match(deleteAction, /await requireRole\('ADMIN'\)/, `${actionName} delete must require ADMIN`)
    assert.match(deleteAction, /masterUuidSchema\.parse\(id\)/, `${actionName} delete must validate its id`)
    assert.match(deleteAction, /executeAuditedMasterMutation\(/, `${actionName} delete must be audited`)
    assert.match(deleteAction, /action: 'DELETE'/, `${actionName} must record a DELETE audit event`)

    const [queryFile, functionName] = protectedDeleteQueries[actionName]
    const querySource = await readFile(new URL(`../src/lib/queries/${queryFile}`, import.meta.url), 'utf8')
    const queryBody = querySource.match(
      new RegExp(`export async function ${functionName}\\(id\\) \\{([\\s\\S]*?)\\n\\}`)
    )?.[1]
    assert.match(queryBody || '', /softDeleteMasterRecord\(/, `${functionName} must soft-delete`)
    assert.doesNotMatch(queryBody || '', /\.delete\(/, `${functionName} must not hard-delete`)
  }
})

test('soft delete is idempotent and retains the original machine removal date', async () => {
  const record = { id: 'machine-1', is_active: true, deactivated_at: null }
  let updateCount = 0
  const model = {
    async findUnique() {
      return { id: record.id, is_active: record.is_active }
    },
    async update({ data }) {
      updateCount += 1
      Object.assign(record, data)
      return { ...record }
    }
  }

  const deleted = await softDeleteMasterRecord(model, record.id, { trackRemovalDate: true })
  const removalTime = deleted.deactivated_at.getTime()
  const repeated = await softDeleteMasterRecord(model, record.id, { trackRemovalDate: true })

  assert.equal(deleted.is_active, false)
  assert.equal(repeated.is_active, false)
  assert.equal(record.deactivated_at.getTime(), removalTime)
  assert.equal(updateCount, 1)

  await assert.rejects(
    softDeleteMasterRecord({ findUnique: async () => null }, 'missing'),
    /Master record not found/
  )
})

test('every Master mutation requires the ADMIN role', async () => {
  for (const actionName of [
    ...protectedDeleteActions,
    'hok-strength',
    'tpi-entry',
    'twc-entry'
  ]) {
    const source = await readFile(new URL(`../src/app/actions/${actionName}.js`, import.meta.url), 'utf8')
    const mutations = [...source.matchAll(
      /export async function ((?:create|update|delete|activate)\w*Action)\([^)]*\) \{([\s\S]*?)(?=\n})/g
    )]

    assert.ok(mutations.length > 0, `${actionName} must expose at least one mutation`)
    for (const [, functionName, body] of mutations) {
      assert.match(body, /await requireRole\('ADMIN'\)/, `${functionName} must require ADMIN`)
    }
  }
})

test('allowed Master mutations emit operation-level audit events', async () => {
  for (const actionName of [
    ...protectedDeleteActions,
    'hok-strength',
    'tpi-entry',
    'twc-entry'
  ]) {
    const source = await readFile(new URL(`../src/app/actions/${actionName}.js`, import.meta.url), 'utf8')
    const allowedMutations = [...source.matchAll(
      /export async function ((?:create|update|delete|activate)\w*Action)\([^)]*\) \{([\s\S]*?)(?=\n})/g
    )]

    for (const [, functionName, body] of allowedMutations) {
      assert.match(
        body,
        /executeAuditedMasterMutation\(/,
        `${functionName} must create a mutation audit event`
      )
    }

  }
})

test('Master integrity reporting is read-only and exposed as an npm command', async () => {
  const reportSource = await readFile(
    new URL('../scripts/master-integrity-report.js', import.meta.url),
    'utf8'
  )
  const packageSource = await readFile(new URL('../package.json', import.meta.url), 'utf8')

  assert.match(reportSource, /mode: 'READ_ONLY'/)
  assert.doesNotMatch(
    reportSource,
    /prisma(?:\[[^\]]+\]|\.\w+)\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\(/
  )
  assert.match(packageSource, /"integrity:masters": "node scripts\/master-integrity-report\.js"/)
})

test('bulk action results preserve successful and failed items', async () => {
  const items = [{ id: 'ok' }, { id: 'returned-error' }, { id: 'thrown-error' }]
  const result = await runBulkActions(items, async (item) => {
    if (item.id === 'returned-error') return { success: false, error: 'Rejected by action' }
    if (item.id === 'thrown-error') throw new Error('Network failure')
    return { success: true, data: { updated: item.id } }
  })

  assert.deepEqual(result.succeeded.map(outcome => outcome.item.id), ['ok'])
  assert.deepEqual(result.failed.map(outcome => outcome.item.id), ['returned-error', 'thrown-error'])
  assert.deepEqual(result.failed.map(outcome => outcome.error), ['Rejected by action', 'Network failure'])
})

test('drawing breaker cleanup is limited to the legacy baseline inside a transaction', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/drawingBreakerQueries.js', import.meta.url),
    'utf8'
  )

  assert.match(source, /return prisma\.\$transaction\(async \(tx\) =>/)
  assert.match(source, /entry_date: new Date\('1970-01-01T00:00:00\.000Z'\)/)
  assert.match(source, /shift: 1/)
  assert.doesNotMatch(source, /deleteMany\(\{\s*where: \{ machine_id: (existing|created)\.id \}\s*\}\)/)
})

test('typed master search validates complete numeric and date values', () => {
  const dateWhere = buildTypedSearchWhere(
    'entry_date',
    'Equal',
    '2026-08-14',
    { entry_date: 'date' }
  )

  assert.equal(dateWhere.entry_date.toISOString(), '2026-08-14T00:00:00.000Z')
  assert.deepEqual(
    buildTypedSearchWhere('entry_id', 'Greater', '12', { entry_id: 'number' }),
    { entry_id: { gt: 12 } }
  )
  assert.throws(
    () => buildTypedSearchWhere('entry_date', 'Equal', '2026-02-30', { entry_date: 'date' }),
    /Invalid date/
  )
  assert.throws(
    () => buildTypedSearchWhere('entry_id', 'Equal', '12abc', { entry_id: 'number' }),
    /Invalid numeric/
  )
  assert.throws(
    () => buildTypedSearchWhere('unexpected', 'Equal', '1', { entry_id: 'number' }),
    /Unsupported search field/
  )
})

test('HOK payload validation rejects invalid dates, negatives and duplicate departments', () => {
  const departmentId = '11111111-1111-4111-8111-111111111111'
  const valid = hokEntrySchema.parse({
    date: '2026-08-14',
    hok_id: null,
    entries: [{ department_id: departmentId, shift1: 1.5, shift2: 0, shift3: 2 }]
  })

  assert.equal(valid.date.toISOString(), '2026-08-14T00:00:00.000Z')
  assert.throws(() => hokEntrySchema.parse({
    date: '2026-02-30',
    entries: [{ department_id: departmentId, shift1: 1, shift2: 0, shift3: 0 }]
  }))
  assert.throws(() => hokEntrySchema.parse({
    date: '2026-08-14',
    entries: [{ department_id: departmentId, shift1: -1, shift2: 0, shift3: 0 }]
  }))
  assert.throws(() => hokEntrySchema.parse({
    date: '2026-08-14',
    entries: [
      { department_id: departmentId, shift1: 1, shift2: 0, shift3: 0 },
      { department_id: departmentId, shift1: 2, shift2: 0, shift3: 0 }
    ]
  }))
})

test('all Master write actions validate payloads before database queries', async () => {
  for (const actionName of [
    'department', 'supervisor', 'stoppage-head', 'stoppage-detail',
    'spinning-count', 'spinning-machine', 'autoconer', 'carding-machine',
    'drawing-breaker', 'comber-machine', 'drawing-finisher', 'lap-former',
    'simplex-machine', 'hok-strength', 'tpi-entry', 'twc-entry'
  ]) {
    const source = await readFile(new URL(`../src/app/actions/${actionName}.js`, import.meta.url), 'utf8')
    const allowedMutations = [...source.matchAll(
      /export async function ((?:create|update)\w*Action)\([^)]*\) \{([\s\S]*?)(?=\n})/g
    )]
    for (const [, functionName, body] of allowedMutations) {
      assert.match(body, /Schema\.parse\(/, `${functionName} must parse a server schema`)
    }
  }
})

test('Master schemas allow lifecycle-only updates and reject unsafe input', () => {
  assert.deepEqual(cardingMachineUpdateSchema.parse({ is_active: false }), { is_active: false })
  assert.deepEqual(comberMachineUpdateSchema.parse({ is_active: false }), { is_active: false })
  assert.deepEqual(
    departmentCreateSchema.parse({ dept_name: 'Valid', hok: 0.2 }),
    { dept_name: 'Valid', hok: 0.2 }
  )
  assert.throws(() => departmentCreateSchema.parse({
    code: 1, dept_name: 'A', sl_no: 1, hok: 0.2
  }))
  assert.throws(() => departmentCreateSchema.parse({
    code: 1, dept_name: 'Valid', sl_no: 1, hok: 0.2, injected: true
  }))
  assert.throws(() => autoconerMachineCreateSchema.parse({
    machine_no: 'AC1-1', description: 'AC1-1', make_name: 'MURT',
    from_drum: 20, to_drum: 10
  }), /To drum/)
  assert.throws(() => tpiEntryCreateSchema.parse({
    entry_date: '2026-02-30',
    spinning_count_id: '11111111-1111-4111-8111-111111111111',
    tpi_value: 10
  }))
})

test('Department identity and display sequence are system-owned and database-guarded', async () => {
  const [gridSource, formSource, querySource, schemaSource, migrationSource, integritySource] = await Promise.all([
    readFile(new URL('../src/components/common/DataGrid.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/modules/masters/DepartmentForm.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/queries/queries.js', import.meta.url), 'utf8'),
    readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'),
    readFile(new URL('../prisma/migrations/20260829_department_generated_identity/migration.sql', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/master-integrity-report.js', import.meta.url), 'utf8')
  ])

  assert.match(gridSource, /getRowId\?\.\(row, index\) \?\? row\.id \?\? index/)
  assert.doesNotMatch(gridSource, /key=\{row\.code/)
  assert.doesNotMatch(formSource, /register\(['"](?:code|sl_no)['"]\)/)
  assert.match(formSource, /assigned automatically/)

  assert.match(querySource, /isolationLevel: 'Serializable'/)
  assert.match(querySource, /const nextSequence = Math\.max/)
  assert.match(querySource, /code: nextSequence/)
  assert.match(querySource, /sl_no: nextSequence/)
  assert.doesNotMatch(querySource, /code: departmentData\.code|sl_no: departmentData\.sl_no/)

  assert.match(schemaSource, /sl_no\s+Int\s+@unique\(map: "uq_departments_sl_no"\)/)
  assert.match(schemaSource, /code\s+Int\s+@unique\(map: "uq_departments_code"\)/)
  assert.match(migrationSource, /UPDATE `departments`/)
  assert.match(migrationSource, /ADD UNIQUE KEY `uq_departments_code`/)
  assert.match(migrationSource, /ADD UNIQUE KEY `uq_departments_sl_no`/)
  assert.match(integritySource, /duplicateDepartmentCodes/)
  assert.match(integritySource, /duplicateDepartmentSerials/)
  assert.match(integritySource, /missingMasterIdentityIndexes/)
})

test('Comber uses the shared soft-delete path without exposing restore details in the UI', async () => {
  const [pageSource, querySource] = await Promise.all([
    readFile(new URL('../src/app/preparatory-master/comber/page.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/queries/comberMachineQueries.js', import.meta.url), 'utf8')
  ])

  assert.match(pageSource, /deleteComberMachineAction\(/)
  assert.match(pageSource, /await confirmAction\('delete'\)/)
  assert.doesNotMatch(pageSource, /This is a soft delete|Existing entry snapshots/)
  assert.doesNotMatch(pageSource, /handleActivate/)
  assert.match(querySource, /softDeleteMasterRecord\(prisma\.comber_machines/)
  assert.match(querySource, /hasField\('sliver_hank'\) && \{ sliver_hank: machineData\.sliver_hank \}/)
})

test('Simplex form maps count name without leaking UI fields into strict Master validation', async () => {
  const [formSource, querySource] = await Promise.all([
    readFile(new URL('../src/components/modules/preparatory-master/SimplexMachineForm.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/queries/simplexMachineQueries.js', import.meta.url), 'utf8')
  ])

  assert.match(formSource, /const \{ count_name, \.\.\.formValues \} = data/)
  assert.match(formSource, /prodn_mixing: count_name \|\| null/)
  assert.doesNotMatch(formSource, /const cleanedData = \{\s*\.\.\.data,/)
  assert.match(querySource, /const shouldUpdateTpi = hasField\('tpi'\) \|\| hasField\('count_tpi'\)/)
  assert.match(querySource, /shouldUpdateTpi && \{ tpi: effectiveTpi \}/)
})

test('machine lifecycle boundaries consistently exclude the deactivation date', async () => {
  const queryFiles = [
    'autoconerEntryQueries.js', 'breakerDrawingQueries.js', 'cardingEntryQueries.js',
    'comberEntryQueries.js', 'finisherDrawingEntryQueries.js', 'lapFormerQueries.js',
    'simplexEntryQueries.js', 'spinningEntryQueries.js'
  ]
  for (const fileName of queryFiles) {
    const source = await readFile(new URL(`../src/lib/queries/${fileName}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /deactivated_at:\s*\{\s*gte:/, fileName)
    assert.doesNotMatch(source, /activated_at:\s*\{\s*lte:/, fileName)
  }
})

test('machine masters expose neither entry removal nor a restore action', async () => {
  const pageFiles = [
    '../src/app/masters/autoconer/page.jsx',
    '../src/app/masters/spinning-machine/page.jsx',
    '../src/app/preparatory-master/carding-machine/page.jsx',
    '../src/app/preparatory-master/comber/page.jsx',
    '../src/app/preparatory-master/drawing-breaker/page.jsx',
    '../src/app/preparatory-master/drawing-finisher/page.jsx',
    '../src/app/preparatory-master/lap-former/page.jsx',
    '../src/app/preparatory-master/simplex/page.jsx'
  ]
  for (const pageFile of pageFiles) {
    const source = await readFile(new URL(pageFile, import.meta.url), 'utf8')
    assert.match(source, /onSecondaryAction=\{null\}/, pageFile)
    assert.match(source, /style=\{\{ display: 'none' \}\}/, pageFile)
    assert.doesNotMatch(source, /handleActivate|secondaryActionLabel=.*Activate/, pageFile)
  }

  const [actionSource, querySource] = await Promise.all([
    readFile(new URL('../src/app/actions/spinning-machine.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/queries/spinningMachineQueries.js', import.meta.url), 'utf8')
  ])
  assert.doesNotMatch(actionSource, /activateSpinningMachineAction/)
  assert.doesNotMatch(querySource, /activateSpinningMachine/)
})

test('all referenced Master pages expose concise working delete controls', async () => {
  const pagePaths = [
    'masters/department', 'masters/supervisor', 'masters/stoppage-head',
    'masters/stoppage-detail', 'masters/spinning-count', 'masters/spinning-machine',
    'masters/autoconer', 'preparatory-master/carding-machine',
    'preparatory-master/comber', 'preparatory-master/drawing-breaker',
    'preparatory-master/drawing-finisher', 'preparatory-master/lap-former',
    'preparatory-master/simplex'
  ]

  for (const pagePath of pagePaths) {
    const source = await readFile(new URL(`../src/app/${pagePath}/page.jsx`, import.meta.url), 'utf8')
    assert.match(source, /const handleDelete = async/, pagePath)
    assert.match(source, /onClick=\{handleDelete\}/, pagePath)
    assert.match(source, /if \(!\(await confirmAction\('delete'\)\)\) return/, pagePath)
    assert.doesNotMatch(source, /This is a soft delete|Existing .*retain|snapshots? remain/i, pagePath)
    assert.doesNotMatch(source, /MASTER_DELETE_DISABLED_MESSAGE|disabledMasterDeleteResult/, pagePath)
  }
})

test('Master counters include active records only and calculator omits keyboard instructions', async () => {
  const countedPages = [
    'masters/department/page.jsx',
    'masters/supervisor/page.jsx',
    'masters/spinning-count/page.jsx',
    'masters/spinning-machine/page.jsx',
    'masters/autoconer/page.jsx',
    'preparatory-master/carding-machine/page.jsx',
    'preparatory-master/comber/page.jsx',
    'preparatory-master/drawing-breaker/page.jsx',
    'preparatory-master/drawing-finisher/page.jsx',
    'preparatory-master/lap-former/page.jsx',
    'preparatory-master/simplex/page.jsx'
  ]

  for (const pagePath of countedPages) {
    const source = await readFile(new URL(`../src/app/${pagePath}`, import.meta.url), 'utf8')
    assert.match(source, /getActiveMasterRecordCount\(/, `${pagePath} must count active records only`)
  }

  const calculatorSource = await readFile(
    new URL('../src/components/common/ProductionCalculator.jsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(calculatorSource, /Keyboard input is ready|Enter = calculate|Esc = close|\( \) = grouping/)
})

test('Master pages expose write controls only to administrators', async () => {
  const pagePaths = [
    'masters/autoconer', 'masters/department', 'masters/hok-strength',
    'masters/spinning-count', 'masters/spinning-machine', 'masters/stoppage-detail',
    'masters/stoppage-head', 'masters/supervisor', 'masters/tpi-entry',
    'masters/twc-entry', 'preparatory-master/carding-machine',
    'preparatory-master/comber', 'preparatory-master/drawing-breaker',
    'preparatory-master/drawing-finisher', 'preparatory-master/lap-former',
    'preparatory-master/simplex'
  ]
  for (const pagePath of pagePaths) {
    const source = await readFile(new URL(`../src/app/${pagePath}/page.jsx`, import.meta.url), 'utf8')
    assert.match(source, /useAuthUser\(\)/, pagePath)
    assert.match(source, /canManageMasters \? "flex flex-wrap gap-2" : "hidden"/, pagePath)
  }
})

test('duplicate repair is guarded, reversible and defaults to dry-run', async () => {
  const source = await readFile(
    new URL('../scripts/repair-master-duplicates.js', import.meta.url),
    'utf8'
  )
  assert.match(source, /process\.argv\.includes\('--apply'\)/)
  assert.match(source, /duplicateRefs\.total === 0/)
  assert.match(source, /canonicalRefs\.total > 0/)
  assert.match(source, /prisma\.\$transaction/)
  assert.match(source, /MASTER_MAINTENANCE/)
})

test('orphan cleanup and referential guards are deployment-safe', async () => {
  const [cleanupSource, migrationSource, packageSource] = await Promise.all([
    readFile(new URL('../scripts/repair-master-orphans.js', import.meta.url), 'utf8'),
    readFile(
      new URL('../prisma/migrations/20260814_master_referential_integrity/migration.sql', import.meta.url),
      'utf8'
    ),
    readFile(new URL('../package.json', import.meta.url), 'utf8')
  ])

  assert.match(cleanupSource, /process\.argv\.includes\('--apply'\)/)
  assert.match(cleanupSource, /--database=/)
  assert.match(cleanupSource, /Database confirmation mismatch/)
  assert.match(cleanupSource, /prisma\.\$transaction/)
  assert.match(cleanupSource, /REMOVE_LEGACY_ORPHANS/)
  assert.doesNotMatch(cleanupSource, /\$(?:queryRawUnsafe|executeRawUnsafe)/)
  assert.equal((migrationSource.match(/ADD CONSTRAINT `fk_/g) || []).length, 88)
  assert.match(migrationSource, /fk_hok_detail_department/)
  assert.match(packageSource, /"integrity:masters:check"/)
  assert.match(packageSource, /"repair:master-orphans"/)
})

test('HOK replacement and deletion keep header and details in transactions', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/hokStrengthQueries.js', import.meta.url),
    'utf8'
  )

  assert.match(source, /return runHOKTransaction\(async \(tx\) =>/)
  assert.match(source, /await tx\.hok_strength_detail\.deleteMany/)
  assert.match(source, /await tx\.hok_strength_head\.delete/)
  assert.match(source, /isolationLevel: 'Serializable'/)
})
