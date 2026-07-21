import { prisma } from '../prisma'
import { resolveCardingShiftFallbackTime } from '../cardingShiftFallback'
import { calculateCardingStdProdn, resolveCardingFormulaInputs } from '../cardingFormulaFallback'

function isCardingMachineVisibleOnDate(machine, entryDate) {
  if (!machine) return false
  if (machine.activated_at && new Date(machine.activated_at) > entryDate) return false
  if (machine.deactivated_at && new Date(machine.deactivated_at) <= entryDate) return false
  return true
}

// ============================================
// SHIFT CONFIGURATION QUERIES
// ============================================

// Get shift configuration for a department and shift
export async function getShiftConfig(departmentCode, shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: departmentCode,
        shift: shift,
        is_active: true
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Get all shift configurations for a department
export async function getAllShiftConfigs(departmentCode) {
  try {
    const data = await prisma.shift_config.findMany({
      where: {
        department_code: departmentCode,
        is_active: true
      },
      orderBy: {
        shift: 'asc'
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Get shift time for carding based on shift number
// Primary source: shift_config. Fallback is centralized helper only.
export async function getCardingShiftTime(shift) {
  const config = await getShiftConfig('CARDING', shift)
  return config?.shift_time || resolveCardingShiftFallbackTime(shift)
}

// No default stoppage for carding - always 0
export async function getCardingDefaultStoppage(shift) {
  return 0
}

// ============================================
// CARDING PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers with supervisor info
export async function getCardingProductionHeaders() {
  try {
    const data = await prisma.carding_production_header.findMany({
      orderBy: {
        entry_date: 'desc'
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Get production header by date and shift
export async function getCardingProductionByDateShift(date, shift) {
  try {
    const data = await prisma.carding_production_header.findFirst({
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

// Create or get production header
export async function getOrCreateProductionHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getCardingProductionByDateShift(date, shift)
  if (existing) return existing

  // Get shift-specific total time from configuration
  const shiftTime = await getCardingShiftTime(shift)

  // Create new header
  try {
    const data = await prisma.carding_production_header.create({
      data: {
        entry_date: new Date(date),
        shift: shift,
        supervisor_id: supervisorId || null,
        maisitry_id: maisitryId || null,
        total_time: shiftTime
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update production header
export async function updateProductionHeader(id, updates) {
  try {
    const data = await prisma.carding_production_header.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// CARDING PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getCardingProductionDetails(headerId) {
  try {
    const data = await prisma.carding_production_detail.findMany({
      where: { header_id: headerId }
    })

    if (!data || data.length === 0) return []

    const machineIds = data.map(d => d.machine_id).filter(Boolean)
    const machines = machineIds.length > 0
      ? await prisma.carding_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            description: true,
            prodn_mixing: true,
            is_active: true,
            activated_at: true,
            deactivated_at: true,
            sort_order: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const header = await prisma.carding_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    return data
      .map(detail => ({
        ...detail,
        machine: machineMap[detail.machine_id] || null
      }))
      .filter(detail => isCardingMachineVisibleOnDate(detail.machine, entryDate))
      .sort((a, b) => (a.machine?.sort_order || 9999) - (b.machine?.sort_order || 9999))
  } catch (error) {
    throw error
  }
}

// Get production details with machine setup for a header (for display)
export async function getCardingProductionWithSetup(headerId) {
  try {
    const data = await prisma.carding_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    if (!data || data.length === 0) return []

    const detailIds = data.map(d => d.id)
    const machineIds = data.map(d => d.machine_id).filter(Boolean)

    const [machines, stoppages] = await Promise.all([
      machineIds.length > 0
        ? prisma.carding_machines.findMany({
            where: { id: { in: machineIds } },
            select: {
              id: true,
              machine_no: true,
              description: true,
              prodn_mixing: true,
              mc_id: true,
              is_active: true,
              activated_at: true,
              deactivated_at: true,
              sort_order: true
            }
          })
        : Promise.resolve([]),
      detailIds.length > 0
        ? prisma.carding_stoppage_entry.findMany({
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
        : Promise.resolve([])
    ])

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const stoppageMap = {}
    stoppages.forEach(s => {
      stoppageMap[s.production_detail_id] = s
    })

    const enriched = data.map(detail => ({
      ...detail,
      machine: machineMap[detail.machine_id] || null,
      stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
    }))

    // Sort by natural machine number order (CA1, CA2, ... CA10, CA11)
    const sorted = enriched?.sort((a, b) => {
      const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
      const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
      return aNum - bNum
    }) || []

    // Apply date-visibility filter: hide machines not active on this entry date
    const hdrForDate = await prisma.carding_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = hdrForDate?.entry_date || new Date()

    return sorted.filter(detail => isCardingMachineVisibleOnDate(detail.machine, entryDate))
  } catch (error) {
    throw error
  }
}

// Helper to fetch inherited machine setups from the chronologically prior shift/date's production details
export async function getCardingInheritedMachineSetups(dateObj, shiftNum, headerId) {
  try {
    const d = new Date(dateObj)
    const s = parseInt(shiftNum)

    // Find the most recent chronologically entered header prior to (d, s)
    const priorHeader = await prisma.carding_production_header.findFirst({
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
    const details = await prisma.carding_production_detail.findMany({
      where: { header_id: priorHeader.id },
      select: {
        machine_id: true,
        count_mixing: true,
        employee_name: true,
        session_no: true,
        waste: true
      }
    })

    // Convert to map: machine_id -> { count_mixing, employee_name, session_no, waste }
    const inheritedMap = {}
    details.forEach(detail => {
      inheritedMap[detail.machine_id] = {
        count_mixing: detail.count_mixing,
        employee_name: detail.employee_name,
        session_no: detail.session_no,
        waste: detail.waste
      }
    })

    return inheritedMap
  } catch (error) {
    console.error('Error in getCardingInheritedMachineSetups:', error)
    return {}
  }
}

// Initialize production details for all carding machines visible on the entry date
// Now accepts shift parameter to determine correct runtime
export async function initializeProductionDetails(headerId, shift = 1) {
  try {
    // Get entry_date from the header
    const header = await prisma.carding_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    // Check if details already exist for this header
    const existingDetails = await prisma.carding_production_detail.findMany({
      where: { header_id: headerId },
      select: { machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Get setups scoped strictly by the entry date and shift
    const setups = await getOrCreateCardingMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get all carding machines visible on the entry date that have a setup entry
    const machines = await prisma.carding_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        activated_at: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: { mc_id: 'asc' }
    })

    // Filter out machines that already have entries
    const newMachines = machines.filter(m => !existingMachineIds.includes(m.id))

    // If all machines already have entries, return early
    if (newMachines.length === 0) {
      return existingDetails
    }

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Fetch inherited machine setups from the chronologically prior shift/date's production details
    const inheritedSetups = await getCardingInheritedMachineSetups(entryDate, shift, headerId)

    // Get shift-specific runtime from configuration (DB-first + centralized fallback)
    const totalTime = await getCardingShiftTime(shift)
    const defaultStoppage = await getCardingDefaultStoppage(shift)
    const defaultWorkTime = totalTime - defaultStoppage
    const defaultUti = Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100
    
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const inherited = inheritedSetups[machine.id] || {}

      const countMixing = inherited.count_mixing !== undefined ? inherited.count_mixing : (machine.prodn_mixing || '64COMBED GOLD')
      const employeeName = inherited.employee_name !== undefined ? inherited.employee_name : null
      const sessionNo = inherited.session_no !== undefined ? inherited.session_no : 1
      const wasteVal = inherited.waste !== undefined && inherited.waste !== null ? inherited.waste : (setup.default_waste ?? null)

      const fallbackStdProdn = calculateCardingStdProdn(setup, totalTime)
      return {
        header_id: headerId,
        machine_id: machine.id,
        count_mixing: countMixing,
        employee_name: employeeName,
        act_hank: 0,
        act_prodn: 0,
        std_prodn: setup.std_prodn ?? fallbackStdProdn,
        exp_prodn: 0,
        effi_percent: 0,
        uti_percent: defaultUti,
        waste: wasteVal,
        waste_percent: 0,
        run_time: totalTime, // Shift-specific runtime
        work_time: defaultWorkTime, // Runtime - stoppage
        total_stoppage_mins: defaultStoppage, // Shift-specific default stoppage
        session_no: sessionNo
      }
    })

    await prisma.carding_production_detail.createMany({
      data: details
    })

    // Get the created details (only new ones)
    const createdDetails = await prisma.carding_production_detail.findMany({
      where: { 
        header_id: headerId,
        machine_id: { in: newMachines.map(m => m.id) }
      }
    })

    // Initialize stoppage entries for each NEW detail only
    const stoppageEntries = createdDetails.map(detail => ({
      production_detail_id: detail.id,
      stoppage1_time: defaultStoppage,  // Shift-specific default stoppage
      total_stoppage_time: defaultStoppage
    }))

    await prisma.carding_stoppage_entry.createMany({
      data: stoppageEntries
    })

    // Return all details (existing + new)
    return await prisma.carding_production_detail.findMany({
      where: { header_id: headerId }
    })
  } catch (error) {
    throw error
  }
}

// Sync newly added machines to an existing production header
// This function adds production details for machines that don't have entries yet
export async function syncNewMachinesToHeader(headerId, shift = 1) {
  try {
    // Get shift-based time values (MUST await async functions)
    const totalTime = await getCardingShiftTime(shift)
    const defaultStoppage = await getCardingDefaultStoppage(shift)
    const defaultWorkTime = totalTime - defaultStoppage
    const defaultUti = Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100

    // Get entry_date from the header for date-based machine visibility
    const headerForDate = await prisma.carding_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = headerForDate?.entry_date || new Date()

    // Get setups scoped strictly by the entry date and shift
    const setups = await getOrCreateCardingMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get all carding machines visible on this entry date that have a setup entry
    const machines = await prisma.carding_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        activated_at: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: { mc_id: 'asc' }
    })

    // Get existing production details for this header
    const existingDetails = await prisma.carding_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Delete rows for machines that are no longer visible on the entry date or have no setup
    const allExistingMachines = existingMachineIds.length > 0
      ? await prisma.carding_machines.findMany({
          where: { id: { in: existingMachineIds } }
        })
      : []
    const existingMachineMap = {}
    allExistingMachines.forEach(m => { existingMachineMap[m.id] = m })

    const deactivatedDetailIds = existingDetails
      .filter(d => {
        const m = existingMachineMap[d.machine_id]
        if (!m) return false
        if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return true
        if (!machineIdsWithSetup.includes(m.id)) return true  // remove rows for master-only machines (no setup)
        return false
      })
      .map(d => d.id)

    if (deactivatedDetailIds.length > 0) {
      await prisma.carding_stoppage_entry.deleteMany({
        where: { production_detail_id: { in: deactivatedDetailIds } }
      })
      await prisma.carding_production_detail.deleteMany({
        where: { id: { in: deactivatedDetailIds } }
      })
    }

    // Find only truly new machines (after cleanup)
    const remainingMachineIds = existingDetails
      .filter(d => !deactivatedDetailIds.includes(d.id))
      .map(d => d.machine_id)

    // Find machines that don't have entries
    const newMachines = machines?.filter(m => !remainingMachineIds.includes(m.id)) || []

    if (newMachines.length === 0) {
      return { added: 0, machines: [] }
    }

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Fetch inherited machine setups from the chronologically prior shift/date's production details
    const inheritedSetups = await getCardingInheritedMachineSetups(entryDate, shift, headerId)

    // Create detail records for new machines (using shift-based values calculated above)
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const inherited = inheritedSetups[machine.id] || {}

      const countMixing = inherited.count_mixing !== undefined ? inherited.count_mixing : (machine.prodn_mixing || '64COMBED GOLD')
      const employeeName = inherited.employee_name !== undefined ? inherited.employee_name : null
      const sessionNo = inherited.session_no !== undefined ? inherited.session_no : 1
      const wasteVal = inherited.waste !== undefined && inherited.waste !== null ? inherited.waste : (setup.default_waste ?? null)

      const fallbackStdProdn = calculateCardingStdProdn(setup, totalTime)
      return {
        header_id: headerId,
        machine_id: machine.id,
        count_mixing: countMixing,
        employee_name: employeeName,
        act_hank: 0,
        act_prodn: 0,
        std_prodn: setup.std_prodn ?? fallbackStdProdn,
        exp_prodn: 0,
        effi_percent: 0,
        uti_percent: defaultUti,
        waste: wasteVal,
        waste_percent: 0,
        run_time: totalTime,
        work_time: defaultWorkTime,
        total_stoppage_mins: defaultStoppage,
        session_no: sessionNo
      }
    })

    await prisma.carding_production_detail.createMany({
      data: details
    })

    // Get the newly created details
    const createdDetails = await prisma.carding_production_detail.findMany({
      where: {
        header_id: headerId,
        machine_id: { in: newMachines.map(m => m.id) }
      }
    })

    // Initialize stoppage entries for each new detail (using shift-based stoppage)
    const stoppageEntries = createdDetails.map(detail => ({
      production_detail_id: detail.id,
      stoppage1_time: defaultStoppage,
      total_stoppage_time: defaultStoppage
    }))

    await prisma.carding_stoppage_entry.createMany({
      data: stoppageEntries
    })

    return { added: createdDetails.length, machines: newMachines.map(m => m.machine_no) }
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateProductionDetail(id, updates) {
  try {
    const data = await prisma.carding_production_detail.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Bulk update production details
export async function bulkUpdateProductionDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    prisma.carding_production_detail.update({
      where: { id },
      data
    })
  )

  const results = await Promise.all(promises)
  return results
}

// ============================================
// CARDING STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header (only active machines)
export async function getCardingStoppageEntries(headerId) {
  try {
    // First get all production details for this header (no is_active filter — deactivated machines must still show in past entries)
    const details = await prisma.carding_production_detail.findMany({
      where: {
        header_id: headerId
      },
      select: { id: true }
    })

    const detailIds = details?.map(d => d.id) || []
    
    if (detailIds.length === 0) return []

    // Get stoppage entries for these production details
    const data = await prisma.carding_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: detailIds }
      },
      orderBy: {
        production_detail_id: 'asc'
      }
    })

    if (!data || data.length === 0) return []

    const detailRows = await prisma.carding_production_detail.findMany({
      where: { id: { in: detailIds } },
      select: {
        id: true,
        machine_id: true,
        act_prodn: true,
        std_prodn: true,
        exp_prodn: true,
        session_no: true,
        effi_percent: true,
        uti_percent: true,
        run_time: true,
        work_time: true,
        total_stoppage_mins: true
      }
    })

    const detailMap = {}
    detailRows.forEach(d => {
      detailMap[d.id] = d
    })

    const machineIds = [...new Set(detailRows.map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.carding_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            is_active: true,
            activated_at: true,
            deactivated_at: true,
            sort_order: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const stoppageIds = [...new Set(
      data
        .flatMap(s => [s.stoppage1_id, s.stoppage2_id, s.stoppage3_id, s.stoppage4_id])
        .filter(Boolean)
    )]

    const stoppageDefs = stoppageIds.length > 0
      ? await prisma.stoppage_details.findMany({
          where: { id: { in: stoppageIds } },
          select: { id: true, stoppage_name: true, short_code: true }
        })
      : []

    const stoppageMap = {}
    stoppageDefs.forEach(s => {
      stoppageMap[s.id] = s
    })

    const enriched = data.map(entry => {
      const detail = detailMap[entry.production_detail_id] || null
      const machine = detail?.machine_id ? (machineMap[detail.machine_id] || null) : null
      return {
        ...entry,
        production_detail: detail ? { ...detail, machine } : null,
        stoppage1: entry.stoppage1_id ? (stoppageMap[entry.stoppage1_id] || null) : null,
        stoppage2: entry.stoppage2_id ? (stoppageMap[entry.stoppage2_id] || null) : null,
        stoppage3: entry.stoppage3_id ? (stoppageMap[entry.stoppage3_id] || null) : null,
        stoppage4: entry.stoppage4_id ? (stoppageMap[entry.stoppage4_id] || null) : null
      }
    })
  
    // Sort by natural machine number order
    const sorted = enriched?.sort((a, b) => {
      const aNum = parseInt(a.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
      const bNum = parseInt(b.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
      return aNum - bNum
    }) || []

    // Apply date-visibility filter: hide machines not active on this entry date
    const hdrForDate = await prisma.carding_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = hdrForDate?.entry_date || new Date()

    return sorted.filter(entry => isCardingMachineVisibleOnDate(entry.production_detail?.machine, entryDate))
  } catch (error) {
    throw error
  }
}

// Update stoppage entry
export async function updateStoppageEntry(id, updates) {
  try {
    // First, fetch the existing record to get current stoppage values
    const existing = await prisma.carding_stoppage_entry.findUnique({
      where: { id },
      select: {
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
    const total = mergedStoppages.stoppage1_time + 
                  mergedStoppages.stoppage2_time + 
                  mergedStoppages.stoppage3_time + 
                  mergedStoppages.stoppage4_time

    const data = await prisma.carding_stoppage_entry.update({
      where: { id },
      data: {
        ...updates,
        ...mergedStoppages,
        total_stoppage_time: total
      }
    })

    // Resolve runtime using this entry's header shift (DB-first, guarded fallback).
    const prodDetail = await prisma.carding_production_detail.findUnique({
      where: { id: data.production_detail_id },
      select: {
        id: true,
        header_id: true,
        machine_id: true,
        act_prodn: true,
        std_prodn: true,
        waste: true,
      }
    })

    const header = prodDetail?.header_id
      ? await prisma.carding_production_header.findUnique({
          where: { id: prodDetail.header_id },
          select: { shift: true }
        })
      : null

    const totalTime = await getCardingShiftTime(header?.shift || 1)
    const workTime = Math.max(totalTime - total, 0)
    const utiPercent = Math.round((workTime / totalTime) * 100 * 100) / 100

    // STEP-2/3/4/7 dynamic recalculation from formula flow:
    // Std Prodn = setup/std baseline, Exp Prodn = Std * Work / Total,
    // Effi% (Performance) = Act / Exp * 100, Waste% = Waste / Act * 100.
    const setup = prodDetail?.machine_id
      ? await prisma.carding_machine_setup.findFirst({
          where: { machine_id: prodDetail.machine_id },
          select: {
            speed: true,
            hank_constant: true,
            std_efficiency_factor: true,
            divisor_constant: true,
            std_prodn: true,
          }
        })
      : null

    const stdProdnBaseline =
      (prodDetail?.std_prodn ?? null) ||
      (setup?.std_prodn ?? null) ||
      calculateCardingStdProdn(setup || {}, totalTime)

    const expProdn = totalTime > 0 ? (stdProdnBaseline * workTime) / totalTime : 0
    const actProdn = Number.parseFloat(prodDetail?.act_prodn || 0)
    const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
    const waste = Number.parseFloat(prodDetail?.waste || 0)
    const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

    await prisma.carding_production_detail.update({
      where: { id: data.production_detail_id },
      data: {
        total_stoppage_mins: total,
        work_time: workTime,
        uti_percent: utiPercent,
        std_prodn: Math.round(stdProdnBaseline * 100) / 100,
        exp_prodn: Math.round(expProdn * 100) / 100,
        effi_percent: Math.round(effiPercent * 100) / 100,
        waste_percent: Math.round(wastePercent * 100) / 100,
      }
    })

    return data
  } catch (error) {
    throw error
  }
}

// Apply full stoppage to all machines
export async function applyFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  const parsedTime = Number.parseInt(stoppageTime, 10)
  if (!stoppageId) {
    throw new Error('Stoppage reason is required')
  }
  if (Number.isNaN(parsedTime) || parsedTime <= 0) {
    throw new Error('Stoppage time must be greater than 0')
  }

  // Get all stoppage entries for this header
  const stoppages = await getCardingStoppageEntries(headerId)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const updates = stoppages.map(s => ({
    id: s.id,
    [stoppageIdField]: stoppageId,
    [stoppageTimeField]: parsedTime,
    is_full_stoppage: slot === 1
  }))

  const promises = updates.map(({ id, ...data }) =>
    updateStoppageEntry(id, data)
  )

  return Promise.all(promises)
}

// Apply partial stoppage to machine range
export async function applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const parsedTime = Number.parseInt(stoppageTime, 10)
    if (!stoppageId) {
      throw new Error('Stoppage reason is required')
    }
    if (Number.isNaN(parsedTime) || parsedTime <= 0) {
      throw new Error('Stoppage time must be greater than 0')
    }

    // Get all production details and join machine info manually
    const details = await prisma.carding_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    const machineIds = details.map(d => d.machine_id).filter(Boolean)
    const machines = machineIds.length > 0
      ? await prisma.carding_machines.findMany({
          where: { id: { in: machineIds } },
          select: { id: true, machine_no: true, mc_id: true }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const enrichedDetails = details.map(d => ({
      ...d,
      machine: machineMap[d.machine_id] || null
    }))

    // Filter by machine range
    const parsedFrom = parseInt(String(fromMachineNo || '').replace(/\D/g, '') || '0')
    const parsedTo = parseInt(String(toMachineNo || '').replace(/\D/g, '') || '0')
    if (!parsedFrom || !parsedTo) {
      throw new Error('From machine and To machine are required')
    }
    const fromNum = Math.min(parsedFrom, parsedTo)
    const toNum = Math.max(parsedFrom, parsedTo)

    const filteredDetails = enrichedDetails?.filter(d => {
      if (!d.machine?.machine_no) return false
      const mcNum = parseInt(d.machine.machine_no.replace(/\D/g, ''))
      return mcNum >= fromNum && mcNum <= toNum
    }) || []

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id)

    const stoppages = await prisma.carding_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: detailIds }
      }
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

    const pickCommonAvailableSlot = (entries) => {
      for (let i = 1; i <= 4; i++) {
        const allAvailable = entries.every(entry => {
          const slotValue = entry?.[`stoppage${i}_id`]
          return slotValue === null || slotValue === undefined || slotValue === ''
        })
        if (allAvailable) {
          return i
        }
      }
      return null
    }

    const commonSlot = stoppages.length > 0 ? pickCommonAvailableSlot(stoppages) : null

    let updatedCount = 0
    let overflowCount = 0
    const appliedRows = []

    for (const stoppage of stoppages) {
      const resolvedSlot = commonSlot || pickFirstAvailableSlot(stoppage)
      if (!resolvedSlot) {
        overflowCount++
        continue
      }

      const updated = await updateStoppageEntry(stoppage.id, {
        [`stoppage${resolvedSlot}_id`]: stoppageId,
        [`stoppage${resolvedSlot}_time`]: parsedTime
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
      totalTargeted: stoppages.length,
      updatedCount,
      overflowCount,
      skippedCount: stoppages.length - updatedCount,
      appliedRows
    }
  } catch (error) {
    throw error
  }
}

// ============================================
// CARDING MACHINE SETUP QUERIES
// ============================================

// Helper to get or create machine setups for a given date (with chronological inheritance)
export async function getOrCreateCardingMachineSetups(entryDate, shift = 1) {
  try {
    const dateObj = new Date(entryDate)
    const shiftNum = parseInt(shift)
    const targetShiftTime = await getCardingShiftTime(shiftNum)
    
    // 1. Try to find setups for this exact date and shift
    let setups = await prisma.carding_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
    
    if (setups.length > 0) {
      return setups
    }
    
    // 2. Fallback: Inherit from the most recent chronologically prior setups in the database
    const latestPreviousSetup = await prisma.carding_machine_setup.findFirst({
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
      const prevSetups = await prisma.carding_machine_setup.findMany({
        where: { 
          entry_date: latestPreviousSetup.entry_date,
          shift: latestPreviousSetup.shift
        }
      })
      
      const prevMachineIds = prevSetups.map(s => s.machine_id)

      // Find active machines that are missing setups in the prior record set
      const activeMachines = await prisma.carding_machines.findMany({
        where: { is_active: true }
      })
      const missingMachines = activeMachines.filter(m => !prevMachineIds.includes(m.id))

      const cloneData = prevSetups.map(s => {
        const { id, created_at, updated_at, ...rest } = s
        const fallbackStdProdn = calculateCardingStdProdn({
          speed: rest.speed,
          divisor_constant: rest.divisor_constant ?? 1693,
          hank_constant: rest.hank_constant,
          std_efficiency_factor: rest.std_efficiency_factor
        }, targetShiftTime)

        return {
          ...rest,
          entry_date: dateObj,
          shift: shiftNum,
          shift_time: targetShiftTime,
          std_prodn: Math.round(fallbackStdProdn * 100) / 100
        }
      })

      const missingSetups = missingMachines.map(m => {
        const rawEffi = Number(m.prodn_efficiency ?? 0.9800)
        const stdEffi = rawEffi > 1 ? rawEffi / 100 : rawEffi

        const fallbackStdProdn = calculateCardingStdProdn({
          speed: m.speed ?? 130,
          divisor_constant: 1693,
          hank_constant: m.hank_constant ?? 0.1300,
          std_efficiency_factor: stdEffi
        }, targetShiftTime)
        
        return {
          machine_id: m.id,
          entry_date: dateObj,
          shift: shiftNum,
          speed: m.speed ?? 130.00,
          hank_constant: m.hank_constant ?? 0.1300,
          std_efficiency_factor: stdEffi,
          default_waste: 0.3400,
          std_prodn: Math.round(fallbackStdProdn * 100) / 100,
          shift_time: targetShiftTime,
          default_stoppage: 0,
          divisor_constant: 1693
        }
      })

      const allDataToInsert = [...cloneData, ...missingSetups]
      
      if (allDataToInsert.length > 0) {
        await prisma.carding_machine_setup.createMany({
          data: allDataToInsert
        })
      }
      
      return await prisma.carding_machine_setup.findMany({
        where: { 
          entry_date: dateObj,
          shift: shiftNum
        }
      })
    }
    
    // 3. Fallback: Initialize default setups for all active machines
    const activeMachines = await prisma.carding_machines.findMany({
      where: { is_active: true }
    })
    
    const defaultSetups = activeMachines.map(m => {
      const rawEffi = Number(m.prodn_efficiency ?? 0.9800)
      const stdEffi = rawEffi > 1 ? rawEffi / 100 : rawEffi

      const fallbackStdProdn = calculateCardingStdProdn({
        speed: m.speed ?? 130,
        divisor_constant: 1693,
        hank_constant: m.hank_constant ?? 0.1300,
        std_efficiency_factor: stdEffi
      }, targetShiftTime)
      
      return {
        machine_id: m.id,
        entry_date: dateObj,
        shift: shiftNum,
        speed: m.speed ?? 130.00,
        hank_constant: m.hank_constant ?? 0.1300,
        std_efficiency_factor: stdEffi,
        default_waste: 0.3400,
        std_prodn: Math.round(fallbackStdProdn * 100) / 100,
        shift_time: targetShiftTime,
        default_stoppage: 0,
        divisor_constant: 1693
      }
    })
    
    if (defaultSetups.length > 0) {
      await prisma.carding_machine_setup.createMany({
        data: defaultSetups
      })
    }
    
    return await prisma.carding_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
  } catch (error) {
    throw error
  }
}

// Get all machine setups with machine info (only active machines) for a given date and shift
export async function getCardingMachineSetups(entryDate, shift = 1) {
  try {
    if (!entryDate) {
      throw new Error('entryDate is required for getCardingMachineSetups')
    }

    const setups = await getOrCreateCardingMachineSetups(entryDate, shift)
    if (!setups || setups.length === 0) return []

    const machineIds = setups.map(s => s.machine_id).filter(Boolean)
    const machines = machineIds.length > 0
      ? await prisma.carding_machines.findMany({
          where: {
            id: { in: machineIds },
            is_active: true
          },
          select: {
            id: true,
            machine_no: true,
            description: true,
            make_name: true,
            prodn_mixing: true,
            is_active: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const data = setups
      .filter(setup => !!machineMap[setup.machine_id])
      .map(setup => ({
        ...setup,
        machine: machineMap[setup.machine_id]
      }))

    // Natural sort by machine_no (e.g. CA1, CA2... CA10...)
    return data.sort((a, b) => {
      const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
      const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
      return aNum - bNum
    })
  } catch (error) {
    throw error
  }
}

// Update machine setup targeting the exact date & shift for scoping
export async function updateMachineSetup(identifier, updates, entryDate = null, shift = null) {
  try {
    let existing = null

    // 1. Try to find unique row by setup UUID
    if (identifier && identifier.length === 36) {
      existing = await prisma.carding_machine_setup.findUnique({
        where: { id: identifier },
        select: { id: true, machine_id: true, entry_date: true, shift: true }
      })
    }

    // 2. If not found by unique ID, try by machine_id + entryDate + shift
    if (!existing && entryDate && shift) {
      existing = await prisma.carding_machine_setup.findFirst({
        where: { 
          machine_id: identifier,
          entry_date: new Date(entryDate),
          shift: parseInt(shift)
        },
        select: { id: true, machine_id: true, entry_date: true, shift: true }
      })
    }

    // 3. Backward fallback to first setup record
    if (!existing) {
      existing = await prisma.carding_machine_setup.findFirst({
        where: { machine_id: identifier },
        select: { id: true, machine_id: true, entry_date: true, shift: true }
      })
    }

    if (!existing?.id) {
      throw new Error(`Machine setup not found for identifier ${identifier}`)
    }

    const setupUpdates = { ...updates }

    const currentSetup = await prisma.carding_machine_setup.findUnique({
      where: { id: existing.id },
      select: {
        speed: true,
        hank_constant: true,
        std_efficiency_factor: true,
        divisor_constant: true,
        shift_time: true
      }
    })

    const mergedSetup = {
      ...currentSetup,
      ...setupUpdates
    }

    const shiftTime = Number(mergedSetup.shift_time || 0)
    if (shiftTime > 0) {
      const recalculatedStdProdn = calculateCardingStdProdn(mergedSetup, shiftTime)
      setupUpdates.std_prodn = Math.round(recalculatedStdProdn * 100) / 100
    }

    const data = await prisma.carding_machine_setup.update({
      where: { id: existing.id },
      data: setupUpdates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Create or update machine setup (upsert) targeting exact date/shift
export async function upsertMachineSetup(machineId, setupData, entryDate = null, shift = null) {
  try {
    const dateObj = entryDate ? new Date(entryDate) : new Date('2026-04-01')
    const shiftNum = shift ? parseInt(shift) : 1

    const existing = await prisma.carding_machine_setup.findFirst({
      where: { 
        machine_id: machineId,
        entry_date: dateObj,
        shift: shiftNum
      },
      select: { id: true }
    })

    if (existing?.id) {
      return await prisma.carding_machine_setup.update({
        where: { id: existing.id },
        data: setupData
      })
    }

    return await prisma.carding_machine_setup.create({
      data: {
        machine_id: machineId,
        entry_date: dateObj,
        shift: shiftNum,
        ...setupData
      }
    })
  } catch (error) {
    throw error
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get stoppage details for dropdown (filtered by CARDING department)
export async function getStoppageDetails() {
  try {
    const normalizeId = (value) => String(value || '').trim().toLowerCase()

    // First get the CARDING department ID
    const cardingDept = await prisma.departments.findFirst({
      where: { dept_name: 'CARDING' }
    })
    
    const data = await prisma.stoppage_details.findMany({
      where: { 
        is_active: true,
        department_id: cardingDept?.id
      },
      select: {
        id: true,
        stoppage_name: true,
        short_code: true
        ,stoppage_head_id: true
      },
      orderBy: {
        stoppage_name: 'asc'
      }
    })

    const headIds = [...new Set((data || []).map(item => item.stoppage_head_id).filter(Boolean))]
    const heads = headIds.length > 0
      ? await prisma.stoppage_heads.findMany({
          where: { id: { in: headIds } },
          select: { id: true, stoppage_head_name: true }
        })
      : []

    const headMap = {}
    heads.forEach(head => {
      headMap[normalizeId(head.id)] = head.stoppage_head_name
    })

    return (data || []).map(item => ({
      ...item,
      stoppage_head_name: item.stoppage_head_id ? (headMap[normalizeId(item.stoppage_head_id)] || 'General') : 'General',
      category: item.stoppage_head_id ? (headMap[normalizeId(item.stoppage_head_id)] || 'General') : 'General'
    }))
  } catch (error) {
    throw error
  }
}

// Get all supervisors
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

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getCardingAvailablePreviousDates(beforeDate, shift, limit = 30) {
  try {
    const data = await prisma.carding_production_header.findMany({
      where: {
        shift: shift,
        entry_date: {
          lt: new Date(beforeDate)
        }
      },
      select: {
        entry_date: true,
        shift: true
      },
      orderBy: {
        entry_date: 'desc'
      },
      take: limit
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Copy data from a previous date
export async function copyCardingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    let previousDate = sourceDate
    if (!previousDate) {
      const targetDateObj = new Date(targetDate)
      const yesterdayDateObj = new Date(targetDateObj)
      yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1)
      previousDate = yesterdayDateObj.toISOString().split('T')[0]
    }

    // Normalize the date to just the date portion (YYYY-MM-DD) to handle ISO string dates
    // This handles both "2026-01-30" and "2026-01-30T00:00:00.000Z" formats
    const normalizedDate = previousDate.includes('T') 
      ? previousDate.split('T')[0] 
      : previousDate

    // Get source header
    const sourceHeader = await getCardingProductionByDateShift(normalizedDate, targetShift)
    if (!sourceHeader) {
      throw new Error(`No production data found for ${normalizedDate} shift ${targetShift}`)
    }

    // Get source production details
    const sourceDetails = await prisma.carding_production_detail.findMany({
      where: { header_id: sourceHeader.id }
    })

    if (!sourceDetails || sourceDetails.length === 0) {
      throw new Error(`No production details found for ${previousDate}`)
    }

    // Get source stoppage entries
    const sourceStoppages = await prisma.carding_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: sourceDetails.map(d => d.id) }
      }
    })

    // Get target's existing production details
    const targetDetails = await prisma.carding_production_detail.findMany({
      where: { header_id: targetHeaderId }
    })

    // Create a map of machine_id to source data
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

    // Update target details with source data
    let machinesUpdated = 0
    for (const targetDetail of targetDetails) {
      const sourceData = sourceDataMap[targetDetail.machine_id]
      if (!sourceData) continue

      await prisma.carding_production_detail.update({
        where: { id: targetDetail.id },
        data: {
          employee_name: sourceData.employee_name,
          count_mixing: sourceData.count_mixing,
          act_hank: sourceData.act_hank,
          act_prodn: sourceData.act_prodn,
          std_prodn: sourceData.std_prodn,
          exp_prodn: sourceData.exp_prodn,
          effi_percent: sourceData.effi_percent,
          uti_percent: sourceData.uti_percent,
          waste: sourceData.waste,
          waste_percent: sourceData.waste_percent,
          work_time: sourceData.work_time,
          run_time: sourceData.run_time,
          total_stoppage_mins: sourceData.total_stoppage_mins
        }
      })
      machinesUpdated++
    }

    // Update target stoppage entries
    const targetStoppages = await prisma.carding_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: targetDetails.map(d => d.id) }
      }
    })

    const targetDetailMachineMap = {}
    targetDetails.forEach(d => {
      targetDetailMachineMap[d.id] = d.machine_id
    })

    for (const targetStoppage of targetStoppages || []) {
      const machineId = targetDetailMachineMap[targetStoppage.production_detail_id]
      const sourceStoppage = sourceStoppageMap[machineId]
      if (!sourceStoppage) continue

      await prisma.carding_stoppage_entry.update({
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
// CALCULATION UTILITY FUNCTIONS
// ============================================

// Calculate production values based on carding formulas
// STEP-1: Get Hank from standard values
// STEP-2: Std Prodn = (Speed / Divisor / Hank) × TotalTime × StdEffi
// STEP-3: Exp Prodn = Std Prodn × WorkTime / TotalTime
// STEP-4: Effi% = ActProdn / ExpProdn × 100
// STEP-5: UTI% = WorkTime / TotalTime × 100
export function calculateProductionValues(actHank, actProdn, totalTime, stoppageTime, setup) {
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant } = resolveCardingFormulaInputs(setup)
  const wasteValue = setup?.default_waste ?? 0

  // WorkTime = TotalTime - StoppageTime (this is the actual run time)
  const workTime = Math.max(totalTime - stoppageTime, 0)
  
  // RunTime defaults to TotalTime, represents available shift time
  const runTime = totalTime

  // Std Prodn = (Speed / Divisor / Hank) × TotalTime × StdEffi
  const stdProdn = (speed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor

  // Exp Prodn = Std Prodn × WorkTime / TotalTime (time-adjusted target)
  const expProdn = stdProdn * workTime / totalTime

  // Effi% = ActProdn / ExpProdn × 100 (Performance %)
  const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0

  // UTI% = WorkTime / TotalTime × 100 (Utilization based on actual working time)
  const utiPercent = (workTime / totalTime) * 100

  // Waste% = Waste / ActProdn × 100
  const wastePercent = actProdn > 0 ? (wasteValue / actProdn) * 100 : 0

  return {
    std_prodn: Math.round(stdProdn * 100) / 100,
    exp_prodn: Math.round(expProdn * 100) / 100,
    effi_percent: Math.round(effiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    waste: setup?.default_waste ?? null,
    waste_percent: Math.round(wastePercent * 100) / 100,
    run_time: runTime,
    work_time: workTime, // TotalTime - StoppageTime
    total_stoppage_mins: stoppageTime // Store total stoppage for reference
  }
}

// Get all carding machines
export async function getCardingMachines() {
  try {
    const data = await prisma.carding_machines.findMany({
      where: { is_active: true },
      orderBy: { mc_id: 'asc' }
    })
    
    // Sort by natural machine number order (CA1, CA2, ... CA10, CA11)
    return (data || []).sort((a, b) => {
      const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
      const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
      if (aNum !== bNum) return aNum - bNum
      return a.machine_no.localeCompare(b.machine_no)
    })
  } catch (error) {
    throw error
  }
}

// Get stoppage reasons (alias for getStoppageDetails)
export async function getCardingStoppageReasons() {
  return getStoppageDetails()
}

// Get count options for dropdown from spinning_counts master table
export async function getCountOptions() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: { 
        id: true,
        count_name: true, 
        act_count: true,
        sliver_hank: true
      },
      orderBy: { count_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Lookup a carding machine by machine_no (for setup page auto-fill)
export async function lookupCardingMachineByNo(machineNo) {
  // Prefer active machine; fall back to any machine with this number
  const activeMachine = await prisma.carding_machines.findFirst({
    where: { machine_no: { equals: machineNo }, is_active: true }
  })
  const machine = activeMachine || await prisma.carding_machines.findFirst({
    where: { machine_no: { equals: machineNo } },
    orderBy: { is_active: 'desc' }
  })
  if (!machine) return null

  // Try setup for this machine
  const setup = await prisma.carding_machine_setup.findFirst({
    where: { machine_id: machine.id }
  })

  return {
    ...machine,
    // Setup fields (if setup exists)
    speed_setup: setup?.speed != null ? parseFloat(setup.speed) : null,
    hank_constant: machine.hank_constant != null
      ? parseFloat(machine.hank_constant)
      : (setup?.hank_constant != null ? parseFloat(setup.hank_constant) : null),
    std_efficiency_factor: setup?.std_efficiency_factor != null ? parseFloat(setup.std_efficiency_factor) : null,
    has_setup: !!setup,
  }
}

// Add a new carding machine
export async function addCardingMachine(machineData) {
  try {
    const formulaDefaults = resolveCardingFormulaInputs(machineData)
    const setupShiftTime = machineData.shift_time ?? await getCardingShiftTime(1)
    const fallbackStdProdn = calculateCardingStdProdn(
      {
        speed: formulaDefaults.speed,
        hank_constant: formulaDefaults.hankConstant,
        std_efficiency_factor: formulaDefaults.stdEfficiencyFactor,
        divisor_constant: formulaDefaults.divisorConstant
      },
      setupShiftTime
    )

    // Check if machine_no already exists (might be inactive)
    if (machineData.machine_no) {
      const existingMachine = await prisma.carding_machines.findFirst({
        where: { machine_no: machineData.machine_no }
      })

      if (existingMachine) {
        if (!existingMachine.is_active) {
          // Reactivate the existing machine
          let installedDate = machineData.installed_date
          if (installedDate && typeof installedDate === 'string') installedDate = new Date(installedDate)
          const reactivated = await prisma.carding_machines.update({
            where: { id: existingMachine.id },
            data: {
              is_active: true,
              activated_at: new Date(),
              deactivated_at: null,
              description: machineData.description || machineData.machine_no,
              make_name: machineData.make_name || 'LMW',
              model: machineData.model || existingMachine.model,
              prodn_mixing: machineData.prodn_mixing || existingMachine.prodn_mixing,
              ...(installedDate && { installed_date: installedDate })
            }
          })

          // Check if setup exists for this machine, create if not
          let existingSetup = await prisma.carding_machine_setup.findFirst({
            where: { machine_id: existingMachine.id }
          })
          
          let setup = existingSetup
          if (!existingSetup) {
            // Create setup for reactivated machine
            setup = await prisma.carding_machine_setup.create({
              data: {
                machine_id: existingMachine.id,
                speed: formulaDefaults.speed,
                hank_constant: formulaDefaults.hankConstant,
                std_efficiency_factor: formulaDefaults.stdEfficiencyFactor,
                shift_time: setupShiftTime,
                divisor_constant: formulaDefaults.divisorConstant,
                default_waste: null,
                default_stoppage: null,
                std_prodn: fallbackStdProdn
              }
            })
          }

          // Sync reactivated machine to ALL existing production headers
          const existingHeaders = await prisma.carding_production_header.findMany({
            where: { entry_date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } },
            select: { id: true, shift: true }
          })

          for (const header of existingHeaders) {
            await syncNewMachinesToHeader(header.id, header.shift)
          }

          return { machine: reactivated, setup, reactivated: true, syncedHeaders: existingHeaders.length }
        } else {
          // Machine is active — check if it already has a setup
          let existingSetup = await prisma.carding_machine_setup.findFirst({
            where: { machine_id: existingMachine.id }
          })

          if (existingSetup) {
            throw new Error(`Machine ${machineData.machine_no} already exists in setup`)
          }

          // Active machine without setup — create setup for it
          const setup = await prisma.carding_machine_setup.create({
            data: {
              machine_id: existingMachine.id,
              speed: formulaDefaults.speed,
              hank_constant: formulaDefaults.hankConstant,
              std_efficiency_factor: formulaDefaults.stdEfficiencyFactor,
              shift_time: setupShiftTime,
              divisor_constant: formulaDefaults.divisorConstant,
              default_waste: null,
              default_stoppage: null,
              std_prodn: fallbackStdProdn
            }
          })

          // Sync to existing production headers
          const existingHeaders = await prisma.carding_production_header.findMany({
            where: { entry_date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } },
            select: { id: true, shift: true }
          })

          for (const header of existingHeaders) {
            await syncNewMachinesToHeader(header.id, header.shift)
          }

          return { machine: existingMachine, setup, reactivated: false, syncedHeaders: existingHeaders.length }
        }
      }
    }

    // Get the max mc_id to generate next one (include inactive machines)
    const maxMachine = await prisma.carding_machines.findFirst({
      orderBy: { mc_id: 'desc' },
      select: { mc_id: true, machine_no: true }
    })

    const nextMcId = (maxMachine?.mc_id || 0) + 1
    const nextMachineNo = machineData.machine_no || `CA${nextMcId}`

    // Insert new machine - only with carding_machines table fields
    let newInstalledDate = machineData.installed_date
    if (newInstalledDate && typeof newInstalledDate === 'string') newInstalledDate = new Date(newInstalledDate)
    const newMachine = await prisma.carding_machines.create({
      data: {
        machine_no: nextMachineNo,
        mc_id: nextMcId,
        description: machineData.description || `Carding Machine ${nextMcId}`,
        make_name: machineData.make_name || 'LMW',
        model: machineData.model || null,
        prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
        speed: formulaDefaults.speed,
        installed_date: newInstalledDate || null,
        is_active: true,
        activated_at: new Date()
      }
    })

    // Create machine setup for the new machine - with setup-specific fields
    const newSetup = await prisma.carding_machine_setup.create({
      data: {
        machine_id: newMachine.id,
        speed: formulaDefaults.speed,
        hank_constant: formulaDefaults.hankConstant,
        std_efficiency_factor: formulaDefaults.stdEfficiencyFactor,
        shift_time: setupShiftTime,
        divisor_constant: formulaDefaults.divisorConstant,
        default_waste: null,
        default_stoppage: null,
        std_prodn: fallbackStdProdn
      }
    })

    // Sync new machine to ALL existing production headers (last 30 days)
    const existingHeaders = await prisma.carding_production_header.findMany({
      where: { entry_date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } },
      select: { id: true, shift: true }
    })

    for (const header of existingHeaders) {
      await syncNewMachinesToHeader(header.id, header.shift)
    }

    return { machine: newMachine, setup: newSetup, syncedHeaders: existingHeaders.length }
  } catch (error) {
    throw error
  }
}

// Remove (deactivate) a carding machine
export async function removeCardingMachine(machineId) {
  try {
    const data = await prisma.carding_machines.update({
      where: { id: machineId },
      data: { is_active: false }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update machine count (prodn_mixing)
export async function updateMachineCount(machineId, countMixing) {
  try {
    const data = await prisma.carding_machines.update({
      where: { id: machineId },
      data: { prodn_mixing: countMixing }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Bulk update machine count for multiple machines
export async function bulkUpdateMachineCount(machineIds, countMixing, hank_constant) {
  try {
    const machineUpdateData = { prodn_mixing: countMixing }
    if (hank_constant != null) machineUpdateData.hank_constant = hank_constant

    await prisma.carding_machines.updateMany({
      where: { id: { in: machineIds } },
      data: machineUpdateData
    })

    // Also update the setup hank_constant when a new count changes the sliver hank
    if (hank_constant != null) {
      await prisma.carding_machine_setup.updateMany({
        where: { machine_id: { in: machineIds } },
        data: { hank_constant }
      })
    }

    return { count: machineIds.length }
  } catch (error) {
    throw error
  }
}
