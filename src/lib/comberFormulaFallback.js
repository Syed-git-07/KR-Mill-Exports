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
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number.parseFloat(value?.toString?.() ?? String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function calculateComberConstantFromSlHank(slHank) {
  const hank = toNumber(slHank)
  if (!hank) return 0
  return 1 / 2.20456 / hank
}

// Supports both legacy percent inputs (e.g. 93) and factor inputs (e.g. 0.93).
export function resolveComberMcEffiFactor(value) {
  const n = toNumber(value)
  if (n === null) return COMBER_FORMULA_FALLBACK.mcEffiFactor
  return n > 1 ? (n / 100) : n
}

export function resolveComberFormulaInputs(setup = {}, machine = null) {
  const m = machine || setup?.machine || {}
  
  const slHank =
    toNumber(setup?.sl_hank) ||
    toNumber(m?.sliver_hank) ||
    COMBER_FORMULA_FALLBACK.slHank

  let machineEffFactor = null
  if (toNumber(m?.mc_effi) !== null) {
      const rawEff = toNumber(m.mc_effi)
      machineEffFactor = rawEff > 1 ? rawEff / 100 : rawEff
  }

  const mcEffiFactor = resolveComberMcEffiFactor(
    toNumber(setup?.mc_effi) || machineEffFactor || COMBER_FORMULA_FALLBACK.mcEffiFactor
  )
  const mcEffiPercent = mcEffiFactor * 100

  // Constant is formula-owned. Recompute it from the effective Sliver Hank so
  // an unsaved hank draft cannot be paired with an old stored constant.
  const constant = calculateComberConstantFromSlHank(slHank)

  return {
    slHank,
    mcEffiFactor,
    mcEffiPercent,
    constant,
  }
}
