/**
 * Autoconer Production Entry Queries
 * Module 23: Post Preparatory - Autoconer Production
 * 
 * Database Tables:
 * - autoconer_production_header
 * - autoconer_production_detail
 * - autoconer_stoppage_entry
 * - autoconer_machine_setup
 */

import { prisma } from '../prisma'
import { resolveAutoconerShiftFallbackTime } from '../autoconerShiftFallback'

// ============================================
// SHIFT CONFIGURATION QUERIES
// ============================================

// Get shift configuration for autoconer and shift
export async function getAutoconerShiftConfig(shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'AUTOCONER',
        shift: parseInt(shift),
        is_active: true
      }
    })
    return data
  } catch (error) {
    console.error('Error fetching autoconer shift config:', error)
    return null
  }
}

// Get all shift configurations for autoconer
export async function getAllAutoconerShiftConfigs() {
  try {
    const data = await prisma.shift_config.findMany({
      where: {
        department_code: 'AUTOCONER',
        is_active: true
      },
      orderBy: {
        shift: 'asc'
      }
    })
    return data
  } catch (error) {
    console.error('Error fetching all autoconer shift configs:', error)
    return []
  }
}

// Get shift time for autoconer based on shift number.
// Primary source: shift_config. Fallback is centralized helper only.
export async function getAutoconerShiftTime(shift) {
  const config = await getAutoconerShiftConfig(shift)
  return config?.shift_time || resolveAutoconerShiftFallbackTime(shift)
}

// No default stoppage for autoconer - always 0
export async function getAutoconerDefaultStoppage(shift) {
  return 0
}

// Get full shift configuration for autoconer
export async function getAutoconerShiftConfiguration(shift) {
  const config = await getAutoconerShiftConfig(shift)
  const shiftTime = config?.shift_time || resolveAutoconerShiftFallbackTime(shift)
  
  return {
    totalTime: shiftTime,
    defaultStoppage: 0,
    workTime: shiftTime,
    config: config
  }
}

// ============================================
// HEADER OPERATIONS
// ============================================

// Get production header by date and shift
export async function getAutoconerProductionByDateShift(date, shift) {
  try {
    const data = await prisma.autoconer_production_header.findFirst({
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
export async function createAutoconerProductionHeader(headerData) {
  try {
    const data = await prisma.autoconer_production_header.create({
      data: headerData
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update production header
export async function updateAutoconerProductionHeader(id, updates) {
  try {
    const data = await prisma.autoconer_production_header.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Get or create header for a date/shift
export async function getOrCreateAutoconerHeader(date, shift, supervisorId = null) {
  let header = await getAutoconerProductionByDateShift(date, shift)
  
  if (!header) {
    // Get shift configuration for total_time from database
    const shiftConfig = await getAutoconerShiftConfiguration(shift)
    
    header = await createAutoconerProductionHeader({
      entry_date: new Date(date),
      shift,
      supervisor_id: supervisorId,
      total_time: shiftConfig.totalTime
    })
    
    // Initialize production details for all active machines with shift-specific times
    await initializeAutoconerProductionDetails(header.id, shift)
  }
  
  return header
}

// ============================================
// PRODUCTION DETAIL OPERATIONS
// ============================================

// Helper to fetch inherited machine setups from the chronologically prior shift/date's production details
export async function getInheritedMachineSetups(dateObj, shiftNum, headerId) {
  try {
    const d = new Date(dateObj)
    const s = parseInt(shiftNum)

    // Find the most recent chronologically entered header prior to (d, s)
    const priorHeader = await prisma.autoconer_production_header.findFirst({
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
    const details = await prisma.autoconer_production_detail.findMany({
      where: { header_id: priorHeader.id },
      select: {
        machine_id: true,
        count_name: true,
        count_id: true,
        session_no: true
      }
    })

    // Convert to map: machine_id -> { count_name, count_id, session_no }
    const inheritedMap = {}
    details.forEach(detail => {
      inheritedMap[detail.machine_id] = {
        count_name: detail.count_name,
        count_id: detail.count_id,
        session_no: detail.session_no
      }
    })

    return inheritedMap
  } catch (error) {
    console.error('Error in getInheritedMachineSetups (Autoconer):', error)
    return {}
  }
}

// Initialize production details for all active machines
// Now accepts shift parameter to determine correct runtime (like Carding)
async function initializeAutoconerProductionDetails(headerId, shift = 1) {
  try {
    console.log(`[INIT] Starting initialization for headerId: ${headerId}, shift: ${shift}`)
    
    // Fetch entry_date from header for date-range visibility
    const header = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    // Get setups for this date and shift (with inheritance)
    const setups = await getOrCreateAutoconerMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get machines visible on entry_date
    // Only include machines with a setup entry — master-only machines (no setup) are excluded
    const machines = await prisma.autoconer_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        activated_at: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: [
        { group_id: 'asc' },
        { machine_no: 'asc' }
      ]
    })

    console.log(`[INIT] Found ${machines?.length || 0} machines visible on ${entryDate}`)
    
    if (!machines || machines.length === 0) return

    // Get existing production details for this header
    const existingDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId },
      select: { machine_id: true }
    })
    const existingMachineIds = new Set(existingDetails.map(d => d.machine_id))
    
    console.log(`[INIT] Found ${existingDetails?.length || 0} existing details for this header`)

    // Filter out machines that already have entries
    const newMachines = machines.filter(m => !existingMachineIds.has(m.id))
    
    console.log(`[INIT] ${newMachines.length} new machines need entries`)
    
    if (newMachines.length === 0) return existingDetails

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Fetch inherited machine setups from the chronologically prior shift/date's production details
    const inheritedSetups = await getInheritedMachineSetups(entryDate, shift, headerId)

    // Get shift-specific runtime from configuration (like Carding)
    // Shift 1: 510 mins, Shift 2: 510 mins, Shift 3: 420 mins
    const totalTime = await getAutoconerShiftTime(shift)
    const defaultStoppage = await getAutoconerDefaultStoppage(shift)
    const defaultWorkTime = totalTime - defaultStoppage

    // Create production detail for each NEW machine with shift-specific times
    const detailInserts = newMachines.map(m => {
      const setup = setupMap[m.id] || {}
      const inherited = inheritedSetups[m.id] || {}
      
      const countName = inherited.count_name !== undefined ? inherited.count_name : (setup.count_name || null)
      const countId = inherited.count_id !== undefined ? inherited.count_id : (setup.count_id || null)
      const sessionNo = inherited.session_no !== undefined ? inherited.session_no : (setup.session_no || 1)

      return {
        header_id: headerId,
        machine_id: m.id,
        count_name: countName,
        count_id: countId,
        session_no: sessionNo,
        waste_kg: null,
        waste_percent: null,
        run_time: totalTime,               // Shift-specific runtime
        work_time: defaultWorkTime,        // Runtime - stoppage
        total_stoppage_mins: defaultStoppage  // Shift-specific default stoppage
      }
    })

    await prisma.autoconer_production_detail.createMany({
      data: detailInserts
    })

    // Get the created details to create stoppage entries
    const createdDetails = await prisma.autoconer_production_detail.findMany({
      where: { 
        header_id: headerId,
        machine_id: { in: newMachines.map(m => m.id) }
      }
    })

    // Create stoppage entry for each production detail with shift-specific times
    const stoppageInserts = createdDetails.map(d => ({
      production_detail_id: d.id,
      run_time: totalTime,                  // Shift-specific runtime
      total_stoppage_time: defaultStoppage  // Shift-specific default stoppage
    }))

    await prisma.autoconer_stoppage_entry.createMany({
      data: stoppageInserts
    })

    return createdDetails
  } catch (error) {
    throw error
  }
}

// Sync new machines to existing header — adds newly visible machines AND removes
// stale rows for machines deactivated before the entry_date.
export async function syncNewMachinesToAutoconerHeader(headerId, shift = 1) {
  try {
    // 1. Fetch entry_date
    const headerRow = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = headerRow?.entry_date || new Date()

    // Get machine setups for this date and shift (with inheritance)
    const setups = await getOrCreateAutoconerMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // 2. Get currently visible machines for entry_date
    // Only include machines with a setup entry — master-only machines (no setup) are excluded
    const machines = await prisma.autoconer_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        activated_at: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: [{ group_id: 'asc' }, { machine_no: 'asc' }]
    })

    // 3. Fetch existing detail rows
    const existingDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })
    const existingMachineIds = existingDetails.map(d => d.machine_id)

    // 4. Find stale rows — machines deactivated on or before entry_date OR with no setup
    const allExistingMachines = existingMachineIds.length > 0
      ? await prisma.autoconer_machines.findMany({
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
      await prisma.autoconer_stoppage_entry.deleteMany({
        where: { production_detail_id: { in: deactivatedDetailIds } }
      })
      await prisma.autoconer_production_detail.deleteMany({
        where: { id: { in: deactivatedDetailIds } }
      })
    }

    // 5. Remaining machines after cleanup
    const remainingMachineIds = existingDetails
      .filter(d => !deactivatedDetailIds.includes(d.id))
      .map(d => d.machine_id)

    // 6. Add only truly new machines
    const newMachines = machines.filter(m => !remainingMachineIds.includes(m.id))
    if (newMachines.length === 0) return []

    // 7. Map setups
    const setupMap = {}
    setups.forEach(s => { setupMap[s.machine_id] = s })

    // Fetch inherited machine setups from the chronologically prior shift/date's production details
    const inheritedSetups = await getInheritedMachineSetups(entryDate, shift, headerId)

    const totalTime = await getAutoconerShiftTime(shift)
    const defaultStoppage = await getAutoconerDefaultStoppage(shift)
    const defaultWorkTime = totalTime - defaultStoppage

    const detailInserts = newMachines.map(m => {
      const setup = setupMap[m.id] || {}
      const inherited = inheritedSetups[m.id] || {}

      const countName = inherited.count_name !== undefined ? inherited.count_name : (setup.count_name || null)
      const countId = inherited.count_id !== undefined ? inherited.count_id : (setup.count_id || null)
      const sessionNo = inherited.session_no !== undefined ? inherited.session_no : (setup.session_no || 1)

      return {
        header_id: headerId,
        machine_id: m.id,
        count_name: countName,
        count_id: countId,
        session_no: sessionNo,
        waste_kg: null,
        waste_percent: null,
        run_time: totalTime,
        work_time: defaultWorkTime,
        total_stoppage_mins: defaultStoppage
      }
    })

    await prisma.autoconer_production_detail.createMany({ data: detailInserts })

    const createdDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId, machine_id: { in: newMachines.map(m => m.id) } }
    })

    const stoppageInserts = createdDetails.map(d => ({
      production_detail_id: d.id,
      run_time: totalTime,
      total_stoppage_time: defaultStoppage
    }))

    await prisma.autoconer_stoppage_entry.createMany({ data: stoppageInserts })

    return createdDetails
  } catch (error) {
    throw error
  }
}

// Get production details for a header
export async function getAutoconerProductionDetails(headerId) {
  try {
    // Fetch entry_date for date-range visibility filtering
    const header = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const data = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId }
    })

    if (!data || data.length === 0) return []

    const machineIds = data.map(d => d.machine_id)
    const detailIds = data.map(d => d.id)

    const [machines, stoppages] = await Promise.all([
      prisma.autoconer_machines.findMany({
        where: { id: { in: machineIds } },
        select: {
          id: true,
          machine_no: true,
          group_id: true,
          from_drum: true,
          to_drum: true,
          no_of_drums: true,
          act_effi: true,
          make_name: true,
          is_active: true,
          activated_at: true,
          deactivated_at: true
        }
      }),
      prisma.autoconer_stoppage_entry.findMany({
        where: { production_detail_id: { in: detailIds } }
      })
    ])

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const stoppageMap = {}
    stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s })

    const enriched = data.map(detail => ({
      ...detail,
      machine: machineMap[detail.machine_id] || null,
      stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
    }))

    // Apply date-range visibility filter (preserve historical data correctly)
    const filtered = enriched.filter(detail => {
      const m = detail.machine
      if (!m) return false
      if (m.activated_at && new Date(m.activated_at) > entryDate) return false
      if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false
      return true
    })
  
    // Natural sort by group_id then machine_no
    filtered.sort((a, b) => {
        const groupA = a.machine?.group_id || 999;
        const groupB = b.machine?.group_id || 999;
        if (groupA !== groupB) return groupA - groupB;
        
        const machineNoA = a.machine?.machine_no || '';
        const machineNoB = b.machine?.machine_no || '';
        
        const matchA = machineNoA.match(/^AC(\d+)-(\d+)$/i);
        const matchB = machineNoB.match(/^AC(\d+)-(\d+)$/i);
        
        if (matchA && matchB) {
          const groupNumA = parseInt(matchA[1], 10);
          const groupNumB = parseInt(matchB[1], 10);
          if (groupNumA !== groupNumB) return groupNumA - groupNumB;
          
          const subNumA = parseInt(matchA[2], 10);
          const subNumB = parseInt(matchB[2], 10);
          return subNumA - subNumB;
        }
        
        return machineNoA.localeCompare(machineNoB, undefined, { numeric: true });
      });
    
    return filtered
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateAutoconerProductionDetail(id, updates) {
  try {
    // Note: Front-end now calculates all values using calculateAutoconerProductionValues()
    // Backend simply saves the data (like carding module)
    const data = await prisma.autoconer_production_detail.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Batch update production details
export async function batchUpdateAutoconerProductionDetails(updates) {
  const promises = updates.map(({ id, ...data }) => 
    updateAutoconerProductionDetail(id, data)
  )
  return Promise.all(promises)
}

// ============================================
// STOPPAGE ENTRY OPERATIONS
// ============================================

// Get stoppage entries for a header
export async function getAutoconerStoppageEntries(headerId) {
  try {
    // Fetch entry_date for date-range visibility filtering
    const header = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const details = await prisma.autoconer_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    if (!details || details.length === 0) return []

    const detailIds = details.map(d => d.id)
    const machineIds = details.map(d => d.machine_id)

    const [stoppages, machines] = await Promise.all([
      prisma.autoconer_stoppage_entry.findMany({
        where: { production_detail_id: { in: detailIds } }
      }),
      prisma.autoconer_machines.findMany({
        where: { id: { in: machineIds } },
        select: {
          id: true,
          machine_no: true,
          group_id: true,
          no_of_drums: true,
          act_effi: true,
          is_active: true,
          activated_at: true,
          deactivated_at: true
        }
      })
    ])

    const reasonIds = []
    stoppages.forEach(s => {
      if (s.stoppage1_id) reasonIds.push(s.stoppage1_id)
      if (s.stoppage2_id) reasonIds.push(s.stoppage2_id)
      if (s.stoppage3_id) reasonIds.push(s.stoppage3_id)
      if (s.stoppage4_id) reasonIds.push(s.stoppage4_id)
    })

    const reasons = reasonIds.length > 0
      ? await prisma.stoppage_details.findMany({
          where: { id: { in: [...new Set(reasonIds)] } },
          select: {
            id: true,
            stoppage_name: true,
            short_code: true
          }
        })
      : []

    const detailMap = {}
    details.forEach(d => { detailMap[d.id] = d })

    const machineMap = {}
    machines.forEach(m => { machineMap[m.id] = m })

    const reasonMap = {}
    reasons.forEach(r => { reasonMap[r.id] = r })

    const data = stoppages.map(s => {
      const detail = detailMap[s.production_detail_id]
      return {
        ...s,
        production_detail: detail
          ? {
              ...detail,
              machine: machineMap[detail.machine_id] || null
            }
          : null,
        stoppage1: reasonMap[s.stoppage1_id] || null,
        stoppage2: reasonMap[s.stoppage2_id] || null,
        stoppage3: reasonMap[s.stoppage3_id] || null,
        stoppage4: reasonMap[s.stoppage4_id] || null
      }
    })

    // Apply date-range visibility filter
    const filtered = (data || []).filter(entry => {
      const m = entry.production_detail?.machine
      if (!m) return false
      if (m.activated_at && new Date(m.activated_at) > entryDate) return false
      if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false
      return true
    })
  
    // Natural sort by group_id and machine_no
    return filtered.sort((a, b) => {
      const groupA = a.production_detail?.machine?.group_id || 999
      const groupB = b.production_detail?.machine?.group_id || 999
      if (groupA !== groupB) return groupA - groupB
      
      const machA = a.production_detail?.machine?.machine_no || ''
      const machB = b.production_detail?.machine?.machine_no || ''
      
      const matchA = machA.match(/^AC(\d+)-(\d+)$/i);
      const matchB = machB.match(/^AC(\d+)-(\d+)$/i);
      
      if (matchA && matchB) {
        const groupNumA = parseInt(matchA[1], 10);
        const groupNumB = parseInt(matchB[1], 10);
        if (groupNumA !== groupNumB) return groupNumA - groupNumB;
        
        const subNumA = parseInt(matchA[2], 10);
        const subNumB = parseInt(matchB[2], 10);
        return subNumA - subNumB;
      }
      
      return machA.localeCompare(machB, undefined, { numeric: true })
    })
  } catch (error) {
    throw error
  }
}

// Update stoppage entry - merges with existing values like Carding
export async function updateAutoconerStoppageEntry(id, updates) {
  try {
    // First, fetch the existing record to get current stoppage values
    const existing = await prisma.autoconer_stoppage_entry.findUnique({
      where: { id },
      select: {
        production_detail_id: true,
        stoppage1_time: true,
        stoppage2_time: true,
        stoppage3_time: true,
        stoppage4_time: true
      }
    })

    if (!existing) {
      throw new Error(`Stoppage entry ${id} not found`)
    }

    // Merge existing values with updates - use updated value if provided, else keep existing
    const mergedStoppages = {
      stoppage1_time: updates.stoppage1_time ?? existing?.stoppage1_time ?? 0,
      stoppage2_time: updates.stoppage2_time ?? existing?.stoppage2_time ?? 0,
      stoppage3_time: updates.stoppage3_time ?? existing?.stoppage3_time ?? 0,
      stoppage4_time: updates.stoppage4_time ?? existing?.stoppage4_time ?? 0
    }

    // Calculate total stoppage time from merged values
    const totalStoppage = 
      mergedStoppages.stoppage1_time + 
      mergedStoppages.stoppage2_time + 
      mergedStoppages.stoppage3_time + 
      mergedStoppages.stoppage4_time

    const data = await prisma.autoconer_stoppage_entry.update({
      where: { id },
      data: {
        ...updates,
        ...mergedStoppages,
        total_stoppage_time: totalStoppage
      }
    })

    // Resolve shift runtime from shift_config via this entry's header shift.
    // Fallback behavior remains centralized in getAutoconerShiftTime().
    const detail = await prisma.autoconer_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: { header_id: true }
    })

    const header = detail?.header_id
      ? await prisma.autoconer_production_header.findUnique({
          where: { id: detail.header_id },
          select: { shift: true }
        })
      : null

    const totalTime = await getAutoconerShiftTime(header?.shift || 1)
    const workTime = Math.max(totalTime - totalStoppage, 0)

    await prisma.autoconer_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        total_stoppage_mins: totalStoppage,
        work_time: workTime
      }
    })

    return data
  } catch (error) {
    throw error
  }
}

// Apply full stoppage to all machines (with slot selection like Carding)
export async function applyFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  // Get all stoppage entries for this header
  const stoppages = await getAutoconerStoppageEntries(headerId)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const promises = stoppages.map(s =>
    updateAutoconerStoppageEntry(s.id, {
      [stoppageIdField]: stoppageId,
      [stoppageTimeField]: stoppageTime,
      is_full_stoppage: slot === 1
    })
  )

  return Promise.all(promises)
}

// Apply partial stoppage to machine range (like Carding)
export async function applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    // Get all stoppage entries with machine info
    const stoppages = await getAutoconerStoppageEntries(headerId)

    // Filter by machine range (extract numeric part for comparison)
    // Machine format: AC1-1, AC1-2, AC2-1, etc.
    const extractMachineNum = (machineNo) => {
      const match = machineNo?.match(/^AC(\d+)-(\d+)$/i)
      if (match) {
        // Create a sortable number: group * 100 + sub
        return parseInt(match[1]) * 100 + parseInt(match[2])
      }
      return 0
    }

    const parsedFrom = extractMachineNum(fromMachineNo)
    const parsedTo = extractMachineNum(toMachineNo)
    const fromNum = Math.min(parsedFrom, parsedTo)
    const toNum = Math.max(parsedFrom, parsedTo)

    const filteredStoppages = stoppages.filter(s => {
      const machineNo = s.production_detail?.machine?.machine_no
      const mcNum = extractMachineNum(machineNo)
      return mcNum >= fromNum && mcNum <= toNum
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
    const appliedRows = []

    for (const stoppage of filteredStoppages) {
      const resolvedSlot = pickFirstAvailableSlot(stoppage)
      if (!resolvedSlot) {
        overflowCount++
        continue
      }

      const updated = await updateAutoconerStoppageEntry(stoppage.id, {
        [`stoppage${resolvedSlot}_id`]: stoppageId,
        [`stoppage${resolvedSlot}_time`]: stoppageTime
      })

      appliedRows.push({
        id: updated.id,
        [`stoppage${resolvedSlot}_id`]: updated[`stoppage${resolvedSlot}_id`],
        [`stoppage${resolvedSlot}_time`]: updated[`stoppage${resolvedSlot}_time`],
        total_stoppage_time: updated.total_stoppage_time
      })

      updatedCount++
    }

    return {
      totalTargeted: filteredStoppages.length,
      updatedCount,
      overflowCount,
      skippedCount: filteredStoppages.length - updatedCount,
      appliedRows
    }
  } catch (error) {
    throw error
  }
}

// ============================================
// MACHINE SETUP OPERATIONS
// ============================================

// Helper to get or create machine setups (no date/shift scoping)
export async function getOrCreateAutoconerMachineSetups(entryDate, shift = 1) {
  try {
    const shiftNum = parseInt(shift)
    const targetShiftTime = shiftNum === 3 ? 420 : 510
    
    // 1. Find all existing setups
    let setups = await prisma.autoconer_machine_setup.findMany({
      orderBy: { machine_id: 'asc' }
    })
    
    // 2. Find active machines that are missing setups
    const activeMachines = await prisma.autoconer_machines.findMany({
      where: { is_active: true }
    })
    
    const existingMachineIds = new Set(setups.map(s => s.machine_id))
    const missingMachines = activeMachines.filter(m => !existingMachineIds.has(m.id))
    
    if (missingMachines.length > 0) {
      const counts = await prisma.spinning_counts.findMany({
        where: { autoconer_active: true, is_active: true }
      })
      
      const missingSetups = missingMachines.map(m => {
        const matchedCount = counts.find(c => c.count_name === m.count)
        return {
          machine_id: m.id,
          count_name: m.count || '',
          count_id: matchedCount?.id || null,
          act_count: matchedCount?.act_count || 69.50,
          session_no: 1,
          run_time: targetShiftTime
        }
      })
      
      await prisma.autoconer_machine_setup.createMany({
        data: missingSetups
      })
      
      setups = await prisma.autoconer_machine_setup.findMany({
        orderBy: { machine_id: 'asc' }
      })
    }
    
    return setups
  } catch (error) {
    throw error
  }
}

// Get all machine setups
export async function getAutoconerMachineSetups(entryDate = null, shift = 1) {
  try {
    const setups = await getOrCreateAutoconerMachineSetups(entryDate, shift)
    if (!setups || setups.length === 0) return []

    const machineIds = setups.map(s => s.machine_id)
    const machines = await prisma.autoconer_machines.findMany({
      where: {
        id: { in: machineIds },
        is_active: true
      },
      select: {
        id: true,
        machine_no: true,
        make_name: true,
        group_id: true,
        from_drum: true,
        to_drum: true,
        no_of_drums: true,
        is_active: true
      }
    })

    const machineMap = {}
    machines.forEach(m => { machineMap[m.id] = m })

    const data = setups
      .filter(s => !!machineMap[s.machine_id])
      .map(s => ({ ...s, machine: machineMap[s.machine_id] }))
  
    // Natural sort by group_id then machine_no
    if (data) {
      data.sort((a, b) => {
        const groupA = a.machine?.group_id || 999;
        const groupB = b.machine?.group_id || 999;
        if (groupA !== groupB) return groupA - groupB;
        
        const machineNoA = a.machine?.machine_no || '';
        const machineNoB = b.machine?.machine_no || '';
        
        const matchA = machineNoA.match(/^AC(\d+)-(\d+)$/i);
        const matchB = machineNoB.match(/^AC(\d+)-(\d+)$/i);
        
        if (matchA && matchB) {
          const groupNumA = parseInt(matchA[1], 10);
          const groupNumB = parseInt(matchB[1], 10);
          if (groupNumA !== groupNumB) return groupNumA - groupNumB;
          
          const subNumA = parseInt(matchA[2], 10);
          const subNumB = parseInt(matchB[2], 10);
          return subNumA - subNumB;
        }
        
        return machineNoA.localeCompare(machineNoB, undefined, { numeric: true });
      });
    }
    
    return data || []
  } catch (error) {
    throw error
  }
}

// Update machine setup by ID - also syncs count to production details strictly for this date & shift
// Update machine setup by ID - also syncs count to production details
export async function updateAutoconerMachineSetup(id, updates, shift = null, entryDate = null) {
  try {
    const data = await prisma.autoconer_machine_setup.update({
      where: { id },
      data: {
        ...updates,
        updated_at: new Date()
      }
    })
    
    // If count_id or count_name is being updated, sync to production details
    if ((updates.count_id || updates.count_name) && data.machine_id) {
      const targetDate = entryDate ? new Date(entryDate) : null
      const headers = await prisma.autoconer_production_header.findMany({
        where: { 
          ...(targetDate ? { entry_date: targetDate } : { entry_date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } }),
          ...(shift !== null && { shift: parseInt(shift) })
        },
        select: { id: true }
      })
      
      const headerIds = headers.map(h => h.id)
      if (headerIds.length > 0) {
        const updateData = {}
        if (updates.count_id) updateData.count_id = updates.count_id
        if (updates.count_name) updateData.count_name = updates.count_name
        
        await prisma.autoconer_production_detail.updateMany({
          where: { 
            machine_id: data.machine_id,
            header_id: { in: headerIds }
          },
          data: updateData
        })
      }
    }
    
    return data
  } catch (error) {
    throw error
  }
}

// Upsert machine setup (no date/shift scoping)
export async function upsertAutoconerMachineSetup(machineId, entryDate, shift, updates) {
  try {
    const existing = await prisma.autoconer_machine_setup.findFirst({
      where: { machine_id: machineId },
      select: { id: true }
    })
    
    let data
    if (existing?.id) {
      data = await prisma.autoconer_machine_setup.update({
        where: { id: existing.id },
        data: updates
      })
    } else {
      data = await prisma.autoconer_machine_setup.create({
        data: {
          machine_id: machineId,
          ...updates
        }
      })
    }
    
    // Sync count strictly to production details for this date and shift if count changed
    if ((updates.count_id || updates.count_name) && machineId && entryDate) {
      const dateObj = new Date(entryDate)
      const shiftNum = parseInt(shift)
      const headers = await prisma.autoconer_production_header.findMany({
        where: { 
          entry_date: dateObj,
          shift: shiftNum
        },
        select: { id: true }
      })
      
      const headerIds = headers.map(h => h.id)
      if (headerIds.length > 0) {
        const updateData = {}
        if (updates.count_id) updateData.count_id = updates.count_id
        if (updates.count_name) updateData.count_name = updates.count_name
        
        await prisma.autoconer_production_detail.updateMany({
          where: { 
            machine_id: machineId,
            header_id: { in: headerIds }
          },
          data: updateData
        })
      }
    }
    
    return data
  } catch (error) {
    throw error
  }
}


// Batch update machine setups
export async function batchUpdateAutoconerMachineSetups(updates, shift = null) {
  const promises = updates.map(({ id, machine_id, ...data }) => {
    const targetId = id || machine_id
    return updateAutoconerMachineSetup(targetId, data, shift)
  })
  return Promise.all(promises)
}

// Get spinning counts for autoconer
export async function getAutoconerSpinningCounts() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: {
        autoconer_active: true,
        is_active: true
      },
      select: {
        id: true,
        count_name: true,
        act_count: true,
        speed_autoconer: true,
        auto_effi: true
      },
      orderBy: { count_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getAutoconerAvailablePreviousDates(beforeDate, shift, limit = 30) {
  try {
    const data = await prisma.autoconer_production_header.findMany({
      where: {
        shift,
        entry_date: { lt: new Date(beforeDate) }
      },
      select: {
        entry_date: true,
        shift: true
      },
      orderBy: { entry_date: 'desc' },
      take: limit
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Copy data from a previous date
export async function copyAutoconerFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    let previousDate = sourceDate
    if (!previousDate) {
      const targetDateObj = new Date(targetDate)
      const yesterdayDateObj = new Date(targetDateObj)
      yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1)
      previousDate = yesterdayDateObj.toISOString().split('T')[0]
    }

    // Normalize the date to just the date portion (YYYY-MM-DD) to handle ISO string dates
    const normalizedDate = previousDate.includes('T') 
      ? previousDate.split('T')[0] 
      : previousDate

    // Get source header
    const sourceHeader = await getAutoconerProductionByDateShift(normalizedDate, targetShift)
    if (!sourceHeader) {
      throw new Error(`No production data found for ${normalizedDate} shift ${targetShift}`)
    }

    // Get source production details
    const sourceDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: sourceHeader.id }
    })
    
    if (!sourceDetails || sourceDetails.length === 0) {
      throw new Error(`No production details found for ${normalizedDate}`)
    }

    // Get source stoppage entries
    const sourceStoppages = await prisma.autoconer_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: sourceDetails.map(d => d.id) }
      }
    })
    
    // Get target production details
    const targetDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: targetHeaderId }
    })
    
    // Create map of machine_id to source data
    const sourceDataMap = {}
    sourceDetails.forEach(d => {
      sourceDataMap[d.machine_id] = d
    })

    const sourceStoppageMap = {}
    sourceStoppages?.forEach(s => {
      const detail = sourceDetails.find(d => d.id === s.production_detail_id)
      if (detail) {
        sourceStoppageMap[detail.machine_id] = s
      }
    })
    
    // Update target details with source data (copy ALL production fields)
    let machinesUpdated = 0
    for (const targetDetail of targetDetails) {
      const sourceData = sourceDataMap[targetDetail.machine_id]
      if (!sourceData) continue
      
      // Copy ALL production values
      await prisma.autoconer_production_detail.update({
        where: { id: targetDetail.id },
        data: {
          emp_name: sourceData.emp_name,
          count_id: sourceData.count_id,
          count_name: sourceData.count_name,
          act_prodn: sourceData.act_prodn,
          prodn_effi: sourceData.prodn_effi,
          red_light: sourceData.red_light,
          idle_drum: sourceData.idle_drum,
          idle_reason: sourceData.idle_reason,
          waste_kg: sourceData.waste_kg,
          waste_percent: sourceData.waste_percent,
          total_stoppage_mins: sourceData.total_stoppage_mins,
          work_time: sourceData.work_time,
          session_no: sourceData.session_no
        }
      })
      machinesUpdated++
    }

    // Update target stoppage entries
    const targetStoppages = await prisma.autoconer_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: targetDetails.map(d => d.id) }
      },
      include: {
        production_detail: {
          select: { machine_id: true }
        }
      }
    })

    // Copy stoppage data
    for (const targetStoppage of targetStoppages || []) {
      const machineId = targetStoppage.production_detail?.machine_id
      const sourceStoppage = sourceStoppageMap[machineId]
      if (!sourceStoppage) continue

      await prisma.autoconer_stoppage_entry.update({
        where: { id: targetStoppage.id },
        data: {
          run_time: sourceStoppage.run_time,
          stoppage1_id: sourceStoppage.stoppage1_id,
          stoppage1_time: sourceStoppage.stoppage1_time,
          stoppage2_id: sourceStoppage.stoppage2_id,
          stoppage2_time: sourceStoppage.stoppage2_time,
          stoppage3_id: sourceStoppage.stoppage3_id,
          stoppage3_time: sourceStoppage.stoppage3_time,
          stoppage4_id: sourceStoppage.stoppage4_id,
          stoppage4_time: sourceStoppage.stoppage4_time,
          total_stoppage_time: sourceStoppage.total_stoppage_time,
          is_full_stoppage: sourceStoppage.is_full_stoppage
        }
      })
    }

    return {
      success: true,
      copiedFrom: normalizedDate,
      machinesUpdated: machinesUpdated
    }
  } catch (error) {
    throw error
  }
}

// ============================================
// ADDITIONAL HELPER FUNCTIONS
// ============================================

// Get supervisors
export async function getSupervisors() {
  try {
    const data = await prisma.supervisors.findMany({
      where: { is_active: true },
      orderBy: { supervisor_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Get stoppage details for autoconer department (with category from stoppage_heads)
export async function getStoppageDetails() {
  try {
    // First get the AUTOCONER department id
    const dept = await prisma.departments.findFirst({
      where: { dept_name: 'AUTOCONER' }
    })

    const data = await prisma.stoppage_details.findMany({
      where: {
        is_active: true,
        department_id: dept?.id
      },
      select: {
        id: true,
        stoppage_name: true,
        short_code: true,
        stoppage_head_id: true
      },
      orderBy: { stoppage_name: 'asc' }
    })

    // Fetch stoppage heads for category names
    const headIds = [...new Set(data.filter(d => d.stoppage_head_id).map(d => d.stoppage_head_id))]
    const heads = headIds.length > 0
      ? await prisma.stoppage_heads.findMany({
          where: { id: { in: headIds } },
          select: { id: true, stoppage_head_name: true }
        })
      : []
    const headMap = {}
    heads.forEach(h => { headMap[h.id] = h.stoppage_head_name })

    return data.map(d => ({
      id: d.id,
      stoppage_name: d.stoppage_name,
      short_code: d.short_code,
      category: d.stoppage_head_id ? (headMap[d.stoppage_head_id] || 'General') : 'General'
    }))
  } catch (error) {
    console.error('Error fetching stoppage details:', error)
    return []
  }
}

// Get spinning counts for autoconer
export async function getSpinningCounts() {
  return getAutoconerSpinningCounts()
}

// Get autoconer machines
export async function getAutoconerMachines() {
  try {
    const data = await prisma.autoconer_machines.findMany({
      where: { is_active: true },
      orderBy: [
        { group_id: 'asc' },
        { machine_no: 'asc' }
      ]
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Lookup a single machine by machine_no — searches ALL machines (active + inactive)
export async function lookupAutoconerMachineByNo(machineNo) {
  try {
    // MySQL TEXT columns are case-insensitive by default — no need for mode: 'insensitive'
    const data = await prisma.autoconer_machines.findFirst({
      where: {
        machine_no: { equals: machineNo }
      },
      orderBy: { is_active: 'desc' }  // prefer active row first
    })
    return data || null
  } catch (error) {
    throw error
  }
}

// Get autoconer groups (distinct group_ids)
export async function getAutoconerGroups() {
  try {
    const machines = await prisma.autoconer_machines.findMany({
      where: { is_active: true },
      select: { group_id: true },
      distinct: ['group_id'],
      orderBy: { group_id: 'asc' }
    })
    return machines.map(m => m.group_id).filter(Boolean)
  } catch (error) {
    throw error
  }
}

// Add autoconer machine
export async function addAutoconerMachine(machineData) {
  try {
    // Extract only the fields that belong to autoconer_machines table
    const {
      mc_id,
      group_id,
      machine_no,
      description,
      make_name,
      model,
      from_drum,
      to_drum,
      no_of_drums,
      speed,
      count,
      act_effi,
      installed_date,
      direct_prod_entry,
      // Setup fields (not for machines table)
      count_id,
      count_name,
      session_no,
      run_time,
      ...rest
    } = machineData

    // Check if machine already exists
    const existingMachine = await prisma.autoconer_machines.findFirst({
      where: { machine_no: machine_no }
    })

    let machine
    let reactivated = false

    if (existingMachine) {
      if (!existingMachine.is_active) {
        // Reactivate existing machine
        machine = await prisma.autoconer_machines.update({
          where: { id: existingMachine.id },
          data: {
            is_active: true,
            activated_at: new Date(),
            deactivated_at: null,
            description: description || machine_no,
            make_name: make_name || 'MURT',
            model,
            from_drum,
            to_drum,
            no_of_drums,
            speed,
            count,
            act_effi: act_effi || 0,
            installed_date,
            mc_id,
            group_id
          }
        })
        reactivated = true
      } else {
        // Machine is already active (e.g. created via Master page without a setup).
        // Use it as-is — the setup + production sync below will handle the rest.
        machine = existingMachine
        reactivated = false
      }
    } else {
      // Create new machine
      machine = await prisma.autoconer_machines.create({
        data: {
          mc_id,
          group_id: group_id || 1,
          machine_no,
          description: description || machine_no,
          make_name: make_name || 'MURT',
          model: model || '',
          from_drum,
          to_drum,
          no_of_drums,
          speed,
          count: count || '',
          act_effi: act_effi || 0,
          installed_date,
          direct_prod_entry: direct_prod_entry || false,
          is_active: true,
          activated_at: new Date()
        }
      })
    }

    // Create or update machine setup (always create for new/reactivated machines)
    let setup = null
    if (machine) {
      // Resolve setup runtime from payload first; fallback from shift_config (shift 1) if missing.
      const parsedRunTime = Number.parseInt(String(run_time), 10)
      const resolvedRunTime = Number.isFinite(parsedRunTime) && parsedRunTime > 0
        ? parsedRunTime
        : await getAutoconerShiftTime(1)

      // Check if default setup already exists
      const existingSetup = await prisma.autoconer_machine_setup.findFirst({
        where: { machine_id: machine.id }
      })
      
      if (existingSetup) {
        setup = existingSetup
      } else {
        // Create setup for the machine
        setup = await prisma.autoconer_machine_setup.create({
          data: {
            machine_id: machine.id,
            count_id: count_id || null,
            count_name: count_name || null,
            session_no: session_no || 1,
            run_time: resolvedRunTime
          }
        })
      }
    }

    // Sync new/reactivated machine to ALL existing production headers
    const existingHeaders = await prisma.autoconer_production_header.findMany({
      where: { entry_date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } },
      select: { id: true, shift: true }  // Include shift for proper shift-wise data
    })

    for (const header of existingHeaders) {
      await syncNewMachinesToAutoconerHeader(header.id, header.shift)  // Pass shift
    }

    return { machine, setup, reactivated, syncedHeaders: existingHeaders.length }
  } catch (error) {
    throw error
  }
}

// Remove/deactivate autoconer machine
// entryDate: the production entry date from which the machine is being removed.
// deactivated_at is set to entryDate so the machine is hidden from that date onwards
// but remains visible on all prior dates.
export async function removeAutoconerMachine(id, entryDate) {
  try {
    const data = await prisma.autoconer_machines.update({
      where: { id },
      data: { is_active: false, deactivated_at: entryDate ? new Date(entryDate) : new Date() }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Remove machine setups by IDs
export async function removeAutoconerMachineSetups(setupIds) {
  try {
    const data = await prisma.autoconer_machine_setup.deleteMany({
      where: {
        id: {
          in: setupIds // IDs are strings (UUIDs), not integers
        }
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * Calculate autoconer production values (similar to carding's calculateProductionValues)
 * @param {number} actProdn - Actual production in kg
 * @param {number} wasteKg - Waste in kg
 * @param {number} idleDrum - Number of idle drums
 * @param {number} totalDrums - Total drums in machine
 * @param {number} totalStoppageMins - Total stoppage time in minutes
 * @param {number} runTime - Run time (total shift time, e.g., 510 or 420)
 * @returns {Object} Calculated production values
 */
export function calculateAutoconerProductionValues(actProdn, wasteKg, idleDrum, totalDrums, totalStoppageMins, runTime) {
  // Ensure numeric values
  actProdn = parseFloat(actProdn) || 0
  wasteKg = parseFloat(wasteKg) || 0
  idleDrum = parseInt(idleDrum) || 0
  totalDrums = parseInt(totalDrums) || 0
  totalStoppageMins = parseInt(totalStoppageMins) || 0
  runTime = parseInt(runTime) || resolveAutoconerShiftFallbackTime(1)

  // Calculate Work Time = Run Time - Total Stoppage
  const workTime = Math.max(runTime - totalStoppageMins, 0)

  // Calculate Waste % = (Waste Kg / Act Prodn) × 100
  const wastePercent = actProdn > 0 ? (wasteKg / actProdn) * 100 : null

  // Calculate Idle Drum % = (Idle Drum / Total Drum) × 100
  const idleDrumPercent = totalDrums > 0 ? (idleDrum / totalDrums) * 100 : 0

  // Calculate Drum Efficiency = 100 - Idle Drum %
  const drumEfficiency = 100 - idleDrumPercent

  // Calculate Production Efficiency (UTI %) = (Work Time / Run Time) × Drum Efficiency
  const prodnEffi = runTime > 0 ? (workTime / runTime) * drumEfficiency : 0

  // Calculate Util % = (Work Time / Total Time) × 100
  const utiPercent = runTime > 0 ? (workTime / runTime) * 100 : 0

  return {
    waste_percent: wastePercent === null ? null : Math.round(wastePercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    prodn_effi: Math.round(prodnEffi * 100) / 100,
    work_time: workTime,
    run_time: runTime,
    total_stoppage_mins: totalStoppageMins,
    // Additional calculated values for reference (not stored in DB)
    _idleDrumPercent: Math.round(idleDrumPercent * 100) / 100,
    _drumEfficiency: Math.round(drumEfficiency * 100) / 100
  }
}

// Get idle reasons for autoconer
export function getIdleReasons() {
  return [
    { id: 'NO_SUPPLY', name: 'No Cop Supply' },
    { id: 'NO_POWER', name: 'Power Failure' },
    { id: 'MACHINE_BREAKDOWN', name: 'Machine Breakdown' },
    { id: 'NO_OPERATOR', name: 'No Operator' },
    { id: 'QUALITY_ISSUE', name: 'Quality Issue' },
    { id: 'CONE_SHORTAGE', name: 'Cone Shortage' },
    { id: 'OTHER', name: 'Other' }
  ]
}
