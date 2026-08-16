import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPermanentRemoval,
  assertMachineCannotBeRestored,
  machineAvailableOnDateWhere,
  machineLookupWhere,
  machineRemovalDate
} from '../src/lib/machineLifecycle.js'

test('machine removal is normalized to the same calendar date', () => {
  assert.equal(machineRemovalDate('2026-08-15T17:45:12Z').toISOString(), '2026-08-15T00:00:00.000Z')
  assert.equal(machineRemovalDate('2026-08-14T22:00:00Z').toISOString(), '2026-08-15T00:00:00.000Z')
})

test('entry lookup accepts an exact machine number or floor name and remains date scoped', () => {
  const where = machineLookupWhere('FT1', '2026-08-15')
  assert.ok(where.OR.some(clause => clause.machine_no?.equals === 'FT1'))
  assert.ok(where.OR.some(clause => clause.description?.equals === 'FT1'))
  assert.ok(where.OR.some(clause => clause.active_machine_no?.equals === 'FT1'))
  assert.deepEqual(where.AND, machineAvailableOnDateWhere('2026-08-15').AND)
})

test('entry eligibility starts at installed date and excludes removal date', () => {
  const date = new Date('2026-08-15T13:30:00Z')
  assert.deepEqual(machineAvailableOnDateWhere(date), {
    AND: [
      { OR: [{ installed_date: null }, { installed_date: { lte: new Date('2026-08-15T00:00:00.000Z') } }] },
      { OR: [{ deactivated_at: null }, { deactivated_at: { gt: new Date('2026-08-15T00:00:00.000Z') } }] }
    ]
  })
})

test('removed machines cannot be restored and removal is permanent', () => {
  assert.throws(
    () => assertMachineCannotBeRestored({ is_active: false }, { is_active: true }),
    /cannot be restored/
  )
  const removal = applyPermanentRemoval(
    { is_active: true },
    { is_active: false },
    new Date('2026-08-15T18:00:00Z')
  )
  assert.equal(removal.is_active, false)
  assert.equal(removal.deactivated_at.toISOString(), '2026-08-15T00:00:00.000Z')
})
