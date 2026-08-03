/**
 * Simplex Machine Production Calculations
 * Pure utility functions for client-side calculations
 */

import { resolveSimplexFormulaInputs } from '@/lib/simplexFormulaFallback'
import { resolveProductionTime } from '@/lib/productionFormulaMath'
import {
  minutesToRunHours as formatMinutesAsRunHours,
  parseRunHoursToMinutes as parseRunHours
} from '@/lib/runHoursMath'

const toNonNegativeFiniteNumber = (value) => {
  const parsed = Number(value?.toString?.() ?? value)
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
}

const roundFinite = (value, decimals = 2) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  const factor = 10 ** decimals
  return Math.round(parsed * factor) / factor
}

/**
 * Parse run hours from HH.MM format to total minutes
 * e.g., 7.45 = 7 hours 45 minutes = 465 minutes
 */
export function parseRunHoursToMinutes(runHrs) {
  return parseRunHours(runHrs)
}

/**
 * Convert minutes to run hours format (HH.MM)
 * e.g., 465 minutes = 7.45
 */
export function minutesToRunHours(minutes) {
  return formatMinutesAsRunHours(minutes)
}

/**
 * Calculate Simplex production values based on machine parameters
 * 
 * Formula:
 * Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
 * Act.Effi % = (RunMin / Std.Hrs) × 100
 * Waste % = (Waste / Act.Prodn) × 100
 * UTI % = (WorkTime / TotalTime) × 100
 */
export function calculateSimplexProductionValues(params) {
  const {
    runHrs = 0,           // HH.MM format (e.g., 7.12)
    speed,
    tpi,
    hank,
    mcEffi,
    totalSpindles,
    idleSpindles = 0,     // Idle spindles input
    waste = 0,            // Waste in Kg
    totalTime = 0,
    stoppageTime = 0      // Total stoppage time
  } = params

  const formula = resolveSimplexFormulaInputs({
    overrides: {
      speed,
      tpi,
      hank,
      mcEffi,
      totalSpindles
    }
  })

  // Step 1: Convert Run Hours (HH.MM) to Run Minutes
  const productionTime = resolveProductionTime(totalTime, stoppageTime)
  const workTime = productionTime.workTime

  // Step 1: Convert Run Hours (HH.MM) to Run Minutes. Actual running time
  // cannot exceed the stoppage-adjusted available time.
  const runMin = Math.min(parseRunHoursToMinutes(runHrs), workTime)

  // Step 3: Calculate Standard Hours
  const mcEffiPercent = toNonNegativeFiniteNumber(formula.mcEffiPercent)
  const stdHrs = workTime * (mcEffiPercent / 100)

  // Step 4: Calculate Active Spindles (UNIQUE to Simplex)
  const totalSpindlesValue = toNonNegativeFiniteNumber(formula.totalSpindles)
  const effectiveIdleSpindles = Math.min(
    Math.floor(toNonNegativeFiniteNumber(idleSpindles)),
    totalSpindlesValue
  )
  const activeSpindles = totalSpindlesValue - effectiveIdleSpindles

  // Step 5: Calculate Actual Production using Simplex formula
  // Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
  let actProdn = 0
  const speedValue = toNonNegativeFiniteNumber(formula.speed)
  const tpiValue = toNonNegativeFiniteNumber(formula.tpi)
  const hankValue = toNonNegativeFiniteNumber(formula.slHank)
  if (speedValue > 0 && tpiValue > 0 && hankValue > 0 && runMin > 0 && activeSpindles > 0) {
    const baseRate = speedValue / tpiValue / formula.divisorA / formula.divisorB / hankValue
    actProdn = baseRate * runMin * activeSpindles
  }

  // Step 6: Calculate Actual Efficiency
  // Act.Effi % = (RunMin / Std.Hrs) × 100
  const actEffiPercent = stdHrs > 0 ? (runMin / stdHrs) * 100 : 0

  // Step 7: Calculate Waste Percentage
  // Waste % = (Waste / Act.Prodn) × 100
  const wasteValue = toNonNegativeFiniteNumber(waste)
  const wastePercent = actProdn > 0 ? (wasteValue / actProdn) * 100 : 0

  // Step 8: Calculate Utilization
  // UTI % = (WorkTime / TotalTime) × 100
  const utiPercent = productionTime.totalTime > 0
    ? (workTime / productionTime.totalTime) * 100
    : 0

  return {
    run_min: runMin,
    work_time: workTime,
    std_hrs: roundFinite(stdHrs, 1),
    act_prodn: roundFinite(actProdn),
    act_effi_percent: roundFinite(actEffiPercent),
    waste_percent: roundFinite(wastePercent),
    uti_percent: roundFinite(utiPercent)
  }
}
