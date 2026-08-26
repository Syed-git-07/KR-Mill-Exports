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
import { addMachineToEntrySnapshot, assertEntryDetailUnlocked, assertEntryHeaderUnlocked, assertEntrySetupUnlocked, assertEntryStoppageUnlocked, removeMachineFromEntrySnapshot } from './entryMachineSnapshot'
import { resolveAutoconerShiftFallbackTime } from '../autoconerShiftFallback'
import { findFirstFreeStoppageSlot } from '../stoppageSlotUtils'
import { resolveProductionTime } from '../productionFormulaMath'
import { sanitizeProductionDetailUpdate } from './productionDetailUpdate'
import { preparePayrollEmployeeUpdate } from '../payroll/employeeSelection'
import { getActiveProductionSupervisors, validateProductionSupervisorIds, validateProductionSupervisorUpdate } from './productionSupervisorQueries'
import { sanitizeEntryHeaderUpdate, sanitizeEntrySetupUpdate, sanitizeEntryStoppageUpdate } from './entryUpdateValidation'
import { buildAutoconerCountSnapshot, mergeCountSnapshotWithEntryEdits } from '../countMasterSnapshots'
import { machineAvailableOnDateWhere, machineLookupWhere } from '../machineLifecycle'
import { findPreviousEntrySetupSnapshot } from './dateScopedMachineSetup'

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
  await validateProductionSupervisorIds(headerData?.supervisor_id, headerData?.maisitry_id)
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
  await assertEntryHeaderUnlocked('autoconer', id)
  updates = sanitizeEntryHeaderUpdate(updates)
  await validateProductionSupervisorUpdate(updates)
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
    try {
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
    } catch (error) {
      const racedHeader = await getAutoconerProductionByDateShift(date, shift)
      if (racedHeader) return racedHeader
      throw error
    }
  }

  return header
}

// ============================================
// PRODUCTION DETAIL OPERATIONS
// ============================================

// Initialize production details for all active machines
// Now accepts shift parameter to determine correct runtime (like Carding)
async function initializeAutoconerProductionDetails(headerId, shift = 1) {
  try {
    // Fetch entry_date from header for date-range visibility
    const header = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true }
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
        ...machineAvailableOnDateWhere(entryDate)
      },
      orderBy: [
        { group_id: 'asc' },
        { machine_no: 'asc' }
      ]
    })

    if (!machines || machines.length === 0) return

    // Get existing production details for this header
    const existingDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId },
      select: { machine_id: true }
    })
    const existingMachineIds = new Set(existingDetails.map(d => d.machine_id))

    // Filter out machines that already have entries
    const newMachines = machines.filter(m => !existingMachineIds.has(m.id))

    if (newMachines.length === 0) return existingDetails

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Get shift-specific runtime from configuration (like Carding)
    // Shift 1: 510 mins, Shift 2: 510 mins, Shift 3: 420 mins
    const totalTime = await getAutoconerShiftTime(shift)
    const defaultStoppage = await getAutoconerDefaultStoppage(shift)
    const defaultWorkTime = totalTime - defaultStoppage

    // Create production detail for each NEW machine with shift-specific times
    const detailInserts = newMachines.map(m => {
      const setup = setupMap[m.id] || {}

      return {
        header_id: headerId,
        machine_id: m.id,
        count_name: setup.count_name || null,
        count_id: setup.count_id || null,
        session_no: setup.session_no || 1,
        prodn_effi: 0,
        waste_kg: 0,
        waste_percent: null,
        run_time: totalTime,               // Shift-specific runtime
        work_time: defaultWorkTime,        // Runtime - stoppage
        total_stoppage_mins: defaultStoppage  // Shift-specific default stoppage
      }
    })

    await prisma.autoconer_production_detail.createMany({
      data: detailInserts,
      skipDuplicates: true
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
      data: stoppageInserts,
      skipDuplicates: true
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
        ...machineAvailableOnDateWhere(entryDate)
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
    // Existing detail rows are entry snapshots. Master revisions and later
    // deactivations must not delete or replace them.
    const remainingMachineIds = existingMachineIds

    // 6. Add only truly new machines
    const newMachines = machines.filter(m => !remainingMachineIds.includes(m.id))
    if (newMachines.length === 0) return []

    // 7. Map setups
    const setupMap = {}
    setups.forEach(s => { setupMap[s.machine_id] = s })

    const totalTime = await getAutoconerShiftTime(shift)
    const defaultStoppage = await getAutoconerDefaultStoppage(shift)
    const defaultWorkTime = totalTime - defaultStoppage

    const detailInserts = newMachines.map(m => {
      const setup = setupMap[m.id] || {}

      return {
        header_id: headerId,
        machine_id: m.id,
        count_name: setup.count_name || null,
        count_id: setup.count_id || null,
        session_no: setup.session_no || 1,
        prodn_effi: 0,
        waste_kg: 0,
        waste_percent: null,
        run_time: totalTime,
        work_time: defaultWorkTime,
        total_stoppage_mins: defaultStoppage
      }
    })

    await prisma.autoconer_production_detail.createMany({ data: detailInserts, skipDuplicates: true })

    const createdDetails = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId, machine_id: { in: newMachines.map(m => m.id) } }
    })

    const stoppageInserts = createdDetails.map(d => ({
      production_detail_id: d.id,
      run_time: totalTime,
      total_stoppage_time: defaultStoppage
    }))

    await prisma.autoconer_stoppage_entry.createMany({ data: stoppageInserts, skipDuplicates: true })

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
      select: { entry_date: true, shift: true }
    })
    const entryDate = header?.entry_date || new Date()

    const data = await prisma.autoconer_production_detail.findMany({
      where: { header_id: headerId }
    })

    if (!data || data.length === 0) return []

    const machineIds = data.map(d => d.machine_id)
    const detailIds = data.map(d => d.id)

    const [machines, stoppages, setups] = await Promise.all([
      prisma.autoconer_machines.findMany({
        where: { id: { in: machineIds } },
        select: {
          id: true,
          machine_no: true,
          group_id: true,
          from_drum: true,
          to_drum: true,
          no_of_drums: true,
          make_name: true,
          is_active: true,
          activated_at: true,
          deactivated_at: true
        }
      }),
      prisma.autoconer_stoppage_entry.findMany({
        where: { production_detail_id: { in: detailIds } }
      }),
      prisma.autoconer_machine_setup.findMany({
        where: {
          machine_id: { in: machineIds },
          entry_date: entryDate,
          shift: header?.shift || 1
        }
      })
    ])

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const stoppageMap = {}
    stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s })

    const setupMap = {}
    setups?.forEach(setup => { setupMap[setup.machine_id] = setup })

    const enriched = data.map(detail => ({
      ...detail,
      machine: machineMap[detail.machine_id] || null,
      setup: setupMap[detail.machine_id] || null,
      stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
    }))

    // Apply date-range visibility filter (preserve historical data correctly)
    // A production detail points at the exact machine-master revision that was
    // current when the entry was created. Do not hide or replace that snapshot
    // merely because a newer revision is now active.
    const filtered = enriched.filter(detail => !!detail.machine)

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
  await assertEntryDetailUnlocked('autoconer', id)
  try {
    const current = await prisma.autoconer_production_detail.findUnique({
      where: { id },
      select: { emp_name: true, payroll_employee_id: true }
    })
    const prepared = await preparePayrollEmployeeUpdate(updates, current, [
      { nameField: 'emp_name', idField: 'payroll_employee_id' }
    ])
    // Note: Front-end now calculates all values using calculateAutoconerProductionValues()
    // Backend simply saves the data (like carding module)
    const data = await prisma.autoconer_production_detail.update({
      where: { id },
      data: sanitizeProductionDetailUpdate(prepared)
    })
    return data
  } catch (error) {
    throw error
  }
}

// Batch update production details
export async function batchUpdateAutoconerProductionDetails(updates) {
  await Promise.all(updates.map(({ id }) => assertEntryDetailUnlocked('autoconer', id)))
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
    const header = await prisma.autoconer_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true }
    })
    const details = await prisma.autoconer_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    if (!details || details.length === 0) return []

    const detailIds = details.map(d => d.id)
    const machineIds = details.map(d => d.machine_id)

    const [stoppages, machines, setups] = await Promise.all([
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
          is_active: true,
          activated_at: true,
          deactivated_at: true
        }
      }),
      header
        ? prisma.autoconer_machine_setup.findMany({
          where: {
            machine_id: { in: machineIds },
            entry_date: header.entry_date,
            shift: header.shift
          }
        })
        : []
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

    const setupMap = {}
    setups.forEach(setup => { setupMap[setup.machine_id] = setup })

    const reasonMap = {}
    reasons.forEach(r => { reasonMap[r.id] = r })

    const data = stoppages.map(s => {
      const detail = detailMap[s.production_detail_id]
      return {
        ...s,
        production_detail: detail
          ? {
            ...detail,
            machine: machineMap[detail.machine_id] || null,
            setup: setupMap[detail.machine_id] || null
          }
          : null,
        stoppage1: reasonMap[s.stoppage1_id] || null,
        stoppage2: reasonMap[s.stoppage2_id] || null,
        stoppage3: reasonMap[s.stoppage3_id] || null,
        stoppage4: reasonMap[s.stoppage4_id] || null
      }
    })

    // Preserve the machine revision referenced by this historical detail.
    const filtered = (data || []).filter(entry => !!entry.production_detail?.machine)

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
  await assertEntryStoppageUnlocked('autoconer', id)
  updates = sanitizeEntryStoppageUpdate(updates)
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
      select: { header_id: true, machine_id: true, idle_drum: true }
    })

    const header = detail?.header_id
      ? await prisma.autoconer_production_header.findUnique({
        where: { id: detail.header_id },
        select: { shift: true }
      })
      : null

    const totalTime = await getAutoconerShiftTime(header?.shift || 1)
    const machine = detail?.machine_id
      ? await prisma.autoconer_machines.findUnique({
        where: { id: detail.machine_id },
        select: { no_of_drums: true }
      })
      : null
    const calculated = calculateAutoconerProductionValues(
      0,
      0,
      detail?.idle_drum ?? 0,
      machine?.no_of_drums ?? 0,
      totalStoppage,
      totalTime
    )

    await prisma.autoconer_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        total_stoppage_mins: calculated.total_stoppage_mins,
        work_time: calculated.work_time,
        run_time: calculated.run_time
      }
    })

    return data
  } catch (error) {
    throw error
  }
}

// Apply full stoppage to all machines (with slot selection like Carding)
export async function applyFullStoppage(headerId, stoppageId, stoppageTime) {
  await assertEntryHeaderUnlocked('autoconer', headerId)
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
  await assertEntryHeaderUnlocked('autoconer', headerId)
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

// Get or create dated setup snapshots. Machine identity/count defaults come
// from the current masters; permitted operational fields retain the old flow.
export async function getOrCreateAutoconerMachineSetups(entryDate, shift = 1) {
  try {
    const dateObj = new Date(entryDate)
    const shiftNum = parseInt(shift)
    const targetShiftTime = shiftNum === 3 ? 420 : 510

    // 1. Try to find setups for this exact date and shift
    let setups = await prisma.autoconer_machine_setup.findMany({
      where: {
        entry_date: dateObj,
        shift: shiftNum
      }
    })

    if (setups.length > 0) {
      return setups.filter(setup => setup.is_included)
    }

    // 2. Copy one exact prior entry structure. Per-machine latest lookups can
    // blend several old entries and are not a valid snapshot source.
    const previousSnapshot = await findPreviousEntrySetupSnapshot({
      headerModel: prisma.autoconer_production_header,
      setupModel: prisma.autoconer_machine_setup,
      entryDate: dateObj,
      shift: shiftNum
    })
    const previousHeader = previousSnapshot.header

    if (previousHeader) {
      const prevSetups = previousSnapshot.rows

      // Master edits create a new machine revision. Carry the setup forward to
      // that active revision, while historical production keeps the old one.
      const previousMachineIds = [...new Set(prevSetups.map(s => s.machine_id))]
      const previousMachines = await prisma.autoconer_machines.findMany({
        where: { id: { in: previousMachineIds } },
        select: { id: true, mc_id: true, machine_no: true, count_id: true }
      })
      const activeMachines = await prisma.autoconer_machines.findMany({
        where: {
          ...machineAvailableOnDateWhere(dateObj)
        },
        select: { id: true, mc_id: true, machine_no: true, count_id: true }
      })
      const previousMachineMap = new Map(previousMachines.map(machine => [machine.id, machine]))
      const activeByMcId = new Map(activeMachines.filter(machine => machine.mc_id != null).map(machine => [machine.mc_id, machine]))
      const activeByMachineNo = new Map(activeMachines.map(machine => [machine.machine_no, machine]))

      const sourceCountIds = [...new Set(prevSetups.map(setup => setup.count_id).filter(Boolean))]
      const sourceCountNames = [...new Set(prevSetups.map(setup => setup.count_name).filter(Boolean))]
      const currentCounts = sourceCountIds.length || sourceCountNames.length
        ? await prisma.spinning_counts.findMany({
            where: {
              OR: [
                ...(sourceCountIds.length ? [{ id: { in: sourceCountIds } }] : []),
                ...(sourceCountNames.length ? [{ count_name: { in: sourceCountNames } }] : [])
              ]
            }
          })
        : []
      const countById = new Map(currentCounts.map(count => [count.id, count]))
      const countByName = new Map(currentCounts.map(count => [count.count_name, count]))

      const cloneDataMap = new Map()

      prevSetups.forEach(s => {
        const { id, created_at, updated_at, ...rest } = s
        const previousMachine = previousMachineMap.get(s.machine_id)
        
        // If the machine doesn't exist in the DB anymore (e.g., due to data migration), skip it
        if (!previousMachine) return
        
        const activeMachine = activeByMcId.get(previousMachine.mc_id) || activeByMachineNo.get(previousMachine.machine_no)
        const targetMachineId = activeMachine?.id || previousMachine.id
        const currentCount = countById.get(s.count_id) || countByName.get(s.count_name)
        
        // Avoid duplicate machine_ids which cause 'A record with this value already exists'
        if (!cloneDataMap.has(targetMachineId)) {
          cloneDataMap.set(targetMachineId, {
            ...rest,
            is_included: s.is_included !== false && !!activeMachine,
            machine_id: targetMachineId,
            ...(currentCount ? buildAutoconerCountSnapshot(currentCount) : {}),
            entry_date: dateObj,
            shift: shiftNum,
            run_sequence: 1,
            run_time: targetShiftTime
          })
        }
      })

      // Entry membership comes only from the previous entry snapshot. Creating
      // a Master machine does not enroll it; "Add Master Machine" does that.
      
      const cloneData = Array.from(cloneDataMap.values())

      if (cloneData.length > 0) {
        await prisma.autoconer_machine_setup.createMany({
          data: cloneData,
          skipDuplicates: true
        })
      }

      return await prisma.autoconer_machine_setup.findMany({
        where: {
          entry_date: dateObj,
          shift: shiftNum,
          is_included: true
        }
      })
    }

    // 3. Fallback: Initialize default setups for all active machines on the entry date
    const activeMachines = await prisma.autoconer_machines.findMany({
      where: {
        ...machineAvailableOnDateWhere(dateObj)
      },
      orderBy: { is_active: 'desc' }
    })

    const countIds = [...new Set(activeMachines.map(machine => machine.count_id).filter(Boolean))]
    const counts = countIds.length
      ? await prisma.spinning_counts.findMany({ where: { id: { in: countIds } } })
      : []
    const countById = new Map(counts.map(count => [count.id, count]))

    const defaultSetups = activeMachines.map(m => {
      const matchedCount = countById.get(m.count_id)
      return {
        machine_id: m.id,
        is_included: true,
        entry_date: dateObj,
        shift: shiftNum,
        ...buildAutoconerCountSnapshot(matchedCount),
        session_no: 1,
        run_time: targetShiftTime
      }
    })

    if (defaultSetups.length > 0) {
      await prisma.autoconer_machine_setup.createMany({
        data: defaultSetups,
        // Concurrent page loads can both observe an empty setup list. Let the
        // database keep the first row for each machine/date/shift combination.
        skipDuplicates: true
      })
    }

    return await prisma.autoconer_machine_setup.findMany({
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

const autoconerSetupFields = new Set([
  'count_id', 'count_name', 'act_count', 'speed', 'target_effi',
  'session_no', 'run_time'
])
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

async function prepareAutoconerSetupUpdate(db, updates) {
  const clean = Object.fromEntries(
    Object.entries(updates).filter(([key]) => autoconerSetupFields.has(key))
  )
  const changesCount = owns(clean, 'count_id') || owns(clean, 'count_name')
  if (!changesCount) return { data: clean, changesCount: false }

  const countId = clean.count_id || null
  const countName = clean.count_name || null
  const count = countId || countName
    ? await db.spinning_counts.findFirst({
        where: {
          is_active: true,
          autoconer_active: true,
          ...(countId ? { id: countId } : { count_name: countName })
        }
      })
    : null
  if ((countId || countName) && !count) throw new Error('Selected Autoconer count is not active')
  return {
    data: mergeCountSnapshotWithEntryEdits(buildAutoconerCountSnapshot(count), clean),
    changesCount: true
  }
}

async function syncAutoconerSetupCountToDetail(db, setup) {
  const headers = await db.autoconer_production_header.findMany({
    where: { entry_date: setup.entry_date, shift: setup.shift },
    select: { id: true }
  })
  const headerIds = headers.map(header => header.id)
  if (headerIds.length === 0) return
  await db.autoconer_production_detail.updateMany({
    where: { machine_id: setup.machine_id, header_id: { in: headerIds } },
    data: { count_id: setup.count_id, count_name: setup.count_name }
  })
}

async function updateAutoconerSetupInTransaction(db, id, updates) {
  const existing = await db.autoconer_machine_setup.findUnique({ where: { id } })
  if (!existing) throw new Error('Autoconer machine setup not found')
  const prepared = await prepareAutoconerSetupUpdate(db, updates)
  const result = await db.autoconer_machine_setup.update({
    where: { id },
    data: { ...prepared.data, updated_at: new Date() }
  })
  if (prepared.changesCount) await syncAutoconerSetupCountToDetail(db, result)
  return result
}

export async function updateAutoconerMachineSetup(id, updates) {
  await assertEntrySetupUnlocked('autoconer', id)
  updates = sanitizeEntrySetupUpdate(updates)
  return prisma.$transaction(tx => updateAutoconerSetupInTransaction(tx, id, updates))
}

// Upsert machine setup by machine_id, entryDate, and shift
export async function upsertAutoconerMachineSetup(machineId, entryDate, shift, updates) {
  return prisma.$transaction(async tx => {
    const dateObj = new Date(entryDate)
    const shiftNum = parseInt(shift)
    const header = await tx.autoconer_production_header.findFirst({
      where: { entry_date: dateObj, shift: shiftNum },
      select: { is_locked: true }
    })
    if (!header) throw new Error('Entry not found')
    if (header.is_locked) throw new Error('This entry is locked and cannot be changed')
    const prepared = await prepareAutoconerSetupUpdate(tx, sanitizeEntrySetupUpdate(updates))
    const data = await tx.autoconer_machine_setup.upsert({
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
        ...prepared.data,
        is_included: true
      },
      update: { ...prepared.data, is_included: true }
    })
    if (prepared.changesCount) await syncAutoconerSetupCountToDetail(tx, data)
    return data
  })
}

// Batch update machine setups
export async function batchUpdateAutoconerMachineSetups(updates, shift = null) {
  await Promise.all(updates.map(({ id }) => assertEntrySetupUnlocked('autoconer', id)))
  return prisma.$transaction(async tx => {
    const results = []
    for (const { id, machine_id: _machineId, ...data } of updates) {
      results.push(await updateAutoconerSetupInTransaction(tx, id, sanitizeEntrySetupUpdate(data)))
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
        effi_actual_prodn: true,
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
// ADDITIONAL HELPER FUNCTIONS
// ============================================

// Get supervisors
export async function getSupervisors() {
  return getActiveProductionSupervisors()
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
export async function lookupAutoconerMachineByNo(machineNo, entryDate = null) {
  try {
    // MySQL TEXT columns are case-insensitive by default — no need for mode: 'insensitive'
    const data = await prisma.autoconer_machines.findFirst({
      where: machineLookupWhere(machineNo, entryDate),
      orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }]
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

    const selectedCount = count_id || count_name
      ? await prisma.spinning_counts.findFirst({
          where: {
            is_active: true,
            autoconer_active: true,
            ...(count_id ? { id: count_id } : { count_name })
          }
        })
      : null
    if ((count_id || count_name) && !selectedCount) {
      throw new Error('Selected Autoconer count is not active')
    }

    // Check if machine already exists
    const existingMachine = await prisma.autoconer_machines.findFirst({
      where: { machine_no: machine_no },
      orderBy: { is_active: 'desc' }
    })

    let machine
    let reactivated = false

    if (existingMachine) {
      if (!existingMachine.is_active) {
        // Create a new active revision so historical entries keep the old row.
        machine = await prisma.autoconer_machines.create({
          data: {
            machine_no,
            is_active: true,
            activated_at: new Date(),
            deactivated_at: null,
            description: description || machine_no,
            make_name: make_name || 'MURT',
            model,
            from_drum,
            to_drum,
            no_of_drums,
            speed: null,
            count: selectedCount?.count_name ?? null,
            count_id: selectedCount?.id ?? null,
            act_effi: null,
            installed_date,
            mc_id,
            group_id,
            direct_prod_entry: direct_prod_entry || false
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
          speed: null,
          count: selectedCount?.count_name ?? null,
          count_id: selectedCount?.id ?? null,
          act_effi: null,
          installed_date,
          direct_prod_entry: direct_prod_entry || false,
          is_active: true,
          activated_at: new Date()
        }
      })
    }

    // Create only the requested entry snapshot. Count-dependent values are
    // resolved from Count Master and never duplicated in the machine master.
    let setup = null
    if (machine && machineData.entryDate) {
      // Resolve setup runtime from payload first; fallback from shift_config (shift 1) if missing.
      const activeShift = parseInt(machineData.shift) || 1
      const parsedRunTime = Number.parseInt(String(run_time), 10)
      const resolvedRunTime = Number.isFinite(parsedRunTime) && parsedRunTime > 0
        ? parsedRunTime
        : await getAutoconerShiftTime(activeShift)

      setup = await upsertAutoconerMachineSetup(
        machine.id,
        machineData.entryDate,
        activeShift,
        {
          ...buildAutoconerCountSnapshot(selectedCount),
          ...(speed != null && speed !== '' && { speed: Number(speed) }),
          ...(act_effi != null && act_effi !== '' && { target_effi: Number(act_effi) }),
          session_no: session_no || 1,
          run_time: resolvedRunTime
        }
      )
    }

    // Sync only the entry in which the machine was added. Older entries remain
    // independent snapshots.
    const existingHeaders = machineData.entryDate
      ? await prisma.autoconer_production_header.findMany({
          where: {
            entry_date: new Date(machineData.entryDate),
            shift: parseInt(machineData.shift) || 1
          },
          select: { id: true, shift: true }
        })
      : []

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
export async function addAutoconerEntryMachine(machineData) {
  const targetHeader = await prisma.autoconer_production_header.findUnique({
    where: { id: machineData.headerId },
    select: { entry_date: true }
  })
  if (!targetHeader) throw new Error('Production entry not found')
  const masterMachine = await prisma.autoconer_machines.findFirst({
    where: machineData.machine_id
      ? { id: machineData.machine_id }
      : machineLookupWhere(machineData.machine_no, targetHeader.entry_date),
    orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }],
    select: { count_id: true, count: true }
  })
  if (!masterMachine) throw new Error('Machine does not exist in Machine Master for this entry date')
  const requestedCountId = machineData.count_id || masterMachine?.count_id
  const requestedCountName = machineData.count_name || masterMachine?.count
  const selectedCount = requestedCountId || requestedCountName
    ? await prisma.spinning_counts.findFirst({
        where: {
          is_active: true,
          autoconer_active: true,
          ...(requestedCountId ? { id: requestedCountId } : { count_name: requestedCountName })
        }
      })
    : null
  if ((requestedCountId || requestedCountName) && !selectedCount) {
    throw new Error('Selected Autoconer count is not active')
  }
  const result = await addMachineToEntrySnapshot('autoconer', machineData.headerId, {
    machineId: machineData.machine_id,
    machineNo: machineData.machine_no,
    setupOverrides: {
      ...machineData,
      ...(selectedCount && buildAutoconerCountSnapshot(selectedCount))
    }
  })
  await syncNewMachinesToAutoconerHeader(machineData.headerId, result.header.shift)
  return { ...result, reactivated: false, entryOnly: true }
}

export async function removeAutoconerMachine(id, headerId) {
  return removeMachineFromEntrySnapshot('autoconer', headerId, id)
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
  idleDrum = Math.max(parseInt(idleDrum) || 0, 0)
  totalDrums = Math.max(parseInt(totalDrums) || 0, 0)
  totalStoppageMins = parseInt(totalStoppageMins) || 0
  runTime = parseInt(runTime) || resolveAutoconerShiftFallbackTime(1)

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

  // UTI % = (effective run time / total shift time) × (1 - idle drums / total drums) × 100
  const utiPercent = runTime > 0
    ? (workTime / runTime) * (1 - (totalDrums > 0 ? effectiveIdleDrum / totalDrums : 0)) * 100
    : 0

  return {
    waste_percent: wastePercent === null ? null : Math.round(wastePercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 1000) / 1000,
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
