/**
 * Small, database-independent helpers shared by production reports.
 * Keeping these calculations pure makes the boundary cases directly testable.
 */

export function finiteNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function averagePresent(values) {
  const present = values
    .filter(value => value != null && value !== '')
    .map(value => Number(value))
    .filter(Number.isFinite)

  if (present.length === 0) return 0
  return present.reduce((sum, value) => sum + value, 0) / present.length
}

export function percentageOf(numerator, denominator) {
  const safeNumerator = finiteNumber(numerator)
  const safeDenominator = finiteNumber(denominator)
  return safeDenominator > 0 ? (safeNumerator / safeDenominator) * 100 : 0
}

export function calculateAutoconerPerformance({
  workTime = 0,
  runTime = 0,
  idleDrums = 0,
  drumCapacity = 0,
  redLight = 0,
  machineCount = 0,
} = {}) {
  const safeWorkTime = Math.max(0, finiteNumber(workTime))
  const safeRunTime = Math.max(0, finiteNumber(runTime))
  const safeCapacity = Math.max(0, finiteNumber(drumCapacity))
  const safeIdleDrums = Math.min(
    safeCapacity,
    Math.max(0, finiteNumber(idleDrums))
  )
  const safeMachineCount = Math.max(0, finiteNumber(machineCount))
  const utilizationPercent = percentageOf(safeWorkTime, safeRunTime)
  const drumEfficiencyPercent = safeCapacity > 0
    ? 100 - percentageOf(safeIdleDrums, safeCapacity)
    : 0

  return {
    efficiencyPercent: utilizationPercent * (drumEfficiencyPercent / 100),
    utilizationPercent,
    drumEfficiencyPercent,
    averageRedLight: safeMachineCount > 0
      ? finiteNumber(redLight) / safeMachineCount
      : 0,
  }
}

/**
 * Return the same day in the previous month, clamped to that month's final day.
 * For example, 31-Mar becomes 28-Feb (or 29-Feb in a leap year), never 03-Mar.
 */
export function previousMonthClamped(dateValue) {
  const source = new Date(dateValue)
  if (Number.isNaN(source.getTime())) throw new Error('A valid report date is required')

  const year = source.getFullYear()
  const month = source.getMonth()
  const previousMonthLastDay = new Date(year, month, 0).getDate()
  return new Date(
    year,
    month - 1,
    Math.min(source.getDate(), previousMonthLastDay),
    0,
    0,
    0,
    0
  )
}

export function summarizeSpinningAbstractRows(rows = []) {
  const summaries = new Map()

  for (const row of rows) {
    const countName = row.count_name || 'UNKNOWN'
    if (!summaries.has(countName)) {
      summaries.set(countName, {
        countName,
        conv40sValue: finiteNumber(row.conv_40s_value),
        machines: new Map(),
        productionKg: 0,
        wasteKg: 0,
        expGpsSum: 0,
        expGpsCount: 0,
        achievedGpsSum: 0,
        achievedGpsCount: 0,
        totalRunTime: 0,
        totalStoppageMins: 0,
      })
    }

    const summary = summaries.get(countName)
    if (!summary.conv40sValue && row.conv_40s_value != null) {
      summary.conv40sValue = finiteNumber(row.conv_40s_value)
    }

    const machineId = row.machine_id || `${countName}:${row.machine_no || summary.machines.size}`
    const allocatedSpindles = Math.max(0, finiteNumber(row.allocated_spindles))
    const priorSpindles = summary.machines.get(machineId)
    if (priorSpindles == null || allocatedSpindles > priorSpindles) {
      summary.machines.set(machineId, allocatedSpindles)
    }

    summary.productionKg += finiteNumber(row.production_kg ?? row.act_prodn)
    summary.wasteKg += finiteNumber(row.waste_kg ?? row.waste)
    summary.totalRunTime += Math.max(0, finiteNumber(row.run_time))
    summary.totalStoppageMins += Math.max(0, finiteNumber(row.total_stoppage_mins))

    if (row.exp_gps != null && Number.isFinite(Number(row.exp_gps))) {
      summary.expGpsSum += Number(row.exp_gps)
      summary.expGpsCount += 1
    }
    if (row.achieved_gps != null && Number.isFinite(Number(row.achieved_gps))) {
      summary.achievedGpsSum += Number(row.achieved_gps)
      summary.achievedGpsCount += 1
    }
  }

  return [...summaries.values()].map(summary => {
    const gpsStd = summary.expGpsCount > 0 ? summary.expGpsSum / summary.expGpsCount : 0
    const gpsAchieved = summary.achievedGpsCount > 0
      ? summary.achievedGpsSum / summary.achievedGpsCount
      : 0
    const boundedStoppage = Math.min(summary.totalStoppageMins, summary.totalRunTime)
    const utilizationPercent = percentageOf(
      summary.totalRunTime - boundedStoppage,
      summary.totalRunTime
    )

    return {
      countName: summary.countName,
      machineCount: summary.machines.size,
      totalSpindles: [...summary.machines.values()].reduce((sum, value) => sum + value, 0),
      productionKg: summary.productionKg,
      production40s: summary.productionKg * summary.conv40sValue,
      gpsStd,
      gpsAchieved,
      gps40s: summary.conv40sValue * gpsAchieved,
      wasteKg: summary.wasteKg,
      wastePercent: percentageOf(summary.wasteKg, summary.productionKg),
      utilizationPercent,
      gainLoss: gpsStd - gpsAchieved,
    }
  })
}
