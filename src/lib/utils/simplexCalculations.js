/**
 * Simplex Machine Production Calculations
 * Pure utility functions for client-side calculations
 */

import { resolveSimplexFormulaInputs } from '@/lib/simplexFormulaFallback'

/**
 * Parse run hours from HH.MM format to total minutes
 * e.g., 7.45 = 7 hours 45 minutes = 465 minutes
 */
export function parseRunHoursToMinutes(runHrs) {
  if (!runHrs || isNaN(runHrs)) return 0
  const hrs = Math.floor(runHrs)
  const mins = Math.round((runHrs - hrs) * 100)
  return hrs * 60 + mins
}

/**
 * Convert minutes to run hours format (HH.MM)
 * e.g., 465 minutes = 7.45
 */
export function minutesToRunHours(minutes) {
  if (!minutes || isNaN(minutes)) return 0
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return parseFloat(`${hrs}.${mins.toString().padStart(2, '0')}`)
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
  const runMin = parseRunHoursToMinutes(runHrs)

  // Step 2: Calculate Work Time
  const workTime = totalTime - stoppageTime

  // Step 3: Calculate Standard Hours
  const stdHrs = workTime * (formula.mcEffiPercent / 100)

  // Step 4: Calculate Active Spindles (UNIQUE to Simplex)
  const activeSpindles = formula.totalSpindles - idleSpindles

  // Step 5: Calculate Actual Production using Simplex formula
  // Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
  let actProdn = 0
  if (formula.speed > 0 && formula.tpi > 0 && formula.slHank > 0 && runMin > 0 && activeSpindles > 0) {
    const baseRate = formula.speed / formula.tpi / formula.divisorA / formula.divisorB / formula.slHank
    actProdn = baseRate * runMin * activeSpindles
  }

  // Step 6: Calculate Actual Efficiency
  // Act.Effi % = (RunMin / Std.Hrs) × 100
  const actEffiPercent = stdHrs > 0 ? (runMin / stdHrs) * 100 : 0

  // Step 7: Calculate Waste Percentage
  // Waste % = (Waste / Act.Prodn) × 100
  const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

  // Step 8: Calculate Utilization
  // UTI % = (WorkTime / TotalTime) × 100
  const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0

  return {
    run_min: runMin,
    work_time: workTime,
    std_hrs: Math.round(stdHrs * 10) / 10,
    act_prodn: Math.round(actProdn * 100) / 100,
    act_effi_percent: Math.round(actEffiPercent * 100) / 100,
    waste_percent: Math.round(wastePercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100
  }
}
