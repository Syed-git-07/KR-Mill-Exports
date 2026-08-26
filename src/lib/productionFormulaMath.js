const toFiniteNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value?.toString?.() ?? value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function roundProductionValue(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(toFiniteNumber(value) * factor) / factor
}

export function resolveProductionTime(totalTime, stoppageTime) {
  const safeTotalTime = Math.max(toFiniteNumber(totalTime), 0)
  const safeStoppageTime = Math.min(
    Math.max(toFiniteNumber(stoppageTime), 0),
    safeTotalTime
  )

  return {
    totalTime: safeTotalTime,
    stoppageTime: safeStoppageTime,
    workTime: safeTotalTime - safeStoppageTime,
  }
}

export function calculateSpinningLossEfficiency({
  twCon,
  doffLoss,
  cWastePercent,
}) {
  const totalLossPercent =
    toFiniteNumber(twCon) +
    toFiniteNumber(doffLoss) +
    toFiniteNumber(cWastePercent)

  return Math.max(100 - totalLossPercent, 0) / 100
}

export function calculateSpinningExpectedGps({
  speed,
  tpi,
  count,
  efficiency = 0.95,
}) {
  const safeSpeed = toFiniteNumber(speed)
  const safeTpi = toFiniteNumber(tpi)
  const safeCount = toFiniteNumber(count)
  if (!safeSpeed || !safeTpi || !safeCount) return 0

  const safeEfficiency = Math.min(Math.max(toFiniteNumber(efficiency, 0.95), 0), 1)

  return (7.2 * safeSpeed / safeTpi / safeCount) * safeEfficiency
}

export function calculateSpinningEntryMetrics({
  actHank,
  waste,
  stoppageMins,
  runTime,
  allocatedSpindles,
  shift,
  actCount,
  lossEfficiency,
  expectedGps,
}) {
  const time = resolveProductionTime(runTime, stoppageMins)
  const safeAllocatedSpindles = Math.max(toFiniteNumber(allocatedSpindles), 0)
  const multiplier = Number(shift) === 3 ? 7 : 8.5
  const totalSpindles = Math.round((safeAllocatedSpindles / 8) * multiplier)
  const safeActCount = Math.max(toFiniteNumber(actCount), 0)
  const safeLossEfficiency = Math.max(toFiniteNumber(lossEfficiency), 0)
  const constant = safeActCount > 0
    ? (1 / 2.20456 / safeActCount) * totalSpindles * safeLossEfficiency
    : 0
  const actualProduction = Math.max(toFiniteNumber(actHank), 0) * constant
  const wasteValue = Math.max(toFiniteNumber(waste), 0)
  const wastePercent = actualProduction > 0 ? (wasteValue / actualProduction) * 100 : 0
  const stoppedSpindles = time.totalTime > 0
    ? (time.stoppageTime / time.totalTime) * totalSpindles
    : 0
  const workedSpindles = Math.max(totalSpindles - stoppedSpindles, 0)
  const gps = workedSpindles > 0 ? (actualProduction / workedSpindles) * 1000 : 0

  return {
    act_prodn: roundProductionValue(actualProduction),
    waste_percent: roundProductionValue(wastePercent),
    stopped_spindles: roundProductionValue(stoppedSpindles),
    worked_spindles: workedSpindles,
    gps: roundProductionValue(gps),
    exp_gps: roundProductionValue(expectedGps, 3),
    work_time: time.workTime,
    _constant: roundProductionValue(constant, 3),
    _totalSpindles: totalSpindles,
  }
}

/**
 * Shared workbook rules for Carding, Breaker Drawing, Finisher Drawing and
 * Lap Former:
 *   Expected production = standard production / total time × work time
 *   Efficiency          = actual production / expected production × 100
 *   Utilization         = work time / total time × 100
 *   Waste               = waste / actual production × 100
 */
export function calculateTimeAdjustedProductionMetrics({
  actualProduction,
  standardProduction,
  waste,
  totalTime,
  stoppageTime,
}) {
  const actual = Math.max(toFiniteNumber(actualProduction), 0)
  const standard = Math.max(toFiniteNumber(standardProduction), 0)
  const wasteValue = Math.max(toFiniteNumber(waste), 0)
  const time = resolveProductionTime(totalTime, stoppageTime)

  const expected = time.totalTime > 0
    ? standard * (time.workTime / time.totalTime)
    : 0
  const efficiency = expected > 0 ? (actual / expected) * 100 : 0
  const utilization = time.totalTime > 0
    ? (time.workTime / time.totalTime) * 100
    : 0
  const wastePercent = actual > 0 ? (wasteValue / actual) * 100 : 0

  return {
    actualProduction: roundProductionValue(actual),
    standardProduction: roundProductionValue(standard),
    expectedProduction: roundProductionValue(expected),
    efficiencyPercent: roundProductionValue(efficiency),
    utilizationPercent: roundProductionValue(utilization),
    wastePercent: roundProductionValue(wastePercent),
    ...time,
  }
}
