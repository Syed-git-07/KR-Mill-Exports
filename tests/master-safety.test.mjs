import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { runBulkActions } from '../src/lib/actionResults.js'
import {
  disabledMasterDeleteResult,
  MASTER_DELETE_DISABLED_MESSAGE
} from '../src/lib/masterSafety.js'
import { buildTypedSearchWhere } from '../src/lib/masterSearch.js'
import {
  autoconerMachineCreateSchema,
  cardingMachineUpdateSchema,
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

test('referenced master deletion is blocked after authentication', async () => {
  for (const actionName of protectedDeleteActions) {
    const source = await readFile(new URL(`../src/app/actions/${actionName}.js`, import.meta.url), 'utf8')
    const deleteAction = source.match(/export async function delete[\s\S]*?\n}/)?.[0]

    assert.ok(deleteAction, `${actionName} must export a delete action`)
    assert.match(deleteAction, /await requireRole\('ADMIN'\)/, `${actionName} delete must require ADMIN`)
    assert.match(deleteAction, /disabledMasterDeleteResult\(\)/, `${actionName} delete must be blocked`)
  }

  assert.throws(
    () => disabledMasterDeleteResult(),
    error => error.message === MASTER_DELETE_DISABLED_MESSAGE
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
      /export async function ((?:create|update|activate)\w*Action)\([^)]*\) \{([\s\S]*?)(?=\n})/g
    )]

    for (const [, functionName, body] of allowedMutations) {
      assert.match(
        body,
        /executeAuditedMasterMutation\(/,
        `${functionName} must create a mutation audit event`
      )
    }

    if (['hok-strength', 'tpi-entry', 'twc-entry'].includes(actionName)) {
      const deleteBody = source.match(
        /export async function delete\w*Action\([^)]*\) \{([\s\S]*?)(?=\n})/
      )?.[1]
      assert.match(deleteBody || '', /executeAuditedMasterMutation\(/)
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

test('machine lifecycle boundaries consistently exclude the deactivation date', async () => {
  const queryFiles = [
    'autoconerEntryQueries.js', 'breakerDrawingQueries.js', 'cardingEntryQueries.js',
    'comberEntryQueries.js', 'finisherDrawingEntryQueries.js', 'lapFormerQueries.js',
    'simplexEntryQueries.js', 'spinningEntryQueries.js'
  ]
  for (const fileName of queryFiles) {
    const source = await readFile(new URL(`../src/lib/queries/${fileName}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /deactivated_at:\s*\{\s*gte:/, fileName)
  }
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
