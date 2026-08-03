import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseStrictDate } from '../src/lib/strictDate.js'
import {
  buildMachineLifecycleUpdate,
  normalizeMachineMasterData
} from '../src/lib/queries/machineMasterValidation.js'

const source = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

test('strict master dates reject rollover and malformed calendar values', () => {
  assert.equal(parseStrictDate('2026-02-28').toISOString(), '2026-02-28T00:00:00.000Z')
  assert.equal(parseStrictDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z')
  assert.throws(() => parseStrictDate('2026-02-29'), /real calendar date/)
  assert.throws(() => parseStrictDate('2026-02-30'), /real calendar date/)
  assert.throws(() => parseStrictDate(''), /YYYY-MM-DD/)
  assert.throws(() => parseStrictDate('03/04/2026'), /YYYY-MM-DD/)
})

test('machine master validation rejects poisoned formula values and preserves lifecycle timestamps on ordinary edits', () => {
  const normalized = normalizeMachineMasterData({
    machine_no: ' CA2 ',
    installed_date: '2026-08-03',
    speed: '78',
    prodn_effi: '0.88',
    is_active: true
  }, {
    speed: { label: 'Speed', required: true, max: 1000000 },
    prodn_effi: { label: 'Production efficiency', required: true, max: 100 }
  })
  assert.equal(normalized.machine_no, 'CA2')
  assert.equal(normalized.speed, 78)
  assert.equal(normalized.prodn_effi, 0.88)
  assert.equal(normalized.installed_date.toISOString(), '2026-08-03T00:00:00.000Z')
  assert.deepEqual(buildMachineLifecycleUpdate(true, true), { is_active: true })
  assert.ok(buildMachineLifecycleUpdate(true, false).deactivated_at instanceof Date)
  assert.throws(() => normalizeMachineMasterData({ machine_no: 'CA2', speed: 0 }, {
    speed: { label: 'Speed', required: true, max: 1000000 }
  }), /greater than 0/)
})

test('TPI and TWC retain an unchanged inactive historical count but reject blank measurements', async () => {
  for (const file of ['src/lib/queries/tpiEntryQueries.js', 'src/lib/queries/twcEntryQueries.js']) {
    const text = await source(file)
    assert.match(text, /unchangedCountId/)
    assert.match(text, /existing\.spinning_count_id/)
    assert.match(text, /value == null \|\| \(typeof value === 'string' && value\.trim\(\) === ''\)/)
  }
})

test('operational department names and stoppage child state are protected', async () => {
  const departments = await source('src/lib/queries/queries.js')
  const heads = await source('src/lib/queries/stoppageHeadQueries.js')
  const validation = await source('src/lib/queries/stoppageValidation.js')

  assert.match(departments, /OPERATIONAL_DEPARTMENT_NAMES/)
  assert.match(departments, /operational system key and cannot be renamed/)
  assert.doesNotMatch(heads, /stoppage_details\.updateMany/)
  assert.match(validation, /stoppage_heads\.findMany/)
  assert.match(validation, /is_active: true/)
})

test('inactive stoppage heads are excluded from every production reason picker', async () => {
  for (const file of [
    'src/lib/queries/breakerDrawingQueries.js',
    'src/lib/queries/comberEntryQueries.js',
    'src/lib/queries/finisherDrawingEntryQueries.js',
    'src/lib/queries/lapFormerQueries.js',
    'src/lib/queries/simplexEntryQueries.js',
  ]) {
    const text = await source(file)
    assert.match(text, /sd\.stoppage_head_id IS NULL OR sh\.is_active = 1/)
  }

  for (const file of [
    'src/lib/queries/autoconerEntryQueries.js',
    'src/lib/queries/cardingEntryQueries.js',
    'src/lib/queries/spinningEntryQueries.js',
  ]) {
    const text = await source(file)
    assert.match(text, /stoppage_heads\.findMany\([\s\S]*?is_active: true/)
  }
})
