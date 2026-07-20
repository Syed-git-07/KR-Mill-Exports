/**
 * Fallback-only defaults for Carding production formulas.
 * Primary source is machine setup/master data; use these only when fields are missing.
 */
export const CARDING_FORMULA_FALLBACK = {
  speed: 130,
  hankConstant: 0.13,
  stdEfficiencyFactor: 0.98,
  divisorConstant: 1693,
}

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value) || 0
  if (typeof value === 'object' && value.toString) return Number.parseFloat(value.toString()) || 0
  return 0
}

export function resolveCardingFormulaInputs(setup = {}) {
  const speed = toNumber(setup?.speed) || CARDING_FORMULA_FALLBACK.speed
  const hankConstant = toNumber(setup?.hank_constant) || CARDING_FORMULA_FALLBACK.hankConstant
  const stdEfficiencyFactor = toNumber(setup?.std_efficiency_factor) || CARDING_FORMULA_FALLBACK.stdEfficiencyFactor
  const divisorConstant = toNumber(setup?.divisor_constant) || CARDING_FORMULA_FALLBACK.divisorConstant

  return {
    speed,
    hankConstant,
    stdEfficiencyFactor,
    divisorConstant,
  }
}

export function calculateCardingStdProdn(setup, totalTime) {
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant } = resolveCardingFormulaInputs(setup)
  if (!totalTime || !hankConstant || !divisorConstant) return 0
  return (speed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor
}
