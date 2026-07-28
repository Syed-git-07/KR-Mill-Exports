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
