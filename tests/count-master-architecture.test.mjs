import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildAutoconerCountSnapshot,
  buildSpinningCountSnapshot,
  mergeCountSnapshotWithEntryEdits
} from '../src/lib/countMasterSnapshots.js'

test('spinning count selection creates a complete count-controlled snapshot', () => {
  const snapshot = buildSpinningCountSnapshot({
    id: 'count-68',
    count_name: '68 COMBED STAR',
    act_count: '69.40',
    tpi: '33.00',
    tw_con: '0',
    doff_loss: '0.70',
    waste_percent: '0.90',
    conv_40s_value: '1.70',
    speed: '14000'
  }, { machineSpeed: 18000 })

  assert.deepEqual(snapshot, {
    count_id: 'count-68',
    count_name: '68 COMBED STAR',
    act_count: 69.4,
    tpi: 33,
    tw_con: 0,
    doff_loss: 0.7,
    c_waste_percent: 0.9,
    conv_40s_value: 1.7,
    speed: 14000
  })
})

test('spinning snapshot clears stale values and uses machine speed only as fallback', () => {
  assert.deepEqual(buildSpinningCountSnapshot(null, { machineSpeed: '18487' }), {
    count_id: null,
    count_name: null,
    act_count: null,
    tpi: null,
    tw_con: null,
    doff_loss: null,
    c_waste_percent: null,
    conv_40s_value: null,
    speed: 18487
  })

  assert.equal(
    buildSpinningCountSnapshot({ id: 'c', count_name: '61s', speed: null }, { machineSpeed: 17000 }).speed,
    17000
  )
})

test('autoconer snapshot uses only Count Master speed and efficiency', () => {
  assert.deepEqual(buildAutoconerCountSnapshot({
    id: 'count-61',
    count_name: '61 COMBED COMPACT',
    act_count: '62.00',
    speed_autoconer: '1500',
    effi_actual_prodn: '81.50',
    auto_effi: '79.00'
  }), {
    count_id: 'count-61',
    count_name: '61 COMBED COMPACT',
    act_count: 62,
    speed: 1500,
    target_effi: 81.5
  })
})

test('Count changes retain explicit entry overrides while keeping canonical Count identity', () => {
  const resolved = mergeCountSnapshotWithEntryEdits({
    count_id: 'count-61',
    count_name: '61 COMBED STAR',
    tpi: 31,
    speed: 14500
  }, {
    count_id: 'stale-count-id',
    count_name: 'stale count name',
    tpi: 31.75,
    speed: 14750
  })

  assert.deepEqual(resolved, {
    count_id: 'count-61',
    count_name: '61 COMBED STAR',
    tpi: 31.75,
    speed: 14750
  })
})

test('machine master forms expose only the selected count reference', async () => {
  const spinningForm = await readFile(
    new URL('../src/components/modules/masters/SpinningMachineForm.jsx', import.meta.url),
    'utf8'
  )
  const autoconerForm = await readFile(
    new URL('../src/components/modules/masters/AutoconerForm.jsx', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(spinningForm, /Setup Configuration/)
  assert.doesNotMatch(spinningForm, /id="(?:act_count|tpi|tw_con|doff_loss|c_waste_percent)"/)
  assert.match(spinningForm, /value: c\.id, label: c\.count_name/)

  assert.doesNotMatch(autoconerForm, /id="(?:speed|act_effi)"/)
  assert.match(autoconerForm, /value: c\.id, label: c\.count_name/)
})

test('Count Master writes do not mutate historical machine setup snapshots', async () => {
  const countQueries = await readFile(
    new URL('../src/lib/queries/spinningCountQueries.js', import.meta.url),
    'utf8'
  )
  const updateFunction = countQueries.match(
    /export async function updateSpinningCount[\s\S]*?(?=\/\/ Delete spinning count)/
  )?.[0]

  assert.ok(updateFunction)
  assert.match(updateFunction, /prisma\.spinning_counts\.update/)
  assert.doesNotMatch(updateFunction, /spinning_machine_setup\.(?:update|updateMany|upsert)/)
})

test('entry and report queries resolve dated setup snapshots', async () => {
  const spinningEntry = await readFile(
    new URL('../src/lib/queries/spinningEntryQueries.js', import.meta.url),
    'utf8'
  )
  const autoconerEntry = await readFile(
    new URL('../src/lib/queries/autoconerEntryQueries.js', import.meta.url),
    'utf8'
  )
  const spinningReport = await readFile(
    new URL('../src/app/reports/spinning/production-abstract/spinningAbstractQueries.js', import.meta.url),
    'utf8'
  )
  const autoconerReport = await readFile(
    new URL('../src/lib/queries/autoconerLowEfficiencyReportQueries.js', import.meta.url),
    'utf8'
  )
  const spinningProduction = await readFile(
    new URL('../src/components/modules/post-preparatory/spinning/SpinningProductionTab.jsx', import.meta.url),
    'utf8'
  )
  const autoconerProduction = await readFile(
    new URL('../src/components/modules/post-preparatory/autoconer/AutoconerProductionTab.jsx', import.meta.url),
    'utf8'
  )

  assert.match(spinningEntry, /buildSpinningCountSnapshot/)
  assert.match(spinningEntry, /entry_date: dateObj,[\s\S]*?shift: shiftNum/)
  assert.match(autoconerEntry, /buildAutoconerCountSnapshot/)
  assert.match(autoconerEntry, /entry_date: dateObj,[\s\S]*?shift: shiftNum/)
  assert.match(autoconerEntry, /select: \{ entry_date: true, shift: true \}/)

  assert.match(spinningReport, /JOIN spinning_machine_setup sms/)
  assert.doesNotMatch(spinningReport, /JOIN spinning_counts sc/)
  assert.match(autoconerReport, /prisma\.autoconer_machine_setup\.findMany/)
  assert.doesNotMatch(autoconerReport, /prisma\.spinning_counts\.findMany/)
  assert.match(spinningProduction, /effectiveSetup\?\.count_name \|\| row\.count_name/)
  assert.match(autoconerProduction, /effectiveSetup\.count_name \|\| row\.count_name/)
  assert.match(autoconerProduction, /effectiveSetup\.target_effi/)
})

test('database schema stores master references and immutable entry defaults', async () => {
  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
  const migration = await readFile(
    new URL('../prisma/migrations/20260815_count_master_architecture/migration.sql', import.meta.url),
    'utf8'
  )
  const conversionMigration = await readFile(
    new URL('../prisma/migrations/20260815_spinning_setup_conversion_snapshot/migration.sql', import.meta.url),
    'utf8'
  )

  assert.match(schema, /model spinning_machines[\s\S]*?count_id\s+String\?/) 
  assert.match(schema, /model spinning_machine_setup[\s\S]*?conv_40s_value\s+Decimal\?/)
  assert.match(schema, /model autoconer_machine_setup[\s\S]*?target_effi\s+Decimal\?/)
  assert.match(migration, /fk_spinning_machine_count/)
  assert.match(migration, /target_effi/)
  assert.match(conversionMigration, /conv_40s_value/)
})
