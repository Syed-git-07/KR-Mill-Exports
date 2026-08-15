/**
 * Fallback-only defaults for Finisher Drawing production formulas.
 * Primary source is machine setup/master data; use these only when fields are missing.
 */
export const FINISHER_DRAWING_FORMULA_FALLBACK = {
  speed: 350,
  hankConstant: 0.14,
  stdEfficiencyFactor: 0.9,
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

export function resolveFinisherDrawingFormulaInputs(setup = {}, machineSpeed = null) {
  const m = setup?.machine || {}
  
  let machineEffFactor = null
  if (toNumber(m.prodn_efficiency) !== null) {
      const rawEff = toNumber(m.prodn_efficiency)
      machineEffFactor = rawEff > 1 ? rawEff / 100 : rawEff
  }

  const speed = toNumber(setup?.speed) ?? toNumber(machineSpeed) ?? toNumber(m.speed) ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed
  const hankConstant = toNumber(setup?.hank_constant) ?? toNumber(m.hank_constant) ?? FINISHER_DRAWING_FORMULA_FALLBACK.hankConstant
  const stdEfficiencyFactor = toNumber(setup?.std_efficiency_factor) ?? machineEffFactor ?? FINISHER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor
  const divisorConstant = toNumber(setup?.divisor_constant) ?? toNumber(m.divisor_constant) ?? FINISHER_DRAWING_FORMULA_FALLBACK.divisorConstant
  const delivery = toNumber(setup?.delivery) ?? toNumber(m.delivery) ?? FINISHER_DRAWING_FORMULA_FALLBACK.delivery

  return {
    speed,
    hankConstant,
    stdEfficiencyFactor,
    divisorConstant,
    delivery,
  }
}

export function calculateFinisherDrawingStdProdn(setup, totalTime, machineSpeed = null) {
  const safeTotalTime = toNumber(totalTime)
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveFinisherDrawingFormulaInputs(setup, machineSpeed)
  if (!safeTotalTime || !hankConstant || !divisorConstant) return 0
  return (speed / divisorConstant / hankConstant) * safeTotalTime * stdEfficiencyFactor * delivery
}

export function getFinisherDrawingActProdnConstant(setup = {}) {
  const { hankConstant } = resolveFinisherDrawingFormulaInputs(setup)
  const divisor = FINISHER_DRAWING_FORMULA_FALLBACK.poundsPerKg * hankConstant
  if (!divisor) return 0
  return 1 / divisor
}
