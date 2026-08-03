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
  poundsPerKg: 2.20456,
}

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number.parseFloat(value?.toString?.() ?? String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveBreakerDrawingFormulaInputs(setup = {}, machineSpeed = null) {
  const speed = toNumber(setup?.speed) ?? toNumber(machineSpeed) ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed
  const hankConstant = toNumber(setup?.hank_constant) ?? BREAKER_DRAWING_FORMULA_FALLBACK.hankConstant
  const stdEfficiencyFactor = toNumber(setup?.std_efficiency_factor) ?? BREAKER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor
  const divisorConstant = toNumber(setup?.divisor_constant) ?? BREAKER_DRAWING_FORMULA_FALLBACK.divisorConstant
  const delivery = toNumber(setup?.delivery) ?? BREAKER_DRAWING_FORMULA_FALLBACK.delivery

  return {
    speed,
    hankConstant,
    stdEfficiencyFactor,
    divisorConstant,
    delivery,
  }
}

export function getBreakerDrawingActProdnConstant(setup = {}) {
  const { hankConstant } = resolveBreakerDrawingFormulaInputs(setup)
  const divisor = BREAKER_DRAWING_FORMULA_FALLBACK.poundsPerKg * hankConstant
  return divisor > 0 ? 1 / divisor : 0
}

export function calculateBreakerDrawingStdProdn(setup, totalTime, machineSpeed = null) {
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveBreakerDrawingFormulaInputs(setup, machineSpeed)
  const safeTotalTime = toNumber(totalTime)
  if (
    safeTotalTime === null || safeTotalTime <= 0 ||
    speed <= 0 || hankConstant <= 0 || stdEfficiencyFactor <= 0 ||
    divisorConstant <= 0 || delivery <= 0
  ) return 0
  return (speed / divisorConstant / hankConstant) * safeTotalTime * stdEfficiencyFactor * delivery
}
