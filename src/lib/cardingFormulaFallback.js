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
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number.parseFloat(value?.toString?.() ?? String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveCardingFormulaInputs(setup = {}) {
  const m = setup?.machine || {}
  
  let machineEffFactor = null
  if (toNumber(m.prodn_efficiency) !== null) {
      const rawEff = toNumber(m.prodn_efficiency)
      machineEffFactor = rawEff > 1 ? rawEff / 100 : rawEff
  }

  const speed = toNumber(setup?.speed) ?? toNumber(m.speed) ?? CARDING_FORMULA_FALLBACK.speed
  const hankConstant = toNumber(setup?.hank_constant) ?? toNumber(m.hank_constant) ?? CARDING_FORMULA_FALLBACK.hankConstant
  const stdEfficiencyFactor = toNumber(setup?.std_efficiency_factor) ?? machineEffFactor ?? CARDING_FORMULA_FALLBACK.stdEfficiencyFactor
  const divisorConstant = toNumber(setup?.divisor_constant) ?? toNumber(m.divisor_constant) ?? CARDING_FORMULA_FALLBACK.divisorConstant

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
