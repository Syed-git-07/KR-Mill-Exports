const toFiniteNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value?.toString?.() ?? value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toNonNegativeFiniteNumber = (value, fallback = 0) => (
  Math.max(toFiniteNumber(value, fallback), 0)
)

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

/**
 * One shared Spinning calculation for both Production and Stoppage grids.
 * Keeping it here prevents the two views from drifting when stoppage drafts
 * change before the overall Update is committed.
 */
export function calculateSpinningGpsMetrics({
  actHank,
  actCount,
  allocatedSpindles,
  efficiency,
  speed,
  tpi,
  waste,
  totalTime,
  stoppageTime,
  shiftNo,
}) {
  const time = resolveProductionTime(totalTime, stoppageTime)
  const safeActHank = toNonNegativeFiniteNumber(actHank)
  const safeActCount = toNonNegativeFiniteNumber(actCount)
  const safeAllocatedSpindles = toNonNegativeFiniteNumber(allocatedSpindles)
  const safeEfficiency = toNonNegativeFiniteNumber(efficiency)
  const safeSpeed = toNonNegativeFiniteNumber(speed)
  const safeTpi = toNonNegativeFiniteNumber(tpi)
  const safeWaste = toNonNegativeFiniteNumber(waste)
  const multiplier = Number(shiftNo) === 3 ? 7 : 8.5
  const totalSpindles = Math.round((safeAllocatedSpindles / 8) * multiplier)

  // The production workbook uses a fixed 0.985 factor for actual production.
  const constant = safeActCount > 0
    ? (1 / 2.20456 / safeActCount) * totalSpindles * 0.985
    : 0
  const actualProduction = safeActHank * constant
  const stoppedSpindles = time.totalTime > 0
    ? (time.stoppageTime / time.totalTime) * totalSpindles
    : 0
  const workedSpindles = Math.max(totalSpindles - stoppedSpindles, 0)
  const gps = workedSpindles > 0
    ? (actualProduction / workedSpindles) * 1000
    : 0
  const expectedGps = safeActCount > 0 && safeSpeed > 0 && safeTpi > 0
    ? (7.2 * safeSpeed / safeTpi / safeActCount) * safeEfficiency
    : 0
  const wastePercent = actualProduction > 0
    ? (safeWaste / actualProduction) * 100
    : 0

  return {
    actualProduction: roundProductionValue(actualProduction),
    stoppedSpindles: roundProductionValue(stoppedSpindles),
    workedSpindles: roundProductionValue(workedSpindles),
    gps: roundProductionValue(gps),
    expectedGps: roundProductionValue(expectedGps),
    wastePercent: roundProductionValue(wastePercent),
    constant: roundProductionValue(constant, 3),
    totalSpindles,
    ...time,
  }
}
