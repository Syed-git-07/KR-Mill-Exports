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

export const DEFAULT_SPINNING_EFFICIENCY_FACTOR = 0.95

export function normalizeSpinningEfficiencyFactor(
  value,
  fallback = DEFAULT_SPINNING_EFFICIENCY_FACTOR
) {
  if (value === null || value === undefined || value === '') return fallback
  const numeric = Number(value?.toString?.() ?? value)
  if (!Number.isFinite(numeric)) return fallback
  return numeric > 1 ? numeric / 100 : numeric
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

  return (100 - totalLossPercent) / 100
}

export function calculateSpinningAclConstant({
  aclCount,
  totalSpindles,
  twCon,
  doffLoss,
  cWastePercent,
  conversionFactor = 2.20456,
}) {
  const safeCount = toFiniteNumber(aclCount)
  const safeSpindles = toFiniteNumber(totalSpindles)
  const safeConversionFactor = toFiniteNumber(conversionFactor)
  if (!safeCount || !safeSpindles || !safeConversionFactor) return 0

  const lossEfficiency = calculateSpinningLossEfficiency({
    twCon,
    doffLoss,
    cWastePercent,
  })

  return (1 / safeConversionFactor / safeCount) * safeSpindles * lossEfficiency
}

export function calculateSpinningExpectedGps({
  speed,
  tpi,
  count,
  efficiency = DEFAULT_SPINNING_EFFICIENCY_FACTOR,
}) {
  const safeSpeed = toFiniteNumber(speed)
  const safeTpi = toFiniteNumber(tpi)
  const safeCount = toFiniteNumber(count)
  if (!safeSpeed || !safeTpi || !safeCount) return 0

  const efficiencyFactor = normalizeSpinningEfficiencyFactor(efficiency)

  return (7.2 * safeSpeed / safeTpi / safeCount) * efficiencyFactor
}

export function calculateSpinningNoOfSpindles(allocatedSpindles, shift) {
  const safeAllocatedSpindles = Math.max(toFiniteNumber(allocatedSpindles), 0)
  const multiplier = Number.parseInt(shift, 10) === 3 ? 7 : 8.5
  return Math.round((safeAllocatedSpindles / 8) * multiplier)
}

/**
 * Canonical Spinning entry calculation used by Production, Stoppage and the
 * server calculation action. Keeping the complete calculation here prevents
 * the two entry tabs from drifting when a draft value changes.
 */
export function calculateSpinningEntryMetrics({
  actHank = 0,
  waste = 0,
  actCount = 0,
  expectedCount = actCount,
  allocatedSpindles = 1104,
  shift = 1,
  stoppageMins = 0,
  runTime = 0,
  speed = 0,
  tpi = 0,
  twCon = 0,
  doffLoss = 0,
  cWastePercent = 0,
  efficiency = DEFAULT_SPINNING_EFFICIENCY_FACTOR,
  conversionFactor = 2.20456,
}) {
  const totalSpindles = calculateSpinningNoOfSpindles(allocatedSpindles, shift)
  const time = resolveProductionTime(runTime, stoppageMins)
  const constant = calculateSpinningAclConstant({
    aclCount: actCount,
    totalSpindles,
    twCon,
    doffLoss,
    cWastePercent,
    conversionFactor,
  })
  const actProdn = Math.max(toFiniteNumber(actHank), 0) * constant
  const wasteValue = Math.max(toFiniteNumber(waste), 0)
  const wastePercent = actProdn > 0 ? (wasteValue / actProdn) * 100 : 0
  const stoppedSpindles = time.totalTime > 0
    ? (time.stoppageTime / time.totalTime) * totalSpindles
    : 0
  const workedSpindles = Math.max(totalSpindles - stoppedSpindles, 0)
  const gps = workedSpindles > 0 ? (actProdn / workedSpindles) * 1000 : 0
  const expGps = calculateSpinningExpectedGps({
    speed,
    tpi,
    count: expectedCount,
    efficiency,
  })

  return {
    totalSpindles,
    constant: roundProductionValue(constant, 3),
    actProdn: roundProductionValue(actProdn),
    wastePercent: roundProductionValue(wastePercent),
    stoppedSpindles: roundProductionValue(stoppedSpindles),
    workedSpindles,
    gps: roundProductionValue(gps),
    expGps: roundProductionValue(expGps, 3),
    workTime: time.workTime,
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
