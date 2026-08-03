import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const importSourceModule = async (relativePath) => import(new URL(relativePath, import.meta.url))

const {
  buildAutoconerMachineVisibilityWhere,
  getAutoconerEntryDateWindow,
  isAutoconerMachineVisibleOnDate
} = await importSourceModule('../src/lib/autoconerMachineLifecycle.js')

test('Autoconer lifecycle visibility preserves date snapshots', () => {
  const entryDate = new Date('2026-08-03T00:00:00.000Z')

  assert.equal(isAutoconerMachineVisibleOnDate({
    is_active: true,
    activated_at: new Date('2026-08-03T16:30:00.000Z'),
    deactivated_at: null
  }, entryDate), true, 'same-day activation belongs to the entry snapshot')

  assert.equal(isAutoconerMachineVisibleOnDate({
    is_active: false,
    activated_at: new Date('2026-07-01T00:00:00.000Z'),
    deactivated_at: new Date('2026-08-04T00:00:00.000Z')
  }, entryDate), true, 'deactivated machines remain visible on earlier historical dates')

  assert.equal(isAutoconerMachineVisibleOnDate({
    is_active: false,
    activated_at: new Date('2026-07-01T00:00:00.000Z'),
    deactivated_at: new Date('2026-08-03T00:00:00.000Z')
  }, entryDate), false, 'deactivation is effective from its entry date')

  assert.equal(isAutoconerMachineVisibleOnDate({
    is_active: true,
    activated_at: new Date('2026-08-04T00:00:00.000Z'),
    deactivated_at: null
  }, entryDate), false, 'future machines are not backfilled into older snapshots')

  const window = getAutoconerEntryDateWindow(entryDate)
  assert.equal(window.start.toISOString(), '2026-08-03T00:00:00.000Z')
  assert.equal(window.end.toISOString(), '2026-08-04T00:00:00.000Z')
  assert.deepEqual(buildAutoconerMachineVisibilityWhere(entryDate).AND[0].OR[1], {
    activated_at: { lt: window.end }
  })
})

test('Autoconer header sync is additive, idempotent, and atomic', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/autoconerEntryQueries.js', import.meta.url),
    'utf8'
  )
  const syncStart = source.indexOf('export async function syncNewMachinesToAutoconerHeader')
  const syncEnd = source.indexOf('// Get production details for a header', syncStart)
  assert.ok(syncStart >= 0 && syncEnd > syncStart)
  const syncSource = source.slice(syncStart, syncEnd)

  assert.doesNotMatch(syncSource, /deleteMany\(/, 'loading an entry must never delete historical rows')
  assert.match(syncSource, /new Set\(existingDetails\.map/, 'existing machine rows must be preserved')
  assert.match(syncSource, /buildAutoconerMachineVisibilityWhere\(entryDate\)/)
  assert.match(syncSource, /prisma\.\$transaction\(async tx =>/)
  assert.match(syncSource, /tx\.autoconer_production_detail\.createMany/)
  assert.match(syncSource, /tx\.autoconer_stoppage_entry\.createMany/)
  assert.match(syncSource, /skipDuplicates: true/g)
  assert.match(syncSource, /Repair any legacy\/partially initialized visible detail/)
})

test('Autoconer setup snapshots add missing visible machines transactionally', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/autoconerEntryQueries.js', import.meta.url),
    'utf8'
  )
  const helperStart = source.indexOf('async function synchronizeAutoconerMachineSetupSnapshots')
  const helperEnd = source.indexOf('export async function getOrCreateAutoconerMachineSetups', helperStart)
  const helperSource = source.slice(helperStart, helperEnd)

  assert.ok(helperStart >= 0 && helperEnd > helperStart)
  assert.match(helperSource, /prisma\.\$transaction\(async tx =>/)
  assert.match(helperSource, /missingMachines = visibleMachines\.filter/)
  assert.match(helperSource, /previousByMachine/)
  assert.match(helperSource, /tx\.autoconer_machine_setup\.createMany/)
  assert.match(helperSource, /skipDuplicates: true/)
  assert.match(helperSource, /defaultCountMaster/, 'missing machine counts must fall back to an active count master')

  const addStart = source.indexOf('export async function addAutoconerMachine')
  const addEnd = source.indexOf('// Remove/deactivate autoconer machine', addStart)
  const addSource = source.slice(addStart, addEnd)
  assert.match(addSource, /const activationDate = getAutoconerEntryDateWindow/)
  assert.match(addSource, /prisma\.\$transaction\(async tx =>/)
  assert.match(addSource, /A new lifecycle row preserves the prior machine/)
  assert.match(addSource, /where: \{ entry_date: \{ gte: activationDate \} \}/)
})

test('Autoconer Master reactivation creates a new lifecycle row', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/autoconerQueries.js', import.meta.url),
    'utf8'
  )
  const createStart = source.indexOf('export async function createAutoconerMachine')
  const createEnd = source.indexOf('// Helper function to add machine', createStart)
  const createSource = source.slice(createStart, createEnd)

  assert.ok(createStart >= 0 && createEnd > createStart)
  assert.match(createSource, /completed lifecycle snapshot referenced by past/)
  assert.match(createSource, /transaction\.autoconer_machines\.create/)
  assert.doesNotMatch(
    createSource,
    /where:\s*\{\s*id:\s*duplicates\[0\]\.id\s*\}/,
    'reactivation must not rewrite the historical machine row'
  )
})
