import { prisma } from '../prisma'
import { addMachineToEntrySnapshot, assertEntryDetailUnlocked, assertEntryHeaderUnlocked, assertEntrySetupUnlocked, assertEntryStoppageUnlocked, removeMachineFromEntrySnapshot } from './entryMachineSnapshot'
import { resolveSpinningShiftFallbackTime } from '../spinningShiftFallback'
import { findFirstFreeStoppageSlot } from '../stoppageSlotUtils'
import { copyPreviousSpeeds, getAvailablePreviousSpeedDates } from './copyPreviousSpeed'
import { calculateSpinningExpectedGps, resolveProductionTime } from '../productionFormulaMath'
import { sanitizeProductionDetailUpdate } from './productionDetailUpdate'
import { sanitizeEntryHeaderUpdate, sanitizeEntrySetupUpdate, sanitizeEntryStoppageUpdate } from './entryUpdateValidation'
import { buildSpinningCountSnapshot, mergeCountSnapshotWithEntryEdits } from '../countMasterSnapshots'
import {
  createSpinningOptionCheckError,
  normalizeSpinningEntryContext,
  normalizeSpinningEntryDate,
  validateSpinningOptionCheckSource
} from '../spinningOptionCheck'

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
    return null
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
    return []
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
  if (!allocatedSpindles) return 0
  const multiplier = parseInt(shift) === 3 ? 7 : 8.5
  return Math.round((allocatedSpindles / 8) * multiplier)
}

/**
 * Calculate Constant for spinning production
 * Formula: Constant = 1 / 2.20456 / ACL_Count × Total_Spl × CONSTANT_EFFICIENCY
 * Note: CONSTANT_EFFICIENCY is always 0.985 (98.5%) - this is a fixed conversion factor,
 *       NOT the same as the machine setup efficiency (0.95) used in Exp GPS calculation.
 */
const CONSTANT_EFFICIENCY = 0.985

export function calculateConstant(aclCount, totalSpindles) {
  if (!aclCount || aclCount === 0) return 0
  return (1 / 2.20456 / aclCount) * totalSpindles * CONSTANT_EFFICIENCY
}

/**
 * Calculate ACL Production (Kg)
 * Formula: ACL_Prod = ACL_Hank × Constant
 */
export function calculateActProdn(actHank, constant) {
  return actHank * constant
}

/**
 * Calculate Waste Percentage
 * Formula: Waste % = (Waste / ACL_Prod) × 100
 */
export function calculateWastePercent(waste, actProdn) {
  if (!actProdn || actProdn === 0) return 0
  return (waste / actProdn) * 100
}

/**
 * Calculate Stopped Spindles
 * Formula: Stopped_Spl = (Stoppage_Mins / Total_Mins) × Total_Spl
 */
export function calculateStoppedSpindles(stoppageMins, totalMins, totalSpindles) {
  const time = resolveProductionTime(totalMins, stoppageMins)
  if (time.totalTime === 0) return 0
  return (time.stoppageTime / time.totalTime) * totalSpindles
}

/**
 * Calculate Worked Spindles
 * Formula: Worked_Spl = Total_Spl - Stopped_Spl
 */
export function calculateWorkedSpindles(totalSpindles, stoppedSpindles) {
  return Math.max(totalSpindles - stoppedSpindles, 0)
}

/**
 * Calculate GPS (Grams Per Spindle)
 * Formula: GPS = (ACL_Prod / Worked_Spl) × 1000
 */
export function calculateGps(actProdn, workedSpindles) {
  if (!workedSpindles || workedSpindles === 0) return 0
  return (actProdn / workedSpindles) * 1000
}

/**
 * Calculate Expected GPS
 * Formula: Exp_GPS = 7.2 × Speed / TPI / Count × Loss_Effi
 * Loss_Effi = (100 - (TW.Con + Doff Loss + C.Waste %)) / 100
 * @param {number} speed - Machine speed (RPM)
 * @param {number} tpi - Twists per inch
 * @param {number} count - Act Count value (e.g., 69.5 from machine setup)
 * @param {number} twCon - TW.Con loss percentage
 * @param {number} doffLoss - Doff loss percentage
 * @param {number} cWastePercent - C.Waste percentage
 */
export function calculateExpGps(speed, tpi, count, twCon = 0, doffLoss = 0, cWastePercent = 0) {
  return calculateSpinningExpectedGps({
    speed,
    tpi,
    count,
    twCon,
    doffLoss,
    cWastePercent
  })
}

/**
 * Full production calculation
 * Updated to include No of Spindles calculation based on shift
 */
export function calculateSpinningProduction(params) {
  const {
    actHank = 0,
    waste = 0,
    actCount = 0,
    allocatedSpindles = 1104,
    shift = 1,
    stoppageMins = 0,
    runTime = 0,
    speed = 0,
    tpi = 0,
    count = 0,
    twCon = 0,
    doffLoss = 0,
    cWastePercent = 0
  } = params

  // Calculate No of Spindles based on shift
  const totalSpindles = calculateNoOfSpindles(allocatedSpindles, shift)

  const constant = calculateConstant(actCount, totalSpindles)
  const actProdn = calculateActProdn(actHank, constant)
  const wastePercent = calculateWastePercent(waste, actProdn)
  const stoppedSpindles = calculateStoppedSpindles(stoppageMins, runTime, totalSpindles)
  const workedSpindles = calculateWorkedSpindles(totalSpindles, stoppedSpindles)
  const gps = calculateGps(actProdn, workedSpindles)
  const expGps = calculateExpGps(speed, tpi, count, twCon, doffLoss, cWastePercent)

  return {
    totalSpindles: totalSpindles,
    constant: Math.round(constant * 1000) / 1000,
    actProdn: Math.round(actProdn * 100) / 100,
    wastePercent: Math.round(wastePercent * 100) / 100,
    stoppedSpindles: Math.round(stoppedSpindles * 100) / 100,
    workedSpindles: workedSpindles,
    gps: Math.round(gps * 100) / 100,
    expGps: Math.round(expGps * 1000) / 1000
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
  await assertEntryHeaderUnlocked('spinning', id)
  updates = sanitizeEntryHeaderUpdate(updates)
  try {
    const data = await prisma.spinning_production_header.update({
      where: { id },
      data: updates
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
    try {
      // Get shift configuration for total_time from database
      const shiftConfig = await getSpinningShiftConfiguration(shift)

      header = await createSpinningProductionHeader({
        entry_date: new Date(date),
        shift,
        supervisor_id: supervisorId,
        maisitry_id: maisitryId,
        total_time: shiftConfig.totalTime
      })

      // Initialize production details for all active machines
      await initializeSpinningProductionDetails(header.id, shift)
    } catch (error) {
      const racedHeader = await getSpinningProductionByDateShift(date, shift)
      if (racedHeader) return racedHeader
      throw error
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
      setupMap[`${s.machine_id}:${s.run_sequence || 1}`] = s
    })
    
    const stoppageMap = {}
    stoppages?.forEach(s => {
      stoppageMap[s.production_detail_id] = s
    })
    
    // A detail points to the exact machine revision captured by the entry.
    const enrichedData = data
      ?.map(detail => ({
        ...detail,
        machine: machineMap[detail.machine_id] || null,
        setup: setupMap[`${detail.machine_id}:${detail.run_sequence || 1}`] || setupMap[detail.machine_id] || null,
        stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
      }))
      .filter(detail => !!detail.machine) || []
    
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
    // Check if details already exist
    const existingDetails = await prisma.spinning_production_detail.findMany({
      where: { header_id: headerId },
      select: { machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Get header entry_date for date-based machine visibility
    const header = await prisma.spinning_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    // Get machine setups for default values for this date
    const setups = await getOrCreateSpinningMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get machines visible on the entry date that have a setup
    const machines = await prisma.spinning_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        installed_date: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: { sort_order: 'asc' }
    })

    // Filter out machines that already have entries
    const newMachines = machines.filter(m => !existingMachineIds.includes(m.id))

    if (newMachines.length === 0) {
      return existingDetails
    }

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Get shift configuration
    const shiftConfig = await getSpinningShiftConfiguration(shift)

    // Create detail records for new machines
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const allocatedSpindles = firstProvidedNumber([setup.allocated_spindles, machine.allocated_spindles], 1104)
      // Calculate No of Spindles based on shift: (Allocated / 8) × 8.5 for Shift 1&2, × 7 for Shift 3
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, shift)

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

    await prisma.spinning_production_detail.createMany({
      data: details,
      skipDuplicates: true
    })

    // Get created details
    const createdDetails = await prisma.spinning_production_detail.findMany({
      where: { 
        header_id: headerId,
        machine_id: { in: newMachines.map(m => m.id) }
      }
    })

    // Initialize stoppage entries for each new detail
    const stoppageEntries = createdDetails.map(detail => ({
      production_detail_id: detail.id,
      run_time: shiftConfig.totalTime,
      stoppage1_time: 0,
      stoppage2_time: 0,
      stoppage3_time: 0,
      stoppage4_time: 0,
      total_stoppage_time: 0
    }))

    await prisma.spinning_stoppage_entry.createMany({
      data: stoppageEntries,
      skipDuplicates: true
    })

    return await prisma.spinning_production_detail.findMany({
      where: { header_id: headerId }
    })
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
      select: { entry_date: true }
    })
    const entryDate = headerForDate?.entry_date || new Date()

    // Get machine setups for default values for this date
    const setups = await getOrCreateSpinningMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get machines visible on the entry date
    // Only include machines with a setup entry — master-only machines (no setup) are excluded
    const machines = await prisma.spinning_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        installed_date: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: { sort_order: 'asc' }
    })

    // Get existing production details for this header
    const existingDetails = await prisma.spinning_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Existing detail rows are snapshots. A later master deactivation or
    // revision must never delete or replace a machine in this entry.
    const remainingMachineIds = existingDetails.map(detail => detail.machine_id)

    // Find machines that don't have entries
    const newMachines = machines?.filter(m => !remainingMachineIds.includes(m.id)) || []

    if (newMachines.length === 0) {
      return { added: 0, machines: [] }
    }

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Get shift configuration
    const shiftConfig = await getSpinningShiftConfiguration(shift)

    // Create detail records
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const allocatedSpindles = firstProvidedNumber([setup.allocated_spindles, machine.allocated_spindles], 1104)
      // Calculate No of Spindles based on shift: (Allocated / 8) × 8.5 for Shift 1&2, × 7 for Shift 3
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, shift)

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

    await prisma.spinning_production_detail.createMany({
      data: details,
      skipDuplicates: true
    })

    // Get created details
    const createdDetails = await prisma.spinning_production_detail.findMany({
      where: { 
        header_id: headerId,
        machine_id: { in: newMachines.map(m => m.id) }
      }
    })

    // Create stoppage entries
    const stoppageEntries = createdDetails.map(detail => ({
      production_detail_id: detail.id,
      run_time: shiftConfig.totalTime,
      total_stoppage_time: 0
    }))

    await prisma.spinning_stoppage_entry.createMany({
      data: stoppageEntries,
      skipDuplicates: true
    })

    return { 
      added: newMachines.length, 
      machines: newMachines.map(m => m.machine_no) 
    }
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateSpinningProductionDetail(id, updates) {
  await assertEntryDetailUnlocked('spinning', id)
  try {
    const cleanUpdates = sanitizeProductionDetailUpdate(updates)
    const data = await prisma.spinning_production_detail.update({
      where: { id },
      data: {
        ...cleanUpdates,
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
  await Promise.all(updates.map(({ id }) => assertEntryDetailUnlocked('spinning', id)))
  try {
    const updatedAt = new Date()
    return await prisma.$transaction(updates.map((update) => {
      const { id, ...data } = update
      return prisma.spinning_production_detail.update({
        where: { id },
        data: {
          ...sanitizeProductionDetailUpdate(data),
          updated_at: updatedAt
        }
      })
    }))
  } catch (error) {
    throw error
  }
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
    const entryDate = header?.entry_date || new Date()
    const shift = header?.shift || 1

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
    setups?.forEach(s => {
      const runSequence = Number(s.run_sequence || 1)
      setupMap[`${s.machine_id}:${runSequence}`] = s
      if (!setupMap[s.machine_id] || runSequence === 1) {
        setupMap[s.machine_id] = s
      }
    })

    const stoppageReasonMap = {}
    stoppageReasons?.forEach(r => { stoppageReasonMap[r.id] = r })

    // Create stoppage map
    const stoppageMap = {}
    stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s })

    // Preserve the machine revision already referenced by the entry.
    const result = details
      .filter(detail => !!machineMap[detail.machine_id])
      .map(detail => {
        const machine = machineMap[detail.machine_id]
        const setup = setupMap[`${detail.machine_id}:${detail.run_sequence || 1}`] || setupMap[detail.machine_id] || {}
        const stoppage = stoppageMap[detail.id] || {}

        return {
          id: detail.id,
          machine_id: detail.machine_id,
          run_sequence: Number(detail.run_sequence || 1),
          setup_id: setup.id || null,
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
          count_id: setup.count_id || null,
          session_no: detail.session_no ?? null,
          run_time: detail.run_time ?? fallbackRunTime,
          total_spindles: firstProvidedNumber([setup.allocated_spindles, machine.allocated_spindles], 1104),
          act_count: toFiniteNumber(setup.act_count),
          efficiency: toFiniteNumber(setup.efficiency, 0.95),
          speed: toFiniteNumber(setup.speed),
          tpi: toFiniteNumber(setup.tpi),
          tw_con: toFiniteNumber(setup.tw_con),
          doff_loss: toFiniteNumber(setup.doff_loss),
          c_waste_percent: toFiniteNumber(setup.c_waste_percent),
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

// Update stoppage entry
export async function updateSpinningStoppageEntry(stoppageId, updates) {
  await assertEntryStoppageUnlocked('spinning', stoppageId)
  updates = sanitizeEntryStoppageUpdate(updates)
  try {
    const normalizedUpdates = { ...updates }
    ;[1, 2, 3, 4].forEach((slot) => {
      const idField = `stoppage${slot}_id`
      const timeField = `stoppage${slot}_time`
      const rawId = normalizedUpdates[idField]
      const isClearing = rawId === 'NONE' || rawId === '' || rawId === null
      if (isClearing) {
        normalizedUpdates[idField] = null
        if (normalizedUpdates[timeField] === undefined) {
          normalizedUpdates[timeField] = 0
        }
      }
    })

    // First, fetch the existing record to get current stoppage values (like Carding module)
    const existing = await prisma.spinning_stoppage_entry.findUnique({
      where: { id: stoppageId },
      select: {
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

    // Merge existing values with updates - use updated value if provided, else keep existing
    const mergedStoppages = {
      stoppage1_time: normalizedUpdates.stoppage1_time ?? existing.stoppage1_time ?? 0,
      stoppage2_time: normalizedUpdates.stoppage2_time ?? existing.stoppage2_time ?? 0,
      stoppage3_time: normalizedUpdates.stoppage3_time ?? existing.stoppage3_time ?? 0,
      stoppage4_time: normalizedUpdates.stoppage4_time ?? existing.stoppage4_time ?? 0
    }

    // Calculate total stoppage time from merged values
    const totalStoppageTime = 
      (parseInt(mergedStoppages.stoppage1_time) || 0) +
      (parseInt(mergedStoppages.stoppage2_time) || 0) +
      (parseInt(mergedStoppages.stoppage3_time) || 0) +
      (parseInt(mergedStoppages.stoppage4_time) || 0)

    const data = await prisma.spinning_stoppage_entry.update({
      where: { id: stoppageId },
      data: {
        ...normalizedUpdates,
        ...mergedStoppages,
        total_stoppage_time: totalStoppageTime,
        updated_at: new Date()
      }
    })

    // Recalculate stopped_spindles and worked_spindles in production detail
    // Get production detail with header to know shift
    const prodDetail = await prisma.spinning_production_detail.findUnique({
      where: { id: data.production_detail_id }
    })
    if (prodDetail) {
      const header = await prisma.spinning_production_header.findUnique({
        where: { id: prodDetail.header_id }
      })
      const setup = await prisma.spinning_machine_setup.findFirst({
        where: { 
          machine_id: prodDetail.machine_id,
          entry_date: header?.entry_date || new Date(),
          shift: header?.shift || 1
        }
      })
      const machine = await prisma.spinning_machines.findUnique({
        where: { id: prodDetail.machine_id }
      })
      const allocatedSpindles = firstProvidedNumber([setup?.allocated_spindles, machine?.allocated_spindles], 1104)
      const shift = header?.shift || 1
      const runTime = prodDetail.run_time ?? resolveSpinningShiftFallbackTime(shift)
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, shift)
      // STOPPED SPL = (Total Stoppage Mins / Total Min) × No of Spindles
      const stoppedSpl = runTime > 0 ? (totalStoppageTime / runTime) * noOfSpindles : 0
      // WORKED SPL = No of Spindles - STOPPED SPL
      const workedSpl = noOfSpindles - stoppedSpl

      await prisma.spinning_production_detail.update({
        where: { id: data.production_detail_id },
        data: {
          total_stoppage_mins: totalStoppageTime,
          stopped_spindles: Math.round(stoppedSpl * 100) / 100,
          worked_spindles: workedSpl,
          updated_at: new Date()
        }
      })
    }

    return data
  } catch (error) {
    throw error
  }
}

// Apply full stoppage to all machines
export async function applyFullStoppage(headerId, stoppageId, stoppageTime) {
  await assertEntryHeaderUnlocked('spinning', headerId)
  try {
    // Get header to know shift
    const header = await prisma.spinning_production_header.findUnique({
      where: { id: headerId }
    })
    const shift = header?.shift || 1

    // Get machine setups for allocated spindles
    const setups = await prisma.spinning_machine_setup.findMany({
      where: { 
        entry_date: header?.entry_date || new Date(),
        shift: shift
      }
    })
    const setupMap = {}
    setups?.forEach(s => { setupMap[s.machine_id] = s })

    // Get machines for fallback spindle counts (all, no filter — historical)
    const machines = await prisma.spinning_machines.findMany()
    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    // Get all production details for this header
    const details = await prisma.spinning_production_detail.findMany({
      where: { header_id: headerId }
    })

    const results = []
    for (const detail of details) {
      // Get or create stoppage entry
      let stoppage = await prisma.spinning_stoppage_entry.findFirst({
        where: { production_detail_id: detail.id }
      })

      if (!stoppage) {
        stoppage = await prisma.spinning_stoppage_entry.create({
          data: {
            production_detail_id: detail.id,
            run_time: detail.run_time ?? resolveSpinningShiftFallbackTime(shift)
          }
        })
      }

      // Preserve existing stoppages and use this machine's first free slot.
      const slot = findFirstFreeStoppageSlot(stoppage)
      if (!slot) continue
      const updateData = {}
      updateData[`stoppage${slot}_id`] = stoppageId
      updateData[`stoppage${slot}_time`] = parseInt(stoppageTime) || 0

      // Recalculate total
      const currentStoppage = { ...stoppage }
      currentStoppage[`stoppage${slot}_time`] = parseInt(stoppageTime) || 0
      
      const totalStoppageTime = 
        (parseInt(currentStoppage.stoppage1_time) || 0) +
        (parseInt(currentStoppage.stoppage2_time) || 0) +
        (parseInt(currentStoppage.stoppage3_time) || 0) +
        (parseInt(currentStoppage.stoppage4_time) || 0)

      updateData.total_stoppage_time = totalStoppageTime
      updateData.is_full_stoppage = true

      const result = await prisma.spinning_stoppage_entry.update({
        where: { id: stoppage.id },
        data: updateData
      })

      // Recalculate stopped_spindles and worked_spindles
      const setup = setupMap[`${detail.machine_id}:${detail.run_sequence || 1}`] || setupMap[detail.machine_id]
      const machine = machineMap[detail.machine_id]
      const allocatedSpindles = firstProvidedNumber([setup?.allocated_spindles, machine?.allocated_spindles], 1104)
      const runTime = detail.run_time ?? resolveSpinningShiftFallbackTime(shift)
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, shift)
      const stoppedSpl = runTime > 0 ? (totalStoppageTime / runTime) * noOfSpindles : 0
      const workedSpl = noOfSpindles - stoppedSpl

      await prisma.spinning_production_detail.update({
        where: { id: detail.id },
        data: {
          total_stoppage_mins: totalStoppageTime,
          stopped_spindles: Math.round(stoppedSpl * 100) / 100,
          worked_spindles: workedSpl
        }
      })

      results.push(result)
    }

    return results
  } catch (error) {
    throw error
  }
}

// Apply partial stoppage to range of machines
export async function applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  await assertEntryHeaderUnlocked('spinning', headerId)
  try {
    // Get header to know shift
    const header = await prisma.spinning_production_header.findUnique({
      where: { id: headerId }
    })
    const shift = header?.shift || 1

    // Get machine setups for allocated spindles
    const setups = await prisma.spinning_machine_setup.findMany({
      where: { 
        entry_date: header?.entry_date || new Date(),
        shift: shift
      }
    })
    const setupMap = {}
    setups?.forEach(s => { setupMap[s.machine_id] = s })

    // Get all production details with machines
    const details = await getSpinningProductionDetails(headerId)

    // Filter by machine range
    const parsedFrom = parseInt(String(fromMachineNo || '').replace(/\D/g, '') || '0')
    const parsedTo = parseInt(String(toMachineNo || '').replace(/\D/g, '') || '999')
    const fromNum = Math.min(parsedFrom, parsedTo)
    const toNum = Math.max(parsedFrom, parsedTo)

    const filteredDetails = details.filter(d => {
      const machineNum = parseInt(d.machine?.machine_no?.replace(/\D/g, '') || '0')
      return machineNum >= fromNum && machineNum <= toNum
    })

    const pickFirstAvailableSlot = (entry) => {
      for (let i = 1; i <= 4; i++) {
        const slotValue = entry?.[`stoppage${i}_id`]
        if (slotValue === null || slotValue === undefined || slotValue === '') {
          return i
        }
      }
      return null
    }

    let updatedCount = 0
    let overflowCount = 0

    for (const detail of filteredDetails) {
      // Get or create stoppage entry
      let stoppage = await prisma.spinning_stoppage_entry.findFirst({
        where: { production_detail_id: detail.id }
      })

      if (!stoppage) {
        stoppage = await prisma.spinning_stoppage_entry.create({
          data: {
            production_detail_id: detail.id,
            run_time: detail.run_time ?? resolveSpinningShiftFallbackTime(shift)
          }
        })
      }

      // Auto-assign first available slot (1 -> 4)
      const resolvedSlot = pickFirstAvailableSlot(stoppage)
      if (!resolvedSlot) {
        overflowCount++
        continue
      }

      const updateData = {}
      updateData[`stoppage${resolvedSlot}_id`] = stoppageId
      updateData[`stoppage${resolvedSlot}_time`] = parseInt(stoppageTime) || 0

      // Recalculate total
      const currentStoppage = { ...stoppage }
      currentStoppage[`stoppage${resolvedSlot}_time`] = parseInt(stoppageTime) || 0
      currentStoppage[`stoppage${resolvedSlot}_id`] = stoppageId
      
      const totalStoppageTime = 
        (parseInt(currentStoppage.stoppage1_time) || 0) +
        (parseInt(currentStoppage.stoppage2_time) || 0) +
        (parseInt(currentStoppage.stoppage3_time) || 0) +
        (parseInt(currentStoppage.stoppage4_time) || 0)

      updateData.total_stoppage_time = totalStoppageTime

      const result = await prisma.spinning_stoppage_entry.update({
        where: { id: stoppage.id },
        data: updateData
      })

      // Recalculate stopped_spindles and worked_spindles
      const setup = setupMap[detail.machine_id]
      const allocatedSpindles = firstProvidedNumber([setup?.allocated_spindles, detail.machine?.allocated_spindles], 1104)
      const runTime = detail.run_time ?? resolveSpinningShiftFallbackTime(shift)
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, shift)
      const stoppedSpl = runTime > 0 ? (totalStoppageTime / runTime) * noOfSpindles : 0
      const workedSpl = noOfSpindles - stoppedSpl

      await prisma.spinning_production_detail.update({
        where: { id: detail.id },
        data: {
          total_stoppage_mins: totalStoppageTime,
          stopped_spindles: Math.round(stoppedSpl * 100) / 100,
          worked_spindles: workedSpl
        }
      })

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
}

// ============================================
// MACHINE SETUP OPERATIONS
// ============================================

// Create new date/shift snapshots from the canonical machine defaults.
// Explicit copy actions remain available, but initialization never carries
// forward the most recently edited setup automatically.
export async function getOrCreateSpinningMachineSetups(entryDate, shift = 1) {
  try {
    const dateObj = new Date(entryDate)
    const shiftNum = parseInt(shift)
    const targetShiftTime = shiftNum === 3 ? 420 : 510

    // An existing date/shift is an immutable entry snapshot. Reopening it must
    // never re-resolve today's machine master or count master.
    const existingSetups = await prisma.spinning_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
    if (existingSetups.length > 0) {
      return existingSetups.filter(setup => setup.is_included)
    }

    // Participation comes from the latest earlier entry snapshot. Master-only
    // machines are deliberately excluded until Add Master Machine enrolls them.
    // Multiple count runs collapse to the latest run for the next entry.
    const previousRows = await prisma.spinning_machine_setup.findMany({
      where: {
        OR: [
          { entry_date: { lt: dateObj } },
          { entry_date: dateObj, shift: { lt: shiftNum } }
        ]
      },
      orderBy: [
        { entry_date: 'desc' },
        { shift: 'desc' },
        { run_sequence: 'desc' }
      ]
    })
    const latestByMachine = new Map()
    previousRows.forEach(row => {
      if (!latestByMachine.has(row.machine_id)) latestByMachine.set(row.machine_id, row)
    })
    const enrolledRows = [...latestByMachine.values()].filter(row => row.is_included)
    const machineIds = enrolledRows.map(row => row.machine_id)
    const machines = machineIds.length
      ? await prisma.spinning_machines.findMany({
          where: { id: { in: machineIds } },
          orderBy: { sort_order: 'asc' }
        })
      : []
    const sourceByMachine = new Map(enrolledRows.map(row => [row.machine_id, row]))
    const countNames = [...new Set(enrolledRows.map(row => row.count_name).filter(Boolean))]
    const countMasters = countNames.length
      ? await prisma.spinning_counts.findMany({ where: { count_name: { in: countNames } } })
      : []
    const countByName = new Map(countMasters.map(count => [count.count_name, count]))

    const defaultSetups = machines.map(machine => {
      const source = sourceByMachine.get(machine.id)
      const count = countByName.get(source?.count_name)
      return {
      machine_id: machine.id,
      is_included: true,
      entry_date: dateObj,
      shift: shiftNum,
      run_sequence: 1,
      ...buildSpinningCountSnapshot(count, { machineSpeed: machine.speed }),
      allocated_spindles: firstProvidedNumber([machine.allocated_spindles], 1104),
      session_no: 1,
      run_time: targetShiftTime,
      efficiency: 0.985,
      conversion_factor: 2.20456
    }})
    
    if (defaultSetups.length > 0) {
      await prisma.spinning_machine_setup.createMany({
        data: defaultSetups,
        skipDuplicates: true
      })
    }
    
    return await prisma.spinning_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum,
        is_included: true
      }
    })
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
    
    // Get machines that have setups
    const machineIds = setups.map(s => s.machine_id).filter(Boolean)
    const machines = machineIds.length > 0 
      ? await prisma.spinning_machines.findMany({
          where: { id: { in: machineIds } },
          orderBy: { sort_order: 'asc' }
        })
      : []

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    // Combine setup with machine info
    const latestSequenceByMachine = new Map()
    const runCountByMachine = new Map()
    setups.forEach(setup => {
      const sequence = Number(setup.run_sequence || 1)
      latestSequenceByMachine.set(setup.machine_id, Math.max(latestSequenceByMachine.get(setup.machine_id) || 0, sequence))
      runCountByMachine.set(setup.machine_id, (runCountByMachine.get(setup.machine_id) || 0) + 1)
    })
    const enrichedSetups = setups
      .filter(s => machineMap[s.machine_id]) // Only setups for active machines
      .map(setup => ({
        ...setup,
        machine: machineMap[setup.machine_id] || null,
        is_latest_run: Number(setup.run_sequence || 1) === latestSequenceByMachine.get(setup.machine_id),
        has_multiple_runs: (runCountByMachine.get(setup.machine_id) || 0) > 1
      }))

    // Return in sort_order
    return enrichedSetups.sort((a, b) => {
      return (a.machine?.sort_order || 0) - (b.machine?.sort_order || 0)
        || Number(a.run_sequence || 1) - Number(b.run_sequence || 1)
    })
  } catch (error) {
    throw error
  }
}

const spinningSetupFields = new Set([
  'count_id', 'count_name', 'act_count', 'tpi', 'allocated_spindles',
  'tw_con', 'doff_loss', 'c_waste_percent', 'conv_40s_value', 'speed', 'session_no',
  'run_time', 'efficiency', 'conversion_factor'
])

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

async function prepareSpinningSetupUpdate(db, existing, updates) {
  const clean = Object.fromEntries(
    Object.entries(updates).filter(([key]) => spinningSetupFields.has(key))
  )
  const changesCount = hasOwn(clean, 'count_id') || hasOwn(clean, 'count_name')
  if (!changesCount) return { data: clean, changesCount: false }

  const countId = clean.count_id || null
  const countName = clean.count_name || null
  const count = countId || countName
    ? await db.spinning_counts.findFirst({
        where: {
          is_active: true,
          ...(countId ? { id: countId } : { count_name: countName })
        }
      })
    : null
  if ((countId || countName) && !count) throw new Error('Selected spinning count is not active')

  const machine = await db.spinning_machines.findUnique({
    where: { id: existing.machine_id },
    select: { speed: true }
  })
  return {
    data: mergeCountSnapshotWithEntryEdits(
      buildSpinningCountSnapshot(count, { machineSpeed: machine?.speed }),
      clean
    ),
    changesCount: true
  }
}

async function syncSpinningSetupCountToDetail(db, setup, countName) {
  const headers = await db.spinning_production_header.findMany({
    where: { entry_date: setup.entry_date, shift: setup.shift },
    select: { id: true }
  })
  const headerIds = headers.map(header => header.id)
  if (headerIds.length === 0) return
  await db.spinning_production_detail.updateMany({
    where: {
      machine_id: setup.machine_id,
      header_id: { in: headerIds },
      run_sequence: Number(setup.run_sequence || 1)
    },
    data: { count_name: countName }
  })
}

async function updateSpinningSetupInTransaction(db, id, updates) {
  const existing = await db.spinning_machine_setup.findUnique({ where: { id } })
  if (!existing) throw new Error('Spinning machine setup not found')
  const prepared = await prepareSpinningSetupUpdate(db, existing, updates)
  if (hasOwn(prepared.data, 'run_time')) {
    const header = await db.spinning_production_header.findFirst({
      where: { entry_date: existing.entry_date, shift: existing.shift },
      select: { id: true, total_time: true }
    })
    const runs = await db.spinning_machine_setup.findMany({
      where: {
        machine_id: existing.machine_id,
        entry_date: existing.entry_date,
        shift: existing.shift,
        is_included: true
      },
      select: { id: true, run_time: true }
    })
    if (runs.length > 1) {
      const combined = runs.reduce(
        (sum, run) => sum + Number(run.id === id ? prepared.data.run_time : run.run_time || 0),
        0
      )
      if (combined > Number(header?.total_time || 0)) {
        throw new Error(`Combined count-run time cannot exceed the ${header?.total_time}-minute shift`)
      }
    }
  }
  const result = await db.spinning_machine_setup.update({
    where: { id },
    data: { ...prepared.data, updated_at: new Date() }
  })
  if (prepared.changesCount) {
    await syncSpinningSetupCountToDetail(db, result, result.count_name)
  }
  if (hasOwn(prepared.data, 'run_time')) {
    const headers = await db.spinning_production_header.findMany({
      where: { entry_date: result.entry_date, shift: result.shift },
      select: { id: true }
    })
    await db.spinning_production_detail.updateMany({
      where: {
        header_id: { in: headers.map(header => header.id) },
        machine_id: result.machine_id,
        run_sequence: Number(result.run_sequence || 1)
      },
      data: { run_time: result.run_time, work_time: result.run_time }
    })
    const details = await db.spinning_production_detail.findMany({
      where: {
        header_id: { in: headers.map(header => header.id) },
        machine_id: result.machine_id,
        run_sequence: Number(result.run_sequence || 1)
      },
      select: { id: true }
    })
    await db.spinning_stoppage_entry.updateMany({
      where: { production_detail_id: { in: details.map(detail => detail.id) } },
      data: { run_time: result.run_time }
    })
  }
  return result
}

export async function updateSpinningMachineSetup(id, updates) {
  await assertEntrySetupUnlocked('spinning', id)
  updates = sanitizeEntrySetupUpdate(updates)
  return prisma.$transaction(tx => updateSpinningSetupInTransaction(tx, id, updates))
}

export async function upsertSpinningMachineSetup(machineId, entryDate, setupData) {
  const dateObj = new Date(entryDate)
  const shiftNum = parseInt(setupData.shift) || 1
  return prisma.$transaction(async tx => {
    const header = await tx.spinning_production_header.findFirst({
      where: { entry_date: dateObj, shift: shiftNum },
      select: { is_locked: true }
    })
    if (!header) throw new Error('Entry not found')
    if (header.is_locked) throw new Error('This entry is locked and cannot be changed')
    const safeSetupData = sanitizeEntrySetupUpdate(setupData)
    const existing = await tx.spinning_machine_setup.findFirst({
      where: {
        machine_id: machineId,
        entry_date: dateObj,
        shift: shiftNum
      },
      orderBy: { run_sequence: 'desc' }
    })
    if (existing) return updateSpinningSetupInTransaction(tx, existing.id, { ...safeSetupData, is_included: true })

    const prepared = await prepareSpinningSetupUpdate(tx, { machine_id: machineId }, safeSetupData)
    const result = await tx.spinning_machine_setup.create({
      data: {
        machine_id: machineId,
        entry_date: dateObj,
        shift: shiftNum,
        ...prepared.data,
        is_included: true
      }
    })
    if (prepared.changesCount) {
      await syncSpinningSetupCountToDetail(tx, result, result.count_name)
    }
    return result
  })
}

export async function batchUpdateSpinningMachineSetups(updates) {
  await Promise.all(updates.map(({ id }) => assertEntrySetupUnlocked('spinning', id)))
  return prisma.$transaction(async tx => {
    const results = []
    // Apply time reductions before increases. This allows two edited count-run
    // rows to keep the same valid combined shift time without a temporary
    // intermediate value exceeding the shift during the transaction.
    const ids = updates.map(update => update.id)
    const currentRows = await tx.spinning_machine_setup.findMany({
      where: { id: { in: ids } },
      select: { id: true, run_time: true }
    })
    const currentById = new Map(currentRows.map(row => [row.id, Number(row.run_time || 0)]))
    const orderedUpdates = [...updates].sort((a, b) => {
      const deltaA = a.run_time == null ? 0 : Number(a.run_time) - (currentById.get(a.id) || 0)
      const deltaB = b.run_time == null ? 0 : Number(b.run_time) - (currentById.get(b.id) || 0)
      return deltaA - deltaB
    })
    for (const update of orderedUpdates) {
      const { id, machine_id: _machineId, ...data } = update
      results.push(await updateSpinningSetupInTransaction(tx, id, sanitizeEntrySetupUpdate(data)))
    }
    return results
  })
}

function toDateOnlyString(dateValue) {
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function getPreviousSpinningHeaderWhere(target) {
  return {
    shift: { in: [1, 2, 3] },
    OR: [
      { entry_date: { lt: target.date } },
      {
        entry_date: target.date,
        shift: { lt: target.shift }
      }
    ]
  }
}

async function getAvailableSourceShifts(entryDate, target) {
  const headers = await prisma.spinning_production_header.findMany({
    where: {
      entry_date: entryDate,
      ...getPreviousSpinningHeaderWhere(target)
    },
    select: { shift: true },
    orderBy: { shift: 'desc' }
  })

  return [...new Set(headers.map(header => header.shift))]
    .filter(sourceShift => [1, 2, 3].includes(sourceShift))
    .sort((a, b) => b - a)
}

// Resolve the newest initialized entry, or the available initialized shifts
// for a date chosen by the user. Only entries earlier than the current context
// are returned.
export async function getSpinningOptionCheckSource(payload) {
  const {
    targetDate,
    targetShift,
    sourceDate
  } = payload || {}
  const target = normalizeSpinningEntryContext(targetDate, targetShift, 'Current entry')

  if (sourceDate) {
    const selectedDate = normalizeSpinningEntryDate(sourceDate, 'Source date')
    const availableShifts = await getAvailableSourceShifts(selectedDate.date, target)

    return {
      sourceDate: selectedDate.dateKey,
      sourceShift: availableShifts[0] || null,
      availableShifts
    }
  }

  const latestHeader = await prisma.spinning_production_header.findFirst({
    where: getPreviousSpinningHeaderWhere(target),
    select: {
      entry_date: true,
      shift: true
    },
    orderBy: [
      { entry_date: 'desc' },
      { shift: 'desc' }
    ]
  })

  if (!latestHeader) {
    return {
      sourceDate: '',
      sourceShift: null,
      availableShifts: []
    }
  }

  const availableShifts = await getAvailableSourceShifts(latestHeader.entry_date, target)
  return {
    sourceDate: toDateOnlyString(latestHeader.entry_date),
    sourceShift: availableShifts.includes(latestHeader.shift)
      ? latestHeader.shift
      : availableShifts[0] || null,
    availableShifts
  }
}

export async function applySpinningOptionCheck(payload) {
  const {
    targetDate,
    targetShift,
    sourceDate,
    sourceShift,
    options = {}
  } = payload || {}

  const copySpeed = options.copySpeed === true
  const copyTpi = options.copyTpi === true
  const copyTwCon = options.copyTwCon === true
  const copyCount = options.copyCount === true

  if (!copySpeed && !copyTpi && !copyTwCon && !copyCount) {
    throw createSpinningOptionCheckError('Select at least one option to copy')
  }

  const { source, target } = validateSpinningOptionCheckSource({
    targetDate,
    targetShift,
    sourceDate,
    sourceShift
  })

  return await prisma.$transaction(async (tx) => {
    const targetHeader = await tx.spinning_production_header.findFirst({
      where: {
        entry_date: target.date,
        shift: target.shift
      },
      select: {
        id: true,
        entry_date: true,
        shift: true
      }
    })

    if (!targetHeader) {
      throw createSpinningOptionCheckError(
        'Current spinning entry was not found. Refresh the page and try again.'
      )
    }

    const sourceHeader = await tx.spinning_production_header.findFirst({
      where: {
        entry_date: source.date,
        shift: source.shift
      },
      select: {
        id: true,
        entry_date: true,
        shift: true
      }
    })

    if (!sourceHeader) {
      throw createSpinningOptionCheckError(
        `No spinning entry exists for ${source.dateKey}, Shift ${source.shift}. Choose another source date and shift.`
      )
    }

    const targetDetails = await tx.spinning_production_detail.findMany({
      where: { header_id: targetHeader.id },
      select: { machine_id: true }
    })

    const targetMachineIds = [...new Set(targetDetails.map(d => d.machine_id))]
    if (targetMachineIds.length === 0) {
      return {
        sourceDate: toDateOnlyString(sourceHeader.entry_date),
        sourceShift: source.shift,
        totalEligibleMachines: 0,
        machinesUpdated: 0,
        machinesSkipped: 0
      }
    }

    const targetMachines = await tx.spinning_machines.findMany({
      where: {
        id: { in: targetMachineIds },
        AND: [
          {
            OR: [
              { activated_at: null },
              { installed_date: { lte: targetHeader.entry_date } }
            ]
          },
          {
            OR: [
              { deactivated_at: null },
              { deactivated_at: { gt: targetHeader.entry_date } }
            ]
          }
        ]
      },
      select: { id: true }
    })

    const eligibleMachineIds = new Set(targetMachines.map(m => m.id))

    const targetSetups = await tx.spinning_machine_setup.findMany({
      where: { 
        machine_id: { in: [...eligibleMachineIds] },
        entry_date: targetHeader.entry_date,
        shift: target.shift
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
            entry_date: sourceHeader.entry_date,
            shift: source.shift
          },
          select: {
            machine_id: true,
            speed: true,
            tpi: true,
            tw_con: true,
            count_id: true,
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
      if (copyCount && (sourceSetup.count_id || sourceSetup.count_name)) {
        data.count_id = sourceSetup.count_id
        data.count_name = sourceSetup.count_name
      }

      if (Object.keys(data).length === 0) {
        machinesSkipped++
        continue
      }

      const prepared = await prepareSpinningSetupUpdate(tx, targetSetup, data)
      const updatedSetup = await tx.spinning_machine_setup.update({
        where: { id: targetSetup.id },
        data: {
          ...prepared.data,
          updated_at: new Date()
        }
      })

      if (prepared.changesCount) {
        await syncSpinningSetupCountToDetail(tx, updatedSetup, updatedSetup.count_name)
      }

      machinesUpdated++
    }

    return {
      sourceDate: toDateOnlyString(sourceHeader.entry_date),
      sourceShift: source.shift,
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
      console.error('SPINNING department not found')
      return []
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
      where: { id: { in: headIds } },
      select: { id: true, stoppage_head_name: true }
    }) : []

    const headMap = {}
    heads.forEach(h => { headMap[h.id] = h.stoppage_head_name })

    // Enrich data with category name
    const enrichedData = data.map(item => ({
      ...item,
      category: headMap[item.stoppage_head_id] || 'OTHERS'
    }))
    
    return enrichedData || []
  } catch (error) {
    console.error('Error fetching spinning stoppage reasons:', error)
    return []
  }
}

// Search stoppage reasons for spinning (for autocomplete)
export async function searchSpinningStoppageReasons(searchTerm = '', limit = 20) {
  try {
    const dept = await prisma.departments.findFirst({
      where: { dept_name: 'SPINNING' }
    })

    if (!dept) return []

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
      where: { id: { in: headIds } },
      select: { id: true, stoppage_head_name: true }
    }) : []

    const headMap = {}
    heads.forEach(h => { headMap[h.id] = h.stoppage_head_name })

    return data.map(item => ({
      ...item,
      category: headMap[item.stoppage_head_id] || 'OTHERS'
    }))
  } catch (error) {
    console.error('Error searching spinning stoppage reasons:', error)
    return []
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
  await assertEntryHeaderUnlocked('spinning', targetHeaderId)
  return copyPreviousSpeeds({
    setupModel: prisma.spinning_machine_setup,
    targetDate,
    targetShift,
    sourceDate,
    updateSpeed: (setupId, speed) => updateSpinningMachineSetup(setupId, { speed }, targetShift)
  })
}

// ============================================
// MACHINE MANAGEMENT FUNCTIONS
// ============================================

// Add spinning machine
export async function lookupSpinningMachineByNo(machineNo) {
  const activeMachine = await prisma.spinning_machines.findFirst({
    where: { machine_no: { equals: machineNo }, is_active: true },
    include: { spinning_counts: true }
  })
  const machine = activeMachine || await prisma.spinning_machines.findFirst({
    where: { machine_no: { equals: machineNo } },
    orderBy: { updated_at: 'desc' },
    include: { spinning_counts: true }
  })
  if (!machine) return null

  const { spinning_counts: selectedCount, ...machineData } = machine
  return {
    ...machineData,
    machine_speed: machine.speed,
    ...buildSpinningCountSnapshot(selectedCount, { machineSpeed: machine.speed }),
    speed: machine.speed
  }
}

export async function addSpinningMachine(machineData) {
  try {
    // Extract fields for spinning_machines table
    const {
      machine_no,
      description,
      make_name,
      model,
      allocated_spindles: masterAllocatedSpindles,
      frame_no,
      mc_id,
      group_no,
      installed_date,
      production_kgs_manual_entry,
      direct_hank_entry,
      // Setup fields (not for machines table)
      count_id,
      count_name,
      act_count,
      session_no,
      run_time,
      tw_con,
      doff_loss,
      c_waste_percent,
      speed,
      tpi,
      efficiency,
      ...rest
    } = machineData

    const selectedCount = count_id || count_name
      ? await prisma.spinning_counts.findFirst({
          where: {
            is_active: true,
            ...(count_id ? { id: count_id } : { count_name })
          }
        })
      : null
    if ((count_id || count_name) && !selectedCount) {
      throw new Error('Selected spinning count is not active')
    }

    // Check if machine already exists
    const existingMachine = await prisma.spinning_machines.findFirst({
      where: { machine_no: machine_no },
      orderBy: { is_active: 'desc' }
    })

    let machine
    let reactivated = false

    if (existingMachine) {
      if (!existingMachine.is_active) {
        // Create a new active revision so historical entries keep the old row.
        machine = await prisma.spinning_machines.create({
          data: {
            machine_no,
            is_active: true,
            activated_at: new Date(),
            deactivated_at: null,
            description: description || machine_no,
            make_name: make_name || 'LAKSHMI',
            model: model || null,
            allocated_spindles: firstProvidedNumber([masterAllocatedSpindles], 1104),
            speed: toFiniteNumber(speed),
            count_id: selectedCount?.id ?? null,
            frame_no: frame_no || null,
            mc_id: mc_id || null,
            group_no: group_no || null,
            installed_date: installed_date || null,
            production_kgs_manual_entry: production_kgs_manual_entry || false,
            direct_hank_entry: direct_hank_entry || false,
            sort_order: existingMachine.sort_order
          }
        })
        reactivated = true
      } else {
        // Machine is active but may not have a setup yet — use existing machine
        machine = existingMachine
        reactivated = false
      }
    } else {
      // Create new machine
      // Get max sort_order to place new machine at the end
      const maxSortResult = await prisma.spinning_machines.findFirst({
        orderBy: { sort_order: 'desc' },
        select: { sort_order: true }
      })
      const nextSortOrder = (maxSortResult?.sort_order || 0) + 1

      machine = await prisma.spinning_machines.create({
        data: {
          machine_no,
          description: description || machine_no,
          make_name: make_name || 'LAKSHMI',
          model: model || null,
          allocated_spindles: firstProvidedNumber([masterAllocatedSpindles], 1104),
          speed: toFiniteNumber(speed),
          count_id: selectedCount?.id ?? null,
          frame_no: frame_no || null,
          mc_id: mc_id || null,
          group_no: group_no || null,
          installed_date: installed_date || null,
          production_kgs_manual_entry: production_kgs_manual_entry || false,
          direct_hank_entry: direct_hank_entry || false,
          is_active: true,
          activated_at: new Date(),
          sort_order: nextSortOrder
        }
      })
    }

    // Create only the requested entry snapshot. Machine Master stores the
    // selected count; Count Master supplies its defaults.
    let setup = null
    if (machine && machineData.entryDate) {
      const activeShift = parseInt(machineData.shift) || 1
      const countSnapshot = buildSpinningCountSnapshot(selectedCount, { machineSpeed: machine.speed })
      setup = await upsertSpinningMachineSetup(machine.id, machineData.entryDate, {
        shift: activeShift,
        ...countSnapshot,
        // Values entered after count selection are entry-level adjustments.
        ...(isProvided(act_count) && { act_count: toFiniteNumber(act_count) }),
        ...(isProvided(tpi) && { tpi: toFiniteNumber(tpi) }),
        ...(isProvided(tw_con) && { tw_con: toFiniteNumber(tw_con) }),
        ...(isProvided(doff_loss) && { doff_loss: toFiniteNumber(doff_loss) }),
        ...(isProvided(c_waste_percent) && { c_waste_percent: toFiniteNumber(c_waste_percent) }),
        ...(isProvided(speed) && { speed: toFiniteNumber(speed) }),
        allocated_spindles: firstProvidedNumber([masterAllocatedSpindles], 1104),
        session_no: toFiniteNumber(session_no, 1),
        run_time: run_time ?? resolveSpinningShiftFallbackTime(activeShift),
        efficiency: toFiniteNumber(efficiency, 0.95)
      })
    }

    return { machine, setup, reactivated }
  } catch (error) {
    throw error
  }
}

// Remove spinning machine (deactivate)
export async function addSpinningEntryMachine(machineData) {
  const masterMachine = await prisma.spinning_machines.findFirst({
    where: machineData.machine_id
      ? { id: machineData.machine_id }
      : { machine_no: String(machineData.machine_no || '').trim() },
    orderBy: { is_active: 'desc' },
    select: { count_id: true, speed: true }
  })
  const requestedCountId = machineData.count_id || masterMachine?.count_id
  const selectedCount = requestedCountId || machineData.count_name
    ? await prisma.spinning_counts.findFirst({
        where: {
          is_active: true,
          ...(requestedCountId ? { id: requestedCountId } : { count_name: machineData.count_name })
        }
      })
    : null
  if ((requestedCountId || machineData.count_name) && !selectedCount) {
    throw new Error('Selected spinning count is not active')
  }
  const result = await addMachineToEntrySnapshot('spinning', machineData.headerId, {
    machineId: machineData.machine_id,
    machineNo: machineData.machine_no,
    setupOverrides: {
      ...machineData,
      // An unselected dropdown supplies an empty string in the browser. The
      // setup foreign key must receive NULL, never an invalid empty UUID.
      count_id: selectedCount?.id ?? null,
      count_name: selectedCount?.count_name ?? null,
      ...(selectedCount && buildSpinningCountSnapshot(selectedCount, { machineSpeed: masterMachine?.speed ?? machineData.speed }))
    }
  })
  await syncNewMachinesToSpinningHeader(machineData.headerId, result.header.shift)
  return { ...result, reactivated: false, entryOnly: true }
}

export async function removeSpinningMachine(id, headerId) {
  return removeMachineFromEntrySnapshot('spinning', headerId, id)
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

