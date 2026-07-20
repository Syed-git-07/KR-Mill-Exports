/**
 * Fallback-only defaults for Breaker Drawing production formulas.
 * Primary source is machine setup/master data; use these only when fields are missing.
 */
export const BREAKER_DRAWING_FORMULA_FALLBACK = {
  speed: 750,
  hankConstant: 0.14,
  stdEfficiencyFactor: 0.85,
  divisorConstant: 1693,
  delivery: 1,
}

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value) || 0
  if (typeof value === 'object' && value.toString) return Number.parseFloat(value.toString()) || 0
  return 0
}

export function resolveBreakerDrawingFormulaInputs(setup = {}, machineSpeed = null) {
  const speed = toNumber(machineSpeed) || toNumber(setup?.speed) || BREAKER_DRAWING_FORMULA_FALLBACK.speed
  const hankConstant = toNumber(setup?.hank_constant) || BREAKER_DRAWING_FORMULA_FALLBACK.hankConstant
  const stdEfficiencyFactor = toNumber(setup?.std_efficiency_factor) || BREAKER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor
  const divisorConstant = toNumber(setup?.divisor_constant) || BREAKER_DRAWING_FORMULA_FALLBACK.divisorConstant
  const delivery = toNumber(setup?.delivery) || BREAKER_DRAWING_FORMULA_FALLBACK.delivery

  return {
    speed,
    hankConstant,
    stdEfficiencyFactor,
    divisorConstant,
    delivery,
  }
}

export function calculateBreakerDrawingStdProdn(setup, totalTime, machineSpeed = null) {
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveBreakerDrawingFormulaInputs(setup, machineSpeed)
  if (!totalTime || !hankConstant || !divisorConstant) return 0
  return (speed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery
}
