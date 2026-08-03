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
import { buildStoppageUpdate, findFirstFreeStoppageSlot } from '../stoppageSlotUtils'
import { resolveProductionTime } from '../productionFormulaMath'
import { sanitizeAutoconerSetupUpdate, validateCompleteAutoconerSetup } from '../machineSetupValidation'
import {
  buildAutoconerMachineVisibilityWhere,
  getAutoconerEntryDateWindow,
  isAutoconerMachineVisibleOnDate
} from '../autoconerMachineLifecycle'
import { assertActiveStoppageReasons } from './stoppageValidation'
import { sanitizeProductionDetailUpdate, sanitizeProductionHeaderUpdate } from './productionDetailUpdate'
import { cleanAutoconerMachineInput } from './autoconerQueries'

function autoconerSetupError(message) {
  const error = new Error(message)
  error.code = 'INVALID_MACHINE_SETUP'
  return error
}

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
    throw error
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
    throw error
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
      data: {
        ...sanitizeProductionHeaderUpdate('autoconer_production_header', updates),
        updated_at: new Date()
      }
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
    
    try {
      header = await createAutoconerProductionHeader({
        entry_date: new Date(date),
        shift,
        supervisor_id: supervisorId,
        total_time: shiftConfig.totalTime
      })

      // Initialize production details only for the request that created the header.
      await initializeAutoconerProductionDetails(header.id, shift)
    } catch (error) {
      if (error?.code !== 'P2002') throw error
      header = await getAutoconerProductionByDateShift(date, shift)
      if (!header) throw error
    }
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
    throw error
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
    if (!header) throw new Error('Autoconer production header not found')
    const entryDate = header.entry_date

    // Get setups for this date and shift (with inheritance)
    const setups = await getOrCreateAutoconerMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // getOrCreateAutoconerMachineSetups snapshots every machine visible on this date.
    const machines = await prisma.autoconer_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        ...buildAutoconerMachineVisibilityWhere(entryDate)
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

    const createdDetails = await prisma.$transaction(async tx => {
      await tx.autoconer_production_detail.createMany({
        data: detailInserts,
        skipDuplicates: true
      })

      const details = await tx.autoconer_production_detail.findMany({
        where: {
          header_id: headerId,
          machine_id: { in: newMachines.map(m => m.id) }
        }
      })

      await tx.autoconer_stoppage_entry.createMany({
        data: details.map(detail => ({
          production_detail_id: detail.id,
          run_time: totalTime,
          total_stoppage_time: defaultStoppage
        })),
        skipDuplicates: true
      })

      return details
    })

    return createdDetails
  } catch (error) {
    throw error
  }
}

// Add newly visible machines to an existing header without mutating historical rows.
export async function syncNewMachinesToAutoconerHeader(headerId, shift = 1) {
  try {
    // 1. Fetch entry_date
    const headerRow = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    if (!headerRow) throw new Error('Autoconer production header not found')
    const entryDate = headerRow.entry_date

    // Get machine setups for this date and shift (with inheritance)
    const setups = await getOrCreateAutoconerMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // 2. Get machines belonging to this entry-date snapshot.
    const machines = await prisma.autoconer_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        ...buildAutoconerMachineVisibilityWhere(entryDate)
      },
      orderBy: [{ group_id: 'asc' }, { machine_no: 'asc' }]
    })

    // 3. Fetch existing detail rows
    const existingDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })
    const existingMachineIds = new Set(existingDetails.map(detail => detail.machine_id))

    // 4. Determine additive rows only.
    const newMachines = machines.filter(machine => !existingMachineIds.has(machine.id))

    // Existing detail and stoppage rows are historical snapshots. A machine
    // deactivation changes visibility only; synchronization never deletes data.

    // Map setups for additive inserts.
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

    return await prisma.$transaction(async tx => {
      if (detailInserts.length > 0) {
        await tx.autoconer_production_detail.createMany({
          data: detailInserts,
          skipDuplicates: true
        })
      }

      // Repair any legacy/partially initialized visible detail that is missing
      // its one-to-one stoppage row while creating new pairs atomically.
      const visibleDetails = machines.length > 0
        ? await tx.autoconer_production_detail.findMany({
            where: {
              header_id: headerId,
              machine_id: { in: machines.map(machine => machine.id) }
            }
          })
        : []

      if (visibleDetails.length > 0) {
        await tx.autoconer_stoppage_entry.createMany({
          data: visibleDetails.map(detail => ({
            production_detail_id: detail.id,
            run_time: totalTime,
            total_stoppage_time: defaultStoppage
          })),
          skipDuplicates: true
        })
      }

      const newMachineIds = new Set(newMachines.map(machine => machine.id))
      return visibleDetails.filter(detail => newMachineIds.has(detail.machine_id))
    })
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
    if (!header) throw new Error('Autoconer production header not found')
    const entryDate = header.entry_date

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
      return isAutoconerMachineVisibleOnDate(detail.machine, entryDate)
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
      data: {
        ...sanitizeProductionDetailUpdate('autoconer_production_detail', updates),
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Batch update production details
export async function batchUpdateAutoconerProductionDetails(updates) {
  const updatedAt = new Date()
  return prisma.$transaction(
    updates.map(({ id, ...data }) =>
      prisma.autoconer_production_detail.update({
        where: { id },
        data: {
          ...sanitizeProductionDetailUpdate('autoconer_production_detail', data),
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
export async function getAutoconerStoppageEntries(headerId) {
  try {
    // Fetch entry_date for date-range visibility filtering
    const header = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    if (!header) throw new Error('Autoconer production header not found')
    const entryDate = header.entry_date

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
      return isAutoconerMachineVisibleOnDate(entry.production_detail?.machine, entryDate)
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
  return prisma.$transaction(async tx => {
    try {
    // First, fetch the existing record to get current stoppage values
    const existing = await tx.autoconer_stoppage_entry.findUnique({
      where: { id },
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
      throw new Error(`Stoppage entry ${id} not found`)
    }

    const stoppageUpdate = buildStoppageUpdate(existing, updates)
    await assertActiveStoppageReasons(tx, stoppageUpdate, ['AUTOCONER'])
    const totalStoppage = stoppageUpdate.total_stoppage_time

    const data = await tx.autoconer_stoppage_entry.update({
      where: { id },
      data: stoppageUpdate
    })

    // Resolve shift runtime from shift_config via this entry's header shift.
    // Fallback behavior remains centralized in getAutoconerShiftTime().
    const detail = await tx.autoconer_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: {
        id: true,
        header_id: true,
        machine_id: true,
        act_prodn: true,
        waste_kg: true,
        idle_drum: true
      }
    })

    if (!detail) throw new Error('The production row for this stoppage no longer exists')

    const header = detail?.header_id
      ? await tx.autoconer_production_header.findUnique({
          where: { id: detail.header_id },
          select: { shift: true }
        })
      : null

    if (!header) throw new Error('The production header for this stoppage no longer exists')

    const shiftConfig = await tx.shift_config.findFirst({
      where: { department_code: 'AUTOCONER', shift: header.shift, is_active: true },
      select: { shift_time: true }
    })
    const totalTime = shiftConfig?.shift_time || resolveAutoconerShiftFallbackTime(header.shift)
    if (totalStoppage > totalTime) {
      const error = new Error('Stoppage time cannot exceed the shift time')
      error.code = 'INVALID_STOPPAGE'
      throw error
    }
    const machine = await tx.autoconer_machines.findUnique({
      where: { id: detail.machine_id },
      select: { no_of_drums: true }
    })
    const calculated = calculateAutoconerProductionValues(
      detail.act_prodn,
      detail.waste_kg,
      detail.idle_drum,
      machine?.no_of_drums ?? 0,
      totalStoppage,
      totalTime
    )
    const persistedValues = { ...calculated }
    delete persistedValues._idleDrumPercent
    delete persistedValues._drumEfficiency

    await tx.autoconer_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        ...persistedValues,
        updated_at: new Date()
      }
    })

    return data
    } catch (error) {
      throw error
    }
  })
}

// Apply full stoppage to all machines (with slot selection like Carding)
export async function applyFullStoppage(headerId, stoppageId, stoppageTime) {
  // Get all stoppage entries for this header
  const stoppages = await getAutoconerStoppageEntries(headerId)

  const promises = stoppages.flatMap(s => {
    const slot = findFirstFreeStoppageSlot(s)
    if (!slot) return []
    return [updateAutoconerStoppageEntry(s.id, {
      [`stoppage${slot}_id`]: stoppageId,
      [`stoppage${slot}_time`]: stoppageTime,
      is_full_stoppage: true
    })]
  })

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

async function synchronizeAutoconerMachineSetupSnapshots(entryDate, shift = 1) {
  const dateObj = getAutoconerEntryDateWindow(entryDate).start
  const shiftNum = parseInt(shift)
  const targetShiftTime = await getAutoconerShiftTime(shiftNum)

  return prisma.$transaction(async tx => {
    const [existingSetups, visibleMachines] = await Promise.all([
      tx.autoconer_machine_setup.findMany({
        where: { entry_date: dateObj, shift: shiftNum }
      }),
      tx.autoconer_machines.findMany({
        where: buildAutoconerMachineVisibilityWhere(dateObj)
      })
    ])

    const existingMachineIds = new Set(existingSetups.map(setup => setup.machine_id))
    const missingMachines = visibleMachines.filter(machine => !existingMachineIds.has(machine.id))
    if (missingMachines.length === 0) return existingSetups

    const missingMachineIds = missingMachines.map(machine => machine.id)
    const previousSetups = await tx.autoconer_machine_setup.findMany({
      where: {
        machine_id: { in: missingMachineIds },
        OR: [
          { entry_date: { lt: dateObj } },
          { entry_date: dateObj, shift: { lt: shiftNum } }
        ]
      },
      orderBy: [
        { entry_date: 'desc' },
        { shift: 'desc' }
      ]
    })

    const previousByMachine = new Map()
    for (const setup of previousSetups) {
      if (!previousByMachine.has(setup.machine_id)) {
        previousByMachine.set(setup.machine_id, setup)
      }
    }

    const referencedCountIds = [...new Set(previousSetups.map(setup => setup.count_id).filter(Boolean))]
    const referencedCountNames = [...new Set([
      ...previousSetups.map(setup => setup.count_name),
      ...missingMachines.map(machine => machine.count)
    ].filter(Boolean))]
    const activeCounts = await tx.spinning_counts.findMany({
      where: {
        is_active: true,
        OR: [
          { autoconer_active: true },
          ...(referencedCountIds.length ? [{ id: { in: referencedCountIds } }] : []),
          ...(referencedCountNames.length ? [{ count_name: { in: referencedCountNames } }] : [])
        ]
      }
    })
    const countById = new Map(activeCounts.map(count => [count.id, count]))
    const countByName = new Map(activeCounts.map(count => [count.count_name, count]))

    const inserts = missingMachines.map(machine => {
      const previous = previousByMachine.get(machine.id)
      const currentCount = countByName.get(machine.count) ||
        countById.get(previous?.count_id) ||
        countByName.get(previous?.count_name)
      const setup = {
        machine_id: machine.id,
        entry_date: dateObj,
        shift: shiftNum,
        count_name: currentCount?.count_name ?? machine.count ?? previous?.count_name ?? '',
        count_id: currentCount?.id ?? previous?.count_id ?? null,
        act_count: currentCount?.act_count ?? previous?.act_count,
        session_no: previous?.session_no ?? 1,
        run_time: targetShiftTime
      }
      const validated = validateCompleteAutoconerSetup(setup)
      return { ...setup, ...validated }
    })

    await tx.autoconer_machine_setup.createMany({
      data: inserts,
      skipDuplicates: true
    })

    return tx.autoconer_machine_setup.findMany({
      where: { entry_date: dateObj, shift: shiftNum }
    })
  })
}

export async function getOrCreateAutoconerMachineSetups(entryDate, shift = 1) {
  if (!entryDate) throw new Error('entryDate is required for Autoconer machine setups')
  return synchronizeAutoconerMachineSetupSnapshots(entryDate, shift)
}

// Get all machine setups for a given date
export async function getAutoconerMachineSetups(entryDate, shift = 1) {
  try {
    if (!entryDate) {
      throw new Error('entryDate is required for getAutoconerMachineSetups')
    }
    
    const setups = await getOrCreateAutoconerMachineSetups(entryDate, shift)
    if (!setups || setups.length === 0) return []

    const machineIds = setups.map(s => s.machine_id)
    const machines = await prisma.autoconer_machines.findMany({
      where: {
        id: { in: machineIds }
      },
      select: {
        id: true,
        machine_no: true,
        make_name: true,
        group_id: true,
        from_drum: true,
        to_drum: true,
        no_of_drums: true,
        is_active: true,
        activated_at: true,
        deactivated_at: true
      }
    })

    const machineMap = {}
    machines.forEach(m => { machineMap[m.id] = m })

    const data = setups
      .filter(s => isAutoconerMachineVisibleOnDate(machineMap[s.machine_id], entryDate))
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

async function resolveCompleteAutoconerSetup(tx, existing, updates) {
  const sanitized = sanitizeAutoconerSetupUpdate(updates)
  const countWasEdited = Object.prototype.hasOwnProperty.call(sanitized, 'count_id') ||
    Object.prototype.hasOwnProperty.call(sanitized, 'count_name')
  const countId = sanitized.count_id ?? existing?.count_id
  const countName = sanitized.count_name ?? existing?.count_name
  const countWhere = countId ? { id: countId } : { count_name: countName }
  const count = countId || countName
    ? await tx.spinning_counts.findFirst({
        where: {
          ...countWhere,
          ...(!existing || countWasEdited ? { is_active: true, autoconer_active: true } : {})
        },
        select: { id: true, count_name: true, act_count: true }
      })
    : null

  if (!count) {
    throw autoconerSetupError(
      !existing || countWasEdited
        ? 'Select an active Autoconer spinning count'
        : 'The count stored in this Autoconer setup no longer exists'
    )
  }

  return validateCompleteAutoconerSetup({
    ...existing,
    ...sanitized,
    count_id: count.id,
    count_name: count.count_name,
    act_count: Number(count.act_count)
  })
}

async function syncAutoconerSetupToEntry(tx, setup) {
  const header = await tx.autoconer_production_header.findFirst({
    where: { entry_date: setup.entry_date, shift: setup.shift },
    select: { id: true, total_time: true }
  })
  if (!header) return null

  const machine = await tx.autoconer_machines.findUnique({
    where: { id: setup.machine_id },
    select: { no_of_drums: true }
  })
  if (!machine) throw new Error('The Autoconer machine for this setup no longer exists')

  const existingDetail = await tx.autoconer_production_detail.findUnique({
    where: {
      uk_autoconer_detail_header_machine: {
        header_id: header.id,
        machine_id: setup.machine_id
      }
    }
  })
  const runTime = Number(setup.run_time ?? header.total_time ?? resolveAutoconerShiftFallbackTime(setup.shift))
  const totalStoppage = Number(existingDetail?.total_stoppage_mins ?? 0)
  if (totalStoppage > runTime) {
    const error = new Error('Existing stoppage time cannot exceed the updated machine run time')
    error.code = 'INVALID_STOPPAGE'
    throw error
  }
  const calculated = calculateAutoconerProductionValues(
    existingDetail?.act_prodn ?? 0,
    existingDetail?.waste_kg ?? 0,
    existingDetail?.idle_drum ?? 0,
    machine.no_of_drums ?? 0,
    totalStoppage,
    runTime
  )
  const { _idleDrumPercent, _drumEfficiency, ...persistedValues } = calculated
  const now = new Date()
  const detail = await tx.autoconer_production_detail.upsert({
    where: {
      uk_autoconer_detail_header_machine: {
        header_id: header.id,
        machine_id: setup.machine_id
      }
    },
    create: {
      header_id: header.id,
      machine_id: setup.machine_id,
      count_id: setup.count_id,
      count_name: setup.count_name,
      session_no: setup.session_no,
      total_stoppage_mins: totalStoppage,
      ...persistedValues,
      updated_at: now
    },
    update: {
      count_id: setup.count_id,
      count_name: setup.count_name,
      session_no: setup.session_no,
      total_stoppage_mins: totalStoppage,
      ...persistedValues,
      updated_at: now
    }
  })

  await tx.autoconer_stoppage_entry.createMany({
    data: [{
      production_detail_id: detail.id,
      run_time: runTime,
      total_stoppage_time: totalStoppage
    }],
    skipDuplicates: true
  })
  await tx.autoconer_stoppage_entry.updateMany({
    where: { production_detail_id: detail.id },
    data: { run_time: runTime, updated_at: now }
  })
  return detail
}

async function persistAutoconerMachineSetup(tx, id, updates, shift = null) {
  if (typeof id !== 'string' || !id.trim()) throw autoconerSetupError('Autoconer setup id is required')
  const existing = await tx.autoconer_machine_setup.findUnique({ where: { id } })
  if (!existing) throw autoconerSetupError('Autoconer machine setup not found')

  const expectedShift = shift === null ? existing.shift : Number(shift)
  if (!Number.isInteger(expectedShift) || expectedShift !== existing.shift) {
    throw autoconerSetupError('Autoconer setup shift does not match the entry being saved')
  }

  const setupUpdates = await resolveCompleteAutoconerSetup(tx, existing, updates)
  const setup = await tx.autoconer_machine_setup.update({
    where: { id },
    data: { ...setupUpdates, updated_at: new Date() }
  })
  await syncAutoconerSetupToEntry(tx, setup)
  return setup
}

// Update one setup and its same-date/shift production + stoppage snapshot atomically.
export async function updateAutoconerMachineSetup(id, updates, shift = null) {
  return prisma.$transaction(tx => persistAutoconerMachineSetup(tx, id, updates, shift))
}

// Upsert a setup only in the selected date/shift snapshot and initialize its
// dependent entry rows in the same transaction.
export async function upsertAutoconerMachineSetup(machineId, entryDate, shift, updates) {
  if (typeof machineId !== 'string' || !machineId.trim()) throw autoconerSetupError('Autoconer machine ID is required')
  const dateObj = getAutoconerEntryDateWindow(entryDate).start
  const shiftNum = Number(shift)
  if (!Number.isInteger(shiftNum) || shiftNum < 1 || shiftNum > 3) {
    throw autoconerSetupError('Autoconer shift must be 1, 2, or 3')
  }

  return prisma.$transaction(async tx => {
    const machine = await tx.autoconer_machines.findFirst({
      where: {
        id: machineId,
        ...buildAutoconerMachineVisibilityWhere(dateObj)
      },
      select: { id: true }
    })
    if (!machine) throw autoconerSetupError('The selected Autoconer machine is not active for this entry date')

    const existing = await tx.autoconer_machine_setup.findUnique({
      where: {
        idx_autoconer_machine_setup_date: {
          machine_id: machineId,
          entry_date: dateObj,
          shift: shiftNum
        }
      }
    })
    const setupValues = await resolveCompleteAutoconerSetup(tx, existing, updates)
    const setup = await tx.autoconer_machine_setup.upsert({
      where: {
        idx_autoconer_machine_setup_date: {
          machine_id: machineId,
          entry_date: dateObj,
          shift: shiftNum
        }
      },
      create: {
        machine_id: machineId,
        entry_date: dateObj,
        shift: shiftNum,
        ...setupValues,
        updated_at: new Date()
      },
      update: { ...setupValues, updated_at: new Date() }
    })
    await syncAutoconerSetupToEntry(tx, setup)
    return setup
  }, { isolationLevel: 'Serializable' })
}

// Commit the whole edited setup tab as one transaction so one bad row cannot
// leave the other rows partially saved.
export async function batchUpdateAutoconerMachineSetups(updates, shift = null) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw autoconerSetupError('At least one Autoconer setup update is required')
  }
  return prisma.$transaction(async tx => {
    const results = []
    for (const { id, machine_id, ...data } of updates) {
      const targetId = id || machine_id
      results.push(await persistAutoconerMachineSetup(tx, targetId, data, shift))
    }
    return results
  })
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
      }
    })

    const targetDetailMachineMap = {}
    targetDetails.forEach(d => {
      targetDetailMachineMap[d.id] = d.machine_id
    })

    // Copy stoppage data
    for (const targetStoppage of targetStoppages || []) {
      const machineId = targetDetailMachineMap[targetStoppage.production_detail_id]
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
    if (!dept?.id) throw new Error('AUTOCONER department not found')

    const data = await prisma.stoppage_details.findMany({
      where: {
        is_active: true,
        department_id: dept.id
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
          where: { id: { in: headIds }, is_active: true },
          select: { id: true, stoppage_head_name: true }
        })
      : []
    const headMap = {}
    heads.forEach(h => { headMap[h.id] = h.stoppage_head_name })

    return data.filter(d => !d.stoppage_head_id || headMap[d.stoppage_head_id]).map(d => ({
      id: d.id,
      stoppage_name: d.stoppage_name,
      short_code: d.short_code,
      category: d.stoppage_head_id ? (headMap[d.stoppage_head_id] || 'General') : 'General'
    }))
  } catch (error) {
    console.error('Error fetching stoppage details:', error)
    throw error
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

async function addDateScopedAutoconerMachine(machineData) {
  const entryDate = machineData?.entryDate
  if (!entryDate) throw autoconerSetupError('Autoconer entry date is required')
  const activationDate = getAutoconerEntryDateWindow(entryDate).start
  const activeShift = Number(machineData?.shift)
  if (!Number.isInteger(activeShift) || activeShift < 1 || activeShift > 3) {
    throw autoconerSetupError('Autoconer shift must be 1, 2, or 3')
  }

  const machineInput = cleanAutoconerMachineInput(machineData, { creating: true })
  if (!Number.isInteger(machineInput.no_of_drums) || machineInput.no_of_drums <= 0) {
    throw autoconerSetupError('Number of drums must be greater than zero')
  }
  if (!Number.isInteger(machineInput.speed) || machineInput.speed <= 0) {
    throw autoconerSetupError('Autoconer speed must be greater than zero')
  }
  if (!Number.isInteger(machineInput.group_id) || machineInput.group_id <= 0) {
    throw autoconerSetupError('Autoconer group ID must be greater than zero')
  }

  const result = await prisma.$transaction(async tx => {
    const activeDuplicate = await tx.autoconer_machines.findFirst({
      where: { machine_no: { equals: machineInput.machine_no }, is_active: true },
      select: { id: true }
    })
    if (activeDuplicate) {
      const error = new Error(`Machine ${machineInput.machine_no} already exists and is active`)
      error.code = 'ACTIVE_MACHINE_EXISTS'
      throw error
    }

    const selectedCount = machineData.count_id
      ? await tx.spinning_counts.findFirst({
          where: { id: machineData.count_id, is_active: true, autoconer_active: true },
          select: { id: true, count_name: true, act_count: true }
        })
      : await tx.spinning_counts.findFirst({
          where: {
            count_name: machineData.count_name || machineInput.count,
            is_active: true,
            autoconer_active: true
          },
          select: { id: true, count_name: true, act_count: true }
        })
    if (!selectedCount) throw autoconerSetupError('Select an active Autoconer spinning count')

    const runTime = machineData.run_time ?? await getAutoconerShiftTime(activeShift)
    const setupInput = validateCompleteAutoconerSetup({
      count_id: selectedCount.id,
      count_name: selectedCount.count_name,
      act_count: Number(selectedCount.act_count),
      session_no: machineData.session_no ?? 1,
      run_time: runTime
    })

    const machine = await tx.autoconer_machines.create({
      data: {
        ...machineInput,
        count: selectedCount.count_name,
        is_active: true,
        activated_at: activationDate,
        deactivated_at: null,
        updated_at: new Date()
      }
    })
    const setup = await tx.autoconer_machine_setup.create({
      data: {
        machine_id: machine.id,
        entry_date: activationDate,
        shift: activeShift,
        ...setupInput,
        updated_at: new Date()
      }
    })
    return { machine, setup }
  }, { isolationLevel: 'Serializable' })

  const headers = await prisma.autoconer_production_header.findMany({
    where: { entry_date: { gte: activationDate } },
    select: { id: true, shift: true }
  })
  for (const header of headers) {
    await syncNewMachinesToAutoconerHeader(header.id, header.shift)
  }
  return { ...result, reactivated: false, syncedHeaders: headers.length }
}

// Add autoconer machine
export async function addAutoconerMachine(machineData) {
  if (machineData?.entryDate) return addDateScopedAutoconerMachine(machineData)
  try {
    const activationDate = getAutoconerEntryDateWindow(machineData.entryDate || new Date()).start
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

    const activeShift = parseInt(machineData.shift) || 1
    const parsedRunTime = Number.parseInt(String(run_time), 10)
    const resolvedRunTime = Number.isFinite(parsedRunTime) && parsedRunTime > 0
      ? parsedRunTime
      : await getAutoconerShiftTime(activeShift)

    const { machine, setup, reactivated } = await prisma.$transaction(async tx => {
      // Check if machine already exists
      const existingMachine = await tx.autoconer_machines.findFirst({
        where: { machine_no: machine_no },
        orderBy: { is_active: 'desc' }
      })

      let machine
      let reactivated = false

    if (existingMachine) {
      if (!existingMachine.is_active) {
        // A new lifecycle row preserves the prior machine's historical active
        // interval and its production/stoppage foreign keys.
        machine = await tx.autoconer_machines.create({
          data: {
            is_active: true,
            activated_at: activationDate,
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
      machine = await tx.autoconer_machines.create({
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
          activated_at: activationDate
        }
      })
    }

    // Create or update machine setup (always create for new/reactivated machines)
      let setup = null
      if (machine) {
        // The first setup starts with this lifecycle row; do not backfill a new
        // machine into dates before it was activated.
        setup = await tx.autoconer_machine_setup.upsert({
          where: {
            idx_autoconer_machine_setup_date: {
              machine_id: machine.id,
              entry_date: activationDate,
              shift: activeShift
            }
          },
          create: {
            machine_id: machine.id,
            entry_date: activationDate,
            shift: activeShift,
            count_id: count_id || null,
            count_name: count_name || null,
            session_no: session_no || 1,
            run_time: resolvedRunTime
          },
          update: {}
        })
      }
      return { machine, setup, reactivated }
    })

    // Sync new/reactivated machine to ALL existing production headers
    const existingHeaders = await prisma.autoconer_production_header.findMany({
      where: { entry_date: { gte: activationDate } },
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
  if (!id) throw new Error('Autoconer machine ID is required')
  if (!entryDate) throw new Error('Autoconer entry date is required')
  const deactivationDate = getAutoconerEntryDateWindow(entryDate).start
  try {
    const current = await prisma.autoconer_machines.findUnique({ where: { id } })
    if (!current) throw new Error('Autoconer machine not found')
    if (!current.is_active) return current
    const data = await prisma.autoconer_machines.update({
      where: { id },
      data: { is_active: false, deactivated_at: deactivationDate, updated_at: new Date() }
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
  const toNonNegativeNumber = (value) => {
    const parsed = Number(value?.toString?.() ?? value)
    return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
  }

  // All production inputs represent physical quantities. Keep calculations
  // finite/non-negative even while a user is typing a partial value.
  actProdn = toNonNegativeNumber(actProdn)
  wasteKg = toNonNegativeNumber(wasteKg)
  idleDrum = Math.floor(toNonNegativeNumber(idleDrum))
  totalDrums = Math.floor(toNonNegativeNumber(totalDrums))
  totalStoppageMins = Math.floor(toNonNegativeNumber(totalStoppageMins))
  runTime = runTime === null || runTime === undefined || runTime === ''
    ? resolveAutoconerShiftFallbackTime(1)
    : Math.floor(toNonNegativeNumber(runTime))

  const productionTime = resolveProductionTime(runTime, totalStoppageMins)
  const workTime = productionTime.workTime
  totalStoppageMins = productionTime.stoppageTime
  runTime = productionTime.totalTime

  // Calculate Waste % = (Waste Kg / Act Prodn) × 100
  const wastePercent = actProdn > 0 ? (wasteKg / actProdn) * 100 : null

  // Calculate Idle Drum % = (Idle Drum / Total Drum) × 100
  const effectiveIdleDrum = Math.min(Math.max(idleDrum, 0), totalDrums)
  const idleDrumPercent = totalDrums > 0 ? (effectiveIdleDrum / totalDrums) * 100 : 0

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
