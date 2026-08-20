import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

test('spinning efficiency is a dated setup snapshot with a 95 percent default', async () => {
  const [schema, migration, queries] = await Promise.all([
    read('prisma/schema.prisma'),
    read('prisma/migrations/20260821_spinning_entry_efficiency/migration.sql'),
    read('src/lib/queries/spinningEntryQueries.js')
  ])

  assert.match(
    schema,
    /model spinning_machine_setup[\s\S]*?efficiency\s+Decimal\?\s+@default\(0\.950\)/
  )
  assert.match(migration, /WHERE `efficiency` IS NULL OR `efficiency` = 0\.985/)
  assert.match(migration, /DEFAULT 0\.950/)
  assert.equal((queries.match(/efficiency: DEFAULT_SPINNING_EFFICIENCY_FACTOR/g) || []).length, 2)
  assert.match(queries, /entry_date: dateObj,[\s\S]*?shift: shiftNum/)
})

test('machine setup exposes per-row and bulk entry efficiency controls', async () => {
  const [setupTab, entryPage] = await Promise.all([
    read('src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx'),
    read('src/app/post-preparatory/spinning/entry/page.jsx')
  ])

  assert.match(setupTab, />Effi\. %</)
  assert.match(setupTab, /applyEfficiencyPercent/)
  assert.match(setupTab, /for \(const row of setupData\)/)
  assert.match(entryPage, />\s*Set Efficiency\s*</)
  assert.match(entryPage, /Other entries are unchanged/)
  assert.match(entryPage, /Default is 95%/)
})

test('copy-previous remains speed-only and does not copy efficiency', async () => {
  const queries = await read('src/lib/queries/spinningEntryQueries.js')
  const copyFunction = queries.match(
    /export async function copySpinningFromPreviousDate[\s\S]*?(?=\/\/ ============================================)/
  )?.[0] || ''

  assert.match(copyFunction, /updateSpinningMachineSetup\(setupId, \{ speed \}/)
  assert.doesNotMatch(copyFunction, /efficiency/)
})
