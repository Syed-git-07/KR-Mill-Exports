import { prisma } from '../prisma'
import { format } from 'date-fns'
import { resolveComberShiftFallbackTime } from '../comberShiftFallback'
import {
  COMBER_FORMULA_FALLBACK,
  calculateComberConstantFromSlHank,
  resolveComberFormulaInputs,
} from '../comberFormulaFallback'

// ============================================
// COMBER CONSTANTS
// ============================================

// Stoppage reasons for Comber machines
export const COMBER_STOPPAGE_REASONS = [
  'Power Cut',
  'Breakdown',
  'No Material',
  'Quality Issue',
  'Cleaning',
  'Doffing',
  'Can Change',
  'Lap Change',
  'Piecing',
  'Maintenance',
  'Tea Break',
  'Lunch Break',
  'Meeting',
  'Other'
]

function isMachineVisibleOnDate(machine, entryDate) {
  if (!machine) return false
  const date = entryDate ? new Date(entryDate) : null
  if (!date) return true

  const activated = machine.activated_at ? new Date(machine.activated_at) : null
  const deactivated = machine.deactivated_at ? new Date(machine.deactivated_at) : null

  if (activated && activated > date) return false
  if (deactivated && deactivated <= date) return false
  return true
}

// ============================================
// SHIFT CONFIGURATION QUERIES
// ============================================

// Get shift configuration for COMBER department from database
export async function getComberShiftConfig(shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'COMBER',
        shift: parseInt(shift),
        is_active: true
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Get shift time for comber based on shift number
// Shift 1: 510 minutes, Shift 2: 510 minutes, Shift 3: 420 minutes
export async function getComberShiftTime(shift) {
  const config = await getComberShiftConfig(shift)
  return config?.shift_time || resolveComberShiftFallbackTime(shift)
}

// Get shift configuration object (for use in functions that need totalTime)
// Comber has no default stoppage - stoppage is entered manually
export async function getComberShiftConfiguration(shift) {
  const config = await getComberShiftConfig(shift)
  const shiftTime = config?.shift_time || resolveComberShiftFallbackTime(shift)
  return { 
    totalTime: shiftTime
  }
}

// ============================================
// COMBER PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers
export async function getComberProductionHeaders() {
  try {
    const data = await prisma.comber_production_header.findMany({
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
export async function getComberProductionByDateShift(date, shift) {
  try {
    // Handle date as string to avoid timezone conversion issues
    let dateStr
    if (typeof date === 'string') {
      dateStr = date // Already in yyyy-MM-dd format
    } else if (date instanceof Date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      dateStr = `${year}-${month}-${day}`
    } else {
      throw new Error('Invalid date format')
    }
    
    // Use raw SQL to avoid timezone conversion
    const results = await prisma.$queryRaw`
      SELECT * FROM comber_production_header 
      WHERE DATE(entry_date) = ${dateStr} 
      AND shift = ${shift}
      LIMIT 1
    `
    
    if (results.length === 0) return null
    
    const header = results[0]
    
    // Return the header directly (supervisor info will be fetched separately if needed)
    const data = await prisma.comber_production_header.findUnique({
      where: { id: header.id }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Create or get production header
export async function getOrCreateComberProductionHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getComberProductionByDateShift(date, shift)
  if (existing) return existing

  // Handle date as string to avoid timezone issues
  let dateStr
  if (typeof date === 'string') {
    dateStr = date // Already in yyyy-MM-dd format
  } else if (date instanceof Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    dateStr = `${year}-${month}-${day}`
  } else {
    throw new Error('Invalid date format')
  }

  // Get shift-specific time from shift_config
  const shiftConfig = await getComberShiftConfiguration(shift)
  const totalTime = shiftConfig.totalTime

  // Create new header using raw SQL to avoid timezone issues
  try {
    const result = await prisma.$executeRaw`
      INSERT INTO comber_production_header (id, entry_date, shift, supervisor_id, maisitry_id, total_time)
      VALUES (UUID(), ${dateStr}, ${shift}, ${supervisorId || null}, ${maisitryId || null}, ${totalTime})
    `
    
    // Fetch the created record
    const data = await getComberProductionByDateShift(date, shift)
    return data
  } catch (error) {
    throw error
  }
}

// Update production header
export async function updateComberProductionHeader(id, updates) {
  try {
    const data = await prisma.comber_production_header.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// COMBER PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getComberProductionDetails(headerId) {
  try {
    // Get entry date for date-visibility filter
    const header = await prisma.comber_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date ? new Date(header.entry_date) : null

    const data = await prisma.comber_production_detail.findMany({
      where: { header_id: headerId },
      orderBy: { machine_id: 'asc' }
    })

    const machineIds = [...new Set((data || []).map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.comber_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            description: true,
            mc_id: true,
            activated_at: true,
            deactivated_at: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const withMachine = (data || []).map(d => ({
      ...d,
      machine: machineMap[d.machine_id] || null
    }))

    // Filter out machines not visible on entry date (safety net for stale rows)
    if (entryDate) {
      return withMachine.filter(d => isMachineVisibleOnDate(d.machine, entryDate))
    }
    return withMachine
  } catch (error) {
    throw error
  }
}

// Get production details with machine setup for a header (for display)
export async function getComberProductionWithSetup(headerId) {
  try {
    const data = await prisma.comber_production_detail.findMany({
      where: { header_id: headerId }
    })

    const machineIds = [...new Set((data || []).map(d => d.machine_id).filter(Boolean))]
    const detailIds = (data || []).map(d => d.id)

    const [machines, stoppages] = await Promise.all([
      machineIds.length > 0
        ? prisma.comber_machines.findMany({
            where: { id: { in: machineIds } },
            select: {
              id: true,
              machine_no: true,
              description: true,
              mc_id: true,
              is_active: true,
              activated_at: true,
              deactivated_at: true
            }
          })
        : Promise.resolve([]),
      detailIds.length > 0
        ? prisma.comber_stoppage_entry.findMany({
            where: { production_detail_id: { in: detailIds } },
            select: {
              id: true,
              production_detail_id: true,
              total_stoppage_time: true,
              stoppage1_id: true,
              stoppage1_time: true,
              stoppage2_id: true,
              stoppage2_time: true,
              stoppage3_id: true,
              stoppage3_time: true,
              stoppage4_id: true,
              stoppage4_time: true,
              is_full_stoppage: true
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
      if (!stoppageMap[s.production_detail_id]) {
        stoppageMap[s.production_detail_id] = []
      }
      stoppageMap[s.production_detail_id].push(s)
    })

    const enriched = (data || []).map(d => ({
      ...d,
      machine: machineMap[d.machine_id] || null,
      stoppage: stoppageMap[d.id] || []
    }))

    // Sort by natural machine number order (CO1, CO2, ... CO10, CO11)
    return enriched?.sort((a, b) => {
      const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
      const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
      return aNum - bNum
    }) || []
  } catch (error) {
    throw error
  }
}

// Initialize production details for all comber machines
// totalTime comes from shift_config based on shift (510/510/420)
export async function initializeComberProductionDetails(headerId, totalTime = resolveComberShiftFallbackTime(1)) {
  try {
    // Get entry date from header for date-visibility filter
    const header = await prisma.comber_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    // Get machines visible on this date and keep setup-only machines
    const [allVisibleMachines, setups] = await Promise.all([
      prisma.comber_machines.findMany({
        where: {
          activated_at: { lte: entryDate },
          OR: [
            { deactivated_at: null },
            { deactivated_at: { gt: entryDate } }
          ]
        },
        orderBy: { sort_order: 'asc' }
      }),
      prisma.comber_machine_setup.findMany()
    ])

    const setupMachineIds = new Set((setups || []).map(s => s.machine_id))
    const machines = (allVisibleMachines || []).filter(m => setupMachineIds.has(m.id))
    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Create detail records for each machine
    // work_time starts as totalTime (full shift time), will be reduced when stoppages are entered
    const details = machines.map(machine => {
      const setup = setupMap[machine.id] || {}
      return {
        header_id: headerId,
        machine_id: machine.id,
        prodn_mixing: setup.prodn_mixing || '64COMBED GOLD',
        act_hank: 0,
        run_hrs: 0,
        run_min: 0,
        waste: setup.default_waste ?? null,
        act_prodn: 0,
        waste_percent: 0,
        act_effi_percent: 0,
        uti_percent: 0,
        std_hrs: 0,
        work_time: totalTime,  // Start with full shift time, reduced by stoppages
        session_no: setup.session_no || 1
      }
    })

    await prisma.comber_production_detail.createMany({
      data: details
    })

    // Get the created details
    const createdDetails = await prisma.comber_production_detail.findMany({
      where: { header_id: headerId }
    })

    // Initialize stoppage entries for each detail with 0 stoppage (user enters manually)
    const stoppageEntries = createdDetails.map(detail => ({
      production_detail_id: detail.id,
      stoppage1_time: 0,
      stoppage2_time: 0,
      stoppage3_time: 0,
      stoppage4_time: 0,
      total_stoppage_time: 0
    }))

    await prisma.comber_stoppage_entry.createMany({
      data: stoppageEntries
    })

    return createdDetails
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateComberProductionDetail(id, updates) {
  try {
    const data = await prisma.comber_production_detail.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Bulk update production details
export async function bulkUpdateComberProductionDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    prisma.comber_production_detail.update({
      where: { id },
      data
    })
  )

  const results = await Promise.all(promises)
  return results
}

// ============================================
// COMBER STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getComberStoppageEntries(headerId) {
  try {
    // Get entry date for date-visibility filter
    const header = await prisma.comber_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date ? new Date(header.entry_date) : null

    // First get production details for this header
    const details = await prisma.comber_production_detail.findMany({
      where: {
        header_id: headerId
      },
      select: { 
        id: true
      }
    })

    const detailIds = details?.map(d => d.id) || []
    
    // Now get stoppage entries only for these production details
    const data = await prisma.comber_stoppage_entry.findMany({
      where: {
        production_detail_id: {
          in: detailIds
        }
      },
      select: {
        id: true,
        production_detail_id: true,
        stoppage1_id: true,
        stoppage1_time: true,
        stoppage2_id: true,
        stoppage2_time: true,
        stoppage3_id: true,
        stoppage3_time: true,
        stoppage4_id: true,
        stoppage4_time: true,
        total_stoppage_time: true,
        is_full_stoppage: true
      },
      orderBy: {
        production_detail_id: 'asc'
      }
    })

    const stoppageDetailIds = [...new Set((data || []).map(s => s.production_detail_id).filter(Boolean))]
    const productionDetails = stoppageDetailIds.length > 0
      ? await prisma.comber_production_detail.findMany({
          where: { id: { in: stoppageDetailIds } },
          select: {
            id: true,
            machine_id: true,
            run_hrs: true,
            act_effi_percent: true,
            std_hrs: true,
            work_time: true,
            uti_percent: true,
            session_no: true
          }
        })
      : []

    const machineIds = [...new Set((productionDetails || []).map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.comber_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            is_active: true,
            activated_at: true,
            deactivated_at: true
          }
        })
      : []

    const reasonIds = [...new Set(
      (data || []).flatMap(s => [s.stoppage1_id, s.stoppage2_id, s.stoppage3_id, s.stoppage4_id]).filter(Boolean)
    )]
    const reasons = reasonIds.length > 0
      ? await prisma.stoppage_details.findMany({
          where: { id: { in: reasonIds } },
          select: {
            id: true,
            stoppage_name: true,
            short_code: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const detailMap = {}
    productionDetails.forEach(d => {
      detailMap[d.id] = {
        ...d,
        machine: machineMap[d.machine_id] || null
      }
    })

    const reasonMap = {}
    reasons.forEach(r => {
      reasonMap[r.id] = r
    })

    const enriched = (data || []).map(s => ({
      ...s,
      production_detail: detailMap[s.production_detail_id] || null,
      stoppage1: s.stoppage1_id ? (reasonMap[s.stoppage1_id] || null) : null,
      stoppage2: s.stoppage2_id ? (reasonMap[s.stoppage2_id] || null) : null,
      stoppage3: s.stoppage3_id ? (reasonMap[s.stoppage3_id] || null) : null,
      stoppage4: s.stoppage4_id ? (reasonMap[s.stoppage4_id] || null) : null
    }))

    // Filter stoppages to only those for machines visible on entry date (safety net)
    if (entryDate) {
      return enriched.filter(s => {
        const machine = s.production_detail?.machine
        return isMachineVisibleOnDate(machine, entryDate)
      })
    }
    return enriched
  } catch (error) {
    throw error
  }
}

// Update stoppage entry
export async function updateComberStoppageEntry(id, updates) {
  try {
    // First, fetch the existing record to get current stoppage values and production_detail_id
    const existing = await prisma.comber_stoppage_entry.findUnique({
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
    const total = mergedStoppages.stoppage1_time + 
                  mergedStoppages.stoppage2_time + 
                  mergedStoppages.stoppage3_time + 
                  mergedStoppages.stoppage4_time

    const data = await prisma.comber_stoppage_entry.update({
      where: { id },
      data: {
        ...updates,
        ...mergedStoppages,
        total_stoppage_time: total
      }
    })

    // Resolve shift time from shift_config (DB-first) using this detail's header shift.
    const detail = await prisma.comber_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: {
        id: true,
        header_id: true,
        machine_id: true,
        act_hank: true,
        run_hrs: true,
        waste: true
      }
    })
    const header = detail?.header_id
      ? await prisma.comber_production_header.findUnique({
          where: { id: detail.header_id },
          select: { shift: true }
        })
      : null

    const shiftConfig = await getComberShiftConfiguration(header?.shift || 1)
    const totalTime = shiftConfig.totalTime
    const setup = detail?.machine_id
      ? await prisma.comber_machine_setup.findFirst({
          where: { machine_id: detail.machine_id }
        })
      : null

    // Recalculate all dependent production values when stoppage changes.
    const recalculated = calculateComberProductionValues(
      detail?.act_hank ?? 0,
      detail?.run_hrs ?? 0,
      detail?.waste,
      totalTime,
      total,
      setup
    )

    await prisma.comber_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        total_stoppage_mins: total,
        ...recalculated
      }
    })

    return data
  } catch (error) {
    throw error
  }
}

// Apply full stoppage to all machines
export async function applyComberFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  try {
    // Get all stoppage entries for this header
    const stoppages = await getComberStoppageEntries(headerId)

    const appliedRows = []

    // Apply full stoppage to all machines
    for (const s of stoppages) {
      const updateData = {}
      updateData[`stoppage${slot}_id`] = stoppageId
      updateData[`stoppage${slot}_time`] = parseInt(stoppageTime) || 0
      if (slot === 1) {
        updateData.is_full_stoppage = true
      }

      const result = await updateComberStoppageEntry(s.id, updateData)
      appliedRows.push(result)
    }

    return {
      success: true,
      data: appliedRows
    }
  } catch (error) {
    console.error('applyComberFullStoppage error:', error)
    throw error
  }
}

// Apply partial stoppage to machine range (auto-slot allocation, no manual slot parameter)
export async function applyComberPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    // Helper to pick first available slot (1 -> 2 -> 3 -> 4)
    const pickFirstAvailableSlot = (entry) => {
      for (let i = 1; i <= 4; i++) {
        const slotValue = entry?.[`stoppage${i}_id`]
        if (slotValue === null || slotValue === undefined || slotValue === '') {
          return i
        }
      }
      return null
    }

    // Get all production details for this header
    const details = await prisma.comber_production_detail.findMany({
      where: { header_id: headerId },
      select: {
        id: true,
        machine_id: true
      }
    })

    const machineIds = [...new Set((details || []).map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.comber_machines.findMany({
          where: {
            id: { in: machineIds },
            is_active: true
          },
          select: {
            id: true,
            machine_no: true,
            mc_id: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const detailsWithMachine = (details || []).map(d => ({
      ...d,
      machine: machineMap[d.machine_id] || null
    }))

    // Filter by machine range
    const fromNum = parseInt(String(fromMachineNo || '').replace(/\D/g, '') || '0')
    const toNum = parseInt(String(toMachineNo || '').replace(/\D/g, '') || '999')
    const minNum = Math.min(fromNum, toNum)
    const maxNum = Math.max(fromNum, toNum)

    const filteredDetails = detailsWithMachine?.filter(d => {
      if (!d.machine?.machine_no) return false  // Skip orphaned records
      const mcNum = parseInt(d.machine.machine_no.replace(/\D/g, ''))
      return mcNum >= minNum && mcNum <= maxNum
    }) || []

    if (filteredDetails.length === 0) {
      throw new Error(`No machines found in range ${fromMachineNo} to ${toMachineNo}`)
    }

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id)
    const stoppages = await prisma.comber_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: detailIds }
      }
    })

    let updatedCount = 0
    let overflowCount = 0
    let skippedCount = 0
    const appliedRows = []

    // Apply partial stoppage with auto-slot allocation per machine
    for (const stoppage of stoppages) {
      // Auto-allocate first available slot
      const resolvedSlot = pickFirstAvailableSlot(stoppage)
      
      if (!resolvedSlot) {
        // All slots are full
        overflowCount++
        continue
      }

      // Prepare update data for the resolved slot
      const updateData = {}
      updateData[`stoppage${resolvedSlot}_id`] = stoppageId
      updateData[`stoppage${resolvedSlot}_time`] = parseInt(stoppageTime) || 0

      // Update the stoppage entry using the helper function
      const result = await updateComberStoppageEntry(stoppage.id, updateData)
      appliedRows.push(result)
      updatedCount++
    }

    return {
      success: true,
      data: {
        updatedCount,
        skippedCount,
        overflowCount,
        appliedRows
      }
    }
  } catch (error) {
    console.error('applyComberPartialStoppage error:', error)
    throw error
  }
}

// ============================================
// COMBER MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info
export async function getComberMachineSetups() {
  try {
    const setups = await prisma.comber_machine_setup.findMany({
      orderBy: { machine_id: 'asc' }
    })

    const machineIds = [...new Set((setups || []).map(s => s.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.comber_machines.findMany({
          where: {
            id: { in: machineIds },
            is_active: true
          },
          select: {
            id: true,
            machine_no: true,
            description: true,
            mc_id: true,
            make_name: true,
            prodn_mixing: true,
            speed: true,
            mc_effi: true,
            is_active: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    return (setups || [])
      .map(setup => ({
        ...setup,
        machine: machineMap[setup.machine_id] || null
      }))
      .filter(setup => setup.machine)
  } catch (error) {
    throw error
  }
}

// Update machine setup
export async function updateComberMachineSetup(setupId, updates) {
  try {
    // Recalculate constant if sl_hank changes
    if (updates.sl_hank !== undefined) {
      updates.constant = calculateComberConstantFromSlHank(updates.sl_hank)
    }

    const data = await prisma.comber_machine_setup.update({
      where: { id: setupId },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Create new machine setup
export async function createComberMachineSetup(setupData) {
  try {
    // Calculate constant from sl_hank
    if (setupData.sl_hank) {
      setupData.constant = calculateComberConstantFromSlHank(setupData.sl_hank)
    }

    const data = await prisma.comber_machine_setup.create({
      data: setupData
    })
    return data
  } catch (error) {
    throw error
  }
}

// Add new comber machine (creates both machine and setup)
export async function addComberMachine(machineData) {
  try {
    const requestedShift = Number.parseInt(machineData?.shift, 10)
    const effectiveShift = Number.isFinite(requestedShift) && requestedShift > 0 ? requestedShift : 1
    const shiftConfig = await getComberShiftConfiguration(effectiveShift)
    const setupShiftTime = shiftConfig.totalTime
    const defaultSlHank = machineData.sl_hank || COMBER_FORMULA_FALLBACK.slHank
    const defaultMcEffi = machineData.mc_effi ?? COMBER_FORMULA_FALLBACK.mcEffiFactor

    // Check if machine_no already exists (might be inactive)
    if (machineData.machine_no) {
      const existingMachine = await prisma.comber_machines.findFirst({
        where: { machine_no: machineData.machine_no }
      })

      if (existingMachine && !existingMachine.is_active) {
        // Reactivate the existing machine
        const reactivated = await prisma.comber_machines.update({
          where: { id: existingMachine.id },
          data: {
            is_active: true,
            activated_at: new Date(),
            deactivated_at: null,
            description: machineData.description || existingMachine.machine_no,
            make_name: machineData.make_name || 'LMW',
            model: machineData.model || null,
            prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
            speed: machineData.speed || 350,
            mc_effi: defaultMcEffi
          }
        })
        
        // Check if setup exists, create if not
        const slHank = defaultSlHank
        let existingSetup = await prisma.comber_machine_setup.findFirst({
          where: { machine_id: existingMachine.id }
        })
        
        let setup = existingSetup
        if (existingSetup) {
          // Update existing setup
          await prisma.comber_machine_setup.update({
            where: { id: existingSetup.id },
            data: {
              prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
              session_no: machineData.session_no || machineData.session || 1,
              cc_time: machineData.cc_time || 0,
              sl_hank: slHank,
              mc_effi: defaultMcEffi,
              constant: calculateComberConstantFromSlHank(slHank)
            }
          })
        } else {
          // Create setup if it doesn't exist
          setup = await prisma.comber_machine_setup.create({
            data: {
              machine_id: existingMachine.id,
              prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
              session_no: machineData.session_no || machineData.session || 1,
              cc_time: machineData.cc_time || 0,
              sl_hank: slHank,
              mc_effi: defaultMcEffi,
              constant: calculateComberConstantFromSlHank(slHank),
              shift_time: setupShiftTime,
              default_waste: machineData.default_waste ?? null
            }
          })
        }
        
        // Sync reactivated machine to ALL existing production headers
        return { machine: reactivated, setup, reactivated: true }
      }

      if (existingMachine && existingMachine.is_active) {
        // Check if setup exists — only throw if setup is already present
        const existingSetup = await prisma.comber_machine_setup.findFirst({
          where: { machine_id: existingMachine.id }
        })
        if (existingSetup) {
          throw new Error(`Machine ${machineData.machine_no} already exists and is active`)
        }
        // Active but no setup — create the setup for the existing machine (do NOT create a new machine)
        const slHank = defaultSlHank
        const newSetup = await prisma.comber_machine_setup.create({
          data: {
            machine_id: existingMachine.id,
            prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
            session_no: machineData.session_no || machineData.session || 1,
            cc_time: machineData.cc_time || 0,
            sl_hank: slHank,
            mc_effi: defaultMcEffi,
            constant: calculateComberConstantFromSlHank(slHank),
            shift_time: setupShiftTime,
            default_waste: machineData.default_waste ?? null
          }
        })
        return { machine: existingMachine, setup: newSetup, reactivated: false }
      }
    }

    // Get the max mc_id and sort_order to generate next values
    const maxMachine = await prisma.comber_machines.findFirst({
      orderBy: { mc_id: 'desc' }
    })
    const maxSortResult = await prisma.comber_machines.aggregate({ _max: { sort_order: true } })

    const nextMcId = (maxMachine?.mc_id || 0) + 1
    const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1
    const nextMachineNo = machineData.machine_no || `CO${nextMcId}`

    // Insert new machine
    const newMachine = await prisma.comber_machines.create({
      data: {
        machine_no: nextMachineNo,
        mc_id: nextMcId,
        description: machineData.description || `COMBER ${nextMcId}`,
        make_name: machineData.make_name || 'LMW',
        model: machineData.model || null,
        prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
        speed: machineData.speed || 350,
        mc_effi: defaultMcEffi,
        installed_date: machineData.installed_date ? new Date(machineData.installed_date) : null,
        is_active: true,
        activated_at: new Date(),
        sort_order: nextSortOrder
      }
    })

    // Insert corresponding machine setup
    const slHank = defaultSlHank
    const newSetup = await prisma.comber_machine_setup.create({
      data: {
        machine_id: newMachine.id,
        prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
        session_no: machineData.session_no || machineData.session || 1,
        cc_time: machineData.cc_time || 0,
        sl_hank: slHank,
        mc_effi: defaultMcEffi,
        constant: calculateComberConstantFromSlHank(slHank),
        shift_time: setupShiftTime,
        default_waste: machineData.default_waste ?? null
      }
    })

    // Sync new machine to ALL existing production headers
    return { machine: newMachine, setup: newSetup }
  } catch (error) {
    throw error
  }
}

// Remove comber machine (soft delete)
export async function removeComberMachine(machineId) {
  try {
    const data = await prisma.comber_machines.update({
      where: { id: machineId },
      data: { is_active: false, deactivated_at: new Date() }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Delete machine setup
export async function deleteComberMachineSetup(machineId) {
  try {
    await prisma.comber_machine_setup.deleteMany({
      where: { machine_id: machineId }
    })
    return true
  } catch (error) {
    throw error
  }
}

// Get all comber machines
export async function getComberMachines() {
  try {
    const data = await prisma.comber_machines.findMany({
      orderBy: { mc_id: 'asc' }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Bulk update machine count - updates both machine setup and all production details
export async function bulkUpdateComberMachineCount(machineIds, newCount) {
  try {
    const promises = machineIds.map(machineId => 
      prisma.comber_machine_setup.updateMany({
        where: { machine_id: machineId },
        data: { prodn_mixing: newCount }
      })
    )
    await Promise.all(promises)
    
    // Also update all production details for these machines to sync mixing
    await prisma.comber_production_detail.updateMany({
      where: { machine_id: { in: machineIds } },
      data: { prodn_mixing: newCount }
    })
    
    return true
  } catch (error) {
    throw error
  }
}

// Get comber stoppage reasons (filtered by COMBER department)
export async function getComberStoppageReasons() {
  try {
    // First get the COMBER department ID
    const comberDept = await prisma.departments.findFirst({
      where: { dept_name: 'COMBER' }
    })

    if (!comberDept?.id) return []

    const rows = await prisma.$queryRaw`
      SELECT
        sd.id,
        sd.stoppage_name,
        sd.short_code,
        sd.stoppage_head_id,
        COALESCE(sh.stoppage_head_name, 'General') AS stoppage_head_name
      FROM stoppage_details sd
      LEFT JOIN stoppage_heads sh ON sh.id = sd.stoppage_head_id
      WHERE sd.is_active = 1
        AND sd.department_id = ${comberDept.id}
      ORDER BY sd.stoppage_name ASC
    `

    return (rows || []).map(item => ({
      ...item,
      category: item.stoppage_head_name || 'General'
    }))
  } catch (error) {
    throw error
  }
}

// Update machine count (alias for updateComberMachineSetup for count/mixing)
// Also updates all production details for the machine to sync mixing
export async function updateComberMachineCount(machineId, newCount) {
  try {
    const data = await prisma.comber_machine_setup.updateMany({
      where: { machine_id: machineId },
      data: { prodn_mixing: newCount }
    })
    
    // Also update all production details for this machine to sync mixing
    await prisma.comber_production_detail.updateMany({
      where: { machine_id: machineId },
      data: { prodn_mixing: newCount }
    })
    
    return data
  } catch (error) {
    throw error
  }
}

// Sync new machines to header - create production details for newly added machines
export async function syncNewMachinesToComberHeader(headerId, shift = 1) {
  try {
    // Get shift configuration for totalTime
    const shiftConfig = await getComberShiftConfiguration(shift)
    const totalTime = shiftConfig.totalTime
    
    // Get entry date from header for date-visibility filter
    const header = await prisma.comber_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const [allVisibleMachines, setups] = await Promise.all([
      prisma.comber_machines.findMany({
        where: {
          activated_at: { lte: entryDate },
          OR: [
            { deactivated_at: null },
            { deactivated_at: { gt: entryDate } }
          ]
        },
        select: { id: true, machine_no: true, prodn_mixing: true },
        orderBy: { sort_order: 'asc' }
      }),
      prisma.comber_machine_setup.findMany()
    ])

    const setupMachineIds = new Set((setups || []).map(s => s.machine_id))
    const allMachines = (allVisibleMachines || []).filter(m => setupMachineIds.has(m.id))

    // Get existing production details for this header
    const existingDetails = await prisma.comber_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    // Delete stale rows (machines no longer visible on this date)
    const validMachineIds = new Set(allMachines.map(m => m.id))
    const staleDetails = existingDetails.filter(d => d.machine_id && !validMachineIds.has(d.machine_id))
    for (const stale of staleDetails) {
      await prisma.comber_stoppage_entry.deleteMany({ where: { production_detail_id: stale.id } })
      await prisma.comber_production_detail.delete({ where: { id: stale.id } })
    }

    // Find machines that don't have details yet
    const existingMachineIds = new Set(existingDetails?.map(d => d.machine_id) || [])
    const newMachines = allMachines?.filter(m => !existingMachineIds.has(m.id)) || []

    if (newMachines.length === 0) {
      return [] // No new machines to add
    }

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Create detail records for new machines
    const newDetails = []
    for (const machine of newMachines) {
      const setup = setupMap[machine.id] || {}
      const detail = await prisma.comber_production_detail.create({
        data: {
          header_id: headerId,
          machine_id: machine.id,
          employee_name: '',
          prodn_mixing: setup.prodn_mixing || machine.prodn_mixing || '64COMBED GOLD',
          act_hank: 0,
          run_hrs: 0,
          run_min: 0,
          waste: setup.default_waste ?? null,
          act_prodn: 0,
          waste_percent: 0,
          act_effi_percent: 0,
          uti_percent: 0,
          std_hrs: 0,
          work_time: totalTime,  // Start with full shift time
          session_no: setup.session_no || 1,
          total_stoppage_mins: 0
        }
      })

      // Create corresponding stoppage entry with 0 stoppage (user enters manually)
      await prisma.comber_stoppage_entry.create({
        data: {
          production_detail_id: detail.id,
          stoppage1_id: null,
          stoppage1_time: 0,
          stoppage2_id: null,
          stoppage2_time: 0,
          stoppage3_id: null,
          stoppage3_time: 0,
          stoppage4_id: null,
          stoppage4_time: 0,
          total_stoppage_time: 0,
          is_full_stoppage: false
        }
      })

      newDetails.push(detail)
    }

    return newDetails
  } catch (error) {
    throw error
  }
}

// Get all supervisors
export async function getSupervisors() {
  try {
    const data = await prisma.supervisors.findMany({
      where: { is_active: true },
      orderBy: { supervisor_name: 'asc' }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get stoppage details for dropdown  
export async function getStoppageDetails() {
  try {
    const data = await prisma.stoppage_details.findMany({
      where: { is_active: true },
      select: {
        id: true,
        stoppage_name: true
      },
      orderBy: {
        stoppage_name: 'asc'
      }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// ============================================
// COPY FROM PREVIOUS DATE
// ============================================

// Get available previous dates for copying
export async function getComberAvailableDates(beforeDate, shift, limit = 30) {
  try {
    const dateObj = typeof beforeDate === 'string' ? new Date(beforeDate + 'T00:00:00') : beforeDate
    
    const data = await prisma.comber_production_header.findMany({
      where: {
        entry_date: { lt: dateObj },
        shift: shift
      },
      select: {
        entry_date: true,
        shift: true
      },
      orderBy: {
        entry_date: 'desc'
      },
      take: limit,
      distinct: ['entry_date']
    })
    
    return data
  } catch (error) {
    throw error
  }
}

// Copy production data from previous date
export async function copyComberFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate, sourceShift) {
  try {
    // Handle various date formats - ensure we get yyyy-mm-dd string
    let sourceDateStr
    if (typeof sourceDate === 'string') {
      // Already a string, use as is (should be yyyy-mm-dd format)
      sourceDateStr = sourceDate
    } else if (sourceDate instanceof Date) {
      // Convert Date object to yyyy-mm-dd string
      const year = sourceDate.getFullYear()
      const month = String(sourceDate.getMonth() + 1).padStart(2, '0')
      const day = String(sourceDate.getDate()).padStart(2, '0')
      sourceDateStr = `${year}-${month}-${day}`
    } else {
      throw new Error('Invalid source date format')
    }
    
    console.log('Searching for comber header:', {
      sourceDateStr,
      sourceShift
    })
    
    // Query using DATE() function in raw SQL to avoid timezone issues
    // This ensures we compare date-only values without timezone conversion
    const sourceHeaders = await prisma.$queryRaw`
      SELECT * FROM comber_production_header 
      WHERE DATE(entry_date) = ${sourceDateStr} 
      AND shift = ${sourceShift}
      LIMIT 1
    `
    
    const sourceHeader = sourceHeaders?.[0]
    
    console.log('Source header found:', sourceHeader ? 'Yes' : 'No')
    
    if (!sourceHeader) {
      throw new Error('Source date data not found')
    }
    
    // Get source production details
    const sourceDetails = await prisma.comber_production_detail.findMany({
      where: { header_id: sourceHeader.id }
    })
    
    if (!sourceDetails || sourceDetails.length === 0) {
      throw new Error('No production data found for source date')
    }
    
    // Get target production details
    const targetDetails = await prisma.comber_production_detail.findMany({
      where: { header_id: targetHeaderId }
    })
    
    // Get source stoppage entries
    const sourceStoppages = await prisma.comber_stoppage_entry.findMany({
      where: {
        production_detail_id: {
          in: sourceDetails.map(d => d.id)
        }
      }
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
    
    // Update target details with source data (excluding IDs and calculated fields)
    const updatePromises = targetDetails.map(targetDetail => {
      const sourceDetail = sourceDataMap[targetDetail.machine_id]
      if (!sourceDetail) return null
      
      return prisma.comber_production_detail.update({
        where: { id: targetDetail.id },
        data: {
          employee_name: sourceDetail.employee_name,
          prodn_mixing: sourceDetail.prodn_mixing,
          act_hank: sourceDetail.act_hank,
          run_hrs: sourceDetail.run_hrs,
          run_min: sourceDetail.run_min,
          waste: sourceDetail.waste,
          act_prodn: sourceDetail.act_prodn,
          waste_percent: sourceDetail.waste_percent,
          act_effi_percent: sourceDetail.act_effi_percent,
          uti_percent: sourceDetail.uti_percent,
          std_hrs: sourceDetail.std_hrs,
          work_time: sourceDetail.work_time,
          total_stoppage_mins: sourceDetail.total_stoppage_mins
        }
      })
    }).filter(Boolean)
    
    await Promise.all(updatePromises)
    
    // Update target stoppage entries
    const targetStoppages = await prisma.comber_stoppage_entry.findMany({
      where: {
        production_detail_id: {
          in: targetDetails.map(d => d.id)
        }
      }
    })
    
    const stoppageUpdatePromises = targetStoppages.map(async (targetStoppage) => {
      // Find the target detail to get machine_id
      const targetDetail = targetDetails.find(d => d.id === targetStoppage.production_detail_id)
      if (!targetDetail) return null
      
      const sourceStoppage = sourceStoppageMap[targetDetail.machine_id]
      if (!sourceStoppage) return null
      
      return prisma.comber_stoppage_entry.update({
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
          total_stoppage_time: sourceStoppage.total_stoppage_time,
          is_full_stoppage: sourceStoppage.is_full_stoppage
        }
      })
    }).filter(Boolean)
    
    await Promise.all(stoppageUpdatePromises)
    
    // After copying stoppages, update production_detail.total_stoppage_mins from stoppage_entry.total_stoppage_time
    const syncPromises = targetStoppages.map(async (targetStoppage) => {
      const targetDetail = targetDetails.find(d => d.id === targetStoppage.production_detail_id)
      if (!targetDetail) return null
      
      const sourceStoppage = sourceStoppageMap[targetDetail.machine_id]
      if (!sourceStoppage) return null
      
      return prisma.comber_production_detail.update({
        where: { id: targetDetail.id },
        data: {
          total_stoppage_mins: sourceStoppage.total_stoppage_time || 0
        }
      })
    }).filter(Boolean)
    
    await Promise.all(syncPromises)
    
    return {
      copiedFrom: sourceDateStr,  // Already in yyyy-MM-dd format
      machinesUpdated: updatePromises.length
    }
  } catch (error) {
    throw error
  }
}

// Get count options from spinning_counts table
export async function getComberCountOptions() {
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

// ============================================
// CALCULATION FUNCTIONS (Pure, no Prisma)
// ============================================

// Convert RunHrs (HH.MM format) to RunMin
// Example: 5.58 -> (5 * 60) + 58 = 358
export function calculateRunMin(runHrs) {
  if (!runHrs || runHrs <= 0) return 0
  const hours = Math.floor(runHrs)
  const minutes = Math.round((runHrs - hours) * 100)
  return (hours * 60) + minutes
}

// Calculate all production values based on formula
// COMBER FORMULAS:
// - RunMin = Hours×60 + (Decimal×100)
// - WorkTime = TotalTime - TotalStoppage
// - Std.hrs = WorkTime × (MCEffi/100)
// - Act.Prodn = Act.Hank × Constant
// - Waste% = (Waste / Act.Prodn) × 100
// - Act.Effi% = (RunMin / Std.hrs) × 100
// - Uti% = (WorkTime / TotalTime) × 100
export function calculateComberProductionValues(actHank, runHrs, waste, totalTime, stoppageTime, setup) {
  const { mcEffiFactor, constant } = resolveComberFormulaInputs(setup)
  const wasteValue = waste ?? 0

  // Run Min = Hours×60 + (Decimal×100)
  const runMin = calculateRunMin(runHrs)

  // Work Time = Total Time - Stoppage Time
  const workTime = totalTime - stoppageTime

  // Std.hrs = WorkTime × MCEffi(Factor)
  const stdHrs = workTime * mcEffiFactor

  // Act.Prodn = Act.Hank × Constant
  const actProdn = actHank * constant

  // Waste% = (Waste / Act.Prodn) × 100
  const wastePercent = actProdn > 0 ? (wasteValue / actProdn) * 100 : 0

  // Act.Effi% = (RunMin / Std.hrs) × 100
  const actEffiPercent = stdHrs > 0 ? (runMin / stdHrs) * 100 : 0

  // UTI% = (WorkTime / TotalTime) × 100
  const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0

  return {
    run_min: runMin,
    work_time: workTime,
    std_hrs: Math.round(stdHrs * 10) / 10,
    act_prodn: Math.round(actProdn * 100) / 100,
    waste: waste ?? null,
    waste_percent: Math.round(wastePercent * 100) / 100,
    act_effi_percent: Math.round(actEffiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100
  }
}
