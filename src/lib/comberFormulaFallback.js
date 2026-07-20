/**
 * Fallback-only defaults for Comber production formulas.
 * Primary source is machine setup/master data; use these only when fields are missing.
 */
export const COMBER_FORMULA_FALLBACK = {
  slHank: 0.14,
  mcEffiPercent: 93,
  mcEffiFactor: 0.93,
}

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value) || 0
  if (typeof value === 'object' && value.toString) return Number.parseFloat(value.toString()) || 0
  return 0
}

export function calculateComberConstantFromSlHank(slHank) {
  const hank = toNumber(slHank)
  if (!hank) return 0
  return 1 / 2.20456 / hank
}

// Supports both legacy percent inputs (e.g. 93) and factor inputs (e.g. 0.93).
export function resolveComberMcEffiFactor(value) {
  const n = toNumber(value)
  if (n <= 0) return COMBER_FORMULA_FALLBACK.mcEffiFactor
  return n > 1 ? (n / 100) : n
}

export function resolveComberFormulaInputs(setup = {}, machine = null) {
  const slHank =
    toNumber(setup?.sl_hank) ||
    toNumber(machine?.sliver_hank) ||
    COMBER_FORMULA_FALLBACK.slHank

  const mcEffiFactor = resolveComberMcEffiFactor(
    setup?.mc_effi ?? machine?.mc_effi ?? COMBER_FORMULA_FALLBACK.mcEffiFactor
  )
  const mcEffiPercent = mcEffiFactor * 100

  const setupConstant = toNumber(setup?.constant)
  const constant = setupConstant || calculateComberConstantFromSlHank(slHank)

  return {
    slHank,
    mcEffiFactor,
    mcEffiPercent,
    constant,
  }
}
