/**
 * Fallback-only defaults for Lap Former production formulas.
 * Primary source is machine setup/master data; use these only when fields are missing.
 */
export const LAP_FORMER_FORMULA_FALLBACK = {
  speed: 90,
  hankConstant: 0.0082,
  stdEfficiencyFactor: 0.85,
  divisorConstant: 1693,
  delivery: 1,
  poundsPerKg: 2.20456,
}

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value) || 0
  if (typeof value === 'object' && value.toString) return Number.parseFloat(value.toString()) || 0
  return 0
}

export function resolveLapFormerFormulaInputs(setup = {}, machineSpeed = null) {
  // Setup/draft speed must take precedence so cross-tab dynamic recalculation uses unsaved setup edits.
  const speed = toNumber(setup?.speed) || toNumber(machineSpeed) || LAP_FORMER_FORMULA_FALLBACK.speed
  const hankConstant = toNumber(setup?.hank_constant) || LAP_FORMER_FORMULA_FALLBACK.hankConstant
  const stdEfficiencyFactor = toNumber(setup?.std_efficiency_factor) || LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor
  const divisorConstant = toNumber(setup?.divisor_constant) || LAP_FORMER_FORMULA_FALLBACK.divisorConstant
  const delivery = toNumber(setup?.delivery) || LAP_FORMER_FORMULA_FALLBACK.delivery

  return {
    speed,
    hankConstant,
    stdEfficiencyFactor,
    divisorConstant,
    delivery,
  }
}

export function calculateLapFormerStdProdn(setup, totalTime, machineSpeed = null) {
  const safeTotalTime = toNumber(totalTime)
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveLapFormerFormulaInputs(setup, machineSpeed)
  if (!safeTotalTime || !hankConstant || !divisorConstant) return 0
  return (speed / divisorConstant / hankConstant) * safeTotalTime * stdEfficiencyFactor * delivery
}

export function getLapFormerActProdnConstant(setup = {}) {
  const { hankConstant, delivery } = resolveLapFormerFormulaInputs(setup)
  const divisor = LAP_FORMER_FORMULA_FALLBACK.poundsPerKg * hankConstant
  if (!divisor) return 0
  return (1 / divisor) * delivery
}
