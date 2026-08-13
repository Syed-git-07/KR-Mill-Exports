import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const importSourceModule = async (relativePath) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const {
  SPINNING_OPTION_CHECK_ERROR_CODE,
  normalizeSpinningEntryContext,
  validateSpinningOptionCheckSource
} = await importSourceModule('../src/lib/spinningOptionCheck.js')
const {
  getOccupiedDateKeys,
  normalizeCalendarShift
} = await importSourceModule('../src/lib/dateShiftCalendar.js')

test('option check accepts the latest slot from the prior date', () => {
  const result = validateSpinningOptionCheckSource({
    targetDate: '2026-08-23',
    targetShift: 1,
    sourceDate: '2026-08-22',
    sourceShift: 3
  })

  assert.equal(result.source.dateKey, '2026-08-22')
  assert.equal(result.source.shift, 3)
})

test('option check accepts an earlier shift on the current date', () => {
  const result = validateSpinningOptionCheckSource({
    targetDate: '2026-08-23',
    targetShift: 3,
    sourceDate: '2026-08-23',
    sourceShift: 1
  })

  assert.equal(result.source.shift, 1)
})

test('option check rejects the current or a future entry as its source', () => {
  assert.throws(
    () => validateSpinningOptionCheckSource({
      targetDate: '2026-08-23',
      targetShift: 2,
      sourceDate: '2026-08-23',
      sourceShift: 2
    }),
    error => error.code === SPINNING_OPTION_CHECK_ERROR_CODE && /earlier date and shift/.test(error.message)
  )

  assert.throws(
    () => validateSpinningOptionCheckSource({
      targetDate: '2026-08-23',
      targetShift: 2,
      sourceDate: '2026-08-24',
      sourceShift: 1
    }),
    error => error.code === SPINNING_OPTION_CHECK_ERROR_CODE
  )
})

test('entry context validation rejects impossible dates and shifts', () => {
  assert.throws(
    () => normalizeSpinningEntryContext('2026-02-30', 1, 'Source entry'),
    error => error.code === SPINNING_OPTION_CHECK_ERROR_CODE
  )
  assert.throws(
    () => normalizeSpinningEntryContext('2026-08-23', 4, 'Source entry'),
    error => error.code === SPINNING_OPTION_CHECK_ERROR_CODE
  )
})

test('calendar highlights only dates containing the selected shift', () => {
  const entries = [
    { entry_date: '2026-08-01', shift: 1, hasData: true },
    { entry_date: '2026-08-05', shift: 2, hasData: true },
    { entry_date: '2026-08-05', shift: 3, hasData: true },
    { entry_date: '2026-08-07', shift: 1, hasData: false }
  ]

  assert.deepEqual(getOccupiedDateKeys(entries, 1), ['2026-08-01'])
  assert.deepEqual(getOccupiedDateKeys(entries, '2'), ['2026-08-05'])
  assert.deepEqual(getOccupiedDateKeys(entries, 3), ['2026-08-05'])
  assert.deepEqual(getOccupiedDateKeys(entries), ['2026-08-01', '2026-08-05'])
})

test('calendar shift normalization accepts only production shifts', () => {
  assert.equal(normalizeCalendarShift('1'), 1)
  assert.equal(normalizeCalendarShift(3), 3)
  assert.equal(normalizeCalendarShift(4), null)
  assert.equal(normalizeCalendarShift(''), null)
})
