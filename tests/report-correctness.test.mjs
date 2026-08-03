import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const importSourceModule = async (relativePath) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const {
  averagePresent,
  calculateAutoconerPerformance,
  percentageOf,
  previousMonthClamped,
  summarizeSpinningAbstractRows,
} = await importSourceModule('../src/lib/reportMath.js')

test('report averages exclude missing observations but retain explicit zeroes', () => {
  assert.equal(averagePresent([null, undefined, '', 0, 50]), 25)
  assert.equal(averagePresent([]), 0)
  assert.equal(averagePresent(['not-a-number', Infinity]), 0)
})

test('report percentages are calculated from aggregate quantities', () => {
  assert.equal(percentageOf(10, 400), 2.5)
  assert.equal(percentageOf(10, 0), 0)

  const production = 100 + 900
  const waste = 10 + 18
  assert.ok(Math.abs(percentageOf(waste, production) - 2.8) < 1e-12)
})

test('Autoconer performance totals weight partial days by their underlying time', () => {
  const total = calculateAutoconerPerformance({
    workTime: 100,
    runTime: 1000,
    idleDrums: 0,
    drumCapacity: 20,
    redLight: 12,
    machineCount: 4,
  })

  // A simple mean of the two imagined daily efficiencies (100% and 0%) would
  // be 50%; the aggregate time quantities correctly produce 10%.
  assert.equal(total.efficiencyPercent, 10)
  assert.equal(total.utilizationPercent, 10)
  assert.equal(total.averageRedLight, 3)
})

test('previous-month comparison dates clamp to the prior month end', () => {
  const leapYear = previousMonthClamped(new Date(2024, 2, 31))
  assert.deepEqual(
    [leapYear.getFullYear(), leapYear.getMonth(), leapYear.getDate()],
    [2024, 1, 29]
  )

  const ordinaryYear = previousMonthClamped(new Date(2025, 2, 31))
  assert.deepEqual(
    [ordinaryYear.getFullYear(), ordinaryYear.getMonth(), ordinaryYear.getDate()],
    [2025, 1, 28]
  )

  const yearBoundary = previousMonthClamped(new Date(2025, 0, 31))
  assert.deepEqual(
    [yearBoundary.getFullYear(), yearBoundary.getMonth(), yearBoundary.getDate()],
    [2024, 11, 31]
  )
})

test('spinning abstract accumulates rows and keeps unique historical spindle capacity', () => {
  const [summary] = summarizeSpinningAbstractRows([
    {
      machine_id: 'machine-1',
      count_name: '40 COUNT',
      allocated_spindles: 1000,
      conv_40s_value: 1.25,
      production_kg: 100,
      waste_kg: 5,
      exp_gps: 10,
      achieved_gps: 8,
      run_time: 510,
      total_stoppage_mins: 10,
    },
    {
      machine_id: 'machine-2',
      count_name: '40 COUNT',
      allocated_spindles: 1200,
      conv_40s_value: 1.25,
      production_kg: 200,
      waste_kg: 5,
      exp_gps: 20,
      achieved_gps: 12,
      run_time: 420,
      total_stoppage_mins: 20,
    },
    {
      // A second shift for machine-1 contributes production and time, but not
      // a second copy of that machine's spindle capacity.
      machine_id: 'machine-1',
      count_name: '40 COUNT',
      allocated_spindles: 1000,
      conv_40s_value: 1.25,
      production_kg: 50,
      waste_kg: 0,
      exp_gps: 0,
      achieved_gps: 0,
      run_time: 510,
      total_stoppage_mins: 0,
    },
  ])

  assert.equal(summary.machineCount, 2)
  assert.equal(summary.totalSpindles, 2200)
  assert.equal(summary.productionKg, 350)
  assert.equal(summary.production40s, 437.5)
  assert.equal(summary.wasteKg, 10)
  assert.equal(summary.wastePercent, (10 / 350) * 100)
  assert.equal(summary.gpsStd, 10)
  assert.equal(summary.gpsAchieved, 20 / 3)
  assert.equal(summary.utilizationPercent, ((1440 - 30) / 1440) * 100)
})

test('Autoconer report sources use the configured target and correct time ratio', async () => {
  const abstractSource = await readFile(
    new URL('../src/app/reports/autoconer/abstract/autoconerAbstractReportQueries.js', import.meta.url),
    'utf8'
  )
  const lowEfficiencySource = await readFile(
    new URL('../src/lib/queries/autoconerLowEfficiencyReportQueries.js', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(abstractSource, /d\.run_time\s*\/\s*d\.work_time/)
  assert.match(abstractSource, /d\.work_time\s*\/\s*NULLIF\(d\.run_time, 0\)/)
  assert.match(lowEfficiencySource, /act_effi:\s*Number\(m\.act_effi\)/)
  assert.doesNotMatch(lowEfficiencySource, /prisma\.spinning_counts/)
})
