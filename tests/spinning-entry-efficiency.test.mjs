import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

async function loadDefaultsQueries() {
  const source = (await read('src/lib/queries/spinningMachineDefaults.js'))
    .replace("import { prisma } from '../prisma'", 'const prisma = {}')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

test('Master efficiency persists percentages as factors and new reads use the saved value', async () => {
  const { getSpinningMasterEfficiency, setSpinningMasterEfficiency } = await loadDefaultsQueries()
  let saved = null
  const db = { spinning_machine_defaults: {
    findUnique: async () => saved,
    upsert: async ({ create, update }) => {
      saved = saved ? { ...saved, ...update } : create
      return saved
    }
  } }
  assert.equal(await getSpinningMasterEfficiency(db), 0.95)
  for (const percent of [90, 0, 100, 95.5]) {
    await setSpinningMasterEfficiency(percent, db)
    assert.equal(await getSpinningMasterEfficiency(db), percent / 100)
  }
  for (const invalid of [-1, 101, NaN, Infinity, null, '95']) {
    await assert.rejects(setSpinningMasterEfficiency(invalid, db), /between 0 and 100/)
  }
  assert.equal(await getSpinningMasterEfficiency(db), 0.955)
})

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
  assert.equal((queries.match(/efficiency: masterEfficiency/g) || []).length, 2)
  assert.ok(queries.indexOf('return existingSetups.filter') < queries.indexOf('const masterEfficiency = await getSpinningMasterEfficiency()'))
  assert.match(queries, /entry_date: dateObj,[\s\S]*?shift: shiftNum/)
})

test('bulk efficiency lives in Master while per-row entry efficiency remains available', async () => {
  const [setupTab, entryPage, masterPage] = await Promise.all([
    read('src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx'),
    read('src/app/post-preparatory/spinning/entry/page.jsx'),
    read('src/app/masters/spinning-machine/page.jsx')
  ])

  assert.match(setupTab, />Effi\. %</)
  assert.doesNotMatch(setupTab, /applyEfficiencyPercent|bulk-spinning-efficiency/)
  assert.match(masterPage, /setSpinningMasterEfficiencyAction\(percent\)/)
  assert.match(masterPage, /Set Efficiency %/)
  assert.ok(masterPage.indexOf('id="bulk-spinning-efficiency"') < masterPage.indexOf('<SearchFilter'))
  assert.match(setupTab, /setEditedRows/)
  assert.doesNotMatch(entryPage, />\s*Set Efficiency\s*</)
  assert.doesNotMatch(entryPage, /spinning-entry-efficiency/)
})

test('copy-previous remains speed-only and does not copy efficiency', async () => {
  const queries = await read('src/lib/queries/spinningEntryQueries.js')
  const copyFunction = queries.match(
    /export async function copySpinningFromPreviousDate[\s\S]*?(?=\/\/ ============================================)/
  )?.[0] || ''

  assert.match(copyFunction, /updateSpinningMachineSetup\(setupId, \{ speed \}/)
  assert.doesNotMatch(copyFunction, /efficiency/)
})
