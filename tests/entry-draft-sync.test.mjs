import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const importSourceModule = async (relativePath) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const {
  findSetupDraft,
  getEffectiveStoppageTotal,
  mergeSetupDraft,
  resolveCommitDrafts,
  selectRowsForDependentCommit
} = await importSourceModule('../src/lib/entryDraftSync.js')
const {
  calculateCardingStdProdn,
  resolveCardingFormulaInputs
} = await importSourceModule('../src/lib/cardingFormulaFallback.js')
const {
  calculateBreakerDrawingStdProdn,
  getBreakerDrawingActProdnConstant,
  resolveBreakerDrawingFormulaInputs
} = await importSourceModule('../src/lib/breakerDrawingFormulaFallback.js')
const {
  calculateFinisherDrawingStdProdn,
  resolveFinisherDrawingFormulaInputs
} = await importSourceModule('../src/lib/finisherDrawingFormulaFallback.js')
const {
  calculateLapFormerStdProdn,
  getLapFormerActProdnConstant,
  resolveLapFormerFormulaInputs
} = await importSourceModule('../src/lib/lapFormerFormulaFallback.js')
const {
  calculateComberConstantFromSlHank,
  resolveComberFormulaInputs
} = await importSourceModule('../src/lib/comberFormulaFallback.js')
const {
  resolveSimplexFormulaInputs
} = await importSourceModule('../src/lib/simplexFormulaFallback.js')
const {
  buildMachineSetupOverrides,
  cloneDateScopedSetup
} = await importSourceModule('../src/lib/queries/dateScopedMachineSetup.js')
const {
  calculateSpinningGpsMetrics,
  calculateTimeAdjustedProductionMetrics,
  resolveProductionTime
} = await importSourceModule('../src/lib/productionFormulaMath.js')
const {
  sanitizeAutoconerSetupUpdate,
  sanitizeSpinningSetupUpdate,
  validateCompleteAutoconerSetup,
  validateCompleteSpinningSetup
} = await importSourceModule('../src/lib/machineSetupValidation.js')
const {
  buildStoppageUpdate
} = await importSourceModule('../src/lib/stoppageSlotUtils.js')
const {
  assertAllActionsSucceeded
} = await importSourceModule('../src/lib/actionResult.js')
const {
  assertMachineUpdateCount,
  normalizeMachineIds,
  normalizeMixingValue
} = await importSourceModule('../src/lib/queries/machineMixingUpdate.js')
const {
  sanitizeProductionDetailUpdate
} = await importSourceModule('../src/lib/queries/productionDetailUpdate.js')
const {
  minutesToRunHours,
  parseRunHoursToMinutes
} = await importSourceModule('../src/lib/runHoursMath.js')
const {
  buildMachineVisibilityWhere,
  isMachineVisibleOnDate
} = await importSourceModule('../src/lib/queries/machineDateVisibility.js')

const setup = {
  id: 'setup-1',
  machine_id: 'machine-1',
  speed: 130,
  hank_constant: 0.13,
  std_efficiency_factor: 0.98,
  divisor_constant: 1693
}

const productionRow = {
  id: 'production-1',
  machine_id: 'machine-1',
  setup,
  stoppage: [{
    id: 'stoppage-1',
    production_detail_id: 'production-1',
    stoppage1_time: 10,
    stoppage2_time: 5,
    stoppage3_time: 0,
    stoppage4_time: 0,
    total_stoppage_time: 15
  }]
}

test('HH.MM production time conversion is finite, bounded, and reversible', () => {
  assert.equal(parseRunHoursToMinutes(7.12), 432)
  assert.equal(parseRunHoursToMinutes(1.56), 116)
  assert.equal(parseRunHoursToMinutes(7.99), 479, 'invalid minute fragments are capped at 59')
  assert.equal(parseRunHoursToMinutes(-2.30), 0)
  assert.equal(parseRunHoursToMinutes('invalid'), 0)
  assert.equal(minutesToRunHours(432), 7.12)
  assert.equal(minutesToRunHours(-30), 0)
})

test('historical machine visibility uses lifecycle dates with a safe legacy fallback', () => {
  const date = new Date('2026-08-03T00:00:00.000Z')

  assert.equal(isMachineVisibleOnDate({
    is_active: false,
    activated_at: new Date('2026-01-01T00:00:00.000Z'),
    deactivated_at: new Date('2026-08-04T00:00:00.000Z')
  }, date), true)
  assert.equal(isMachineVisibleOnDate({
    is_active: false,
    activated_at: new Date('2026-01-01T00:00:00.000Z'),
    deactivated_at: date
  }, date), false)
  assert.equal(isMachineVisibleOnDate({ is_active: true }, date), true)
  assert.equal(isMachineVisibleOnDate({ is_active: false }, date), false)
  assert.throws(() => buildMachineVisibilityWhere('not-a-date'), /valid entry date/)
})

test('a setup draft is found whether keyed by setup id or carrying machine_id', () => {
  const bySetupId = { 'setup-1': { speed: 78, machine_id: 'machine-1' } }
  assert.equal(findSetupDraft(bySetupId, 'setup-1', 'machine-1').speed, 78)

  const byUnrelatedKey = { 'draft-row': { speed: 90, machine_id: 'machine-1' } }
  assert.equal(findSetupDraft(byUnrelatedKey, 'setup-1', 'machine-1').speed, 90)
  assert.equal(mergeSetupDraft(setup, 'machine-1', byUnrelatedKey).speed, 90)
})

test('a machine-keyed setup draft remains usable before its base row finishes loading', () => {
  const drafts = {
    'draft-row': {
      machine_id: 'machine-1',
      speed: 78,
      hank_constant: 0.5,
      std_efficiency_factor: 0.88
    }
  }

  assert.deepEqual(mergeSetupDraft(undefined, 'machine-1', drafts), drafts['draft-row'])
})

test('overall update prefers parent drafts over an empty remounted child ref', () => {
  const dependencyDrafts = { setup: { 'setup-1': { speed: 78 } } }

  assert.deepEqual(resolveCommitDrafts({
    dependencyDrafts,
    tabKey: 'setup',
    refDrafts: {},
    propDrafts: dependencyDrafts.setup
  }), dependencyDrafts.setup)

  assert.deepEqual(resolveCommitDrafts({
    dependencyDrafts: null,
    tabKey: 'setup',
    refDrafts: {},
    propDrafts: dependencyDrafts.setup
  }), dependencyDrafts.setup)
})

test('post-preparatory setup validation blocks invalid formula inputs and display-only fields', () => {
  assert.deepEqual(sanitizeAutoconerSetupUpdate({
    machine_id: 'display-only',
    count_name: ' 60s ',
    act_count: '59.5',
    session_no: '1',
    run_time: '510'
  }), {
    count_name: '60s',
    act_count: 59.5,
    session_no: 1,
    run_time: 510
  })

  assert.throws(() => sanitizeAutoconerSetupUpdate({ run_time: Number.NaN }), /valid whole number/)
  assert.throws(() => validateCompleteAutoconerSetup({ count_name: '60s' }), /incomplete/)
  assert.throws(() => sanitizeSpinningSetupUpdate({ speed: 0 }), /greater than 0/)
  assert.throws(() => sanitizeSpinningSetupUpdate({ efficiency: 98 }), /at most 1/)
  assert.throws(() => validateCompleteSpinningSetup({ count_name: '60s' }), /incomplete/)
  assert.deepEqual(sanitizeSpinningSetupUpdate({
    machine_id: 'display-only',
    speed: '14500',
    tpi: '13',
    allocated_spindles: '1104',
    efficiency: '0.985',
    doff_loss: '0'
  }), {
    tpi: 13,
    allocated_spindles: 1104,
    speed: 14500,
    doff_loss: 0,
    efficiency: 0.985
  })
})

test('stoppage draft totals override saved slot values without touching the database row', () => {
  const drafts = {
    'stoppage-1': {
      stoppage1_time: 20,
      stoppage2_time: 7
    }
  }

  assert.equal(getEffectiveStoppageTotal(productionRow, drafts), 27)
  assert.equal(productionRow.stoppage[0].total_stoppage_time, 15)
})

test('production-id keyed Spinning stoppage drafts immediately drive a finite GPS', () => {
  const draftTotal = getEffectiveStoppageTotal(productionRow, {
    'production-1': {
      stoppage1_time: 120,
      stoppage2_time: 30,
      stoppage3_time: 0,
      stoppage4_time: 0
    }
  })
  assert.equal(draftTotal, 150)

  const common = {
    actHank: 100,
    actCount: 69.5,
    allocatedSpindles: 1104,
    efficiency: 0.95,
    speed: 18000,
    tpi: 24,
    totalTime: 510,
    shiftNo: 1
  }
  const saved = calculateSpinningGpsMetrics({ ...common, stoppageTime: 15 })
  const drafted = calculateSpinningGpsMetrics({ ...common, stoppageTime: draftTotal })

  assert.notEqual(drafted.gps, saved.gps)
  assert.ok(Number.isFinite(drafted.gps))
  assert.ok(Number.isFinite(drafted.expectedGps))
  assert.equal(drafted.stoppageTime, 150)
  assert.equal(drafted.constant, saved.constant)

  const zeroCount = calculateSpinningGpsMetrics({ ...common, actCount: 0, stoppageTime: 999 })
  assert.equal(zeroCount.stoppageTime, 510)
  assert.equal(zeroCount.gps, 0)
  assert.equal(zeroCount.expectedGps, 0)
  assert.ok(Object.values(zeroCount).filter(value => typeof value === 'number').every(Number.isFinite))
})

test('dependent setup and stoppage edits select production rows for final commit', () => {
  const setupMap = { 'machine-1': setup }

  const setupRows = selectRowsForDependentCommit(
    [productionRow],
    {},
    setupMap,
    { 'setup-1': { speed: 78, machine_id: 'machine-1' } },
    {}
  )
  assert.deepEqual(setupRows.map(row => row.id), ['production-1'])

  const stoppageRows = selectRowsForDependentCommit(
    [productionRow],
    {},
    setupMap,
    {},
    { 'stoppage-1': { stoppage1_time: 20 } }
  )
  assert.deepEqual(stoppageRows.map(row => row.id), ['production-1'])
})

test('Carding standard production immediately follows draft speed', () => {
  const original = calculateCardingStdProdn(setup, 510)
  const changed = calculateCardingStdProdn({ ...setup, speed: 78 }, 510)

  assert.equal(Number(original.toFixed(2)), 295.22)
  assert.equal(Number(changed.toFixed(2)), 177.13)
})

test('documented drawing and lap-former standard-production examples remain correct', () => {
  assert.equal(Number(calculateBreakerDrawingStdProdn({
    speed: 450,
    hank_constant: 0.14,
    std_efficiency_factor: 0.85,
    divisor_constant: 1693,
    delivery: 2
  }, 510).toFixed(2)), 1646.06)

  assert.equal(Number(calculateFinisherDrawingStdProdn({
    speed: 350,
    hank_constant: 0.14,
    std_efficiency_factor: 0.9,
    divisor_constant: 1693,
    delivery: 1
  }, 510).toFixed(2)), 677.79)

  assert.equal(Number(calculateLapFormerStdProdn({
    speed: 120,
    hank_constant: 0.0082,
    std_efficiency_factor: 0.85,
    divisor_constant: 1693,
    delivery: 1
  }, 510).toFixed(2)), 3747.14)
})

test('workbook time adjustment drives expected production, efficiency and utilization', () => {
  const standardProduction = calculateCardingStdProdn(
    { ...setup, speed: 78 },
    510
  )
  const calculated = calculateTimeAdjustedProductionMetrics({
    actualProduction: 100,
    standardProduction,
    waste: 2,
    totalTime: 510,
    stoppageTime: 150
  })

  assert.deepEqual(calculated, {
    actualProduction: 100,
    standardProduction: 177.13,
    expectedProduction: 125.03,
    efficiencyPercent: 79.98,
    utilizationPercent: 70.59,
    wastePercent: 2,
    totalTime: 510,
    stoppageTime: 150,
    workTime: 360
  })
})

test('workbook actual-production constants do not multiply by delivery', () => {
  const breakerWithOneDelivery = getBreakerDrawingActProdnConstant({
    hank_constant: 0.14,
    delivery: 1
  })
  const breakerWithTwoDeliveries = getBreakerDrawingActProdnConstant({
    hank_constant: 0.14,
    delivery: 2
  })
  assert.equal(breakerWithTwoDeliveries, breakerWithOneDelivery)

  const lapWithOneDelivery = getLapFormerActProdnConstant({
    hank_constant: 0.0082,
    delivery: 1
  })
  const lapWithTwoDeliveries = getLapFormerActProdnConstant({
    hank_constant: 0.0082,
    delivery: 2
  })
  assert.equal(lapWithTwoDeliveries, lapWithOneDelivery)
})

test('Comber constant always follows the current Sliver Hank draft', () => {
  const expected = calculateComberConstantFromSlHank(0.12)
  const resolved = resolveComberFormulaInputs({
    sl_hank: 0.12,
    constant: calculateComberConstantFromSlHank(0.14)
  })

  assert.equal(resolved.constant, expected)
})

test('stoppage time is bounded to the shift before dependent formulas run', () => {
  assert.deepEqual(resolveProductionTime(510, 700), {
    totalTime: 510,
    stoppageTime: 510,
    workTime: 0
  })
  assert.deepEqual(resolveProductionTime(510, -10), {
    totalTime: 510,
    stoppageTime: 0,
    workTime: 510
  })
})

test('explicit zero master values are never replaced by formula defaults', () => {
  assert.deepEqual(resolveCardingFormulaInputs({
    speed: 0,
    hank_constant: 0,
    std_efficiency_factor: 0,
    divisor_constant: 0
  }), {
    speed: 0,
    hankConstant: 0,
    stdEfficiencyFactor: 0,
    divisorConstant: 0
  })

  assert.equal(resolveBreakerDrawingFormulaInputs({ speed: 0 }).speed, 0)
  assert.equal(resolveFinisherDrawingFormulaInputs({ speed: 0 }).speed, 0)
  assert.equal(resolveLapFormerFormulaInputs({ speed: 0 }).speed, 0)

  const simplex = resolveSimplexFormulaInputs({
    overrides: { speed: 0, tpi: 0, hank: 0, mcEffi: 0, totalSpindles: 0 }
  })
  assert.equal(simplex.speed, 0)
  assert.equal(simplex.tpi, 0)
  assert.equal(simplex.slHank, 0)
  assert.equal(simplex.mcEffiPercent, 0)
  assert.equal(simplex.totalSpindles, 0)

  const comber = resolveComberFormulaInputs({ sl_hank: 0, mc_effi: 0 })
  assert.equal(comber.slHank, 0)
  assert.equal(comber.mcEffiFactor, 0)
  assert.equal(comber.constant, 0)
})

test('new date snapshots apply every present machine master value including zero', () => {
  const overrides = buildMachineSetupOverrides({
    speed: 0,
    tpi: 0,
    no_of_spindles: 0,
    absent: null
  }, {
    speed: 'speed',
    tpi: 'tpi',
    spindles: 'no_of_spindles',
    ignored: 'absent'
  })

  assert.deepEqual(overrides, { speed: 0, tpi: 0, spindles: 0 })

  const snapshot = cloneDateScopedSetup({
    id: 'old',
    machine_id: 'machine-1',
    entry_date: new Date('2026-07-01'),
    shift: 1,
    speed: 350,
    hank_constant: 0.14,
    std_efficiency_factor: 0.9,
    divisor_constant: 1693,
    delivery: 1,
    shift_time: 510,
    std_prodn: 677.79
  }, new Date('2026-08-01'), 2, { speed: 0 })

  assert.equal(snapshot.speed, 0)
  assert.equal(snapshot.std_prodn, 0)
})

test('stoppage updates normalize numeric values, clear orphaned minutes and reject invalid time', () => {
  const update = buildStoppageUpdate({
    stoppage1_id: 'reason-1',
    stoppage1_time: 10,
    stoppage2_id: 'reason-2',
    stoppage2_time: 5,
    stoppage3_time: 0,
    stoppage4_time: 0
  }, {
    stoppage1_time: '20',
    stoppage2_id: null
  })

  assert.equal(update.stoppage1_time, 20)
  assert.equal(update.stoppage2_time, 0)
  assert.equal(update.total_stoppage_time, 20)
  assert.throws(
    () => buildStoppageUpdate({}, { stoppage1_time: -1 }),
    error => error?.code === 'INVALID_STOPPAGE'
  )
  assert.throws(
    () => buildStoppageUpdate({}, { stoppage1_time: 1.5 }),
    error => error?.code === 'INVALID_STOPPAGE'
  )
})

test('resolved server-action failures cannot be mistaken for successful bulk operations', () => {
  assert.doesNotThrow(() => assertAllActionsSucceeded([{ success: true }]))
  assert.throws(
    () => assertAllActionsSucceeded([
      { success: true },
      { success: false, error: 'Machine is in use' }
    ]),
    /Machine is in use/
  )
})

test('production updates only send fields accepted by their Prisma model', () => {
  assert.deepEqual(
    sanitizeProductionDetailUpdate('breaker_drawing_production_detail', {
      header_id: 'different-header',
      machine_id: 'different-machine',
      created_at: new Date(0),
      updated_at: new Date(0),
      speed: 750,
      gps: 12.5,
      machine: { machine_no: 'BD-01' },
      stoppage: { total_stoppage_time: 10 },
      act_prodn: 42
    }),
    { act_prodn: 42 }
  )

  assert.deepEqual(
    sanitizeProductionDetailUpdate('spinning_production_detail', {
      speed: 18_000,
      effi_percent: 85,
      gps: 11.75,
      stopped_spindles: 25
    }),
    { gps: 11.75, stopped_spindles: 25 }
  )

  assert.throws(
    () => sanitizeProductionDetailUpdate('unknown_detail', { act_prodn: 1 }),
    /Unknown production model/
  )
})

test('machine mixing/count inputs are normalized before any database writes', () => {
  assert.deepEqual(normalizeMachineIds([' machine-1 ', 'machine-1', 'machine-2']), [
    'machine-1',
    'machine-2'
  ])
  assert.equal(normalizeMixingValue(' 64 COMBED GOLD '), '64 COMBED GOLD')
  assert.equal(normalizeMixingValue(40), '40')
  assert.throws(() => normalizeMachineIds([]), /Select at least one machine/)
  assert.throws(() => normalizeMachineIds(['']), /valid id/)
  assert.throws(() => normalizeMixingValue('   '), /required/)
  assert.throws(() => normalizeMixingValue('123456', 5), /cannot exceed 5/)
  assert.doesNotThrow(() => assertMachineUpdateCount(2, 2, 'production detail'))
  assert.throws(() => assertMachineUpdateCount(1, 2, 'production detail'), /Expected 2 production detail row/)
})

test('mixing/count mutations keep canonical and current-entry data atomic', async () => {
  const modules = [
    ['Breaker Drawing', '../src/lib/queries/breakerDrawingQueries.js', 'bulkUpdateBreakerDrawingMachineMixing', '// Get all mixing options', 'drawing_breaker_machines', 'breaker_drawing_production_detail'],
    ['Lap Former', '../src/lib/queries/lapFormerQueries.js', 'bulkUpdateLapFormerMachineMixing', '// Get spinning count options', 'lap_former_machines', 'lap_former_production_detail'],
    ['Finisher Drawing', '../src/lib/queries/finisherDrawingEntryQueries.js', 'bulkUpdateFinisherDrawingMachineMixing', null, 'drawing_finisher_machines', 'finisher_drawing_production_detail'],
    ['Comber', '../src/lib/queries/comberEntryQueries.js', 'bulkUpdateComberMachineCount', '// Sync new machines to header', 'comber_machines', 'comber_production_detail'],
    ['Simplex', '../src/lib/queries/simplexEntryQueries.js', 'bulkUpdateSimplexMachineCount', '// Get count options for simplex', 'simplex_machines', 'simplex_production_detail']
  ]

  for (const [name, queryPath, functionName, endMarker, machineModel, detailModel] of modules) {
    const source = await readFile(new URL(queryPath, import.meta.url), 'utf8')
    const functionStart = source.indexOf(`export async function ${functionName}`)
    assert.notEqual(functionStart, -1, `${name} mixing/count function must exist`)
    const functionEnd = endMarker ? source.indexOf(endMarker, functionStart) : source.length
    const functionSource = source.slice(functionStart, functionEnd)
    assert.match(functionSource, /resolveMachineMixingContext/, `${name} must validate the selected machines/header`)
    assert.match(functionSource, /\$transaction\(async tx =>/, `${name} mixing/count writes must be atomic`)
    assert.match(functionSource, new RegExp(`tx\\.${machineModel}\\.updateMany`), `${name} must update its canonical machine`)
    assert.match(functionSource, new RegExp(`tx\\.${detailModel}\\.updateMany`), `${name} must update the current production row`)
    assert.match(functionSource, /assertMachineUpdateCount/, `${name} must reject partial writes`)
  }

  for (const [name, componentPath, actionCall] of [
    ['Breaker Drawing', '../src/components/modules/preparatory-entry/BreakerDrawingMachineSetupTab.jsx', /bulkUpdateBreakerDrawingMachineMixingAction\(selectedRows, mixingValue, headerId\)/],
    ['Lap Former', '../src/components/modules/preparatory-entry/LapFormerMachineSetupTab.jsx', /bulkUpdateLapFormerMachineMixingAction\(selectedRows, mixingValue, headerId\)/],
    ['Finisher Drawing', '../src/components/modules/preparatory-entry/FinisherDrawingMachineSetupTab.jsx', /bulkUpdateFinisherDrawingMachineMixingAction\(selectedRows, mixingValue, headerId\)/],
    ['Comber', '../src/components/modules/preparatory-entry/ComberMachineSetupTab.jsx', /bulkUpdateComberMachineCountAction\(selectedRows, countToSet, headerId\)/],
    ['Simplex', '../src/components/modules/preparatory-entry/SimplexMachineSetupTab.jsx', /bulkUpdateSimplexMachineCountAction\(machineIds, countToSet, headerId\)/]
  ]) {
    const componentSource = await readFile(new URL(componentPath, import.meta.url), 'utf8')
    assert.match(componentSource, actionCall, `${name} must identify the current header when changing mixing/count`)
  }

  for (const [name, queryPath, setupModel] of [
    ['Finisher Drawing', '../src/lib/queries/finisherDrawingEntryQueries.js', 'finisher_drawing_machine_setup'],
    ['Comber', '../src/lib/queries/comberEntryQueries.js', 'comber_machine_setup'],
    ['Simplex', '../src/lib/queries/simplexEntryQueries.js', 'simplex_machine_setup']
  ]) {
    const source = await readFile(new URL(queryPath, import.meta.url), 'utf8')
    assert.match(source, new RegExp(`tx\\.${setupModel}\\.upsert`), `${name} must keep its date/shift setup in sync`)
  }
})

test('Finisher Drawing only falls back when shift configuration is absent', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/finisherDrawingEntryQueries.js', import.meta.url),
    'utf8'
  )
  const shiftConfigFunction = source.slice(
    source.indexOf('export async function getFinisherDrawingShiftConfig'),
    source.indexOf('export async function getFinisherDrawingShiftTime')
  )
  assert.match(shiftConfigFunction, /data\?\.shift_time \|\| resolveFinisherDrawingShiftFallbackTime/)
  assert.match(shiftConfigFunction, /catch \(error\)[\s\S]*throw error/)
})

test('all production modules use shared draft dependencies and local bulk-stoppage updates', async () => {
  const moduleFiles = [
    ['Breaker Drawing', '../src/components/modules/preparatory-entry/BreakerDrawingProductionTab.jsx', '../src/components/modules/preparatory-entry/BreakerDrawingStoppageTab.jsx'],
    ['Carding', '../src/components/modules/preparatory-entry/CardingProductionTab.jsx', '../src/components/modules/preparatory-entry/CardingStoppageTab.jsx'],
    ['Comber', '../src/components/modules/preparatory-entry/ComberProductionTab.jsx', '../src/components/modules/preparatory-entry/ComberStoppageTab.jsx'],
    ['Finisher Drawing', '../src/components/modules/preparatory-entry/FinisherDrawingProductionTab.jsx', '../src/components/modules/preparatory-entry/FinisherDrawingStoppageTab.jsx'],
    ['Lap Former', '../src/components/modules/preparatory-entry/LapFormerProductionTab.jsx', '../src/components/modules/preparatory-entry/LapFormerStoppageTab.jsx'],
    ['Simplex', '../src/components/modules/preparatory-entry/SimplexProductionTab.jsx', '../src/components/modules/preparatory-entry/SimplexStoppageTab.jsx'],
    ['Autoconer', '../src/components/modules/post-preparatory/autoconer/AutoconerProductionTab.jsx', '../src/components/modules/post-preparatory/autoconer/AutoconerStoppageTab.jsx'],
    ['Spinning', '../src/components/modules/post-preparatory/spinning/SpinningProductionTab.jsx', '../src/components/modules/post-preparatory/spinning/SpinningStoppageTab.jsx']
  ]

  for (const [name, productionPath, stoppagePath] of moduleFiles) {
    const [productionSource, stoppageSource] = await Promise.all([
      readFile(new URL(productionPath, import.meta.url), 'utf8'),
      readFile(new URL(stoppagePath, import.meta.url), 'utf8')
    ])

    assert.match(productionSource, /getEffectiveStoppageTotal/, `${name} must calculate from stoppage drafts`)
    assert.match(productionSource, /selectRowsForDependentCommit/, `${name} must persist dependent production rows`)
    assert.match(stoppageSource, /applyBulkStoppageDraft/, `${name} bulk stoppage must update local drafts immediately`)
  }
})

test('all stoppage persistence paths validate input and update dependent production atomically', async () => {
  const queryFiles = [
    '../src/lib/queries/autoconerEntryQueries.js',
    '../src/lib/queries/breakerDrawingQueries.js',
    '../src/lib/queries/cardingEntryQueries.js',
    '../src/lib/queries/comberEntryQueries.js',
    '../src/lib/queries/finisherDrawingEntryQueries.js',
    '../src/lib/queries/lapFormerQueries.js',
    '../src/lib/queries/simplexEntryQueries.js',
    '../src/lib/queries/spinningEntryQueries.js'
  ]

  for (const queryPath of queryFiles) {
    const source = await readFile(new URL(queryPath, import.meta.url), 'utf8')
    assert.match(source, /buildStoppageUpdate/, `${queryPath} must normalize stoppage values`)
    assert.match(source, /assertActiveStoppageReasons/, `${queryPath} must reject invalid stoppage reasons`)
    assert.match(source, /sanitizeProductionDetailUpdate/, `${queryPath} must protect production row ownership`)
    assert.match(source, /\$transaction\(/, `${queryPath} must save stoppage and production atomically`)
  }
})

test('controlled entry tabs accept external resets without clobbering rapid child drafts', async () => {
  const componentPaths = [
    '../src/components/modules/preparatory-entry/BreakerDrawingMachineSetupTab.jsx',
    '../src/components/modules/preparatory-entry/BreakerDrawingProductionTab.jsx',
    '../src/components/modules/preparatory-entry/BreakerDrawingStoppageTab.jsx',
    '../src/components/modules/preparatory-entry/CardingMachineSetupTab.jsx',
    '../src/components/modules/preparatory-entry/CardingProductionTab.jsx',
    '../src/components/modules/preparatory-entry/CardingStoppageTab.jsx',
    '../src/components/modules/preparatory-entry/ComberMachineSetupTab.jsx',
    '../src/components/modules/preparatory-entry/ComberProductionTab.jsx',
    '../src/components/modules/preparatory-entry/ComberStoppageTab.jsx',
    '../src/components/modules/preparatory-entry/FinisherDrawingMachineSetupTab.jsx',
    '../src/components/modules/preparatory-entry/FinisherDrawingProductionTab.jsx',
    '../src/components/modules/preparatory-entry/FinisherDrawingStoppageTab.jsx',
    '../src/components/modules/preparatory-entry/LapFormerMachineSetupTab.jsx',
    '../src/components/modules/preparatory-entry/LapFormerProductionTab.jsx',
    '../src/components/modules/preparatory-entry/LapFormerStoppageTab.jsx',
    '../src/components/modules/preparatory-entry/SimplexMachineSetupTab.jsx',
    '../src/components/modules/preparatory-entry/SimplexProductionTab.jsx',
    '../src/components/modules/preparatory-entry/SimplexStoppageTab.jsx',
    '../src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx',
    '../src/components/modules/post-preparatory/spinning/SpinningProductionTab.jsx',
    '../src/components/modules/post-preparatory/spinning/SpinningStoppageTab.jsx',
    '../src/components/modules/post-preparatory/autoconer/AutoconerMachineSetupTab.jsx',
    '../src/components/modules/post-preparatory/autoconer/AutoconerProductionTab.jsx',
    '../src/components/modules/post-preparatory/autoconer/AutoconerStoppageTab.jsx'
  ]

  for (const componentPath of componentPaths) {
    const source = await readFile(new URL(componentPath, import.meta.url), 'utf8')
    assert.match(source, /publishedDraftsRef = useRef\(new WeakSet\(\)\)/, `${componentPath} must track child publications`)
    assert.match(source, /publishedDraftsRef\.current\.add\(next\)/, `${componentPath} must mark child publications`)
    assert.match(source, /!publishedDraftsRef\.current\.has\(editedRows\)/, `${componentPath} must accept external prop resets`)
  }

  // A stale child echo must not replace a newer in-memory edit, while a fresh
  // parent-owned empty object (clearAllDrafts) must reset it.
  const published = new WeakSet()
  const first = { row: { waste: 6 } }
  const latest = { row: { waste: 6.78 } }
  published.add(first)
  published.add(latest)
  let current = latest
  if (!published.has(first)) current = first
  assert.equal(current, latest)
  const externalReset = {}
  if (!published.has(externalReset)) current = externalReset
  assert.deepEqual(current, {})
})

test('entry header reads distinguish database failures from successful empty dates', async () => {
  const pagePaths = [
    '../src/app/preparatory-entry/breaker-drawing/entry/page.jsx',
    '../src/app/preparatory-entry/carding/entry/page.jsx',
    '../src/app/preparatory-entry/comber/entry/page.jsx',
    '../src/app/preparatory-entry/finisher-drawing/entry/page.jsx',
    '../src/app/preparatory-entry/lap-former/entry/page.jsx',
    '../src/app/preparatory-entry/simplex/entry/page.jsx',
    '../src/app/post-preparatory/spinning/entry/page.jsx',
    '../src/app/post-preparatory/autoconer/entry/page.jsx'
  ]

  for (const pagePath of pagePaths) {
    const source = await readFile(new URL(pagePath, import.meta.url), 'utf8')
    assert.match(source, /get\w+ProductionByDateShiftAction\([\s\S]*?if \(!result\?\.success\) throw new Error/, `${pagePath} must throw on a failed header read`)
    assert.match(source, /const requestId = \+\+headerLoadRequestRef\.current/, `${pagePath} must sequence header reads`)
    assert.match(source, /if \(requestId !== headerLoadRequestRef\.current\) return/, `${pagePath} must ignore stale header responses`)
    assert.match(source, /setHeaderLoadError\(true\)/, `${pagePath} must remember the failed read`)
    assert.match(source, /setHeaderLoadError\(true\)[\s\S]*?setHeaderId\(null\)/, `${pagePath} must clear the previous date's header after a failed read`)
    assert.match(source, /!headerLoadError && \(/, `${pagePath} must hide Initialize after a failed read`)
  }
})

test('Simplex saves dependent tabs before its header and counts a header-only save', async () => {
  const source = await readFile(new URL('../src/app/preparatory-entry/simplex/entry/page.jsx', import.meta.url), 'utf8')
  const tabLoopIndex = source.indexOf('for (const tab of tabSaves)')
  const headerSaveIndex = source.indexOf('updateSimplexProductionHeaderAction(headerId, draftSnapshot.header)', tabLoopIndex)
  assert.ok(tabLoopIndex >= 0 && headerSaveIndex > tabLoopIndex)
  assert.match(source.slice(headerSaveIndex), /totalSaved \+= 1/)
})

test('Spinning bulk stoppages use the validated atomic GPS persistence path', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/spinningEntryQueries.js', import.meta.url),
    'utf8'
  )
  const writer = source.slice(
    source.indexOf('async function persistSpinningStoppageUpdate'),
    source.indexOf('function normalizeBulkSpinningStoppage')
  )
  const full = source.slice(
    source.indexOf('export async function applyFullStoppage'),
    source.indexOf('export async function applyPartialStoppage')
  )
  const partial = source.slice(
    source.indexOf('export async function applyPartialStoppage'),
    source.indexOf('// MACHINE SETUP OPERATIONS')
  )

  assert.match(writer, /buildStoppageUpdate\(existing, updates\)/)
  assert.match(writer, /assertActiveStoppageReasons\(tx, stoppageUpdate, \['SPINNING'\]\)/)
  for (const field of [
    'total_stoppage_mins',
    'work_time',
    'act_prodn',
    'waste_percent',
    'stopped_spindles',
    'worked_spindles',
    'gps',
    'exp_gps',
    'updated_at'
  ]) {
    assert.match(writer, new RegExp(`${field}:`), `Spinning stoppage updates must persist ${field}`)
  }

  for (const [name, block] of [['full', full], ['partial', partial]]) {
    assert.match(block, /normalizeBulkSpinningStoppage\(stoppageId, stoppageTime\)/, `${name} stoppage must validate time`)
    assert.match(block, /return prisma\.\$transaction\(async tx =>/, `${name} stoppage must be atomic`)
    assert.match(block, /assertActiveStoppageReasons\(tx, \{ stoppage1_id: reasonId \}, \['SPINNING'\]\)/, `${name} stoppage must validate its reason`)
    assert.match(block, /persistSpinningStoppageUpdate\(tx, stoppage\.id/, `${name} stoppage must recalculate GPS through the shared writer`)
    assert.doesNotMatch(block, /await prisma\.spinning_(?:stoppage_entry|production_detail)\.(?:create|update)/, `${name} stoppage must not write outside its transaction`)
  }
})

test('Spinning existing-entry sync backfills missing setup snapshots without deleting history', async () => {
  const source = await readFile(
    new URL('../src/lib/queries/spinningEntryQueries.js', import.meta.url),
    'utf8'
  )
  const sync = source.slice(
    source.indexOf('export async function syncNewMachinesToSpinningHeader'),
    source.indexOf('// Update production detail')
  )
  const setupSync = source.slice(
    source.indexOf('export async function getOrCreateSpinningMachineSetups'),
    source.indexOf('// Get all machine setups for a given date')
  )

  assert.match(sync, /getOrCreateSpinningMachineSetups\(entryDate, entryShift\)/)
  assert.match(sync, /return prisma\.\$transaction\(async tx =>/)
  assert.match(sync, /tx\.spinning_production_detail\.createMany/)
  assert.match(sync, /tx\.spinning_stoppage_entry\.createMany/)
  assert.match(sync, /!existingMachineIds\.includes\(m\.id\)/)
  assert.match(sync, /visibleDetails = await tx\.spinning_production_detail\.findMany/)
  assert.match(sync, /interrupted or legacy initialization/)
  assert.doesNotMatch(sync, /(?:spinning_stoppage_entry|spinning_production_detail)\.deleteMany/)
  assert.match(setupSync, /return prisma\.\$transaction\(async tx =>/)
  assert.match(setupSync, /missingMachines = activeMachines\.filter/)
  assert.match(setupSync, /machinesWithoutBaseline = missingMachines\.filter/)
  assert.match(setupSync, /skipDuplicates: true/)
  assert.match(setupSync, /return tx\.spinning_machine_setup\.findMany/)

  const stoppageRead = source.slice(
    source.indexOf('export async function getSpinningStoppageEntries'),
    source.indexOf('// Shared transactional writer')
  )
  assert.match(stoppageRead, /if \(!header\) throw new Error/)
  assert.match(stoppageRead, /const fallbackRunTime = resolveSpinningShiftFallbackTime\(shift\)/)
})

test('preparatory entry synchronization is date-scoped, additive, and history-safe', async () => {
  const queryPaths = [
    '../src/lib/queries/breakerDrawingQueries.js',
    '../src/lib/queries/cardingEntryQueries.js',
    '../src/lib/queries/comberEntryQueries.js',
    '../src/lib/queries/finisherDrawingEntryQueries.js',
    '../src/lib/queries/lapFormerQueries.js',
    '../src/lib/queries/simplexEntryQueries.js'
  ]

  for (const queryPath of queryPaths) {
    const source = await readFile(new URL(queryPath, import.meta.url), 'utf8')
    assert.match(source, /buildMachineVisibilityWhere\(entryDate\)/, `${queryPath} must use entry-date lifecycle visibility`)
    assert.doesNotMatch(
      source,
      /(?:production_detail|stoppage_entry)\.deleteMany\(/,
      `${queryPath} must never delete entry history while loading or synchronizing`
    )
    assert.match(
      source,
      /completed historical lifecycles?/,
      `${queryPath} must preserve an inactive machine row when the number is added again`
    )
  }
})
