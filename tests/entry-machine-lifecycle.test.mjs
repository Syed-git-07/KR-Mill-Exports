import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  assertLifecycleCanStart,
  deactivateEntryMachines,
  normalizeEntryMachineContext,
  resolveEntryMachineContext,
  validateInstalledDateForActivation
} from '../src/lib/queries/entryMachineLifecycle.js'

const entryDate = new Date('2026-08-09T00:00:00.000Z')

test('entry machine context requires an exact date, shift, and header', () => {
  const context = normalizeEntryMachineContext({
    headerId: 'header-1',
    entryDate: '2026-08-09',
    shift: '2'
  })

  assert.equal(context.headerId, 'header-1')
  assert.equal(context.entryDate.toISOString(), '2026-08-09T00:00:00.000Z')
  assert.equal(context.shift, 2)
  assert.throws(
    () => normalizeEntryMachineContext({ headerId: 'header-1', entryDate: '2026-02-30', shift: 1 }),
    /real calendar date/
  )
})

test('header context rejects stale routing data and locked entries', async () => {
  const baseHeader = {
    id: 'header-1',
    entry_date: entryDate,
    shift: 1,
    total_time: 510,
    is_locked: false
  }
  const headerModel = { findUnique: async () => baseHeader }

  const resolved = await resolveEntryMachineContext({
    headerModel,
    context: { headerId: 'header-1', entryDate: '2026-08-09', shift: 1 },
    label: 'Test entry'
  })
  assert.equal(resolved.totalTime, 510)

  await assert.rejects(
    resolveEntryMachineContext({
      headerModel,
      context: { headerId: 'header-1', entryDate: '2026-08-10', shift: 1 },
      label: 'Test entry'
    }),
    /date or shift changed/
  )
  await assert.rejects(
    resolveEntryMachineContext({
      headerModel: { findUnique: async () => ({ ...baseHeader, is_locked: true }) },
      context: { headerId: 'header-1', entryDate: '2026-08-09', shift: 1 },
      label: 'Test entry'
    }),
    /locked/
  )
})

test('reusing an inactive machine number starts a new non-overlapping lifecycle', () => {
  const historical = [{
    id: 'old-id',
    is_active: false,
    activated_at: new Date('2026-01-01T00:00:00.000Z'),
    deactivated_at: new Date('2026-08-01T00:00:00.000Z')
  }]
  assert.equal(assertLifecycleCanStart(historical, entryDate, 'M1'), true)
  assert.equal(historical[0].id, 'old-id')

  assert.throws(
    () => assertLifecycleCanStart([{ ...historical[0], is_active: true }], entryDate, 'M1'),
    /already exists and is active/
  )
  assert.throws(
    () => assertLifecycleCanStart([
      { ...historical[0], deactivated_at: new Date('2026-08-10T00:00:00.000Z') }
    ], entryDate, 'M1'),
    /another lifecycle/
  )
})

test('installed date cannot follow the selected activation date', () => {
  assert.equal(
    validateInstalledDateForActivation('2026-08-01', entryDate).toISOString(),
    '2026-08-01T00:00:00.000Z'
  )
  assert.throws(
    () => validateInstalledDateForActivation('2026-08-10', entryDate),
    /cannot be after/
  )
})

test('bulk deactivation is atomic at the selected entry date and never deletes snapshots', async () => {
  let updateCall
  const machineModel = {
    findMany: async () => [
      { id: 'm1', is_active: true, activated_at: new Date('2026-01-01T00:00:00.000Z'), deactivated_at: null },
      { id: 'm2', is_active: true, activated_at: new Date('2026-02-01T00:00:00.000Z'), deactivated_at: null }
    ],
    updateMany: async args => {
      updateCall = args
      return { count: 2 }
    }
  }
  const result = await deactivateEntryMachines({
    headerModel: {
      findUnique: async () => ({
        id: 'header-1',
        entry_date: entryDate,
        shift: 1,
        total_time: 510,
        is_locked: false
      })
    },
    machineModel,
    machineIds: ['m1', 'm2'],
    context: { headerId: 'header-1', entryDate: '2026-08-09', shift: 1 },
    label: 'Test entry'
  })

  assert.equal(result.count, 2)
  assert.equal(updateCall.data.is_active, false)
  assert.equal(updateCall.data.deactivated_at.toISOString(), entryDate.toISOString())
  assert.deepEqual(updateCall.where.id.in, ['m1', 'm2'])
  assert.equal('deleteMany' in machineModel, false)
})

test('all five preparatory entry lifecycle queries persist exact setup context', async () => {
  const files = [
    'breakerDrawingQueries.js',
    'comberEntryQueries.js',
    'finisherDrawingEntryQueries.js',
    'lapFormerQueries.js',
    'simplexEntryQueries.js'
  ]

  for (const file of files) {
    const source = await readFile(new URL(`../src/lib/queries/${file}`, import.meta.url), 'utf8')
    assert.match(source, /resolveEntryMachineContext/)
    assert.match(source, /activated_at:\s*context\.entryDate/)
    assert.match(source, /entry_date:\s*context\.entryDate/)
    assert.match(source, /shift:\s*context\.shift/)
    assert.match(source, /deactivateEntryMachines/)
  }
})
