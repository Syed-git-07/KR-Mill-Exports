import test from 'node:test'
import assert from 'node:assert/strict'
import { getOrCreateDateScopedSetups } from '../src/lib/queries/dateScopedMachineSetup.js'

const targetDate = new Date('2026-08-15T00:00:00.000Z')

function setupHarness(initialRows = [], previousHeader = null) {
  let rows = [...initialRows]
  const setupModel = {
    async findMany({ where } = {}) {
      return rows.filter(row =>
        (!where?.entry_date || row.entry_date?.getTime() === where.entry_date.getTime()) &&
        (!where?.shift || row.shift === where.shift) &&
        (!where?.machine_id?.in || where.machine_id.in.includes(row.machine_id)) &&
        (where?.is_included === undefined || row.is_included === where.is_included)
      )
    },
    async createMany({ data }) {
      rows = [...rows, ...data]
      return { count: data.length }
    }
  }
  const headerModel = {
    async findUnique() {
      return { entry_date: targetDate, shift: 1, total_time: 480 }
    },
    async findFirst() {
      return Array.isArray(previousHeader) ? previousHeader[0] || null : previousHeader
    },
    async findMany() {
      if (!previousHeader) return []
      return Array.isArray(previousHeader) ? previousHeader : [previousHeader]
    }
  }
  return { setupModel, headerModel, rows: () => rows }
}

test('a new entry copies one exact previous entry instead of combining per-machine history', async () => {
  const previousDate = new Date('2026-08-14T00:00:00.000Z')
  const harness = setupHarness([
    {
      machine_id: 'machine-old', entry_date: new Date('2026-08-13T00:00:00.000Z'),
      shift: 1, is_included: true, prodn_mixing: 'OLD COUNT', speed: 80
    },
    {
      machine_id: 'machine-current', entry_date: previousDate,
      shift: 1, is_included: true, prodn_mixing: 'ENTRY COUNT', speed: 90
    }
  ], { entry_date: previousDate, shift: 1 })

  const setups = await getOrCreateDateScopedSetups({
    setupModel: harness.setupModel,
    headerModel: harness.headerModel,
    headerId: 'header-1',
    machineIds: ['machine-old', 'machine-current'],
    machineSetupOverridesMap: { 'machine-current': { speed: 120 } }
  })

  assert.equal(setups.length, 1)
  assert.equal(setups[0].machine_id, 'machine-current')
  assert.equal(setups[0].prodn_mixing, 'ENTRY COUNT')
  assert.equal(setups[0].speed, 120)
})

test('entry removal is inherited and retained as an exclusion marker', async () => {
  const previousDate = new Date('2026-08-14T00:00:00.000Z')
  const removed = {
    machine_id: 'machine-1', entry_date: previousDate,
    shift: 1, is_included: false, speed: 90, shift_time: 510
  }
  const harness = setupHarness([removed], { entry_date: previousDate, shift: 1 })
  const setups = await getOrCreateDateScopedSetups({
    setupModel: harness.setupModel, headerModel: harness.headerModel,
    headerId: 'header-1', machineIds: ['machine-1']
  })

  assert.deepEqual(setups, [])
  const targetMarker = harness.rows().find(row => row.entry_date.getTime() === targetDate.getTime())
  assert.equal(targetMarker?.is_included, false)
})

test('a master-only machine is not enrolled when a previous entry exists', async () => {
  const previousDate = new Date('2026-08-14T00:00:00.000Z')
  const prior = {
    machine_id: 'machine-1', entry_date: previousDate,
    shift: 1, is_included: true, speed: 90
  }
  const harness = setupHarness([prior], { entry_date: previousDate, shift: 1 })
  const setups = await getOrCreateDateScopedSetups({
    setupModel: harness.setupModel,
    headerModel: harness.headerModel,
    headerId: 'header-1',
    machineIds: ['machine-1', 'machine-2'],
    newMachineSetupDefaultsMap: { 'machine-2': { speed: 120 } }
  })

  assert.deepEqual(setups.map(row => row.machine_id), ['machine-1'])
  assert.equal(harness.rows().some(row => row.machine_id === 'machine-2'), false)
})

test('the first-ever entry seeds legacy master machines that lack baseline setup rows', async () => {
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

  assert.equal(setups.length, 1)
  assert.equal(setups[0].machine_id, 'machine-1')
  assert.equal(setups[0].speed, 120)
})

test('an existing entry snapshot is never backfilled from Master or a prior entry', async () => {
  const existing = {
    machine_id: 'machine-1', entry_date: targetDate,
    shift: 1, is_included: true, speed: 90
  }
  const harness = setupHarness([existing], {
    entry_date: new Date('2026-08-14T00:00:00.000Z'), shift: 1
  })
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

test('an interrupted empty header is skipped when resolving the previous format', async () => {
  const emptyDate = new Date('2026-08-14T00:00:00.000Z')
  const validDate = new Date('2026-08-13T00:00:00.000Z')
  const harness = setupHarness([{
    machine_id: 'machine-1', entry_date: validDate,
    shift: 3, is_included: true, prodn_mixing: 'VALID COUNT'
  }], [
    { entry_date: emptyDate, shift: 1 },
    { entry_date: validDate, shift: 3 }
  ])

  const setups = await getOrCreateDateScopedSetups({
    setupModel: harness.setupModel,
    headerModel: harness.headerModel,
    headerId: 'header-1',
    machineIds: ['machine-1']
  })

  assert.equal(setups.length, 1)
  assert.equal(setups[0].prodn_mixing, 'VALID COUNT')
})
