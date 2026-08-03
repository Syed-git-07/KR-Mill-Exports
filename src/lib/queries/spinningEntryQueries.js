import { prisma } from '../prisma'
import { resolveSpinningShiftFallbackTime } from '../spinningShiftFallback'
import { buildStoppageUpdate, findFirstFreeStoppageSlot } from '../stoppageSlotUtils'
import { copyPreviousSpeeds, getAvailablePreviousSpeedDates } from './copyPreviousSpeed'
import { calculateSpinningGpsMetrics, resolveProductionTime } from '../productionFormulaMath'
import { assertActiveStoppageReasons } from './stoppageValidation'
import { sanitizeProductionDetailUpdate, sanitizeProductionHeaderUpdate } from './productionDetailUpdate'
import { sanitizeSpinningSetupUpdate, validateCompleteSpinningSetup } from '../machineSetupValidation'
import { parseStrictDate } from '../strictDate'
import {
  assertLifecycleCanStart,
  deactivateEntryMachines,
  normalizeMachineNumber,
  resolveEntryMachineContext,
  sameCalendarDate,
  validateInstalledDateForActivation
} from './entryMachineLifecycle'

const SPINNING_DEFAULT_SETUP_DATE_KEY = '2026-04-01'
const SPINNING_DEFAULT_SETUP_DATE = new Date(`${SPINNING_DEFAULT_SETUP_DATE_KEY}T00:00:00.000Z`)

const isProvided = value => value !== null && value !== undefined && value !== ''

function toFiniteNumber(value, fallback = 0) {
  if (!isProvided(value)) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function firstProvidedNumber(values, fallback = 0) {
  for (const value of values) {
    if (!isProvided(value)) continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function buildSpinningMachineVisibilityWhere(entryDate) {
  return {
    AND: [
      { OR: [{ activated_at: null }, { activated_at: { lte: entryDate } }] },
      {
        OR: [
          { deactivated_at: { gt: entryDate } },
          { deactivated_at: null, is_active: true }
        ]
      }
    ]
  }
}

function isSpinningMachineVisibleOnDate(machine, entryDate) {
  if (!machine) return false
  if (machine.activated_at && new Date(machine.activated_at) > entryDate) return false
  if (machine.deactivated_at && new Date(machine.deactivated_at) <= entryDate) return false
  if (!machine.activated_at && !machine.deactivated_at && machine.is_active === false) return false
  return true
}

function applySpinningCountMaster(setup, countMaster) {
  if (!countMaster) return setup
  return {
    ...setup,
    ...(isProvided(countMaster.count_name) && { count_name: String(countMaster.count_name).trim() }),
    ...(isProvided(countMaster.act_count) && { act_count: toFiniteNumber(countMaster.act_count) }),
    ...(isProvided(countMaster.tpi) && { tpi: toFiniteNumber(countMaster.tpi) }),
    ...(isProvided(countMaster.speed) && { speed: toFiniteNumber(countMaster.speed) }),
    ...(isProvided(countMaster.tw_con) && { tw_con: toFiniteNumber(countMaster.tw_con) }),
    ...(isProvided(countMaster.doff_loss) && { doff_loss: toFiniteNumber(countMaster.doff_loss) }),
    ...(isProvided(countMaster.waste_percent) && { c_waste_percent: toFiniteNumber(countMaster.waste_percent) })
  }
}

/**
 * Spinning (Ring Frame) Production Entry Queries
 * 
 * Database Tables:
 * - spinning_production_header
 * - spinning_production_detail
 * - spinning_stoppage_entry
 * - spinning_machine_setup
 * - spinning_machines
 * 
 * FORMULAS (from spinning_count-formula.md):
 * 
 * CONSTANT = 1 / 2.20456 / ACL_Count × Total_Spl × 0.985 (constant efficiency)
 * ACL_PROD (Kg) = ACL_Hank × Constant
 * WASTE % = (Waste / ACL_Prod) × 100
 * STOPPED_SPL = (Stoppage_Mins / Total_Mins) × Total_Spl
 * WORKED_SPL = Total_Spl - Stopped_Spl
 * GPS = (ACL_Prod / Worked_Spl) × 1000
 * EXP_GPS = 7.2 × Speed / TPI / Count × Effi
 */

// ============================================
// SHIFT CONFIGURATION QUERIES
// ============================================

// Get shift configuration for spinning department
export async function getSpinningShiftConfig(shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'SPINNING',
        shift: parseInt(shift),
        is_active: true
      }
    })
    return data
  } catch (error) {
    console.error('Error fetching spinning shift config:', error)
    throw error
  }
}

// Get all shift configurations for spinning
export async function getAllSpinningShiftConfigs() {
  try {
    const data = await prisma.shift_config.findMany({
      where: {
        department_code: 'SPINNING',
        is_active: true
      },
      orderBy: {
        shift: 'asc'
      }
    })
    return data
  } catch (error) {
    console.error('Error fetching all spinning shift configs:', error)
    throw error
  }
}

// Get shift time for spinning based on shift_config.
// Use centralized fallback only when shift_config is unavailable.
export async function getSpinningShiftTime(shift) {
  const config = await getSpinningShiftConfig(shift)
  if (config?.shift_time) return config.shift_time
  return resolveSpinningShiftFallbackTime(shift)
}

// No default stoppage for spinning - always 0
export async function getSpinningDefaultStoppage(shift) {
  return 0
}

// Get full shift configuration for spinning
export async function getSpinningShiftConfiguration(shift) {
  const config = await getSpinningShiftConfig(shift)
  const shiftTime = config?.shift_time ?? resolveSpinningShiftFallbackTime(shift)
  
  return {
    totalTime: shiftTime,
    defaultStoppage: 0,
    workTime: shiftTime,
    config: config
  }
}

// ============================================
// FORMULA CALCULATIONS
// ============================================

/**
 * Calculate No of Spindles based on shift
 * Formula: 
 *   Shift 1 & 2: (Allocated Spindles / 8) × 8.5
 *   Shift 3:     (Allocated Spindles / 8) × 7
 */
export function calculateNoOfSpindles(allocatedSpindles, shift) {
  const safeAllocatedSpindles = Math.max(toFiniteNumber(allocatedSpindles), 0)
  if (safeAllocatedSpindles === 0) return 0
  const multiplier = parseInt(shift) === 3 ? 7 : 8.5
  return Math.round((safeAllocatedSpindles / 8) * multiplier)
}

/**
 * Calculate Constant for spinning production
 * Formula: Constant = 1 / 2.20456 / ACL_Count × Total_Spl × CONSTANT_EFFICIENCY
 * Note: CONSTANT_EFFICIENCY is always 0.985 (98.5%) - this is a fixed conversion factor,
 *       NOT the same as the machine setup efficiency (0.95) used in Exp GPS calculation.
 */
const CONSTANT_EFFICIENCY = 0.985

export function calculateConstant(aclCount, totalSpindles) {
  const safeCount = Math.max(toFiniteNumber(aclCount), 0)
  const safeSpindles = Math.max(toFiniteNumber(totalSpindles), 0)
  if (safeCount === 0 || safeSpindles === 0) return 0
  return (1 / 2.20456 / safeCount) * safeSpindles * CONSTANT_EFFICIENCY
}

/**
 * Calculate ACL Production (Kg)
 * Formula: ACL_Prod = ACL_Hank × Constant
 */
export function calculateActProdn(actHank, constant) {
  return Math.max(toFiniteNumber(actHank), 0) * Math.max(toFiniteNumber(constant), 0)
}

/**
 * Calculate Waste Percentage
 * Formula: Waste % = (Waste / ACL_Prod) × 100
 */
export function calculateWastePercent(waste, actProdn) {
  const safeProduction = Math.max(toFiniteNumber(actProdn), 0)
  if (safeProduction === 0) return 0
  return (Math.max(toFiniteNumber(waste), 0) / safeProduction) * 100
}

/**
 * Calculate Stopped Spindles
 * Formula: Stopped_Spl = (Stoppage_Mins / Total_Mins) × Total_Spl
 */
export function calculateStoppedSpindles(stoppageMins, totalMins, totalSpindles) {
  const time = resolveProductionTime(totalMins, stoppageMins)
  if (time.totalTime === 0) return 0
  return (time.stoppageTime / time.totalTime) * Math.max(toFiniteNumber(totalSpindles), 0)
}

/**
 * Calculate Worked Spindles
 * Formula: Worked_Spl = Total_Spl - Stopped_Spl
 */
export function calculateWorkedSpindles(totalSpindles, stoppedSpindles) {
  return Math.max(
    Math.max(toFiniteNumber(totalSpindles), 0) - Math.max(toFiniteNumber(stoppedSpindles), 0),
    0
  )
}

/**
 * Calculate GPS (Grams Per Spindle)
 * Formula: GPS = (ACL_Prod / Worked_Spl) × 1000
 */
export function calculateGps(actProdn, workedSpindles) {
  const safeWorkedSpindles = Math.max(toFiniteNumber(workedSpindles), 0)
  if (safeWorkedSpindles === 0) return 0
  return (Math.max(toFiniteNumber(actProdn), 0) / safeWorkedSpindles) * 1000
}

/**
 * Calculate Expected GPS
 * Formula: Exp_GPS = 7.2 × Speed / TPI / Count × Effi
 * @param {number} speed - Machine speed (RPM)
 * @param {number} tpi - Twists per inch
 * @param {number} count - Act Count value (e.g., 69.5 from machine setup)
 * @param {number} efficiency - Efficiency (0.95 = 95%)
 */
export function calculateExpGps(speed, tpi, count, efficiency = 0.95) {
  const safeSpeed = Math.max(toFiniteNumber(speed), 0)
  const safeTpi = Math.max(toFiniteNumber(tpi), 0)
  const safeCount = Math.max(toFiniteNumber(count), 0)
  const safeEfficiency = Math.max(toFiniteNumber(efficiency), 0)
  if (safeSpeed === 0 || safeTpi === 0 || safeCount === 0) return 0
  return (7.2 * safeSpeed / safeTpi / safeCount) * safeEfficiency
}

/**
 * Full production calculation
 * Updated to include No of Spindles calculation based on shift
 */
export function calculateSpinningProduction(params) {
  const safeParams = params || {}
  const actCount = safeParams.actCount ?? safeParams.count ?? 0
  const metrics = calculateSpinningGpsMetrics({
    actHank: safeParams.actHank,
    waste: safeParams.waste,
    actCount,
    allocatedSpindles: safeParams.allocatedSpindles ?? 1104,
    shiftNo: safeParams.shift ?? 1,
    stoppageTime: safeParams.stoppageMins,
    totalTime: safeParams.runTime,
    efficiency: safeParams.efficiency ?? 0.95,
    speed: safeParams.speed,
    tpi: safeParams.tpi,
  })

  return {
    totalSpindles: metrics.totalSpindles,
    constant: metrics.constant,
    actProdn: metrics.actualProduction,
    wastePercent: metrics.wastePercent,
    stoppedSpindles: metrics.stoppedSpindles,
    workedSpindles: metrics.workedSpindles,
    gps: metrics.gps,
    expGps: metrics.expectedGps
  }
}

// ============================================
// HEADER OPERATIONS
// ============================================

// Get production header by date and shift
export async function getSpinningProductionByDateShift(date, shift) {
  try {
    const data = await prisma.spinning_production_header.findFirst({
      where: {
        entry_date: new Date(date),
        shift: shift
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Create new production header
export async function createSpinningProductionHeader(headerData) {
  try {
    const data = await prisma.spinning_production_header.create({
      data: headerData
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update production header
export async function updateSpinningProductionHeader(id, updates) {
  try {
    const data = await prisma.spinning_production_header.update({
      where: { id },
      data: {
        ...sanitizeProductionHeaderUpdate('spinning_production_header', updates),
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Get or create header for a date/shift
export async function getOrCreateSpinningHeader(date, shift, supervisorId = null, maisitryId = null) {
  let header = await getSpinningProductionByDateShift(date, shift)
  
  if (!header) {
    // Get shift configuration for total_time from database
    const shiftConfig = await getSpinningShiftConfiguration(shift)
    
    try {
      header = await createSpinningProductionHeader({
        entry_date: new Date(date),
        shift,
        supervisor_id: supervisorId,
        maisitry_id: maisitryId,
        total_time: shiftConfig.totalTime
      })

      // Initialize production details only for the request that created the header.
      await initializeSpinningProductionDetails(header.id, shift)
    } catch (error) {
      if (error?.code !== 'P2002') throw error
      header = await getSpinningProductionByDateShift(date, shift)
      if (!header) throw error
    }
  }
  
  return header
}

// ============================================
// PRODUCTION DETAIL OPERATIONS
// ============================================

// Get production details for a header
export async function getSpinningProductionDetails(headerId) {
  try {
    const data = await prisma.spinning_production_detail.findMany({
      where: { header_id: headerId }
    })

    // Fetch header entry_date for date-based visibility filtering
    const header = await prisma.spinning_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true }
    })
    const entryDate = header?.entry_date || new Date()
    const shift = header?.shift || 1
    const fallbackRunTime = resolveSpinningShiftFallbackTime(shift)
    
    // Fetch machines by the exact IDs in this header's detail records
    // (no is_active filter — we apply date-based visibility below)
    const machineIds = data.map(d => d.machine_id)
    const machines = machineIds.length > 0
      ? await prisma.spinning_machines.findMany({
          where: { id: { in: machineIds } },
          orderBy: { sort_order: 'asc' }
        })
      : []
    const setups = await getOrCreateSpinningMachineSetups(entryDate, shift)
    
    // Get stoppage entries for these production details
    const detailIds = data.map(d => d.id)
    const stoppages = await prisma.spinning_stoppage_entry.findMany({
      where: { production_detail_id: { in: detailIds } },
      select: {
        id: true,
        production_detail_id: true,
        total_stoppage_time: true,
        stoppage1_time: true,
        stoppage2_time: true,
        stoppage3_time: true,
        stoppage4_time: true
      }
    })
    
    const machineMap = {}
    machines?.forEach(m => {
      machineMap[m.id] = m
    })
    
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })
    
    const stoppageMap = {}
    stoppages?.forEach(s => {
      stoppageMap[s.production_detail_id] = s
    })
    
    // Attach machine, setup, and stoppage data to each detail
    // Apply date-based visibility: only show machines active on the entry_date
    const enrichedData = data
      ?.map(detail => ({
        ...detail,
        machine: machineMap[detail.machine_id] || null,
        setup: setupMap[detail.machine_id] || null,
        stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
      }))
      .filter(detail => isSpinningMachineVisibleOnDate(detail.machine, entryDate)) || []
    
    // Sort by machine sort_order (proper order: RF1, RF2, ... RF47, RF1A, RF2A)
    return enrichedData.sort((a, b) => {
      const sortA = a.machine?.sort_order || 9999
      const sortB = b.machine?.sort_order || 9999
      return sortA - sortB
    })
  } catch (error) {
    throw error
  }
}

// Initialize production details for all spinning machines
export async function initializeSpinningProductionDetails(headerId, shift = 1) {
  try {
    const header = await prisma.spinning_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true }
    })
    if (!header) throw new Error(`Spinning production header ${headerId} not found`)
    const entryDate = header.entry_date
    const entryShift = Number(header.shift) || parseInt(shift) || 1

    // Check if details already exist
    const existingDetails = await prisma.spinning_production_detail.findMany({
      where: { header_id: headerId },
      select: { machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Get machine setups for default values for this date
    const setups = await getOrCreateSpinningMachineSetups(entryDate, entryShift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get machines visible on the entry date that have a setup
    const machines = await prisma.spinning_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        ...buildSpinningMachineVisibilityWhere(entryDate)
      },
      orderBy: { sort_order: 'asc' }
    })

    // Filter out machines that already have entries
    const newMachines = machines.filter(m => !existingMachineIds.includes(m.id))

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Get shift configuration
    const shiftConfig = await getSpinningShiftConfiguration(entryShift)

    // Create detail records for new machines
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const allocatedSpindles = firstProvidedNumber([setup.allocated_spindles, machine.allocated_spindles], 1104)
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, entryShift)
      // Shift 3 uses seven hours; shifts 1 and 2 use eight and a half hours.

      return {
        header_id: headerId,
        machine_id: machine.id,
        count_name: setup.count_name || null,
        act_hank: null,
        act_prodn: null,
        waste: null,
        waste_percent: null,
        gps: null,
        worked_spindles: noOfSpindles,
        stopped_spindles: 0,
        exp_gps: null,
        total_stoppage_mins: 0,
        session_no: setup.session_no || 1,
        run_time: shiftConfig.totalTime,
        work_time: shiftConfig.totalTime
      }
    })

    return prisma.$transaction(async tx => {
      if (details.length > 0) {
        await tx.spinning_production_detail.createMany({
          data: details,
          skipDuplicates: true
        })
      }

      // Include already-created rows so an interrupted/legacy initialization
      // also receives its missing one-to-one stoppage entry.
      const visibleDetails = await tx.spinning_production_detail.findMany({
        where: {
          header_id: headerId,
          machine_id: { in: machines.map(m => m.id) }
        }
      })
      const stoppageEntries = visibleDetails.map(detail => ({
        production_detail_id: detail.id,
        run_time: shiftConfig.totalTime,
        stoppage1_time: 0,
        stoppage2_time: 0,
        stoppage3_time: 0,
        stoppage4_time: 0,
        total_stoppage_time: 0
      }))

      if (stoppageEntries.length > 0) {
        await tx.spinning_stoppage_entry.createMany({
          data: stoppageEntries,
          skipDuplicates: true
        })
      }

      return tx.spinning_production_detail.findMany({
        where: { header_id: headerId }
      })
    }, { maxWait: 5000, timeout: 30000 })
  } catch (error) {
    throw error
  }
}

// Sync new machines to existing header
export async function syncNewMachinesToSpinningHeader(headerId, shift = 1) {
  try {
    // Get header entry_date for date-based machine visibility
    const headerForDate = await prisma.spinning_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true }
    })
    if (!headerForDate) throw new Error(`Spinning production header ${headerId} not found`)
    const entryDate = headerForDate.entry_date
    const entryShift = Number(headerForDate.shift) || parseInt(shift) || 1

    // Get machine setups for default values for this date
    const setups = await getOrCreateSpinningMachineSetups(entryDate, entryShift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)
    const shiftConfig = await getSpinningShiftConfiguration(entryShift)

    return prisma.$transaction(async tx => {

    // Setup reconciliation above guarantees a date/shift snapshot for each visible active machine.
    const machines = await tx.spinning_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        ...buildSpinningMachineVisibilityWhere(entryDate)
      },
      orderBy: { sort_order: 'asc' }
    })

    // Get existing production details for this header
    const existingDetails = await tx.spinning_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Find machines that don't have entries
    // Existing rows are immutable history: deactivation only affects visibility.
    const newMachines = machines?.filter(m => !existingMachineIds.includes(m.id)) || []

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Create detail records
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const allocatedSpindles = firstProvidedNumber([setup.allocated_spindles, machine.allocated_spindles], 1104)
      // Shift 3 uses seven hours; shifts 1 and 2 use eight and a half hours.
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, entryShift)

      return {
        header_id: headerId,
        machine_id: machine.id,
        count_name: setup.count_name || null,
        act_hank: null,
        act_prodn: null,
        waste: null,
        waste_percent: null,
        gps: null,
        worked_spindles: noOfSpindles,
        stopped_spindles: 0,
        exp_gps: null,
        total_stoppage_mins: 0,
        session_no: setup.session_no || 1,
        run_time: shiftConfig.totalTime,
        work_time: shiftConfig.totalTime
      }
    })

    if (details.length > 0) {
      await tx.spinning_production_detail.createMany({
        data: details,
        skipDuplicates: true
      })
    }

    // Include existing visible rows to repair any missing one-to-one stoppage
    // entry left by an interrupted or legacy initialization.
    const visibleDetails = await tx.spinning_production_detail.findMany({
      where: { 
        header_id: headerId,
        machine_id: { in: machines.map(m => m.id) }
      }
    })

    // Create stoppage entries
    const stoppageEntries = visibleDetails.map(detail => ({
      production_detail_id: detail.id,
      run_time: shiftConfig.totalTime,
      total_stoppage_time: 0
    }))

    if (stoppageEntries.length > 0) {
      await tx.spinning_stoppage_entry.createMany({
        data: stoppageEntries,
        skipDuplicates: true
      })
    }

    return { 
      added: newMachines.length, 
      machines: newMachines.map(m => m.machine_no) 
    }
    }, { maxWait: 5000, timeout: 30000 })
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateSpinningProductionDetail(id, updates) {
  try {
    const data = await prisma.spinning_production_detail.update({
      where: { id },
      data: {
        ...sanitizeProductionDetailUpdate('spinning_production_detail', updates),
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Batch update production details
export async function batchUpdateSpinningProductionDetails(updates) {
  const updatedAt = new Date()
  return prisma.$transaction(
    updates.map(({ id, ...data }) =>
      prisma.spinning_production_detail.update({
        where: { id },
        data: {
          ...sanitizeProductionDetailUpdate('spinning_production_detail', data),
          updated_at: updatedAt
        }
      })
    )
  )
}

// ============================================
// STOPPAGE ENTRY OPERATIONS
// ============================================

// Get stoppage entries for a header
export async function getSpinningStoppageEntries(headerId) {
  try {
    // First get all production details for this header
    const details = await prisma.spinning_production_detail.findMany({
      where: { header_id: headerId }
    })

    const detailIds = details.map(d => d.id)

    // Fetch header entry_date for date-based visibility filtering
    const header = await prisma.spinning_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true }
    })
    if (!header) throw new Error(`Spinning production header ${headerId} not found`)
    const entryDate = header.entry_date
    const shift = header.shift || 1
    const fallbackRunTime = resolveSpinningShiftFallbackTime(shift)

    // Get stoppage entries
    const stoppages = await prisma.spinning_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: detailIds }
      }
    })

    // Get machines and setups — fetch by ID (no is_active filter for historical entries)
    const machineIds = details.map(d => d.machine_id)
    const machines = await prisma.spinning_machines.findMany({
      where: { 
        id: { in: machineIds }
      },
      orderBy: { sort_order: 'asc' }
    })
    const setups = await prisma.spinning_machine_setup.findMany({
      where: { 
        machine_id: { in: machineIds },
        entry_date: entryDate,
        shift: shift
      }
    })

    // Get stoppage reasons for display
    const stoppageReasonIds = []
    stoppages.forEach(s => {
      if (s.stoppage1_id) stoppageReasonIds.push(s.stoppage1_id)
      if (s.stoppage2_id) stoppageReasonIds.push(s.stoppage2_id)
      if (s.stoppage3_id) stoppageReasonIds.push(s.stoppage3_id)
      if (s.stoppage4_id) stoppageReasonIds.push(s.stoppage4_id)
    })
    
    const stoppageReasons = await prisma.stoppage_details.findMany({
      where: { id: { in: stoppageReasonIds } },
      select: {
        id: true,
        stoppage_name: true,
        short_code: true
      }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })
    
    const setupMap = {}
    setups?.forEach(s => { setupMap[s.machine_id] = s })

    const stoppageReasonMap = {}
    stoppageReasons?.forEach(r => { stoppageReasonMap[r.id] = r })

    // Create stoppage map
    const stoppageMap = {}
    stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s })

    // Combine data — apply date-based visibility: only show machines active on the entry_date
    const result = details
      .filter(detail => isSpinningMachineVisibleOnDate(machineMap[detail.machine_id], entryDate))
      .map(detail => {
        const machine = machineMap[detail.machine_id]
        const setup = setupMap[detail.machine_id] || {}
        const stoppage = stoppageMap[detail.id] || {}

        return {
          id: detail.id,
          machine_id: detail.machine_id,
          // Nested structure to match production query
          production_detail: {
            machine: {
              machine_no: machine.machine_no || '',
              description: machine.description || setup.frame_no || ''
            },
            session_no: detail.session_no ?? null
          },
          machine_no: machine.machine_no || '',
          frame_no: machine.description || setup.frame_no || '',
          count_name: detail.count_name || setup.count_name || '',
          session_no: detail.session_no ?? null,
          run_time: detail.run_time ?? fallbackRunTime,
          total_spindles: firstProvidedNumber([setup.allocated_spindles, machine.allocated_spindles], 1104),
          act_count: toFiniteNumber(setup.act_count),
          efficiency: toFiniteNumber(setup.efficiency, 0.95),
          speed: toFiniteNumber(setup.speed),
          tpi: toFiniteNumber(setup.tpi),
          stoppage_entry_id: stoppage.id,
          stoppage1_id: stoppage.stoppage1_id,
          stoppage1: stoppageReasonMap[stoppage.stoppage1_id] || null,
          stoppage1_time: stoppage.stoppage1_time || 0,
          stoppage2_id: stoppage.stoppage2_id,
          stoppage2: stoppageReasonMap[stoppage.stoppage2_id] || null,
          stoppage2_time: stoppage.stoppage2_time || 0,
          stoppage3_id: stoppage.stoppage3_id,
          stoppage3: stoppageReasonMap[stoppage.stoppage3_id] || null,
          stoppage3_time: stoppage.stoppage3_time || 0,
          stoppage4_id: stoppage.stoppage4_id,
          stoppage4: stoppageReasonMap[stoppage.stoppage4_id] || null,
          stoppage4_time: stoppage.stoppage4_time || 0,
          total_stoppage_time: stoppage.total_stoppage_time || 0,
          is_full_stoppage: stoppage.is_full_stoppage || false,
          // Production data for formulas
          act_hank: parseFloat(detail.act_hank) || 0,
          // Calculated fields
          worked_spindles: detail.worked_spindles,
          exp_gps: detail.exp_gps
        }
      })

    // Sort by machine number
    return result.sort((a, b) => {
      const aNum = parseInt(a.machine_no.replace(/\D/g, '') || '0')
      const bNum = parseInt(b.machine_no.replace(/\D/g, '') || '0')
      if (aNum !== bNum) return aNum - bNum
      return a.machine_no.localeCompare(b.machine_no)
    })
  } catch (error) {
    throw error
  }
}

// Shared transactional writer used by manual, full and partial stoppage paths.
async function persistSpinningStoppageUpdate(tx, stoppageId, updates, reasonValidated = false) {
    try {
    // First, fetch the existing record to get current stoppage values (like Carding module)
    const existing = await tx.spinning_stoppage_entry.findUnique({
      where: { id: stoppageId },
      select: {
        production_detail_id: true,
        stoppage1_id: true,
        stoppage1_time: true,
        stoppage2_id: true,
        stoppage2_time: true,
        stoppage3_id: true,
        stoppage3_time: true,
        stoppage4_id: true,
        stoppage4_time: true
      }
    })

    if (!existing) {
      throw new Error(`Stoppage entry ${stoppageId} not found`)
    }

    const stoppageUpdate = buildStoppageUpdate(existing, updates)
    if (!reasonValidated) {
      await assertActiveStoppageReasons(tx, stoppageUpdate, ['SPINNING'])
    }
    const totalStoppageTime = stoppageUpdate.total_stoppage_time
    const updatedAt = new Date()

    const data = await tx.spinning_stoppage_entry.update({
      where: { id: stoppageId },
      data: {
        ...stoppageUpdate,
        updated_at: updatedAt
      }
    })

    // Recalculate stopped_spindles and worked_spindles in production detail
    // Get production detail with header to know shift
    const prodDetail = await tx.spinning_production_detail.findUnique({
      where: { id: data.production_detail_id }
    })
    if (!prodDetail) throw new Error('The production row for this stoppage no longer exists')

      const header = await tx.spinning_production_header.findUnique({
        where: { id: prodDetail.header_id }
      })
      if (!header) throw new Error('The production header for this stoppage no longer exists')
      const setup = await tx.spinning_machine_setup.findFirst({
        where: { 
          machine_id: prodDetail.machine_id,
          entry_date: header.entry_date,
          shift: header.shift
        }
      })
      const machine = await tx.spinning_machines.findUnique({
        where: { id: prodDetail.machine_id }
      })
      const allocatedSpindles = firstProvidedNumber([setup?.allocated_spindles, machine?.allocated_spindles], 1104)
      const shift = header.shift
      const runTime = prodDetail.run_time ?? resolveSpinningShiftFallbackTime(shift)
      if (totalStoppageTime > runTime) {
        const error = new Error('Stoppage time cannot exceed the shift time')
        error.code = 'INVALID_STOPPAGE'
        throw error
      }
      // STOPPED SPL = (Total Stoppage Mins / Total Min) × No of Spindles
      // WORKED SPL = No of Spindles - STOPPED SPL
      const calculated = calculateSpinningProduction({
        actHank: prodDetail.act_hank,
        waste: prodDetail.waste,
        actCount: setup?.act_count,
        allocatedSpindles,
        shift,
        stoppageMins: totalStoppageTime,
        runTime,
        efficiency: setup?.efficiency,
        speed: setup?.speed,
        tpi: setup?.tpi,
        count: setup?.act_count
      })

      await tx.spinning_production_detail.update({
        where: { id: data.production_detail_id },
        data: {
          total_stoppage_mins: totalStoppageTime,
          work_time: Math.max(Number(runTime) - totalStoppageTime, 0),
          act_prodn: calculated.actProdn,
          waste_percent: calculated.wastePercent,
          stopped_spindles: calculated.stoppedSpindles,
          worked_spindles: calculated.workedSpindles,
          gps: calculated.gps,
          exp_gps: calculated.expGps,
          updated_at: updatedAt
        }
      })

    return data
    } catch (error) {
      throw error
    }
}

function normalizeBulkSpinningStoppage(stoppageId, stoppageTime) {
  const normalized = buildStoppageUpdate({}, {
    stoppage1_id: stoppageId,
    stoppage1_time: stoppageTime
  })

  if (!normalized.stoppage1_id) {
    const error = new Error('Stoppage reason is required')
    error.code = 'INVALID_STOPPAGE'
    throw error
  }
  if (normalized.stoppage1_time <= 0) {
    const error = new Error('Stoppage time must be greater than 0')
    error.code = 'INVALID_STOPPAGE'
    throw error
  }

  return {
    reasonId: normalized.stoppage1_id,
    minutes: normalized.stoppage1_time
  }
}

// Update a stoppage and every dependent production/GPS value atomically.
export async function updateSpinningStoppageEntry(stoppageId, updates) {
  return prisma.$transaction(tx => persistSpinningStoppageUpdate(tx, stoppageId, updates))
}

// Apply full stoppage to all machines
export async function applyFullStoppage(headerId, stoppageId, stoppageTime) {
  const { reasonId, minutes } = normalizeBulkSpinningStoppage(stoppageId, stoppageTime)

  return prisma.$transaction(async tx => {
    try {
    await assertActiveStoppageReasons(tx, { stoppage1_id: reasonId }, ['SPINNING'])
    // Get header to know shift
    const header = await tx.spinning_production_header.findUnique({
      where: { id: headerId }
    })
    if (!header) throw new Error(`Spinning production header ${headerId} not found`)
    const shift = header?.shift || 1

    // Get all production details for this header
    const details = await tx.spinning_production_detail.findMany({
      where: { header_id: headerId }
    })

    const results = []
    for (const detail of details) {
      // Get or create stoppage entry
      let stoppage = await tx.spinning_stoppage_entry.findFirst({
        where: { production_detail_id: detail.id }
      })

      if (!stoppage) {
        stoppage = await tx.spinning_stoppage_entry.create({
          data: {
            production_detail_id: detail.id,
            run_time: detail.run_time ?? resolveSpinningShiftFallbackTime(shift)
          }
        })
      }

      // Preserve existing stoppages and use this machine's first free slot.
      const slot = findFirstFreeStoppageSlot(stoppage)
      if (!slot) continue
      const result = await persistSpinningStoppageUpdate(tx, stoppage.id, {
        [`stoppage${slot}_id`]: reasonId,
        [`stoppage${slot}_time`]: minutes,
        is_full_stoppage: true
      }, true)

      results.push(result)
    }

    return results
  } catch (error) {
    throw error
  }
  }, { maxWait: 5000, timeout: 30000 })
}

// Apply partial stoppage to range of machines
export async function applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  const { reasonId, minutes } = normalizeBulkSpinningStoppage(stoppageId, stoppageTime)

  return prisma.$transaction(async tx => {
    try {
    await assertActiveStoppageReasons(tx, { stoppage1_id: reasonId }, ['SPINNING'])
    // Get header to know shift
    const header = await tx.spinning_production_header.findUnique({
      where: { id: headerId }
    })
    if (!header) throw new Error(`Spinning production header ${headerId} not found`)
    const shift = header?.shift || 1

    // Get all production details with machines inside the same transaction.
    const rawDetails = await tx.spinning_production_detail.findMany({
      where: { header_id: headerId }
    })
    const machineIds = [...new Set(rawDetails.map(detail => detail.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await tx.spinning_machines.findMany({ where: { id: { in: machineIds } } })
      : []
    const machineMap = new Map(machines.map(machine => [machine.id, machine]))
    const details = rawDetails
      .map(detail => ({ ...detail, machine: machineMap.get(detail.machine_id) || null }))
      .filter(detail => isSpinningMachineVisibleOnDate(detail.machine, header.entry_date))

    // Filter by machine range
    const parsedFrom = parseInt(String(fromMachineNo || '').replace(/\D/g, '') || '0')
    const parsedTo = parseInt(String(toMachineNo || '').replace(/\D/g, '') || '999')
    const fromNum = Math.min(parsedFrom, parsedTo)
    const toNum = Math.max(parsedFrom, parsedTo)

    const filteredDetails = details.filter(d => {
      const machineNum = parseInt(d.machine?.machine_no?.replace(/\D/g, '') || '0')
      return machineNum >= fromNum && machineNum <= toNum
    })

    let updatedCount = 0
    let overflowCount = 0

    for (const detail of filteredDetails) {
      // Get or create stoppage entry
      let stoppage = await tx.spinning_stoppage_entry.findFirst({
        where: { production_detail_id: detail.id }
      })

      if (!stoppage) {
        stoppage = await tx.spinning_stoppage_entry.create({
          data: {
            production_detail_id: detail.id,
            run_time: detail.run_time ?? resolveSpinningShiftFallbackTime(shift)
          }
        })
      }

      // Auto-assign first available slot (1 -> 4)
      const resolvedSlot = findFirstFreeStoppageSlot(stoppage)
      if (!resolvedSlot) {
        overflowCount++
        continue
      }

      await persistSpinningStoppageUpdate(tx, stoppage.id, {
        [`stoppage${resolvedSlot}_id`]: reasonId,
        [`stoppage${resolvedSlot}_time`]: minutes
      }, true)

      updatedCount++
    }

    return {
      totalTargeted: filteredDetails.length,
      updatedCount,
      overflowCount,
      skippedCount: filteredDetails.length - updatedCount
    }
  } catch (error) {
    throw error
  }
  }, { maxWait: 5000, timeout: 30000 })
}

// ============================================
// MACHINE SETUP OPERATIONS
// ============================================

// Create new date/shift snapshots from the canonical machine defaults.
// Explicit copy actions remain available, but initialization never carries
// forward the most recently edited setup automatically.
export async function getOrCreateSpinningMachineSetups(entryDate, shift = 1) {
  try {
    const dateObj = parseStrictDate(entryDate, 'Spinning entry date')
    const shiftNum = Number.parseInt(shift, 10)
    if (![1, 2, 3].includes(shiftNum)) throw new Error('Spinning shift must be 1, 2, or 3')
    const targetShiftTime = shiftNum === 3 ? 420 : 510

    return prisma.$transaction(async tx => {
    // 1. Try to find setups for this exact date and shift
    const setups = await tx.spinning_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
    
    // 2. Seed from the baseline setup created for each configured machine.
    const baselineSetups = await tx.spinning_machine_setup.findMany({
      where: {
        entry_date: SPINNING_DEFAULT_SETUP_DATE,
        shift: 1
      }
    })

    const activeMachines = await tx.spinning_machines.findMany({
      where: buildSpinningMachineVisibilityWhere(dateObj)
    })
    const defaultCountMaster = await tx.spinning_counts.findFirst({
      where: { is_active: true },
      orderBy: [{ is_running_now: 'desc' }, { count_name: 'asc' }]
    })
    const existingSetupMachineIds = new Set(setups.map(setup => setup.machine_id))
    const baselineSetupMap = new Map(baselineSetups.map(setup => [setup.machine_id, setup]))
    const missingMachines = activeMachines.filter(machine => !existingSetupMachineIds.has(machine.id))
    const machinesWithBaseline = missingMachines.filter(machine => baselineSetupMap.has(machine.id))
    const machinesWithoutBaseline = missingMachines.filter(machine => !baselineSetupMap.has(machine.id))

    if (missingMachines.length === 0) return setups
    
    if (machinesWithBaseline.length > 0) {
      const countNames = [...new Set(
        machinesWithBaseline
          .map(machine => baselineSetupMap.get(machine.id)?.count_name)
          .filter(Boolean)
      )]
      const countMasters = countNames.length
        ? await tx.spinning_counts.findMany({
            where: { count_name: { in: countNames }, is_active: true }
          })
        : []
      const countMasterMap = new Map(countMasters.map(count => [count.count_name, count]))
      const cloneData = machinesWithBaseline.map(machine => {
        const s = baselineSetupMap.get(machine.id)
        const { id, created_at, updated_at, ...rest } = s
        const effectiveSetup = applySpinningCountMaster({
          ...rest,
          entry_date: dateObj,
          shift: shiftNum,
          run_time: targetShiftTime
        }, countMasterMap.get(s.count_name) || defaultCountMaster)
        const validated = validateCompleteSpinningSetup(effectiveSetup)
        return { ...effectiveSetup, ...validated }
      })
      
      await tx.spinning_machine_setup.createMany({
        data: cloneData,
        skipDuplicates: true
      })
    }
    
    // 3. Fill canonical baseline gaps without overwriting existing snapshots.
    if (machinesWithoutBaseline.length > 0 && !defaultCountMaster) {
      throw new Error('Create and activate at least one complete Spinning Count before initializing new Spinning machines')
    }
    const defaultSetups = machinesWithoutBaseline.map(m => {
      const setup = applySpinningCountMaster({
        machine_id: m.id,
        entry_date: dateObj,
        shift: shiftNum,
        allocated_spindles: firstProvidedNumber([m.allocated_spindles], 1104),
        session_no: 1,
        run_time: targetShiftTime,
        efficiency: 0.985,
        conversion_factor: 2.20456
      }, defaultCountMaster)
      const validated = validateCompleteSpinningSetup(setup)
      return { ...setup, ...validated }
    })
    
    if (defaultSetups.length > 0) {
      await tx.spinning_machine_setup.createMany({
        data: defaultSetups,
        skipDuplicates: true
      })
    }
    
    return tx.spinning_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
    }, { maxWait: 5000, timeout: 30000 })
  } catch (error) {
    throw error
  }
}

// Get all machine setups for a given date
export async function getSpinningMachineSetups(entryDate, shift = 1) {
  try {
    if (!entryDate) {
      throw new Error('entryDate is required for getSpinningMachineSetups')
    }
    
    const setups = await getOrCreateSpinningMachineSetups(entryDate, shift)
    
    const entryDateValue = parseStrictDate(entryDate, 'Spinning entry date')
    const setupMachineIds = [...new Set(setups.map(setup => setup.machine_id))]

    // Fetch the setup snapshot's machines, including rows that were active on
    // this historical entry date but have since been deactivated.
    const machines = await prisma.spinning_machines.findMany({
      where: { id: { in: setupMachineIds } },
      orderBy: { sort_order: 'asc' }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    // Combine setup with machine info
    const enrichedSetups = setups
      .filter(s => isSpinningMachineVisibleOnDate(machineMap[s.machine_id], entryDateValue))
      .map(setup => ({
        ...setup,
        machine: machineMap[setup.machine_id] || null
      }))

    // Return in sort_order
    return enrichedSetups.sort((a, b) => {
      return (a.machine?.sort_order || 0) - (b.machine?.sort_order || 0)
    })
  } catch (error) {
    throw error
  }
}

async function applyActiveSpinningCount(tx, updates) {
  let setupUpdates = sanitizeSpinningSetupUpdate(updates)
  if (!Object.prototype.hasOwnProperty.call(setupUpdates, 'count_name')) return setupUpdates

  const count = await tx.spinning_counts.findFirst({
    where: { count_name: setupUpdates.count_name, is_active: true },
    select: {
      count_name: true,
      act_count: true,
      tpi: true,
      speed: true,
      tw_con: true,
      doff_loss: true,
      waste_percent: true
    }
  })
  if (!count) throw new Error('The selected Spinning count is missing or inactive')

  return sanitizeSpinningSetupUpdate({
    ...setupUpdates,
    count_name: count.count_name,
    act_count: count.act_count,
    tpi: count.tpi,
    speed: count.speed,
    tw_con: count.tw_con,
    doff_loss: count.doff_loss ?? setupUpdates.doff_loss,
    c_waste_percent: count.waste_percent ?? setupUpdates.c_waste_percent
  })
}

async function persistSpinningMachineSetup(tx, id, updates, shift = null, entryDate = null) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Spinning setup id is required')
  let setupUpdates = sanitizeSpinningSetupUpdate(updates)
  const existing = await tx.spinning_machine_setup.findUnique({
    where: { id }
  })
  if (!existing) throw new Error('Spinning machine setup not found')
  if (shift !== null) {
    const selectedShift = Number.parseInt(shift, 10)
    if (![1, 2, 3].includes(selectedShift) || selectedShift !== existing.shift) {
      throw new Error('Spinning setup shift does not match the entry being saved')
    }
  }
  if (entryDate !== null) {
    const selectedDate = parseStrictDate(entryDate, 'Spinning entry date')
    if (!sameCalendarDate(existing.entry_date, selectedDate)) {
      throw new Error('Spinning setup date does not match the entry being saved')
    }
  }

  const countWasEdited = Object.prototype.hasOwnProperty.call(setupUpdates, 'count_name')
  if (countWasEdited) {
    setupUpdates = await applyActiveSpinningCount(tx, setupUpdates)
  }

  const validated = validateCompleteSpinningSetup({ ...existing, ...setupUpdates })

  const data = await tx.spinning_machine_setup.update({
    where: { id },
    data: { ...validated, updated_at: new Date() }
  })

  if (countWasEdited) {
    const header = await tx.spinning_production_header.findFirst({
      where: { entry_date: existing.entry_date, shift: existing.shift },
      select: { id: true }
    })
    if (header) {
      await tx.spinning_production_detail.updateMany({
        where: { machine_id: existing.machine_id, header_id: header.id },
        data: { count_name: setupUpdates.count_name, updated_at: new Date() }
      })
    }
  }

  return data
}

// Update machine setup
export async function updateSpinningMachineSetup(id, updates, shift = null, entryDate = null) {
  return prisma.$transaction(tx => persistSpinningMachineSetup(tx, id, updates, shift, entryDate))
}

// Upsert machine setup
export async function upsertSpinningMachineSetup(machineId, entryDate, setupData) {
  const normalizedMachineId = String(machineId ?? '').trim()
  if (!normalizedMachineId) throw new Error('Spinning machine id is required')
  const dateObj = parseStrictDate(entryDate, 'Spinning entry date')
  const shiftNum = Number.parseInt(setupData?.shift, 10)
  if (![1, 2, 3].includes(shiftNum)) throw new Error('Spinning shift must be 1, 2, or 3')

  return prisma.$transaction(async tx => {
    const machine = await tx.spinning_machines.findUnique({ where: { id: normalizedMachineId } })
    if (!machine || !isSpinningMachineVisibleOnDate(machine, dateObj)) {
      throw new Error('The selected Spinning machine is not available on this entry date')
    }

    const existing = await tx.spinning_machine_setup.findUnique({
      where: {
        idx_spinning_machine_setup_date: {
          machine_id: normalizedMachineId,
          entry_date: dateObj,
          shift: shiftNum
        }
      }
    })
    let updates = await applyActiveSpinningCount(tx, setupData)
    const effectiveSetup = {
      ...(existing || {}),
      machine_id: normalizedMachineId,
      entry_date: dateObj,
      shift: shiftNum,
      allocated_spindles: existing?.allocated_spindles ?? machine.allocated_spindles,
      session_no: existing?.session_no ?? 1,
      run_time: existing?.run_time ?? resolveSpinningShiftFallbackTime(shiftNum),
      efficiency: existing?.efficiency ?? 0.985,
      conversion_factor: existing?.conversion_factor ?? 2.20456,
      ...updates
    }
    const validated = validateCompleteSpinningSetup(effectiveSetup)
    const now = new Date()
    const result = existing
      ? await tx.spinning_machine_setup.update({
          where: { id: existing.id },
          data: { ...validated, updated_at: now }
        })
      : await tx.spinning_machine_setup.create({
          data: {
            machine_id: normalizedMachineId,
            entry_date: dateObj,
            shift: shiftNum,
            ...validated,
            created_at: now,
            updated_at: now
          }
        })

    const header = await tx.spinning_production_header.findUnique({
      where: { uk_spinning_header_date_shift: { entry_date: dateObj, shift: shiftNum } },
      select: { id: true }
    })
    if (header) {
      await tx.spinning_production_detail.updateMany({
        where: { header_id: header.id, machine_id: normalizedMachineId },
        data: { count_name: validated.count_name, updated_at: now }
      })
    }

    return result
  })
}

// Batch update machine setups
export async function batchUpdateSpinningMachineSetups(updates, shift = null, entryDate = null) {
  if (!Array.isArray(updates)) throw new Error('Spinning setup updates must be an array')
  const setupIds = updates.map(update => String(update?.id ?? '').trim())
  if (new Set(setupIds).size !== setupIds.length) {
    throw new Error('Spinning setup updates contain a duplicate row')
  }
  return prisma.$transaction(async tx => {
    const results = []
    for (const update of updates) {
      const { id, ...data } = update || {}
      results.push(await persistSpinningMachineSetup(tx, id, data, shift, entryDate))
    }
    return results
  }, { isolationLevel: 'Serializable' })
}

function resolvePreviousShiftContext(targetDate, targetShift) {
  const parsedShift = parseInt(targetShift)
  const sourceDate = new Date(targetDate)

  if (Number.isNaN(sourceDate.getTime())) {
    throw new Error('Invalid target date')
  }

  if (![1, 2, 3].includes(parsedShift)) {
    throw new Error('Invalid target shift')
  }

  if (parsedShift === 1) {
    sourceDate.setDate(sourceDate.getDate() - 1)
    return { sourceDate, sourceShift: 3 }
  }

  if (parsedShift === 2) {
    return { sourceDate, sourceShift: 1 }
  }

  return { sourceDate, sourceShift: 2 }
}

function toDateOnlyString(dateValue) {
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export async function applySpinningOptionCheck(payload) {
  const {
    targetDate,
    targetShift,
    options = {}
  } = payload || {}

  const copySpeed = options.copySpeed === true
  const copyTpi = options.copyTpi === true
  const copyTwCon = options.copyTwCon === true
  const copyCount = options.copyCount === true

  if (!copySpeed && !copyTpi && !copyTwCon && !copyCount) {
    throw new Error('Select at least one option')
  }

  const { sourceDate, sourceShift } = resolvePreviousShiftContext(targetDate, targetShift)

  return await prisma.$transaction(async (tx) => {
    const targetHeader = await tx.spinning_production_header.findFirst({
      where: {
        entry_date: new Date(targetDate),
        shift: parseInt(targetShift)
      },
      select: {
        id: true,
        entry_date: true,
        shift: true
      }
    })

    if (!targetHeader) {
      throw new Error('Target entry not found')
    }

    const sourceHeader = await tx.spinning_production_header.findFirst({
      where: {
        entry_date: new Date(toDateOnlyString(sourceDate)),
        shift: sourceShift
      },
      select: {
        id: true,
        entry_date: true,
        shift: true
      }
    })

    if (!sourceHeader) {
      throw new Error('Source header not found')
    }

    const targetDetails = await tx.spinning_production_detail.findMany({
      where: { header_id: targetHeader.id },
      select: { machine_id: true }
    })

    const targetMachineIds = [...new Set(targetDetails.map(d => d.machine_id))]
    if (targetMachineIds.length === 0) {
      return {
        sourceDate: toDateOnlyString(sourceHeader.entry_date),
        sourceShift,
        totalEligibleMachines: 0,
        machinesUpdated: 0,
        machinesSkipped: 0
      }
    }

    const targetMachines = await tx.spinning_machines.findMany({
      where: {
        id: { in: targetMachineIds },
        ...buildSpinningMachineVisibilityWhere(targetHeader.entry_date)
      },
      select: { id: true }
    })

    const eligibleMachineIds = new Set(targetMachines.map(m => m.id))

    const targetSetups = await tx.spinning_machine_setup.findMany({
      where: { 
        machine_id: { in: [...eligibleMachineIds] },
        entry_date: targetHeader.entry_date
      },
      select: {
        id: true,
        machine_id: true
      }
    })

    const sourceDetails = await tx.spinning_production_detail.findMany({
      where: { header_id: sourceHeader.id },
      select: { machine_id: true }
    })

    const sourceMachineIds = [...new Set(sourceDetails.map(d => d.machine_id))]
    const sourceSetups = sourceMachineIds.length
      ? await tx.spinning_machine_setup.findMany({
          where: { 
            machine_id: { in: sourceMachineIds },
            entry_date: sourceHeader.entry_date
          },
          select: {
            machine_id: true,
            speed: true,
            tpi: true,
            tw_con: true,
            count_name: true
          }
        })
      : []

    const sourceSetupMap = new Map(sourceSetups.map(s => [s.machine_id, s]))

    let machinesUpdated = 0
    let machinesSkipped = 0

    for (const targetSetup of targetSetups) {
      const sourceSetup = sourceSetupMap.get(targetSetup.machine_id)
      if (!sourceSetup) {
        machinesSkipped++
        continue
      }

      const data = {}
      if (copySpeed && sourceSetup.speed != null) data.speed = sourceSetup.speed
      if (copyTpi && sourceSetup.tpi != null) data.tpi = sourceSetup.tpi
      if (copyTwCon && sourceSetup.tw_con != null) data.tw_con = sourceSetup.tw_con
      if (copyCount && sourceSetup.count_name) data.count_name = sourceSetup.count_name

      if (Object.keys(data).length === 0) {
        machinesSkipped++
        continue
      }

      await tx.spinning_machine_setup.update({
        where: { id: targetSetup.id },
        data: {
          ...data,
          updated_at: new Date()
        }
      })

      if (data.count_name) {
        await tx.spinning_production_detail.updateMany({
          where: { 
            machine_id: targetSetup.machine_id,
            header_id: targetHeader.id
          },
          data: { count_name: data.count_name }
        })
      }

      machinesUpdated++
    }

    return {
      sourceDate: toDateOnlyString(sourceHeader.entry_date),
      sourceShift,
      totalEligibleMachines: targetSetups.length,
      machinesUpdated,
      machinesSkipped
    }
  })
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get spinning machines
export async function getSpinningMachines() {
  try {
    const data = await prisma.spinning_machines.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' }
    })
    
    return data || []
  } catch (error) {
    throw error
  }
}

// Get ALL spinning machines (including inactive) — used for autofill lookups
export async function getAllSpinningMachines() {
  try {
    const data = await prisma.spinning_machines.findMany({
      orderBy: { sort_order: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Get spinning counts
export async function getSpinningCounts() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      orderBy: { count_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Get stoppage reasons for spinning (with category/head info)
export async function getSpinningStoppageReasons() {
  try {
    // Get spinning department
    const dept = await prisma.departments.findFirst({
      where: { dept_name: 'SPINNING' }
    })

    if (!dept) {
      throw new Error('SPINNING department not found')
    }

    const data = await prisma.stoppage_details.findMany({
      where: {
        is_active: true,
        department_id: dept.id
      },
      select: {
        id: true,
        stoppage_name: true,
        short_code: true,
        description: true,
        stoppage_head_id: true
      },
      orderBy: { stoppage_name: 'asc' }
    })

    // Fetch stoppage heads for category names
    const headIds = [...new Set(data.filter(d => d.stoppage_head_id).map(d => d.stoppage_head_id))]
    const heads = headIds.length > 0 ? await prisma.stoppage_heads.findMany({
      where: { id: { in: headIds }, is_active: true },
      select: { id: true, stoppage_head_name: true }
    }) : []

    const headMap = {}
    heads.forEach(h => { headMap[h.id] = h.stoppage_head_name })

    // Enrich data with category name
    const enrichedData = data.filter(item => (
      !item.stoppage_head_id || headMap[item.stoppage_head_id]
    )).map(item => ({
      ...item,
      category: headMap[item.stoppage_head_id] || 'OTHERS'
    }))
    
    console.log(`Found ${enrichedData?.length || 0} stoppage reasons for SPINNING department`)
    return enrichedData || []
  } catch (error) {
    console.error('Error fetching spinning stoppage reasons:', error)
    throw error
  }
}

// Search stoppage reasons for spinning (for autocomplete)
export async function searchSpinningStoppageReasons(searchTerm = '', limit = 20) {
  try {
    const dept = await prisma.departments.findFirst({
      where: { dept_name: 'SPINNING' }
    })

    if (!dept) throw new Error('SPINNING department not found')

    const whereClause = {
      is_active: true,
      department_id: dept.id
    }

    // Add search filter if term provided
    if (searchTerm && searchTerm.trim()) {
      whereClause.OR = [
        { stoppage_name: { contains: searchTerm.trim() } },
        { short_code: { contains: searchTerm.trim() } }
      ]
    }

    const data = await prisma.stoppage_details.findMany({
      where: whereClause,
      select: {
        id: true,
        stoppage_name: true,
        short_code: true,
        stoppage_head_id: true
      },
      orderBy: { stoppage_name: 'asc' },
      take: limit
    })

    // Fetch stoppage heads for category names
    const headIds = [...new Set(data.filter(d => d.stoppage_head_id).map(d => d.stoppage_head_id))]
    const heads = headIds.length > 0 ? await prisma.stoppage_heads.findMany({
      where: { id: { in: headIds }, is_active: true },
      select: { id: true, stoppage_head_name: true }
    }) : []

    const headMap = {}
    heads.forEach(h => { headMap[h.id] = h.stoppage_head_name })

    return data.filter(item => (
      !item.stoppage_head_id || headMap[item.stoppage_head_id]
    )).map(item => ({
      ...item,
      category: headMap[item.stoppage_head_id] || 'OTHERS'
    }))
  } catch (error) {
    console.error('Error searching spinning stoppage reasons:', error)
    throw error
  }
}

// Get supervisors
export async function getSupervisors() {
  try {
    const data = await prisma.supervisors.findMany({
      select: {
        id: true,
        supervisor_name: true
      },
      orderBy: {
        supervisor_name: 'asc'
      }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Get maisitries
export async function getMaisitries() {
  try {
    const data = await prisma.supervisors.findMany({
      select: {
        id: true,
        supervisor_name: true
      },
      orderBy: {
        supervisor_name: 'asc'
      }
    })
    return (data || []).map(item => ({
      id: item.id,
      supervisor_name: item.supervisor_name,
      maisitry_name: item.supervisor_name
    }))
  } catch (error) {
    throw error
  }
}

// Get previous dates in the same shift that contain setup speeds.
export async function getSpinningAvailablePreviousDates(beforeDate, shift, limit = 30) {
  return getAvailablePreviousSpeedDates(
    prisma.spinning_machine_setup,
    beforeDate,
    shift,
    limit
  )
}

// Copy only speed between matching machine setup rows in the same shift.
export async function copySpinningFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  return copyPreviousSpeeds({
    setupModel: prisma.spinning_machine_setup,
    headerModel: prisma.spinning_production_header,
    targetHeaderId,
    targetDate,
    targetShift,
    sourceDate
  })
}

// ============================================
// MACHINE MANAGEMENT FUNCTIONS
// ============================================

// Look up the lifecycle and setup that apply to the selected entry date/shift.
export async function lookupSpinningMachineByNo(machineNo, entryDate, shift = 1) {
  const normalizedMachineNo = normalizeMachineNumber(machineNo)
  const dateObj = parseStrictDate(entryDate, 'Spinning entry date')
  const shiftNum = Number.parseInt(shift, 10)
  if (![1, 2, 3].includes(shiftNum)) throw new Error('Spinning shift must be 1, 2, or 3')

  const lifecycles = await prisma.spinning_machines.findMany({
    where: { machine_no: { equals: normalizedMachineNo } },
    orderBy: [{ activated_at: 'desc' }, { created_at: 'desc' }]
  })
  if (lifecycles.length === 0) return null

  const visibleMachine = lifecycles.find(machine => isSpinningMachineVisibleOnDate(machine, dateObj))
  const machine = visibleMachine || lifecycles[0]
  const lifecycleIds = lifecycles.map(row => row.id)
  const exactSetup = await prisma.spinning_machine_setup.findFirst({
    where: { machine_id: machine.id, entry_date: dateObj, shift: shiftNum }
  })
  const setup = exactSetup || await prisma.spinning_machine_setup.findFirst({
    where: { machine_id: { in: lifecycleIds }, entry_date: { lte: dateObj } },
    orderBy: [{ entry_date: 'desc' }, { shift: 'desc' }]
  })

  return {
    ...machine,
    exists_on_entry_date: Boolean(visibleMachine),
    count_name: setup?.count_name ?? null,
    act_count: setup?.act_count != null ? Number(setup.act_count) : null,
    tpi: setup?.tpi != null ? Number(setup.tpi) : null,
    speed: setup?.speed ?? null,
    tw_con: setup?.tw_con ?? null,
    doff_loss: setup?.doff_loss != null ? Number(setup.doff_loss) : null,
    c_waste_percent: setup?.c_waste_percent != null ? Number(setup.c_waste_percent) : null
  }
}

export async function addSpinningMachine(machineData) {
  return addSpinningMachineForEntry(machineData)
}
function optionalWholeNumber(value, label, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative whole number`)
  return parsed
}

function optionalText(value, fallback = null, maxLength = 255) {
  if (value === null || value === undefined || value === '') return fallback
  const normalized = String(value).trim()
  if (!normalized) return fallback
  if (normalized.length > maxLength) throw new Error(`Value cannot exceed ${maxLength} characters`)
  return normalized
}

function optionalBoolean(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  throw new Error('Machine option must be true or false')
}

async function addSpinningMachineForEntry(machineData) {
  if (!machineData || typeof machineData !== 'object' || Array.isArray(machineData)) {
    throw new Error('Spinning machine data is required')
  }

  const context = {
    headerId: machineData.headerId,
    entryDate: machineData.entryDate,
    shift: machineData.shift
  }
  const machineNo = normalizeMachineNumber(machineData.machine_no)

  return prisma.$transaction(async tx => {
    const resolved = await resolveEntryMachineContext({
      headerModel: tx.spinning_production_header,
      context,
      label: 'Spinning entry'
    })
    if (![1, 2, 3].includes(resolved.shift)) throw new Error('Spinning shift must be 1, 2, or 3')

    const lifecycles = await tx.spinning_machines.findMany({
      where: { machine_no: { equals: machineNo } },
      orderBy: [{ activated_at: 'desc' }, { created_at: 'desc' }]
    })
    assertLifecycleCanStart(lifecycles, resolved.entryDate, machineNo)
    const sourceMachine = lifecycles[0] || null
    const sourceSetup = sourceMachine
      ? await tx.spinning_machine_setup.findFirst({
          where: { machine_id: sourceMachine.id, entry_date: { lte: resolved.entryDate } },
          orderBy: [{ entry_date: 'desc' }, { shift: 'desc' }]
        })
      : null

    const allocatedSpindles = optionalWholeNumber(
      machineData.allocated_spindles,
      'Allocated spindles',
      sourceMachine?.allocated_spindles ?? 1104
    )
    if (allocatedSpindles <= 0) throw new Error('Allocated spindles must be greater than zero')
    const installedDateSource = machineData.installed_date ?? sourceMachine?.installed_date ?? null
    const installedDate = validateInstalledDateForActivation(installedDateSource, resolved.entryDate)
    const countName = optionalText(machineData.count_name, sourceSetup?.count_name, 100)
    if (!countName) throw new Error('Select an active Spinning count before adding the machine')
    const count = await tx.spinning_counts.findFirst({
      where: { count_name: countName, is_active: true }
    })
    if (!count) throw new Error('The selected Spinning count is missing or inactive')

    const runTime = Number.isInteger(resolved.totalTime) && resolved.totalTime > 0
      ? resolved.totalTime
      : resolveSpinningShiftFallbackTime(resolved.shift)
    const rawSetup = applySpinningCountMaster({
      count_name: count.count_name,
      allocated_spindles: allocatedSpindles,
      session_no: optionalWholeNumber(machineData.session_no, 'Session number', 1),
      run_time: runTime,
      efficiency: 0.985,
      conversion_factor: 2.20456,
      doff_loss: count.doff_loss ?? sourceSetup?.doff_loss ?? 0,
      c_waste_percent: count.waste_percent ?? sourceSetup?.c_waste_percent ?? 0
    }, count)
    const setupValues = validateCompleteSpinningSetup(rawSetup)

    const maxSort = await tx.spinning_machines.aggregate({ _max: { sort_order: true } })
    const now = new Date()
    const machine = await tx.spinning_machines.create({
      data: {
        machine_no: machineNo,
        description: optionalText(machineData.description, sourceMachine?.description || machineNo),
        make_name: optionalText(machineData.make_name, sourceMachine?.make_name || 'LMW'),
        model: optionalText(machineData.model, sourceMachine?.model || null),
        allocated_spindles: allocatedSpindles,
        frame_no: optionalWholeNumber(machineData.frame_no, 'Frame number', sourceMachine?.frame_no ?? null),
        mc_id: optionalText(machineData.mc_id, sourceMachine?.mc_id || null),
        group_no: optionalWholeNumber(machineData.group_no, 'Group number', sourceMachine?.group_no ?? null),
        installed_date: installedDate,
        production_kgs_manual_entry: optionalBoolean(
          machineData.production_kgs_manual_entry,
          sourceMachine?.production_kgs_manual_entry ?? false
        ),
        direct_hank_entry: optionalBoolean(
          machineData.direct_hank_entry,
          sourceMachine?.direct_hank_entry ?? true
        ),
        is_active: true,
        activated_at: resolved.entryDate,
        deactivated_at: null,
        sort_order: (maxSort._max.sort_order ?? 0) + 1,
        created_at: now,
        updated_at: now
      }
    })

    const exactSetup = await tx.spinning_machine_setup.create({
      data: {
        machine_id: machine.id,
        entry_date: resolved.entryDate,
        shift: resolved.shift,
        ...setupValues,
        created_at: now,
        updated_at: now
      }
    })
    if (!sameCalendarDate(resolved.entryDate, SPINNING_DEFAULT_SETUP_DATE) || resolved.shift !== 1) {
      await tx.spinning_machine_setup.create({
        data: {
          machine_id: machine.id,
          entry_date: SPINNING_DEFAULT_SETUP_DATE,
          shift: 1,
          ...setupValues,
          run_time: resolveSpinningShiftFallbackTime(1),
          created_at: now,
          updated_at: now
        }
      })
    }

    const totalSpindles = calculateNoOfSpindles(allocatedSpindles, resolved.shift)
    const detail = await tx.spinning_production_detail.create({
      data: {
        header_id: resolved.headerId,
        machine_id: machine.id,
        count_name: setupValues.count_name,
        worked_spindles: totalSpindles,
        stopped_spindles: 0,
        total_stoppage_mins: 0,
        session_no: setupValues.session_no,
        run_time: runTime,
        work_time: runTime,
        created_at: now,
        updated_at: now
      }
    })
    await tx.spinning_stoppage_entry.create({
      data: {
        production_detail_id: detail.id,
        run_time: runTime,
        stoppage1_time: 0,
        stoppage2_time: 0,
        stoppage3_time: 0,
        stoppage4_time: 0,
        total_stoppage_time: 0,
        created_at: now,
        updated_at: now
      }
    })

    return {
      machine,
      setup: exactSetup,
      newLifecycle: lifecycles.length > 0,
      reactivated: false
    }
  }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 30000 })
}

export async function removeSpinningMachines(machineIds, context) {
  return prisma.$transaction(tx => deactivateEntryMachines({
    tx,
    headerModel: tx.spinning_production_header,
    machineModel: tx.spinning_machines,
    machineIds,
    context,
    label: 'Spinning entry'
  }), { isolationLevel: 'Serializable' })
}

// Remove spinning machine from the selected entry date onward.
export async function removeSpinningMachine(id, context) {
  const result = await removeSpinningMachines([id], context)
  return { ...result, id }
}

// Remove spinning machine setups (batch)
export async function removeSpinningMachineSetups(setupIds) {
  try {
    const result = await prisma.spinning_machine_setup.deleteMany({
      where: {
        id: { in: setupIds }
      }
    })
    return result
  } catch (error) {
    throw error
  }
}

