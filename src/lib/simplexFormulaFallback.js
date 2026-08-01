/**
 * Fallback-only defaults for Simplex runtime and production formulas.
 *
 * Production calculations should prefer DB-driven machine/setup/shift_config values.
 * These values are only used when DB values are missing.
 */
export const SIMPLEX_FORMULA_FALLBACK = {
  shiftDayMinutes: 510,
  shiftNightMinutes: 420,
  speed: 960,
  tpi: 1.73,
  slHank: 1.4,
  mcEffiPercent: 92,
  totalSpindles: 140,
  productionRateDivisorA: 39.3,
  productionRateDivisorB: 1693
}

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = parseFloat(value?.toString?.() ?? String(value))
  return Number.isFinite(parsed) ? parsed : null
}

// Supports both factor (0.925) and percent (92.5) storage styles.
export function resolveSimplexMcEffiPercent(value) {
  const n = toNumber(value)
  if (n === null) return SIMPLEX_FORMULA_FALLBACK.mcEffiPercent
  return n <= 1 ? (n * 100) : n
}

export function resolveSimplexShiftFallbackTime(shift) {
  return parseInt(shift, 10) === 3
    ? SIMPLEX_FORMULA_FALLBACK.shiftNightMinutes
    : SIMPLEX_FORMULA_FALLBACK.shiftDayMinutes
}

export function resolveSimplexFormulaInputs({ machine, setup, overrides } = {}) {
  const speed = toNumber(overrides?.speed) ?? toNumber(setup?.speed) ?? toNumber(machine?.speed) ?? SIMPLEX_FORMULA_FALLBACK.speed
  const tpi = toNumber(overrides?.tpi) ?? toNumber(setup?.tpi) ?? toNumber(machine?.tpi) ?? SIMPLEX_FORMULA_FALLBACK.tpi
  const slHank = toNumber(overrides?.hank) ?? toNumber(setup?.sl_hank) ?? SIMPLEX_FORMULA_FALLBACK.slHank
  const mcEffiPercent = resolveSimplexMcEffiPercent(
    overrides?.mcEffi ?? setup?.mc_effi ?? machine?.mc_effi ?? SIMPLEX_FORMULA_FALLBACK.mcEffiPercent
  )
  const totalSpindles = toNumber(overrides?.totalSpindles) ?? toNumber(setup?.spindles) ?? toNumber(machine?.no_of_spindles) ?? SIMPLEX_FORMULA_FALLBACK.totalSpindles

  return {
    speed,
    tpi,
    slHank,
    mcEffiPercent,
    totalSpindles,
    divisorA: SIMPLEX_FORMULA_FALLBACK.productionRateDivisorA,
    divisorB: SIMPLEX_FORMULA_FALLBACK.productionRateDivisorB
  }
}
