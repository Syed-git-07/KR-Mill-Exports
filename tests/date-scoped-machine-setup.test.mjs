import test from 'node:test'
import assert from 'node:assert/strict'
import { getOrCreateDateScopedSetups } from '../src/lib/queries/dateScopedMachineSetup.js'

function setupHarness(initialRows = []) {
  let rows = [...initialRows]
  const setupModel = {
    async findMany({ where } = {}) {
      return rows.filter(row =>
        (!where?.entry_date || row.entry_date?.getTime() === where.entry_date.getTime()) &&
        (!where?.shift || row.shift === where.shift) &&
        (where?.is_included === undefined || row.is_included === where.is_included)
      )
    },
    async findFirst({ where }) {
      return rows.find(row => row.machine_id === where.machine_id) || null
    },
    async createMany({ data }) {
      rows = [...rows, ...data]
      return { count: data.length }
    }
  }
  const headerModel = {
    async findUnique() {
      return { entry_date: new Date('2026-08-15T00:00:00.000Z'), shift: 1, total_time: 480 }
    }
  }
  return { setupModel, headerModel, rows: () => rows }
}

test('a new master machine stays out of entries until explicitly enrolled', async () => {
  const harness = setupHarness()
  const setups = await getOrCreateDateScopedSetups({
    setupModel: harness.setupModel,
    headerModel: harness.headerModel,
    headerId: 'header-1',
    machineIds: ['machine-1'],
    machineSetupOverridesMap: { 'machine-1': { speed: 120 } },
    newMachineSetupDefaultsMap: {
      'machine-1': { speed: 90, shift_time: 510, std_prodn: 100, hank_constant: 0.14 }
    }
  })

  assert.deepEqual(setups, [])
  assert.deepEqual(harness.rows(), [])
})

test('entry removal is inherited by newly initialized entries', async () => {
  const removed = {
    machine_id: 'machine-1', entry_date: new Date('2026-08-14T00:00:00.000Z'),
    shift: 1, is_included: false, speed: 90, shift_time: 510
  }
  const harness = setupHarness([removed])
  const setups = await getOrCreateDateScopedSetups({
    setupModel: harness.setupModel, headerModel: harness.headerModel,
    headerId: 'header-1', machineIds: ['machine-1']
  })
  assert.deepEqual(setups, [])
  assert.equal(harness.rows().at(-1).is_included, false)
})

test('an existing entry is not backfilled with a later master-only machine', async () => {
  const existing = {
    machine_id: 'machine-1', entry_date: new Date('2026-08-15T00:00:00.000Z'),
    shift: 1, is_included: true, speed: 90
  }
  const harness = setupHarness([existing])
  const setups = await getOrCreateDateScopedSetups({
    setupModel: harness.setupModel,
    headerModel: harness.headerModel,
    headerId: 'header-1',
    machineIds: ['machine-1', 'machine-2'],
    newMachineSetupDefaultsMap: { 'machine-2': { speed: 120 } }
  })

  assert.deepEqual(setups, [existing])
  assert.equal(harness.rows().length, 1)
})
