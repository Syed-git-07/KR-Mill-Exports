import { prisma } from '../prisma'
import { resolveSpinningShiftFallbackTime } from '../spinningShiftFallback'

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
  if (!totalMins || totalMins === 0) return 0
  return (stoppageMins / totalMins) * totalSpindles
}

/**
 * Calculate Worked Spindles
 * Formula: Worked_Spl = Total_Spl - Stopped_Spl
 */
export function calculateWorkedSpindles(totalSpindles, stoppedSpindles) {
  return totalSpindles - stoppedSpindles
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
 * Formula: Exp_GPS = 7.2 × Speed / TPI / Count × Effi
 * @param {number} speed - Machine speed (RPM)
 * @param {number} tpi - Twists per inch
 * @param {number} count - Act Count value (e.g., 69.5 from machine setup)
 * @param {number} efficiency - Efficiency (0.95 = 95%)
 */
export function calculateExpGps(speed, tpi, count, efficiency = 0.95) {
  if (!speed || !tpi || !count) return 0
  return (7.2 * speed / tpi / count) * efficiency
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
    efficiency = 0.95,
    speed = 0,
    tpi = 0,
    count = 0
  } = params

  // Calculate No of Spindles based on shift
  const totalSpindles = calculateNoOfSpindles(allocatedSpindles, shift)

  const constant = calculateConstant(actCount, totalSpindles)
  const actProdn = calculateActProdn(actHank, constant)
  const wastePercent = calculateWastePercent(waste, actProdn)
  const stoppedSpindles = calculateStoppedSpindles(stoppageMins, runTime, totalSpindles)
  const workedSpindles = calculateWorkedSpindles(totalSpindles, stoppedSpindles)
  const gps = calculateGps(actProdn, workedSpindles)
  const expGps = calculateExpGps(speed, tpi, count, efficiency)

  return {
    totalSpindles: totalSpindles,
    constant: Math.round(constant * 1000) / 1000,
    actProdn: Math.round(actProdn * 100) / 100,
    wastePercent: Math.round(wastePercent * 100) / 100,
    stoppedSpindles: Math.round(stoppedSpindles * 100) / 100,
    workedSpindles: workedSpindles,
    gps: Math.round(gps * 100) / 100,
    expGps: Math.round(expGps * 100) / 100
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
      .filter(detail => {
        if (!detail.machine) return false
        const m = detail.machine
        if (m.activated_at && new Date(m.activated_at) > entryDate) return false
        if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false
        return true
      }) || []
    
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

// Helper to fetch inherited machine setups from the chronologically prior shift/date
export async function getInheritedMachineSetups(dateObj, shiftNum, headerId) {
  try {
    const d = new Date(dateObj)
    const s = parseInt(shiftNum)

    // Find the most recent chronologically entered header prior to (d, s)
    const priorHeader = await prisma.spinning_production_header.findFirst({
      where: {
        id: { not: headerId },
        OR: [
          { entry_date: { lt: d } },
          {
            entry_date: d,
            shift: { lt: s }
          }
        ]
      },
      orderBy: [
        { entry_date: 'desc' },
        { shift: 'desc' }
      ]
    })

    if (!priorHeader) {
      return {}
    }

    // Fetch production details for this prior header
    const details = await prisma.spinning_production_detail.findMany({
      where: { header_id: priorHeader.id },
      select: {
        machine_id: true,
        count_name: true,
        session_no: true
      }
    })

    // Convert to map: machine_id -> { count_name, session_no }
    const inheritedMap = {}
    details.forEach(detail => {
      inheritedMap[detail.machine_id] = {
        count_name: detail.count_name,
        session_no: detail.session_no
      }
    })

    return inheritedMap
  } catch (error) {
    console.error('Error in getInheritedMachineSetups:', error)
    return {}
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
        activated_at: { lte: entryDate },
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

    // Fetch inherited machine setups from the chronologically prior shift/date
    const inheritedSetups = await getInheritedMachineSetups(entryDate, shift, headerId)

    // Get shift configuration
    const shiftConfig = await getSpinningShiftConfiguration(shift)

    // Create detail records for new machines
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const inherited = inheritedSetups[machine.id] || {}
      const allocatedSpindles = parseFloat(setup.allocated_spindles) || machine.allocated_spindles || 1104
      // Calculate No of Spindles based on shift: (Allocated / 8) × 8.5 for Shift 1&2, × 7 for Shift 3
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, shift)

      const countName = inherited.count_name !== undefined ? inherited.count_name : (setup.count_name || null)
      const sessionNo = inherited.session_no !== undefined ? inherited.session_no : (setup.session_no || 1)

      return {
        header_id: headerId,
        machine_id: machine.id,
        count_name: countName,
        act_hank: null,
        act_prodn: null,
        waste: null,
        waste_percent: null,
        gps: null,
        worked_spindles: noOfSpindles,
        stopped_spindles: 0,
        exp_gps: null,
        total_stoppage_mins: 0,
        session_no: sessionNo,
        run_time: shiftConfig.totalTime,
        work_time: shiftConfig.totalTime
      }
    })

    await prisma.spinning_production_detail.createMany({
      data: details
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
      data: stoppageEntries
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
        activated_at: { lte: entryDate },
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

    // Remove detail rows for machines that are deactivated or have no setup
    const allExistingMachines = existingMachineIds.length > 0
      ? await prisma.spinning_machines.findMany({
          where: { id: { in: existingMachineIds } }
        })
      : []
    const existingMachineMap = {}
    allExistingMachines.forEach(m => { existingMachineMap[m.id] = m })

    const deactivatedDetailIds = existingDetails
      .filter(d => {
        const m = existingMachineMap[d.machine_id]
        if (!m) return false
        // Remove if deactivated on or before the entry date
        if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return true
        // Remove if machine has no setup (created via master only, not via Machine Setup tab)
        if (!machineIdsWithSetup.includes(m.id)) return true
        return false
      })
      .map(d => d.id)

    if (deactivatedDetailIds.length > 0) {
      await prisma.spinning_stoppage_entry.deleteMany({
        where: { production_detail_id: { in: deactivatedDetailIds } }
      })
      await prisma.spinning_production_detail.deleteMany({
        where: { id: { in: deactivatedDetailIds } }
      })
    }

    // Refresh existing machine IDs after cleanup
    const remainingMachineIds = existingDetails
      .filter(d => !deactivatedDetailIds.includes(d.id))
      .map(d => d.machine_id)

    // Find machines that don't have entries
    const newMachines = machines?.filter(m => !remainingMachineIds.includes(m.id)) || []

    if (newMachines.length === 0) {
      return { added: 0, machines: [] }
    }

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Fetch inherited machine setups from the chronologically prior shift/date
    const inheritedSetups = await getInheritedMachineSetups(entryDate, shift, headerId)

    // Get shift configuration
    const shiftConfig = await getSpinningShiftConfiguration(shift)

    // Create detail records
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const inherited = inheritedSetups[machine.id] || {}
      const allocatedSpindles = parseFloat(setup.allocated_spindles) || machine.allocated_spindles || 1104
      // Calculate No of Spindles based on shift: (Allocated / 8) × 8.5 for Shift 1&2, × 7 for Shift 3
      const noOfSpindles = calculateNoOfSpindles(allocatedSpindles, shift)

      const countName = inherited.count_name !== undefined ? inherited.count_name : (setup.count_name || null)
      const sessionNo = inherited.session_no !== undefined ? inherited.session_no : (setup.session_no || 1)

      return {
        header_id: headerId,
        machine_id: machine.id,
        count_name: countName,
        act_hank: null,
        act_prodn: null,
        waste: null,
        waste_percent: null,
        gps: null,
        worked_spindles: noOfSpindles,
        stopped_spindles: 0,
        exp_gps: null,
        total_stoppage_mins: 0,
        session_no: sessionNo,
        run_time: shiftConfig.totalTime,
        work_time: shiftConfig.totalTime
      }
    })

    await prisma.spinning_production_detail.createMany({
      data: details
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
      data: stoppageEntries
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
  try {
    const data = await prisma.spinning_production_detail.update({
      where: { id },
      data: {
        ...updates,
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
  try {
    const results = []
    for (const update of updates) {
      const { id, ...data } = update
      const result = await prisma.spinning_production_detail.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      })
      results.push(result)
    }
    return results
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
    setups?.forEach(s => { setupMap[s.machine_id] = s })

    const stoppageReasonMap = {}
    stoppageReasons?.forEach(r => { stoppageReasonMap[r.id] = r })

    // Create stoppage map
    const stoppageMap = {}
    stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s })

    // Combine data — apply date-based visibility: only show machines active on the entry_date
    const result = details
      .filter(detail => {
        const m = machineMap[detail.machine_id]
        if (!m) return false
        if (m.activated_at && new Date(m.activated_at) > entryDate) return false
        if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false
        return true
      })
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
          total_spindles: setup.allocated_spindles || machine.allocated_spindles || 1104,
          act_count: parseFloat(setup.act_count) || 0,
          efficiency: parseFloat(setup.efficiency) || 0.95,
          speed: parseInt(setup.speed) || 0,
          tpi: parseFloat(setup.tpi) || 0,
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
      const allocatedSpindles = parseFloat(setup?.allocated_spindles) || machine?.allocated_spindles || 1104
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
export async function applyFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
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

      // Update the specified slot
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
      const setup = setupMap[detail.machine_id]
      const machine = machineMap[detail.machine_id]
      const allocatedSpindles = parseFloat(setup?.allocated_spindles) || machine?.allocated_spindles || 1104
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
      const allocatedSpindles = parseFloat(setup?.allocated_spindles) || detail.machine?.allocated_spindles || 1104
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

// Helper to get or create machine setups for a given date (with inheritance)
export async function getOrCreateSpinningMachineSetups(entryDate, shift = 1) {
  try {
    const dateObj = new Date(entryDate)
    const shiftNum = parseInt(shift)
    const targetShiftTime = shiftNum === 3 ? 420 : 510
    
    // 1. Try to find setups for this exact date and shift
    let setups = await prisma.spinning_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
    
    if (setups.length > 0) {
      return setups
    }
    
    // 2. Fallback: Inherit from the most recent chronologically prior setups in the database (implicitly, no confirmation)
    const latestPreviousSetup = await prisma.spinning_machine_setup.findFirst({
      where: {
        OR: [
          { entry_date: { lt: dateObj } },
          {
            entry_date: dateObj,
            shift: { lt: shiftNum }
          }
        ]
      },
      orderBy: [
        { entry_date: 'desc' },
        { shift: 'desc' }
      ]
    })
    
    if (latestPreviousSetup) {
      const prevSetups = await prisma.spinning_machine_setup.findMany({
        where: { 
          entry_date: latestPreviousSetup.entry_date,
          shift: latestPreviousSetup.shift
        }
      })
      
      const cloneData = prevSetups.map(s => {
        const { id, created_at, updated_at, ...rest } = s
        return {
          ...rest,
          entry_date: dateObj,
          shift: shiftNum,
          run_time: targetShiftTime
        }
      })
      
      await prisma.spinning_machine_setup.createMany({
        data: cloneData
      })
      
      return await prisma.spinning_machine_setup.findMany({
        where: { 
          entry_date: dateObj,
          shift: shiftNum
        }
      })
    }
    
    // 3. Fallback: Initialize default setups for all active machines
    const activeMachines = await prisma.spinning_machines.findMany({
      where: { is_active: true }
    })
    
    const defaultSetups = activeMachines.map(m => ({
      machine_id: m.id,
      entry_date: dateObj,
      shift: shiftNum,
      count_name: '',
      act_count: 69.50,
      tpi: 13.00,
      allocated_spindles: m.allocated_spindles || 1104,
      tw_con: 4,
      doff_loss: 0.70,
      c_waste_percent: 0.90,
      speed: 0,
      session_no: 1,
      run_time: targetShiftTime,
      efficiency: 0.985,
      conversion_factor: 2.20456
    }))
    
    if (defaultSetups.length > 0) {
      await prisma.spinning_machine_setup.createMany({
        data: defaultSetups
      })
    }
    
    return await prisma.spinning_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
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
    
    // Get active machines
    const machines = await prisma.spinning_machines.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    // Combine setup with machine info
    const enrichedSetups = setups
      .filter(s => machineMap[s.machine_id]) // Only setups for active machines
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

// Update machine setup
export async function updateSpinningMachineSetup(id, updates, shift = null) {
  try {
    const data = await prisma.spinning_machine_setup.update({
      where: { id },
      data: {
        ...updates,
        updated_at: new Date()
      }
    })

    // If count_name was updated, sync it to all production details for this machine on this specific date & shift
    if (updates.count_name && data.machine_id && data.entry_date) {
      const headers = await prisma.spinning_production_header.findMany({
        where: { 
          entry_date: data.entry_date,
          ...(shift !== null && { shift: parseInt(shift) })
        },
        select: { id: true }
      })
      const headerIds = headers.map(h => h.id)
      if (headerIds.length > 0) {
        await prisma.spinning_production_detail.updateMany({
          where: { 
            machine_id: data.machine_id,
            header_id: { in: headerIds }
          },
          data: { count_name: updates.count_name }
        })
      }
    }

    return data
  } catch (error) {
    throw error
  }
}

// Upsert machine setup
export async function upsertSpinningMachineSetup(machineId, entryDate, setupData) {
  try {
    const dateObj = new Date(entryDate)
    // Check if setup exists
    const existing = await prisma.spinning_machine_setup.findFirst({
      where: { 
        machine_id: machineId,
        entry_date: dateObj
      }
    })

    let result
    if (existing) {
      result = await prisma.spinning_machine_setup.update({
        where: { id: existing.id },
        data: {
          ...setupData,
          updated_at: new Date()
        }
      })
    } else {
      result = await prisma.spinning_machine_setup.create({
        data: {
          machine_id: machineId,
          entry_date: dateObj,
          ...setupData
        }
      })
    }

    // Sync count_name if updated
    if (setupData.count_name && machineId) {
      const headers = await prisma.spinning_production_header.findMany({
        where: { entry_date: dateObj },
        select: { id: true }
      })
      const headerIds = headers.map(h => h.id)
      if (headerIds.length > 0) {
        await prisma.spinning_production_detail.updateMany({
          where: { 
            machine_id: machineId,
            header_id: { in: headerIds }
          },
          data: { count_name: setupData.count_name }
        })
      }
    }

    return result
  } catch (error) {
    throw error
  }
}

// Batch update machine setups
export async function batchUpdateSpinningMachineSetups(updates, shift = null) {
  try {
    const results = []
    for (const update of updates) {
      const { id, ...data } = update
      const result = await prisma.spinning_machine_setup.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      })
      results.push(result)
      
      // If count_name was updated, sync it to all production details for this machine on this specific date & shift
      if (data.count_name && result.machine_id && result.entry_date) {
        const headers = await prisma.spinning_production_header.findMany({
          where: { 
            entry_date: result.entry_date,
            ...(shift !== null && { shift: parseInt(shift) })
          },
          select: { id: true }
        })
        const headerIds = headers.map(h => h.id)
        if (headerIds.length > 0) {
          await prisma.spinning_production_detail.updateMany({
            where: { 
              machine_id: result.machine_id,
              header_id: { in: headerIds }
            },
            data: { count_name: data.count_name }
          })
        }
      }
    }
    return results
  } catch (error) {
    throw error
  }
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
        activated_at: { lte: targetHeader.entry_date },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: targetHeader.entry_date } }]
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
    
    console.log(`Found ${enrichedData?.length || 0} stoppage reasons for SPINNING department`)
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
    return data || []
  } catch (error) {
    throw error
  }
}

// Get available previous dates for copy
export async function getSpinningAvailablePreviousDates(beforeDate, shift, limit = 30) {
  try {
    const data = await prisma.spinning_production_header.findMany({
      where: {
        entry_date: { lt: new Date(beforeDate) },
        shift: parseInt(shift)
      },
      orderBy: { entry_date: 'desc' },
      take: limit,
      select: {
        id: true,
        entry_date: true,
        shift: true
      }
    })
    return data || []
  } catch (error) {
    return []
  }
}

// Copy from previous date
export async function copySpinningFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    // Get source header
    const sourceHeader = await prisma.spinning_production_header.findFirst({
      where: {
        entry_date: new Date(sourceDate),
        shift: parseInt(targetShift)
      }
    })

    if (!sourceHeader) {
      throw new Error('Source data not found')
    }

    // Get source production details
    const sourceDetails = await prisma.spinning_production_detail.findMany({
      where: { header_id: sourceHeader.id }
    })

    // Get source stoppage entries
    const sourceDetailIds = sourceDetails.map(d => d.id)
    const sourceStoppages = await prisma.spinning_stoppage_entry.findMany({
      where: { production_detail_id: { in: sourceDetailIds } }
    })

    const stoppageMap = {}
    sourceStoppages.forEach(s => { stoppageMap[s.production_detail_id] = s })

    // Get target details
    const targetDetails = await prisma.spinning_production_detail.findMany({
      where: { header_id: targetHeaderId }
    })

    // Map by machine_id
    const targetDetailMap = {}
    targetDetails.forEach(d => { targetDetailMap[d.machine_id] = d })

    let machinesUpdated = 0

    // Copy data
    for (const sourceDetail of sourceDetails) {
      const targetDetail = targetDetailMap[sourceDetail.machine_id]
      if (!targetDetail) continue

      // Update production detail
      await prisma.spinning_production_detail.update({
        where: { id: targetDetail.id },
        data: {
          count_name: sourceDetail.count_name,
          act_hank: sourceDetail.act_hank,
          act_prodn: sourceDetail.act_prodn,
          waste: sourceDetail.waste,
          waste_percent: sourceDetail.waste_percent,
          gps: sourceDetail.gps,
          stopped_spindles: sourceDetail.stopped_spindles,
          worked_spindles: sourceDetail.worked_spindles,
          exp_gps: sourceDetail.exp_gps,
          session_no: sourceDetail.session_no,
          sider1_name: sourceDetail.sider1_name,
          sider2_name: sourceDetail.sider2_name
        }
      })

      // Copy stoppage entry
      const sourceStoppage = stoppageMap[sourceDetail.id]
      if (sourceStoppage) {
        const targetStoppage = await prisma.spinning_stoppage_entry.findFirst({
          where: { production_detail_id: targetDetail.id }
        })

        if (targetStoppage) {
          await prisma.spinning_stoppage_entry.update({
            where: { id: targetStoppage.id },
            data: {
              stoppage1_id: sourceStoppage.stoppage1_id,
              stoppage1_time: sourceStoppage.stoppage1_time,
              stoppage2_id: sourceStoppage.stoppage2_id,
              stoppage2_time: sourceStoppage.stoppage2_time,
              stoppage3_id: sourceStoppage.stoppage3_id,
              stoppage3_time: sourceStoppage.stoppage3_time,
              stoppage4_id: sourceStoppage.stoppage4_id,
              stoppage4_time: sourceStoppage.stoppage4_time,
              total_stoppage_time: sourceStoppage.total_stoppage_time
            }
          })
        }
      }

      machinesUpdated++
    }

    return {
      success: true,
      copiedFrom: sourceDate,
      machinesUpdated
    }
  } catch (error) {
    throw error
  }
}

// ============================================
// MACHINE MANAGEMENT FUNCTIONS
// ============================================

// Add spinning machine
export async function lookupSpinningMachineByNo(machineNo) {
  // Prefer active machine; fall back to any machine with this number
  const activeMachine = await prisma.spinning_machines.findFirst({
    where: { machine_no: { equals: machineNo }, is_active: true }
  })
  const machine = activeMachine || await prisma.spinning_machines.findFirst({
    where: { machine_no: { equals: machineNo } },
    orderBy: { is_active: 'desc' }
  })
  if (!machine) return null

  // Try setup for active machine first
  let setup = activeMachine
    ? await prisma.spinning_machine_setup.findFirst({ where: { machine_id: activeMachine.id } })
    : null

  // If active machine has no setup (e.g. newly added from master), fall back to any machine's setup
  if (!setup) {
    const allIds = (await prisma.spinning_machines.findMany({
      where: { machine_no: { equals: machineNo } },
      select: { id: true }
    })).map(m => m.id)
    setup = await prisma.spinning_machine_setup.findFirst({
      where: { machine_id: { in: allIds } }
    })
  }

  return {
    ...machine,
    count_name: setup?.count_name ?? null,
    act_count: setup?.act_count != null ? parseFloat(setup.act_count) : null,
    tpi: setup?.tpi != null ? parseFloat(setup.tpi) : null,
    speed: setup?.speed ?? null,
    tw_con: setup?.tw_con ?? null,
    doff_loss: setup?.doff_loss != null ? parseFloat(setup.doff_loss) : null,
    c_waste_percent: setup?.c_waste_percent != null ? parseFloat(setup.c_waste_percent) : null,
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

    // Check if machine already exists
    const existingMachine = await prisma.spinning_machines.findFirst({
      where: { machine_no: machine_no }
    })

    let machine
    let reactivated = false

    if (existingMachine) {
      if (!existingMachine.is_active) {
        // Reactivate existing machine
        machine = await prisma.spinning_machines.update({
          where: { id: existingMachine.id },
          data: {
            is_active: true,
            activated_at: new Date(),
            deactivated_at: null,
            description: description || machine_no,
            make_name: make_name || 'LAKSHMI',
            model: model || null,
            allocated_spindles: masterAllocatedSpindles || 1104,
            frame_no: frame_no || null,
            mc_id: mc_id || null,
            group_no: group_no || null,
            installed_date: installed_date || null,
            production_kgs_manual_entry: production_kgs_manual_entry || false,
            direct_hank_entry: direct_hank_entry || false
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
          allocated_spindles: masterAllocatedSpindles || 1104,
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

    // Create or update machine setup
    let setup = null
    if (machine) {
      // Check if default setup already exists
      const existingSetup = await prisma.spinning_machine_setup.findFirst({
        where: { machine_id: machine.id, entry_date: new Date('2026-04-01') }
      })
      
      if (existingSetup) {
        setup = existingSetup
      } else {
        // Create setup for the machine (default historic date uses shift 1)
        setup = await prisma.spinning_machine_setup.create({
          data: {
            machine_id: machine.id,
            entry_date: new Date('2026-04-01'),
            shift: 1,
            count_name: count_name || '30s CARDED',
            act_count: act_count || 69.5,
            session_no: session_no || 1,
            run_time: run_time ?? resolveSpinningShiftFallbackTime(1),
            allocated_spindles: masterAllocatedSpindles || 1104,
            tw_con: tw_con || 0,
            doff_loss: doff_loss || 0,
            c_waste_percent: c_waste_percent || 0,
            speed: speed || 0,
            tpi: tpi || 0,
            efficiency: efficiency || 0.95
          }
        })
      }

      // Also create setup for the active entryDate if it's provided, different, and not already existing
      if (machineData.entryDate) {
        const activeDateObj = new Date(machineData.entryDate)
        const activeShift = parseInt(machineData.shift) || 1
        if (activeDateObj.toISOString().split('T')[0] !== '2026-04-01') {
          const existingActiveSetup = await prisma.spinning_machine_setup.findFirst({
            where: { 
              machine_id: machine.id, 
              entry_date: activeDateObj,
              shift: activeShift
            }
          })
          if (!existingActiveSetup) {
            await prisma.spinning_machine_setup.create({
              data: {
                machine_id: machine.id,
                entry_date: activeDateObj,
                shift: activeShift,
                count_name: count_name || '30s CARDED',
                act_count: act_count || 69.5,
                session_no: session_no || 1,
                run_time: run_time ?? resolveSpinningShiftFallbackTime(activeShift),
                allocated_spindles: masterAllocatedSpindles || 1104,
                tw_con: tw_con || 0,
                doff_loss: doff_loss || 0,
                c_waste_percent: c_waste_percent || 0,
                speed: speed || 0,
                tpi: tpi || 0,
                efficiency: efficiency || 0.95
              }
            })
          }
        }
      }
    }

    return { machine, setup, reactivated }
  } catch (error) {
    throw error
  }
}

// Remove spinning machine (deactivate)
export async function removeSpinningMachine(id) {
  try {
    const machine = await prisma.spinning_machines.update({
      where: { id },
      data: { is_active: false, deactivated_at: new Date() }
    })
    return machine
  } catch (error) {
    throw error
  }
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

