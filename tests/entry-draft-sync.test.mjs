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
  calculateTimeAdjustedProductionMetrics,
  resolveProductionTime
} = await importSourceModule('../src/lib/productionFormulaMath.js')
const {
  buildStoppageUpdate
} = await importSourceModule('../src/lib/stoppageSlotUtils.js')
const {
  assertAllActionsSucceeded
} = await importSourceModule('../src/lib/actionResult.js')
const {
  sanitizeProductionDetailUpdate
} = await importSourceModule('../src/lib/queries/productionDetailUpdate.js')

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

test('a setup draft is found whether keyed by setup id or carrying machine_id', () => {
  const bySetupId = { 'setup-1': { speed: 78, machine_id: 'machine-1' } }
  assert.equal(findSetupDraft(bySetupId, 'setup-1', 'machine-1').speed, 78)

  const byUnrelatedKey = { 'draft-row': { speed: 90, machine_id: 'machine-1' } }
  assert.equal(findSetupDraft(byUnrelatedKey, 'setup-1', 'machine-1').speed, 90)
  assert.equal(mergeSetupDraft(setup, 'machine-1', byUnrelatedKey).speed, 90)
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

test('production updates cannot reassign rows to another header or machine', () => {
  assert.deepEqual(
    sanitizeProductionDetailUpdate({
      header_id: 'different-header',
      machine_id: 'different-machine',
      created_at: new Date(0),
      updated_at: new Date(0),
      act_prodn: 42
    }),
    { act_prodn: 42 }
  )
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
