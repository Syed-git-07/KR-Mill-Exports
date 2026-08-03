import { prisma } from '../prisma'
import { resolveCardingShiftFallbackTime } from '../cardingShiftFallback'
import { calculateCardingStdProdn, resolveCardingFormulaInputs } from '../cardingFormulaFallback'
import { calculateTimeAdjustedProductionMetrics } from '../productionFormulaMath'
import { copyPreviousSpeeds, getAvailablePreviousSpeedDates } from './copyPreviousSpeed'
import { buildStoppageUpdate, findFirstFreeStoppageSlot } from '../stoppageSlotUtils'
import { assertActiveStoppageReasons } from './stoppageValidation'
import { sanitizeProductionDetailUpdate, sanitizeProductionHeaderUpdate } from './productionDetailUpdate'
import { buildMachineVisibilityWhere, isMachineVisibleOnDate } from './machineDateVisibility'
import { normalizeMixingValue } from './machineMixingUpdate'
import { parseStrictDate } from '../strictDate'

const CARDING_SETUP_UPDATE_FIELDS = new Set([
  'speed',
  'hank_constant',
  'std_efficiency_factor',
  'default_waste',
  'shift_time',
  'default_stoppage',
  'divisor_constant'
])

function normalizeCardingSetupUpdates(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new TypeError('Carding machine setup updates must be an object')
  }

  const normalized = {}
  for (const [field, value] of Object.entries(updates)) {
    if (!CARDING_SETUP_UPDATE_FIELDS.has(field) || value === undefined) continue
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid number`)

    if (field === 'default_waste' || field === 'default_stoppage') {
      if (parsed < 0) throw new Error(`${field} cannot be negative`)
    } else if (parsed <= 0) {
      throw new Error(`${field} must be greater than zero`)
    }

    if (field === 'std_efficiency_factor' && parsed > 1) {
      throw new Error('Standard efficiency factor must be between 0 and 1')
    }

    normalized[field] = parsed
  }
  return normalized
}

function isCardingMachineVisibleOnDate(machine, entryDate) {
  return isMachineVisibleOnDate(machine, entryDate)
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
    if (error?.code === 'P2002') {
      const concurrentHeader = await getCardingProductionByDateShift(date, shift)
      if (concurrentHeader) return concurrentHeader
    }
    throw error
  }
}

// Update production header
export async function updateProductionHeader(id, updates) {
  try {
    const data = await prisma.carding_production_header.update({
      where: { id },
      data: {
        ...sanitizeProductionHeaderUpdate('carding_production_header', updates),
        updated_at: new Date()
      }
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
    throw error
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
        ...buildMachineVisibilityWhere(entryDate)
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
    const defaultWorkTime = Math.max(totalTime - defaultStoppage, 0)
    const defaultUti = totalTime > 0
      ? Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100
      : 0
    
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const inherited = inheritedSetups[machine.id] || {}

      const countMixing = inherited.count_mixing !== undefined ? inherited.count_mixing : (machine.prodn_mixing || '64COMBED GOLD')
      const employeeName = null
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
      data: details,
      skipDuplicates: true
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
      data: stoppageEntries,
      skipDuplicates: true
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
    const headerForDate = await prisma.carding_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true }
    })
    if (!headerForDate) throw new Error(`Carding production header ${headerId} not found`)
    const entryDate = headerForDate.entry_date
    const headerShift = headerForDate.shift ?? shift

    // Get shift-based time values (MUST await async functions)
    const totalTime = await getCardingShiftTime(headerShift)
    const defaultStoppage = await getCardingDefaultStoppage(headerShift)
    const defaultWorkTime = Math.max(totalTime - defaultStoppage, 0)
    const defaultUti = totalTime > 0
      ? Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100
      : 0

    // Get setups scoped strictly by the entry date and shift
    const setups = await getOrCreateCardingMachineSetups(entryDate, headerShift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get all carding machines visible on this entry date that have a setup entry
    const machines = await prisma.carding_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        ...buildMachineVisibilityWhere(entryDate)
      },
      orderBy: { mc_id: 'asc' }
    })

    // Get existing production details for this header
    const existingDetails = await prisma.carding_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Find machines that don't have entries
    const newMachines = machines?.filter(m => !existingMachineIds.includes(m.id)) || []

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Fetch inherited machine setups from the chronologically prior shift/date's production details
    const inheritedSetups = await getCardingInheritedMachineSetups(entryDate, headerShift, headerId)

    // Create detail records for new machines (using shift-based values calculated above)
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const inherited = inheritedSetups[machine.id] || {}

      const countMixing = inherited.count_mixing !== undefined ? inherited.count_mixing : (machine.prodn_mixing || '64COMBED GOLD')
      const employeeName = null
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

    const createdDetails = await prisma.$transaction(async tx => {
      if (details.length > 0) {
        await tx.carding_production_detail.createMany({ data: details, skipDuplicates: true })
      }

      const visibleDetails = await tx.carding_production_detail.findMany({
        where: { header_id: headerId, machine_id: { in: machines.map(machine => machine.id) } },
        select: { id: true, machine_id: true }
      })
      const existingStoppages = visibleDetails.length > 0
        ? await tx.carding_stoppage_entry.findMany({
            where: { production_detail_id: { in: visibleDetails.map(detail => detail.id) } },
            select: { production_detail_id: true }
          })
        : []
      const stoppedDetailIds = new Set(existingStoppages.map(entry => entry.production_detail_id))
      const missingStoppages = visibleDetails
        .filter(detail => !stoppedDetailIds.has(detail.id))
        .map(detail => ({
          production_detail_id: detail.id,
          stoppage1_time: defaultStoppage,
          total_stoppage_time: defaultStoppage
        }))
      if (missingStoppages.length > 0) {
        await tx.carding_stoppage_entry.createMany({ data: missingStoppages, skipDuplicates: true })
      }

      const newMachineIds = new Set(newMachines.map(machine => machine.id))
      return visibleDetails.filter(detail => newMachineIds.has(detail.machine_id))
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
      data: {
        ...sanitizeProductionDetailUpdate('carding_production_detail', updates),
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Bulk update production details
export async function bulkUpdateProductionDetails(updates) {
  const updatedAt = new Date()
  return prisma.$transaction(
    updates.map(({ id, ...data }) =>
      prisma.carding_production_detail.update({
        where: { id },
        data: {
          ...sanitizeProductionDetailUpdate('carding_production_detail', data),
          updated_at: updatedAt
        }
      })
    )
  )
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
  return prisma.$transaction(async tx => {
    const existing = await tx.carding_stoppage_entry.findUnique({
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
    if (!existing) throw new Error(`Stoppage entry ${id} not found`)

    const stoppageUpdate = buildStoppageUpdate(existing, updates)
    await assertActiveStoppageReasons(tx, stoppageUpdate, ['CARDING'])
    const prodDetail = await tx.carding_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: {
        id: true,
        header_id: true,
        machine_id: true,
        act_prodn: true,
        std_prodn: true,
        waste: true,
      }
    })
    if (!prodDetail) throw new Error('The production row for this stoppage no longer exists')

    const header = await tx.carding_production_header.findUnique({
      where: { id: prodDetail.header_id },
      select: { shift: true, entry_date: true }
    })
    if (!header) throw new Error('The production header for this stoppage no longer exists')

    const shiftConfig = await tx.shift_config.findFirst({
      where: { department_code: 'CARDING', shift: header.shift, is_active: true },
      select: { shift_time: true }
    })
    const totalTime = shiftConfig?.shift_time || resolveCardingShiftFallbackTime(header.shift)
    if (stoppageUpdate.total_stoppage_time > totalTime) {
      const error = new Error('Stoppage time cannot exceed the shift time')
      error.code = 'INVALID_STOPPAGE'
      throw error
    }

    const setup = await tx.carding_machine_setup.findFirst({
      where: {
        machine_id: prodDetail.machine_id,
        entry_date: header.entry_date,
        shift: header.shift
      },
      select: {
        speed: true,
        hank_constant: true,
        std_efficiency_factor: true,
        divisor_constant: true,
        std_prodn: true,
      }
    })
    const setupFormulaProduction = calculateCardingStdProdn(setup || {}, totalTime)
    const setupStoredProduction = Number(setup?.std_prodn || 0)
    const detailStoredProduction = Number(prodDetail.std_prodn || 0)
    const standardProduction = setupFormulaProduction > 0
      ? setupFormulaProduction
      : (setupStoredProduction > 0 ? setupStoredProduction : detailStoredProduction)
    const metrics = calculateTimeAdjustedProductionMetrics({
      actualProduction: prodDetail.act_prodn,
      standardProduction,
      waste: prodDetail.waste,
      totalTime,
      stoppageTime: stoppageUpdate.total_stoppage_time,
    })

    const data = await tx.carding_stoppage_entry.update({ where: { id }, data: stoppageUpdate })
    await tx.carding_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        total_stoppage_mins: metrics.stoppageTime,
        work_time: metrics.workTime,
        uti_percent: metrics.utilizationPercent,
        std_prodn: metrics.standardProduction,
        exp_prodn: metrics.expectedProduction,
        effi_percent: metrics.efficiencyPercent,
        waste_percent: metrics.wastePercent,
        updated_at: new Date()
      }
    })
    return data
  })
}

// Apply full stoppage to all machines
export async function applyFullStoppage(headerId, stoppageId, stoppageTime) {
  const parsedTime = Number.parseInt(stoppageTime, 10)
  if (!stoppageId) {
    throw new Error('Stoppage reason is required')
  }
  if (Number.isNaN(parsedTime) || parsedTime <= 0) {
    throw new Error('Stoppage time must be greater than 0')
  }

  // Get all stoppage entries for this header
  const stoppages = await getCardingStoppageEntries(headerId)

  const updates = stoppages.flatMap(s => {
    const slot = findFirstFreeStoppageSlot(s)
    if (!slot) return []
    return [{
      id: s.id,
      [`stoppage${slot}_id`]: stoppageId,
      [`stoppage${slot}_time`]: parsedTime,
      is_full_stoppage: true
    }]
  })

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

    let updatedCount = 0
    let overflowCount = 0
    const appliedRows = []

    for (const stoppage of stoppages) {
      const resolvedSlot = pickFirstAvailableSlot(stoppage)
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
    if (Number.isNaN(dateObj.getTime())) throw new Error('A valid Carding entry date is required')
    const shiftNum = parseInt(shift)
    const targetShiftTime = await getCardingShiftTime(shiftNum)
    const visibleMachines = await prisma.carding_machines.findMany({
      where: buildMachineVisibilityWhere(dateObj)
    })

    const createDefaultSetup = (machine) => {
      const rawSpeed = Number(machine.speed)
      const rawHank = Number(machine.hank_constant)
      const rawEffi = Number(machine.prodn_efficiency)
      const normalizedEffi = rawEffi > 1 ? rawEffi / 100 : rawEffi
      const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 130
      const hankConstant = Number.isFinite(rawHank) && rawHank > 0 ? rawHank : 0.13
      const stdEffi = Number.isFinite(normalizedEffi) && normalizedEffi > 0 && normalizedEffi <= 1
        ? normalizedEffi
        : 0.98
      const setup = {
        machine_id: machine.id,
        entry_date: dateObj,
        shift: shiftNum,
        speed,
        hank_constant: hankConstant,
        std_efficiency_factor: stdEffi,
        default_waste: 0.3400,
        shift_time: targetShiftTime,
        default_stoppage: 0,
        divisor_constant: 1693
      }
      return {
        ...setup,
        std_prodn: Math.round(calculateCardingStdProdn(setup, targetShiftTime) * 100) / 100
      }
    }
    
    // 1. Try to find setups for this exact date and shift
    let setups = await prisma.carding_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
    
    if (setups.length > 0) {
      const existingMachineIds = new Set(setups.map(setup => setup.machine_id))
      const missingSetups = visibleMachines
        .filter(machine => !existingMachineIds.has(machine.id))
        .map(createDefaultSetup)

      if (missingSetups.length > 0) {
        await prisma.carding_machine_setup.createMany({
          data: missingSetups,
          skipDuplicates: true
        })
        setups = await prisma.carding_machine_setup.findMany({
          where: { entry_date: dateObj, shift: shiftNum }
        })
      }
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

      // Clone only machines visible at the target date; current is_active must
      // not erase a machine from a historical setup snapshot.
      const visibleMachineIds = new Set(visibleMachines.map(machine => machine.id))
      const visiblePreviousSetups = prevSetups.filter(setup => visibleMachineIds.has(setup.machine_id))
      const missingMachines = visibleMachines.filter(m => !prevMachineIds.includes(m.id))

      const cloneData = visiblePreviousSetups.map(s => {
        const { id, created_at, updated_at, ...rest } = s
        const machine = visibleMachines.find(m => m.id === s.machine_id)
        const machineSpeed = Number(machine?.speed)
        const inheritedSpeed = Number(rest.speed)
        const defaultSpeed = Number.isFinite(machineSpeed) && machineSpeed > 0
          ? machineSpeed
          : (Number.isFinite(inheritedSpeed) && inheritedSpeed > 0 ? inheritedSpeed : 130)
        const machineEfficiency = machine?.prodn_efficiency == null
          ? null
          : Number(machine.prodn_efficiency)
        const normalizedMachineEfficiency = Number.isFinite(machineEfficiency)
          ? (machineEfficiency > 1 ? machineEfficiency / 100 : machineEfficiency)
          : null
        const inheritedEfficiency = Number(rest.std_efficiency_factor)
        const stdEfficiencyFactor = normalizedMachineEfficiency > 0 && normalizedMachineEfficiency <= 1
          ? normalizedMachineEfficiency
          : (inheritedEfficiency > 0 && inheritedEfficiency <= 1 ? inheritedEfficiency : 0.98)
        const machineHank = Number(machine?.hank_constant)
        const inheritedHank = Number(rest.hank_constant)
        const hankConstant = Number.isFinite(machineHank) && machineHank > 0
          ? machineHank
          : (Number.isFinite(inheritedHank) && inheritedHank > 0 ? inheritedHank : 0.13)
        const fallbackStdProdn = calculateCardingStdProdn({
          speed: defaultSpeed,
          divisor_constant: rest.divisor_constant ?? 1693,
          hank_constant: hankConstant,
          std_efficiency_factor: stdEfficiencyFactor
        }, targetShiftTime)

        return {
          ...rest,
          speed: defaultSpeed,
          hank_constant: hankConstant,
          std_efficiency_factor: stdEfficiencyFactor,
          entry_date: dateObj,
          shift: shiftNum,
          shift_time: targetShiftTime,
          std_prodn: Math.round(fallbackStdProdn * 100) / 100
        }
      })

      const missingSetups = missingMachines.map(createDefaultSetup)

      const allDataToInsert = [...cloneData, ...missingSetups]
      
      if (allDataToInsert.length > 0) {
        await prisma.carding_machine_setup.createMany({
          data: allDataToInsert,
          skipDuplicates: true
        })
      }
      
      return await prisma.carding_machine_setup.findMany({
        where: { 
          entry_date: dateObj,
          shift: shiftNum
        }
      })
    }
    
    // 3. Fallback: initialize defaults for machines visible on this date.
    const defaultSetups = visibleMachines.map(createDefaultSetup)
    
    if (defaultSetups.length > 0) {
      await prisma.carding_machine_setup.createMany({
        data: defaultSetups,
        skipDuplicates: true
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

// Get all machine setups with machine info visible on the entry date.
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
            id: { in: machineIds }
          },
          select: {
            id: true,
            machine_no: true,
            description: true,
            make_name: true,
            prodn_mixing: true,
            is_active: true,
            activated_at: true,
            deactivated_at: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const data = setups
      .filter(setup => isCardingMachineVisibleOnDate(machineMap[setup.machine_id], new Date(entryDate)))
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
  if (typeof identifier !== 'string' || !identifier.trim()) {
    throw new Error('A Carding machine setup id is required')
  }

  const dateObj = entryDate ? new Date(entryDate) : null
  if (dateObj && Number.isNaN(dateObj.getTime())) {
    throw new Error('A valid Carding entry date is required')
  }
  const shiftNum = shift == null ? null : Number.parseInt(shift, 10)
  if (shiftNum !== null && (!Number.isInteger(shiftNum) || shiftNum <= 0)) {
    throw new Error('A valid Carding shift is required')
  }

  const setupUpdates = normalizeCardingSetupUpdates(updates)
  const mixing = updates?.prodn_mixing == null
    ? null
    : normalizeMixingValue(updates.prodn_mixing)

  return prisma.$transaction(async tx => {
    const scopedWhere = dateObj && shiftNum !== null
      ? {
          entry_date: dateObj,
          shift: shiftNum,
          OR: [{ id: identifier }, { machine_id: identifier }]
        }
      : { id: identifier }

    const currentSetup = await tx.carding_machine_setup.findFirst({
      where: scopedWhere,
      select: {
        id: true,
        machine_id: true,
        entry_date: true,
        shift: true,
        speed: true,
        hank_constant: true,
        std_efficiency_factor: true,
        default_waste: true,
        shift_time: true,
        default_stoppage: true,
        divisor_constant: true,
        std_prodn: true
      }
    })
    if (!currentSetup) throw new Error(`Carding machine setup ${identifier} was not found for this date and shift`)

    const mergedSetup = { ...currentSetup, ...setupUpdates }
    if (Number(mergedSetup.default_stoppage || 0) > Number(mergedSetup.shift_time || 0)) {
      throw new Error('Default stoppage cannot exceed shift time')
    }

    const recalculatedStdProdn = calculateCardingStdProdn(mergedSetup, mergedSetup.shift_time)
    if (!(recalculatedStdProdn > 0)) {
      throw new Error('Carding setup values must produce a standard production greater than zero')
    }

    const savedSetup = await tx.carding_machine_setup.update({
      where: { id: currentSetup.id },
      data: {
        ...setupUpdates,
        std_prodn: Math.round(recalculatedStdProdn * 100) / 100,
        updated_at: new Date()
      }
    })

    if (mixing !== null) {
      await tx.carding_machines.update({
        where: { id: currentSetup.machine_id },
        data: { prodn_mixing: mixing, updated_at: new Date() }
      })
      const header = await tx.carding_production_header.findFirst({
        where: { entry_date: currentSetup.entry_date, shift: currentSetup.shift },
        select: { id: true }
      })
      if (header) {
        await tx.carding_production_detail.updateMany({
          where: { header_id: header.id, machine_id: currentSetup.machine_id },
          data: { count_mixing: mixing, updated_at: new Date() }
        })
      }
    }

    return savedSetup
  })
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
    if (!cardingDept?.id) throw new Error('CARDING department not found')
    
    const data = await prisma.stoppage_details.findMany({
      where: { 
        is_active: true,
        department_id: cardingDept.id
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
          where: { id: { in: headIds }, is_active: true },
          select: { id: true, stoppage_head_name: true }
        })
      : []

    const headMap = {}
    heads.forEach(head => {
      headMap[normalizeId(head.id)] = head.stoppage_head_name
    })

    return (data || []).filter(item => (
      !item.stoppage_head_id || headMap[normalizeId(item.stoppage_head_id)]
    )).map(item => ({
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
// COPY PREVIOUS SPEED FUNCTIONALITY
// ============================================

// Get previous dates in the same shift that contain setup speeds.
export async function getCardingAvailablePreviousDates(beforeDate, shift, limit = 30) {
  return getAvailablePreviousSpeedDates(
    prisma.carding_machine_setup,
    beforeDate,
    shift,
    limit
  )
}

// Copy only machine setup speed. Formula-derived standard production is
// recalculated from the target row's own setup values.
export async function copyCardingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  return copyPreviousSpeeds({
    setupModel: prisma.carding_machine_setup,
    headerModel: prisma.carding_production_header,
    targetHeaderId,
    targetDate,
    targetShift,
    sourceDate,
    buildUpdateData: (setup, speed) => {
      const shiftTime = Number(setup.shift_time || 0)
      return {
        speed,
        ...(shiftTime > 0
          ? { std_prodn: Math.round(calculateCardingStdProdn({ ...setup, speed }, shiftTime) * 100) / 100 }
          : {})
      }
    }
  })
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
export function calculateProductionValues(actHank, actProdn, totalTime, stoppageTime, setup, fallbackStdProdn = null) {
  const wasteValue = setup?.default_waste ?? 0

  // WorkTime = TotalTime - StoppageTime (this is the actual run time)
  
  // RunTime defaults to TotalTime, represents available shift time

  // Std Prodn = (Speed / Divisor / Hank) × TotalTime × StdEffi
  const calculatedStdProdn = calculateCardingStdProdn(setup, totalTime)
  const storedStdProdn = Number(fallbackStdProdn ?? setup?.std_prodn ?? 0)
  const stdProdn = calculatedStdProdn > 0
    ? calculatedStdProdn
    : (Number.isFinite(storedStdProdn) && storedStdProdn > 0 ? storedStdProdn : 0)

  // Exp Prodn = Std Prodn × WorkTime / TotalTime (time-adjusted target)

  // Effi% = ActProdn / ExpProdn × 100 (Performance %)

  // UTI% = WorkTime / TotalTime × 100 (Utilization based on actual working time)

  // Waste% = Waste / ActProdn × 100
  const metrics = calculateTimeAdjustedProductionMetrics({
    actualProduction: actProdn,
    standardProduction: stdProdn,
    waste: wasteValue,
    totalTime,
    stoppageTime,
  })

  return {
    std_prodn: metrics.standardProduction,
    exp_prodn: metrics.expectedProduction,
    effi_percent: metrics.efficiencyPercent,
    uti_percent: metrics.utilizationPercent,
    waste: setup?.default_waste ?? null,
    waste_percent: metrics.wastePercent,
    run_time: metrics.totalTime,
    work_time: metrics.workTime,
    total_stoppage_mins: metrics.stoppageTime
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
export async function lookupCardingMachineByNo(machineNo, entryDate = null, shift = null) {
  // Prefer active machine; fall back to any machine with this number
  const activeMachine = await prisma.carding_machines.findFirst({
    where: { machine_no: { equals: machineNo }, is_active: true }
  })
  const machine = activeMachine || await prisma.carding_machines.findFirst({
    where: { machine_no: { equals: machineNo } },
    orderBy: { is_active: 'desc' }
  })
  if (!machine) return null

  const scopedDate = entryDate ? parseStrictDate(entryDate, 'Carding entry date') : null
  const scopedShift = shift == null ? null : Number(shift)
  if (scopedShift !== null && (!Number.isInteger(scopedShift) || scopedShift < 1 || scopedShift > 3)) {
    throw new Error('Carding shift must be 1, 2, or 3')
  }

  // A setup is date/shift scoped. Do not let an unrelated historical row make
  // the current entry look configured.
  const setup = await prisma.carding_machine_setup.findFirst({
    where: {
      machine_id: machine.id,
      ...(scopedDate ? { entry_date: scopedDate } : {}),
      ...(scopedShift !== null ? { shift: scopedShift } : {})
    },
    ...(scopedDate ? {} : { orderBy: [{ entry_date: 'desc' }, { shift: 'desc' }] })
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

async function addDateScopedCardingMachine(machineData, entryDate, shift) {
  const activationDate = parseStrictDate(entryDate, 'Carding entry date')
  const shiftNum = Number(shift)
  if (!Number.isInteger(shiftNum) || shiftNum < 1 || shiftNum > 3) {
    throw new Error('Carding shift must be 1, 2, or 3')
  }

  const machineNo = String(machineData?.machine_no ?? '').trim()
  if (!machineNo) throw new Error('Machine number is required')
  const mixing = normalizeMixingValue(machineData?.prodn_mixing || '64COMBED GOLD')
  const formulaInputs = resolveCardingFormulaInputs(machineData)
  const setupShiftTime = Number(machineData?.shift_time ?? await getCardingShiftTime(shiftNum))
  const defaultStoppage = Number(machineData?.default_stoppage ?? await getCardingDefaultStoppage(shiftNum))
  const setupValues = normalizeCardingSetupUpdates({
    speed: formulaInputs.speed,
    hank_constant: formulaInputs.hankConstant,
    std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
    divisor_constant: formulaInputs.divisorConstant,
    shift_time: setupShiftTime,
    default_waste: machineData?.default_waste ?? 0.34,
    default_stoppage: defaultStoppage
  })
  if (setupValues.default_stoppage > setupValues.shift_time) {
    throw new Error('Default stoppage cannot exceed shift time')
  }
  const stdProdn = calculateCardingStdProdn(setupValues, setupValues.shift_time)
  if (!(stdProdn > 0)) throw new Error('Carding setup values must produce standard production')
  const installedDate = machineData?.installed_date
    ? parseStrictDate(machineData.installed_date, 'Installed date')
    : null

  const result = await prisma.$transaction(async tx => {
    const activeDuplicate = await tx.carding_machines.findFirst({
      where: { machine_no: { equals: machineNo }, is_active: true },
      select: { id: true }
    })
    if (activeDuplicate) throw new Error(`Machine ${machineNo} already exists and is active`)

    const [maxMachine, maxSort] = await Promise.all([
      tx.carding_machines.findFirst({ orderBy: { mc_id: 'desc' }, select: { mc_id: true } }),
      tx.carding_machines.aggregate({ _max: { sort_order: true } })
    ])
    const nextMcId = (maxMachine?.mc_id ?? 0) + 1
    const machine = await tx.carding_machines.create({
      data: {
        machine_no: machineNo,
        mc_id: nextMcId,
        sort_order: (maxSort._max.sort_order ?? 0) + 1,
        description: String(machineData?.description || machineNo).trim(),
        make_name: String(machineData?.make_name || 'LMW').trim(),
        model: machineData?.model ? String(machineData.model).trim() : null,
        prodn_mixing: mixing,
        speed: Math.round(setupValues.speed),
        prodn_efficiency: setupValues.std_efficiency_factor,
        hank_constant: setupValues.hank_constant,
        installed_date: installedDate,
        is_active: true,
        activated_at: activationDate,
        deactivated_at: null,
        updated_at: new Date()
      }
    })
    const setup = await tx.carding_machine_setup.create({
      data: {
        machine_id: machine.id,
        entry_date: activationDate,
        shift: shiftNum,
        ...setupValues,
        std_prodn: Math.round(stdProdn * 100) / 100,
        updated_at: new Date()
      }
    })
    return { machine, setup }
  }, { isolationLevel: 'Serializable' })

  const header = await prisma.carding_production_header.findFirst({
    where: { entry_date: activationDate, shift: shiftNum },
    select: { id: true, shift: true }
  })
  if (header) await syncNewMachinesToHeader(header.id, header.shift)
  return { ...result, reactivated: false, syncedHeaders: header ? 1 : 0 }
}

// Add a new carding machine
export async function addCardingMachine(machineData, entryDate = null, shift = 1) {
  if (entryDate) return addDateScopedCardingMachine(machineData, entryDate, shift)
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
        // An inactive row is a completed historical lifecycle. Adding the same
        // number creates a new row below instead of rewriting past entries.
        where: { machine_no: machineData.machine_no, is_active: true }
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
export async function removeCardingMachine(machineId, entryDate = null) {
  try {
    const current = await prisma.carding_machines.findUnique({ where: { id: machineId } })
    if (!current) throw new Error('Carding machine not found')
    if (!current.is_active) return current

    const deactivationDate = entryDate
      ? parseStrictDate(entryDate, 'Carding entry date')
      : new Date()
    const data = await prisma.carding_machines.update({
      where: { id: machineId },
      data: { is_active: false, deactivated_at: deactivationDate, updated_at: new Date() }
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
