import { prisma } from '../prisma'
import { calculateSimplexProductionValues as calculateSimplexProductionValuesFromUtils } from '../utils/simplexCalculations'
import { resolveSimplexShiftFallbackTime } from '../simplexFormulaFallback'
import {
  minutesToRunHours as minutesToRunHoursShared,
  parseRunHoursToMinutes as parseRunHoursToMinutesShared
} from '../runHoursMath'
import {
  assertPositiveSetupFields,
  getOrCreateDateScopedSetups,
  positiveNumberOrFallback
} from './dateScopedMachineSetup'
import { buildStoppageUpdate, findFirstFreeStoppageSlot, getStoppageTotal } from '../stoppageSlotUtils'
import { assertActiveStoppageReasons, filterReasonsWithActiveHeads } from './stoppageValidation'
import { sanitizeProductionDetailUpdate, sanitizeProductionHeaderUpdate } from './productionDetailUpdate'
import { assertMachineUpdateCount, normalizeMixingValue, resolveMachineMixingContext } from './machineMixingUpdate'
import { buildMachineVisibilityWhere, isMachineVisibleOnDate } from './machineDateVisibility'
import { sanitizeSimplexSetupUpdate } from '../preparatorySetupValidation'
import {
  assertLifecycleCanStart,
  deactivateEntryMachines,
  normalizeMachineNumber,
  resolveEntryMachineContext,
  validateInstalledDateForActivation
} from './entryMachineLifecycle'

function parseCountTpi(tpiValue) {
  if (tpiValue == null) return null
  const match = String(tpiValue).match(/\d+(\.\d+)?/)
  if (!match) return null
  const parsed = parseFloat(match[0])
  return Number.isNaN(parsed) ? null : parsed
}

function firstFiniteNumber(values, fallback) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function isSimplexMachineVisibleOnDate(machine, entryDate) {
  return isMachineVisibleOnDate(machine, entryDate)
}

// ============================================
// SIMPLEX SHIFT CONFIG QUERIES
// ============================================

// Get shift configuration for SIMPLEX department
export async function getSimplexShiftConfig(shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'SIMPLEX',
        shift: parseInt(shift),
        is_active: true
      }
    })
    return data
  } catch (error) {
    console.error('Error fetching simplex shift config:', error)
    throw error
  }
}

// Get shift time for SIMPLEX
export async function getSimplexShiftTime(shift) {
  const config = await getSimplexShiftConfig(shift)
  return config?.shift_time || resolveSimplexShiftFallbackTime(shift)
}

// No default stoppage for SIMPLEX - always 0
export async function getSimplexDefaultStoppage(shift) {
  return 0
}

// Get full shift configuration (time + stoppage) for SIMPLEX
export async function getSimplexShiftConfiguration(shift) {
  const config = await getSimplexShiftConfig(shift)
  const shiftTime = config?.shift_time || resolveSimplexShiftFallbackTime(shift)
  
  return {
    totalTime: shiftTime,
    defaultStoppage: 0,
    workTime: shiftTime,
    config: config
  }
}

// ============================================
// SIMPLEX PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers
export async function getSimplexProductionHeaders() {
  try {
    const data = await prisma.simplex_production_header.findMany({
      orderBy: {
        entry_date: 'desc'
      }
    })
    return data
  } catch (error) {
    throw new Error(`Failed to load production headers: ${error.message}`)
  }
}

// Get production header by date and shift
export async function getSimplexProductionByDateShift(date, shift) {
  try {
    const data = await prisma.simplex_production_header.findFirst({
      where: {
        entry_date: new Date(date),
        shift: parseInt(shift)
      }
    })
    return data
  } catch (error) {
    throw new Error(`Failed to get production header: ${error.message}`)
  }
}

// Create or get production header
export async function getOrCreateSimplexProductionHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getSimplexProductionByDateShift(date, shift)
  if (existing) return existing

  // Create new header
  try {
    const shiftTime = await getSimplexShiftTime(shift)
    const data = await prisma.simplex_production_header.create({
      data: {
        entry_date: new Date(date),
        shift: parseInt(shift),
        supervisor_id: supervisorId || null,
        maisitry_id: maisitryId || null,
        total_time: shiftTime
      }
    })
    return data
  } catch (error) {
    if (error?.code === 'P2002') {
      const concurrentHeader = await getSimplexProductionByDateShift(date, shift)
      if (concurrentHeader) return concurrentHeader
    }
    throw new Error(`Failed to create production header: ${error.message}`)
  }
}

// Update production header
export async function updateSimplexProductionHeader(id, updates) {
  try {
    const data = await prisma.simplex_production_header.update({
      where: { id },
      data: {
        ...sanitizeProductionHeaderUpdate('simplex_production_header', updates),
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw new Error(`Failed to update production header: ${error.message}`)
  }
}

// ============================================
// SIMPLEX PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getSimplexProductionDetails(headerId) {
  try {
    const data = await prisma.simplex_production_detail.findMany({
      where: { header_id: headerId }
    })

    if (!data || data.length === 0) return []

    const validDetails = data.filter(d => !!d.machine_id)
    if (validDetails.length === 0) return []

    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const machineIds = validDetails.map(d => d.machine_id)
    const machines = await prisma.simplex_machines.findMany({
      where: { id: { in: machineIds } },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        machine_no: true,
        description: true,
        prodn_mixing: true,
        speed: true,
        mc_effi: true,
        tpi: true,
        no_of_spindles: true,
        is_active: true,
        activated_at: true,
        deactivated_at: true,
        sort_order: true
      }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    return validDetails
      .map(detail => ({
        ...detail,
        machine: machineMap[detail.machine_id] || null
      }))
      .filter(detail => isSimplexMachineVisibleOnDate(detail.machine, entryDate))
      .sort((a, b) => (a.machine?.sort_order || 9999) - (b.machine?.sort_order || 9999))
  } catch (error) {
    throw error
  }
}

// Get production details with machine setup for a header (for display)
export async function getSimplexProductionWithSetup(headerId) {
  try {
    const data = await prisma.simplex_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    if (!data || data.length === 0) return []

    const validDetails = data.filter(d => !!d.machine_id)
    if (validDetails.length === 0) return []

    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const detailIds = validDetails.map(d => d.id)
    const machineIds = validDetails.map(d => d.machine_id)

    const [machines, stoppages] = await Promise.all([
      prisma.simplex_machines.findMany({
        where: { id: { in: machineIds } },
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          machine_no: true,
          description: true,
          prodn_mixing: true,
          speed: true,
          mc_effi: true,
          tpi: true,
          no_of_spindles: true,
          is_active: true,
          activated_at: true,
          deactivated_at: true,
          sort_order: true
        }
      }),
      prisma.simplex_stoppage_entry.findMany({
        where: { production_detail_id: { in: detailIds } }
      })
    ])

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const stoppageMap = {}
    stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s })

    // Sort by natural machine number order (1, 2, 3... 10)
    return validDetails
      .map(detail => ({
        ...detail,
        machine: machineMap[detail.machine_id] || null,
        stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
      }))
      .filter(detail => isSimplexMachineVisibleOnDate(detail.machine, entryDate))
      .sort((a, b) => (a.machine?.sort_order || 9999) - (b.machine?.sort_order || 9999)) || []
  } catch (error) {
    throw error
  }
}

// Initialize production details for all simplex machines
export async function initializeSimplexProductionDetails(headerId) {
  try {
    // Get header entry_date for date-based machine visibility
    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, total_time: true, shift: true }
    })
    if (!header) throw new Error(`Simplex production header ${headerId} not found`)
    const entryDate = header.entry_date

    // Get all machines visible on this entry date
    const machines = await prisma.simplex_machines.findMany({
      where: {
        ...buildMachineVisibilityWhere(entryDate)
      },
      orderBy: { sort_order: 'asc' }
    })

    if (!machines || machines.length === 0) return []

    // Materialize and read only this header's exact date/shift setup snapshot.
    const setups = await getSimplexMachineSetups(headerId)

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    const headerTotalTime = header.total_time || await getSimplexShiftTime(header.shift)

    const machinesWithSetup = machines.filter(machine => !!setupMap[machine.id])

    // Create detail records for each machine
    const details = machinesWithSetup.map(machine => {
      const setup = setupMap[machine.id] || {}
      return {
        header_id: headerId,
        machine_id: machine.id,
        prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
        run_hrs: 0,
        run_min: 0,
        idle_spindles: 0,
        waste: setup.default_waste ?? null,
        act_prodn: 0,
        waste_percent: 0,
        act_effi_percent: 0,
        uti_percent: 0,
        std_hrs: 0,
        run_time: headerTotalTime,
        work_time: headerTotalTime,
        session_no: 1
      }
    })

    return await prisma.$transaction(async tx => {
      if (details.length > 0) {
        await tx.simplex_production_detail.createMany({ data: details, skipDuplicates: true })
      }
      const createdDetails = await tx.simplex_production_detail.findMany({
        where: { header_id: headerId, machine_id: { in: machinesWithSetup.map(machine => machine.id) } }
      })
      const existingStoppages = createdDetails.length > 0
        ? await tx.simplex_stoppage_entry.findMany({
            where: { production_detail_id: { in: createdDetails.map(detail => detail.id) } },
            select: { production_detail_id: true }
          })
        : []
      const stoppedIds = new Set(existingStoppages.map(entry => entry.production_detail_id))
      const missingStoppages = createdDetails
        .filter(detail => !stoppedIds.has(detail.id))
        .map(detail => ({ production_detail_id: detail.id, total_stoppage_time: 0 }))
      if (missingStoppages.length > 0) {
        await tx.simplex_stoppage_entry.createMany({ data: missingStoppages, skipDuplicates: true })
      }
      return createdDetails
    })
  } catch (error) {
    throw error
  }
}

// Add missing production details for newly added machines in an existing header
export async function addMissingSimplexProductionDetails(headerId) {
  try {
    // Get header entry_date for date-based machine visibility
    const headerForDate = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, total_time: true, shift: true }
    })
    if (!headerForDate) throw new Error(`Simplex production header ${headerId} not found`)
    const entryDate = headerForDate.entry_date

    // Get machines visible on this entry date
    const machines = await prisma.simplex_machines.findMany({
      where: {
        ...buildMachineVisibilityWhere(entryDate)
      },
      orderBy: { sort_order: 'asc' }
    })

    // Get existing detail records for this header
    const existingDetails = await prisma.simplex_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    const validExistingDetails = existingDetails.filter(d => !!d.machine_id)

    // Synchronization is additive; invalid or non-visible historical rows are
    // preserved for audit and are excluded by the entry-date read filters.
    const remainingMachineIds = validExistingDetails.map(d => d.machine_id)

    // Materialize and read only this header's exact date/shift setup snapshot.
    const setups = await getSimplexMachineSetups(headerId)
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })
    const machinesWithSetup = machines.filter(machine => !!setupMap[machine.id])
    const missingMachines = machinesWithSetup.filter(machine => !remainingMachineIds.includes(machine.id))

    const headerTotalTime = headerForDate.total_time || await getSimplexShiftTime(headerForDate.shift)

    // Create detail records for each missing machine
    const details = missingMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      return {
        header_id: headerId,
        machine_id: machine.id,
        prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
        run_hrs: 0,
        run_min: 0,
        idle_spindles: 0,
        waste: setup.default_waste ?? null,
        act_prodn: 0,
        waste_percent: 0,
        act_effi_percent: 0,
        uti_percent: 0,
        std_hrs: 0,
        run_time: headerTotalTime,
        work_time: headerTotalTime,
        session_no: 1
      }
    })

    return await prisma.$transaction(async tx => {
      if (details.length > 0) {
        await tx.simplex_production_detail.createMany({ data: details, skipDuplicates: true })
      }
      const visibleDetails = machinesWithSetup.length > 0
        ? await tx.simplex_production_detail.findMany({
            where: {
              header_id: headerId,
              machine_id: { in: machinesWithSetup.map(machine => machine.id) }
            }
          })
        : []
      const existingStoppages = visibleDetails.length > 0
        ? await tx.simplex_stoppage_entry.findMany({
            where: { production_detail_id: { in: visibleDetails.map(detail => detail.id) } },
            select: { production_detail_id: true }
          })
        : []
      const stoppedIds = new Set(existingStoppages.map(entry => entry.production_detail_id))
      const missingStoppages = visibleDetails
        .filter(detail => !stoppedIds.has(detail.id))
        .map(detail => ({ production_detail_id: detail.id, total_stoppage_time: 0 }))
      if (missingStoppages.length > 0) {
        await tx.simplex_stoppage_entry.createMany({ data: missingStoppages, skipDuplicates: true })
      }
      const newMachineIds = new Set(missingMachines.map(machine => machine.id))
      return visibleDetails.filter(detail => newMachineIds.has(detail.machine_id))
    })
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateSimplexProductionDetail(id, updates) {
  try {
    const data = await prisma.simplex_production_detail.update({
      where: { id },
      data: {
        ...sanitizeProductionDetailUpdate('simplex_production_detail', updates),
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Bulk update production details
export async function bulkUpdateSimplexProductionDetails(updates) {
  const updatedAt = new Date()
  return prisma.$transaction(
    updates.map(({ id, ...data }) =>
      prisma.simplex_production_detail.update({
        where: { id },
        data: {
          ...sanitizeProductionDetailUpdate('simplex_production_detail', data),
          updated_at: updatedAt
        }
      })
    )
  )
}

// ============================================
// SIMPLEX STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getSimplexStoppageEntries(headerId) {
  try {
    const details = await prisma.simplex_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    if (!details || details.length === 0) return []

    const validDetails = details.filter(d => !!d.machine_id)
    if (validDetails.length === 0) return []

    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const detailIds = validDetails.map(d => d.id)
    const machineIds = validDetails.map(d => d.machine_id)

    const stoppages = await prisma.simplex_stoppage_entry.findMany({
      where: { production_detail_id: { in: detailIds } }
    })

    const reasonIds = []
    stoppages?.forEach(s => {
      if (s.stoppage1_id) reasonIds.push(s.stoppage1_id)
      if (s.stoppage2_id) reasonIds.push(s.stoppage2_id)
      if (s.stoppage3_id) reasonIds.push(s.stoppage3_id)
      if (s.stoppage4_id) reasonIds.push(s.stoppage4_id)
    })

    const [machines, reasons] = await Promise.all([
      prisma.simplex_machines.findMany({
        where: { id: { in: machineIds } },
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          machine_no: true,
          speed: true,
          tpi: true,
          mc_effi: true,
          no_of_spindles: true,
          is_active: true,
          activated_at: true,
          deactivated_at: true,
          sort_order: true
        }
      }),
      reasonIds.length > 0
        ? prisma.stoppage_details.findMany({
            where: { id: { in: [...new Set(reasonIds)] } },
            select: { id: true, stoppage_name: true, short_code: true }
          })
        : Promise.resolve([])
    ])

    const detailMap = {}
    validDetails?.forEach(d => { detailMap[d.id] = d })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const reasonMap = {}
    reasons?.forEach(r => { reasonMap[r.id] = r })

    return (stoppages || [])
      .map(s => {
        const detail = detailMap[s.production_detail_id]
        const machine = detail ? (machineMap[detail.machine_id] || null) : null
        return {
          ...s,
          production_detail: detail ? { ...detail, machine } : null,
          stoppage1: reasonMap[s.stoppage1_id] || null,
          stoppage2: reasonMap[s.stoppage2_id] || null,
          stoppage3: reasonMap[s.stoppage3_id] || null,
          stoppage4: reasonMap[s.stoppage4_id] || null,
        }
      })
      .filter(row => isSimplexMachineVisibleOnDate(row.production_detail?.machine, entryDate))
      .sort((a, b) => {
        const sortA = a.production_detail?.machine?.sort_order || 9999
        const sortB = b.production_detail?.machine?.sort_order || 9999
        return sortA - sortB
      })
  } catch (error) {
    throw error
  }
}

// Update stoppage entry
export async function updateSimplexStoppageEntry(id, updates) {
  return prisma.$transaction(async tx => {
    try {
    // First, fetch the existing record to get current stoppage values and production_detail_id
    const existing = await tx.simplex_stoppage_entry.findUnique({
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
    await assertActiveStoppageReasons(tx, stoppageUpdate, ['SIMPLEX'])
    const total = stoppageUpdate.total_stoppage_time

    const data = await tx.simplex_stoppage_entry.update({
      where: { id },
      data: stoppageUpdate
    })

    // Recalculate production values with the latest stoppage total.
    // Relations are not available in Prisma schema for this model, so fetch related rows manually.
    const productionDetail = await tx.simplex_production_detail.findUnique({
      where: { id: existing.production_detail_id }
    })

    if (!productionDetail) {
      throw new Error('The production row for this stoppage no longer exists')
    }

    const [header, machine] = await Promise.all([
      tx.simplex_production_header.findUnique({
        where: { id: productionDetail.header_id },
        select: {
          total_time: true,
          shift: true,
          entry_date: true
        }
      }),
      tx.simplex_machines.findUnique({
        where: { id: productionDetail.machine_id },
        select: {
          speed: true,
          tpi: true,
          mc_effi: true,
          no_of_spindles: true
        }
      })
    ])
    if (!header) throw new Error('The production header for this stoppage no longer exists')

    const setup = await tx.simplex_machine_setup.findFirst({
      where: {
        machine_id: productionDetail.machine_id,
        entry_date: header.entry_date,
        shift: header.shift
      }
    })

    const shift = header?.shift
    const totalTime = header?.total_time || resolveSimplexShiftFallbackTime(shift)
    if (total > totalTime) {
      const error = new Error('Stoppage time cannot exceed the shift time')
      error.code = 'INVALID_STOPPAGE'
      throw error
    }

    const calculated = calculateSimplexProductionValues({
      runHrs: productionDetail.run_hrs || 0,
      speed: firstFiniteNumber([setup?.speed, machine?.speed], 960),
      tpi: firstFiniteNumber([setup?.tpi, machine?.tpi], 1.73),
      hank: firstFiniteNumber([setup?.sl_hank], 1.4),
      mcEffi: firstFiniteNumber([setup?.mc_effi, machine?.mc_effi], 92),
      totalSpindles: firstFiniteNumber([setup?.spindles, machine?.no_of_spindles], 140),
      idleSpindles: productionDetail.idle_spindles || 0,
      waste: productionDetail.waste ?? 0,
      totalTime,
      stoppageTime: total
    })

    await tx.simplex_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        run_time: totalTime,
        run_min: calculated.run_min,
        work_time: calculated.work_time,
        std_hrs: calculated.std_hrs,
        act_prodn: calculated.act_prodn,
        act_effi_percent: calculated.act_effi_percent,
        waste_percent: calculated.waste_percent,
        uti_percent: calculated.uti_percent,
        updated_at: new Date()
      }
    })

    return data
    } catch (error) {
      throw error
    }
  })
}

// Apply full stoppage to all machines and recalculate production
export async function applySimplexFullStoppage(headerId, stoppageId, stoppageTime) {
  // Get all stoppage entries for this header with production details
  const stoppages = await getSimplexStoppageEntries(headerId)
  
  const header = await prisma.simplex_production_header.findUnique({
    where: { id: headerId },
    select: { total_time: true, shift: true }
  })
  const headerTotalTime = header?.total_time || resolveSimplexShiftFallbackTime(header?.shift)

  // Get machine setups for recalculation
  const setups = await getSimplexMachineSetups(headerId)
  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })

  // Update the first free slot independently for every machine.
  const updates = stoppages.flatMap(s => {
    const slot = findFirstFreeStoppageSlot(s)
    if (!slot) return []
    return [{
      id: s.id,
      slot,
      [`stoppage${slot}_id`]: stoppageId,
      [`stoppage${slot}_time`]: stoppageTime
    }]
  })

  const stoppagePromises = updates.map(({ id, slot: _slot, ...data }) =>
    updateSimplexStoppageEntry(id, data)
  )

  const appliedRows = await Promise.all(stoppagePromises)
  
  // Recalculate production for each machine
  const prodPromises = updates.map(async ({ id, slot }) => {
    const s = stoppages.find(entry => entry.id === id)
    if (!s.production_detail) return null
    
    const prodDetail = s.production_detail
    const machineId = prodDetail.machine_id
    const setup = setupMap[machineId]
    const machine = prodDetail.machine || {}
    
    // Calculate new total stoppage (all 4 stoppages)
    const newTotalStoppage = getStoppageTotal({
      ...s,
      [`stoppage${slot}_time`]: stoppageTime
    })
    
    // Recalculate with Simplex formula
    const calculated = calculateSimplexProductionValues({
      runHrs: prodDetail.run_hrs || 0,
      speed: firstFiniteNumber([setup?.speed, machine.speed], 960),
      tpi: firstFiniteNumber([setup?.tpi, machine.tpi], 1.73),
      hank: firstFiniteNumber([setup?.sl_hank], 1.4),
      mcEffi: firstFiniteNumber([setup?.mc_effi, machine.mc_effi], 92),
      totalSpindles: firstFiniteNumber([setup?.spindles, machine.no_of_spindles], 140),
      idleSpindles: prodDetail.idle_spindles || 0,
      waste: prodDetail.waste ?? 0,
      totalTime: headerTotalTime,
      stoppageTime: newTotalStoppage
    })
    
    // Update production detail with recalculated values
    return updateSimplexProductionDetail(prodDetail.id, calculated)
  })
  
  await Promise.all(prodPromises.filter(Boolean))
  return appliedRows
}

// Helper: Pick first available slot (1-4) for a stoppage entry
function pickFirstAvailableSlot(stoppageEntry) {
  if (!stoppageEntry) return null
  for (let slot = 1; slot <= 4; slot += 1) {
    const idField = `stoppage${slot}_id`
    if (!stoppageEntry[idField]) return slot
  }
  return null // All slots full
}

// Apply partial stoppage to machine range and recalculate production
export async function applySimplexPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    // Get all production details and machine info (manual join)
    const details = await prisma.simplex_production_detail.findMany({
      where: { 
        header_id: headerId
      }
    })

    const machineIds = details.map(d => d.machine_id)
    const machines = await prisma.simplex_machines.findMany({
      where: { id: { in: machineIds } },
      select: {
        id: true,
        machine_no: true,
        speed: true,
        tpi: true,
        mc_effi: true,
        no_of_spindles: true
      }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const enrichedDetails = details
      .map(d => ({ ...d, machine: machineMap[d.machine_id] || null }))

    // Filter by machine range (handle reversed from/to)
    const fromNum = parseInt(fromMachineNo)
    const toNum = parseInt(toMachineNo)
    const minNum = Math.min(fromNum, toNum)
    const maxNum = Math.max(fromNum, toNum)

    const filteredDetails = enrichedDetails?.filter(d => {
      if (!d.machine?.machine_no) return false
      const mcNum = parseInt(d.machine.machine_no)
      return mcNum >= minNum && mcNum <= maxNum
    }) || []

    if (filteredDetails.length === 0) {
      throw new Error(`No machines found in range ${fromMachineNo} to ${toMachineNo}`)
    }

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id)

    const stoppages = await prisma.simplex_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: detailIds }
      }
    })

    const stoppageByDetailId = {}
    stoppages.forEach(s => { stoppageByDetailId[s.production_detail_id] = s })

    // Auto-slot allocation for each machine
    let updatedCount = 0
    let skippedCount = 0
    let overflowCount = 0

    for (const detail of filteredDetails) {
      const stoppageEntry = stoppageByDetailId[detail.id]
      if (!stoppageEntry) {
        skippedCount += 1
        continue
      }

      const resolvedSlot = pickFirstAvailableSlot(stoppageEntry)
      if (!resolvedSlot) {
        overflowCount += 1
        continue
      }

      const updateData = {}
      updateData[`stoppage${resolvedSlot}_id`] = stoppageId
      updateData[`stoppage${resolvedSlot}_time`] = stoppageTime
      
      await updateSimplexStoppageEntry(stoppageEntry.id, updateData)
      updatedCount += 1
    }

    // updateSimplexStoppageEntry already recalculates the dependent production
    // detail from the merged, newly persisted stoppage row in one transaction.
    // A second pass here used the stale pre-update row and could overwrite the
    // correct efficiency/UTI with the previous stoppage total.
    
    return { updatedCount, skippedCount, overflowCount }
  } catch (error) {
    throw error
  }
}

// ============================================
// SIMPLEX MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info (only active machines)
export async function getSimplexMachineSetups(headerId = null) {
  try {
    const validHeaderId = typeof headerId === 'string' && headerId.trim() ? headerId.trim() : null
    const header = validHeaderId
      ? await prisma.simplex_production_header.findUnique({
          where: { id: validHeaderId },
          select: { entry_date: true }
        })
      : null
    if (validHeaderId && !header) throw new Error(`Simplex production header ${validHeaderId} not found`)

    const machines = await prisma.simplex_machines.findMany({
      where: header ? buildMachineVisibilityWhere(header.entry_date) : { is_active: true },
      select: {
        id: true,
        machine_no: true,
        description: true,
        make_name: true,
        prodn_mixing: true,
        speed: true,
        mc_effi: true,
        tpi: true,
        no_of_spindles: true,
        is_active: true,
        activated_at: true,
        deactivated_at: true
      }
    })
    const machineById = new Map(machines.map(machine => [machine.id, machine]))
    const machineSpeedMap = {};
    const machineSetupOverridesMap = {};
    machines.forEach(m => {
      const rawEfficiency = Number(m.mc_effi)
      const machineEfficiency = Number.isFinite(rawEfficiency) && rawEfficiency > 0 && rawEfficiency <= 100
        ? rawEfficiency
        : 92
      const speed = positiveNumberOrFallback(m.speed, 960)
      machineSpeedMap[m.id] = speed;
      machineSetupOverridesMap[m.id] = {
        speed,
        tpi: positiveNumberOrFallback(m.tpi, 1.73),
        mc_effi: machineEfficiency,
        spindles: positiveNumberOrFallback(m.no_of_spindles, 140),
        prodn_mixing: m.prodn_mixing || '64COMBED GOLD'
      };
    });
    const setups = await getOrCreateDateScopedSetups({
      setupModel: prisma.simplex_machine_setup,
      headerModel: prisma.simplex_production_header,
      headerId: validHeaderId,
      machineIds: machines.map(machine => machine.id),
      machineSpeedMap,
      machineSetupOverridesMap,
      defaultSetupFactory: ({ machineId, totalTime }) => {
        const machine = machineById.get(machineId)
        if (!machine) throw new Error(`Simplex machine ${machineId} not found`)
        const rawEfficiency = Number(machine.mc_effi)
        const machineEfficiency = Number.isFinite(rawEfficiency) && rawEfficiency > 0 && rawEfficiency <= 100
          ? rawEfficiency
          : 92
        return {
          machine_id: machineId,
          speed: positiveNumberOrFallback(machine.speed, 960),
          prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
          session_no: 1,
          cc_time: 0,
          sl_hank: 1.4,
          mc_effi: machineEfficiency,
          tpi: positiveNumberOrFallback(machine.tpi, 1.73),
          spindles: positiveNumberOrFallback(machine.no_of_spindles, 140),
          shift_time: positiveNumberOrFallback(totalTime, 510),
          default_waste: 0.9
        }
      },
      validateDefaultSetup: setup => assertPositiveSetupFields(
        setup,
        ['speed', 'sl_hank', 'mc_effi', 'tpi', 'spindles', 'shift_time'],
        'Simplex setup'
      )
    })
    const headerDetails = validHeaderId
      ? await prisma.simplex_production_detail.findMany({ where: { header_id: validHeaderId }, select: { machine_id: true, prodn_mixing: true } })
      : []

    const machineMap = {}
    if (Array.isArray(machines)) {
      machines.forEach(m => { machineMap[m.id] = m })
    }

    const mixingMap = {}
    if (Array.isArray(headerDetails)) {
      headerDetails.forEach(d => {
        if (d.prodn_mixing) mixingMap[d.machine_id] = d.prodn_mixing
      })
    }

    return setups
      .filter(s => !!machineMap[s.machine_id])
      .map(s => {
        const machine = machineMap[s.machine_id]
        const dateMixing = mixingMap[s.machine_id] ?? s.prodn_mixing ?? machine?.prodn_mixing
        return {
          ...s,
          machine: machine ? { ...machine, prodn_mixing: dateMixing } : null,
          prodn_mixing: dateMixing
        }
      })
  } catch (error) {
    throw error
  }
}

// Get machine setup by machine_id
export async function getSimplexMachineSetupByMachineId(machineId) {
  try {
    const data = await prisma.simplex_machine_setup.findFirst({
      where: { machine_id: machineId }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update machine setup
export async function updateSimplexMachineSetup(id, updates) {
  try {
    updates = sanitizeSimplexSetupUpdate(updates)
    const currentSetup = await prisma.simplex_machine_setup.findUnique({
      where: { id },
      select: { id: true, machine_id: true }
    })

    if (!currentSetup) {
      throw new Error(`Simplex machine setup ${id} not found`)
    }

    // Simplex speed is fixed after setup creation and cannot be edited from an entry.
    const safeUpdates = { ...(updates || {}) }
    delete safeUpdates.speed

    const data = await prisma.simplex_machine_setup.update({
      where: { id },
      data: { ...safeUpdates, updated_at: new Date() }
    })

    return data
  } catch (error) {
    throw error
  }
}

// Create or update machine setup
export async function upsertSimplexMachineSetup(machineId, setupData) {
  try {
    const existing = await getSimplexMachineSetupByMachineId(machineId)
    
    if (existing) {
      return updateSimplexMachineSetup(existing.id, setupData)
    }

    const data = await prisma.simplex_machine_setup.create({
      data: {
        machine_id: machineId,
        ...setupData
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get simplex stoppage reasons (filtered by SIMPLEX department)
export async function getSimplexStoppageReasons() {
  try {
    // First get the SIMPLEX department ID
    const simplexDept = await prisma.departments.findFirst({
      where: { dept_name: 'SIMPLEX' }
    })
    
    if (!simplexDept?.id) throw new Error('SIMPLEX department not found')

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
        AND sd.department_id = ${simplexDept.id}
        AND (sd.stoppage_head_id IS NULL OR sh.is_active = 1)
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

// ============================================
// SUPERVISORS QUERIES
// ============================================

// Get all supervisors
export async function getSupervisors() {
  try {
    const data = await prisma.supervisors.findMany({
      where: { is_active: true },
      orderBy: {
        supervisor_name: 'asc'
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// SIMPLEX MACHINES QUERIES
// ============================================

// Get all simplex machines
export async function getSimplexMachines() {
  try {
    const data = await prisma.simplex_machines.findMany({
      where: { is_active: true },
      orderBy: {
        machine_no: 'asc'
      }
    })
    
    // Sort by natural number order (1, 2, 3... 10)
    return data?.sort((a, b) => {
      const aNum = parseInt(a.machine_no || '0')
      const bNum = parseInt(b.machine_no || '0')
      return aNum - bNum
    }) || []
  } catch (error) {
    throw error
  }
}

// ============================================
// CALCULATION HELPERS - SIMPLEX FORMULAS
// ============================================

/**
 * Parse Run Hours in HH.MM format to total minutes
 * Example: 7.12 = 7 hours 12 minutes = 432 minutes
 * @param {number} runHrs - Run hours in HH.MM format
 * @returns {number} - Total minutes
 */
export function parseRunHoursToMinutes(runHrs) {
  return parseRunHoursToMinutesShared(runHrs)
}

/**
 * Convert minutes to HH.MM format
 * @param {number} minutes - Total minutes
 * @returns {number} - Hours in HH.MM format
 */
export function minutesToRunHours(minutes) {
  return minutesToRunHoursShared(minutes)
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
        stoppage_name: true,
        stoppage_head_id: true
      },
      orderBy: {
        stoppage_name: 'asc'
      }
    })
    return filterReasonsWithActiveHeads(prisma, data || [])
  } catch (error) {
    throw error
  }
}

// Get all employees for dropdown/search
export async function getSimplexEmployees() {
  try {
    const data = await prisma.employee_master.findMany({
      where: { is_active: true },
      select: {
        id: true,
        emp_name: true,
        emp_code: true
      },
      orderBy: {
        emp_name: 'asc'
      }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Search employees by name
export async function searchSimplexEmployees(searchTerm) {
  try {
    const data = await prisma.employee_master.findMany({
      where: {
        is_active: true,
        emp_name: {
          contains: searchTerm
        }
      },
      select: {
        id: true,
        emp_name: true,
        emp_code: true
      },
      orderBy: {
        emp_name: 'asc'
      },
      take: 20
    })
    return data || []
  } catch (error) {
    throw error
  }
}
// ============================================
// SIMPLEX PRODUCTION CALCULATION
// ============================================

/**
 * Calculate Simplex Production Values
 * 
 * Simplex Formula:
 * - RunMin = Convert RunHrs (HH.MM format) to minutes
 * - WorkTime = TotalTime - StoppageTime
 * - Std Hrs = WorkTime × (MCEffi / 100)
 * - Active Spindles = Total Spindles - Idle Spindles
 * - Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
 * - Act.Effi % = (RunMin / Std.Hrs) × 100
 * - Waste % = (Waste / Act.Prodn) × 100
 * - UTI % = (WorkTime / TotalTime) × 100
 */
export function calculateSimplexProductionValues(params) {
  return calculateSimplexProductionValuesFromUtils(params)
}

// ============================================
// MACHINE SETUP UPDATE FUNCTIONS
// ============================================

// Atomically update canonical, current header, and current date/shift count/mixing.
export async function bulkUpdateSimplexMachineCount(machineIds, countValue, headerId = null) {
  const mixing = normalizeMixingValue(countValue, 50)

  return prisma.$transaction(async tx => {
    const context = await resolveMachineMixingContext({
      headerModel: tx.simplex_production_header,
      machineModel: tx.simplex_machines,
      headerId,
      machineIds
    })
    const updatedAt = new Date()

    const machines = await tx.simplex_machines.updateMany({
      where: { id: { in: context.machineIds }, is_active: true },
      data: { prodn_mixing: mixing, updated_at: updatedAt }
    })
    const productionDetails = context.header
      ? await tx.simplex_production_detail.updateMany({
          where: {
            header_id: context.header.id,
            machine_id: { in: context.machineIds }
          },
          data: { prodn_mixing: mixing, updated_at: updatedAt }
        })
      : { count: 0 }
    const setups = context.header
      ? await Promise.all(context.machineIds.map(machineId => (
          tx.simplex_machine_setup.upsert({
            where: {
              idx_simplex_setup_date: {
                machine_id: machineId,
                entry_date: context.header.entry_date,
                shift: context.header.shift
              }
            },
            update: { prodn_mixing: mixing, updated_at: updatedAt },
            create: {
              machine_id: machineId,
              entry_date: context.header.entry_date,
              shift: context.header.shift,
              prodn_mixing: mixing,
              updated_at: updatedAt
            }
          })
        )))
      : []

    assertMachineUpdateCount(machines.count, context.machineIds.length, 'canonical machine')
    if (context.header) {
      assertMachineUpdateCount(productionDetails.count, context.machineIds.length, 'production detail')
      assertMachineUpdateCount(setups.length, context.machineIds.length, 'machine setup')
    }

    return {
      machineCount: machines.count,
      productionDetailCount: productionDetails.count,
      setupCount: setups.length
    }
  }, { maxWait: 5000, timeout: 30000 })
}

// Get count options for simplex (using spinning_counts table)
export async function getSimplexCountOptions() {
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

// Lookup simplex machine by machine number for setup autofill
export async function lookupSimplexMachineByNo(machineNo) {
  const raw = String(machineNo || '').trim().toUpperCase()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  const variants = Array.from(new Set([
    raw,
    digits || raw,
    digits ? `SF${digits}` : null,
    digits ? `SIMPLEX${digits}` : null,
    digits ? `${digits}` : null,
  ].filter(Boolean)))

  const orClauses = variants.map(v => ({ machine_no: { equals: v } }))

  const activeMachine = await prisma.simplex_machines.findFirst({
    where: { OR: orClauses, is_active: true }
  })

  const machine = activeMachine || await prisma.simplex_machines.findFirst({
    where: { OR: orClauses },
    orderBy: { is_active: 'desc' }
  })

  if (!machine) return null

  let setup = activeMachine
    ? await prisma.simplex_machine_setup.findFirst({ where: { machine_id: activeMachine.id } })
    : null

  if (!setup) {
    const allIds = (await prisma.simplex_machines.findMany({
      where: { OR: orClauses },
      select: { id: true }
    })).map(m => m.id)

    setup = await prisma.simplex_machine_setup.findFirst({
      where: { machine_id: { in: allIds } }
    })
  }

  return {
    ...machine,
    prodn_mixing: machine.prodn_mixing ?? setup?.prodn_mixing ?? null,
    tpi: setup?.tpi ?? machine.tpi ?? null,
    no_of_spindles: machine.no_of_spindles ?? setup?.spindles ?? null,
    has_setup: !!setup
  }
}

// Add simplex machine with setup record
export async function addSimplexMachine(machineData, entryContext) {
  try {
    const created = await prisma.$transaction(async tx => {
    const context = await resolveEntryMachineContext({
      headerModel: tx.simplex_production_header,
      context: entryContext,
      label: 'Simplex production entry'
    })
    const machineNo = normalizeMachineNumber(machineData?.machine_no)
    const matchingLifecycles = await tx.simplex_machines.findMany({
      where: { machine_no: machineNo },
      select: { id: true, is_active: true, activated_at: true, deactivated_at: true }
    })
    assertLifecycleCanStart(matchingLifecycles, context.entryDate, machineNo)
    const installedDate = validateInstalledDateForActivation(machineData?.installed_date, context.entryDate)
    machineData = { ...machineData, machine_no: machineNo }
    const parsedCountTpi = parseCountTpi(machineData.count_tpi)
    const effectiveTpi = machineData.tpi != null ? parseFloat(machineData.tpi) : parsedCountTpi
    const defaultSetupShiftTime = context.totalTime > 0
      ? context.totalTime
      : await getSimplexShiftTime(context.shift)

    // Check if machine already exists (might be inactive)
    if (machineData.machine_no) {
      const existingMachine = await tx.simplex_machines.findFirst({
        // Preserve inactive rows as completed historical lifecycles.
        where: { machine_no: machineData.machine_no, is_active: true }
      })

      if (existingMachine) {
        const existingSetup = await tx.simplex_machine_setup.findFirst({
          where: { machine_id: existingMachine.id }
        })

        if (!existingMachine.is_active) {
          // Reactivate the existing machine
          const reactivated = await tx.simplex_machines.update({
            where: { id: existingMachine.id },
            data: {
              is_active: true,
              activated_at: context.entryDate,
              deactivated_at: null,
              description: machineData.description || existingMachine.description,
              make_name: machineData.make_name || 'LMW',
              model: machineData.model || existingMachine.model || null,
              prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
              installed_date: installedDate ?? existingMachine.installed_date,
              speed: firstFiniteNumber([machineData.speed, existingMachine.speed], 960),
              prodn_efficiency: machineData.prodn_effi != null ? parseFloat(machineData.prodn_effi) : existingMachine.prodn_efficiency,
              tpi: effectiveTpi ?? existingMachine.tpi,
              no_of_spindles: firstFiniteNumber([machineData.no_of_spindles, machineData.spindles, existingMachine.no_of_spindles], 140)
            }
          })

          // Check if setup exists, create if not
          let setup = existingSetup
          if (!existingSetup) {
            // Create setup for reactivated machine
            setup = await tx.simplex_machine_setup.create({
              data: {
                machine_id: existingMachine.id,
                entry_date: context.entryDate,
                shift: context.shift,
                prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
                session_no: parseInt(machineData.session_no) || 1,
                cc_time: parseInt(machineData.cc_time) || 0,
                sl_hank: firstFiniteNumber([machineData.sl_hank], 1.4),
                mc_effi: firstFiniteNumber([machineData.mc_effi, existingMachine.mc_effi], 92),
                tpi: effectiveTpi ?? existingMachine.tpi ?? 1.73,
                spindles: firstFiniteNumber([machineData.no_of_spindles, machineData.spindles, existingMachine.no_of_spindles], 140),
                shift_time: defaultSetupShiftTime,
                default_waste: machineData.default_waste != null && machineData.default_waste !== ''
                  ? parseFloat(machineData.default_waste)
                  : null
              }
            })
          }

          return { machine: reactivated, setup, reactivated: true }
        }

        if (existingSetup) {
          throw new Error(`Machine ${machineData.machine_no} already exists and is active`)
        }

        const setup = await tx.simplex_machine_setup.create({
          data: {
            machine_id: existingMachine.id,
            entry_date: context.entryDate,
            shift: context.shift,
            prodn_mixing: machineData.prodn_mixing || existingMachine.prodn_mixing || '64COMBED GOLD',
            session_no: parseInt(machineData.session_no) || 1,
            cc_time: parseInt(machineData.cc_time) || 0,
            sl_hank: firstFiniteNumber([machineData.sl_hank], 1.4),
            mc_effi: firstFiniteNumber([machineData.mc_effi, existingMachine.mc_effi], 92),
            tpi: effectiveTpi ?? existingMachine.tpi ?? 1.73,
            spindles: firstFiniteNumber([machineData.no_of_spindles, machineData.spindles, existingMachine.no_of_spindles], 140),
            shift_time: defaultSetupShiftTime,
            default_waste: machineData.default_waste != null && machineData.default_waste !== ''
              ? parseFloat(machineData.default_waste)
              : null
          }
        })

        return { machine: existingMachine, setup, reactivated: false }
      }
    }

    const maxSortResult = await tx.simplex_machines.aggregate({ _max: { sort_order: true } })
    const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1

    // Create machine record
    const machine = await tx.simplex_machines.create({
      data: {
        machine_no: machineData.machine_no,
        description: machineData.description || `Simplex Machine ${machineData.machine_no}`,
        make_name: machineData.make_name || 'LMW',
        model: machineData.model || null,
        prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
        installed_date: installedDate,
        speed: firstFiniteNumber([machineData.speed], 1000),
        prodn_efficiency: machineData.prodn_effi != null ? parseFloat(machineData.prodn_effi) : null,
        mc_effi: firstFiniteNumber([machineData.mc_effi], 92),
        tpi: effectiveTpi ?? 1.73,
        no_of_spindles: firstFiniteNumber([machineData.no_of_spindles, machineData.spindles], 140),
        is_active: true,
        activated_at: context.entryDate,
        sort_order: nextSortOrder
      }
    })
    
    // Create corresponding setup record
    const setup = await tx.simplex_machine_setup.create({
      data: {
        machine_id: machine.id,
        entry_date: context.entryDate,
        shift: context.shift,
        prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
        session_no: parseInt(machineData.session_no) || 1,
        cc_time: parseInt(machineData.cc_time) || 0,
        sl_hank: firstFiniteNumber([machineData.sl_hank], 1.4),
        mc_effi: firstFiniteNumber([machineData.mc_effi], 92),
        tpi: effectiveTpi ?? 1.73,
        spindles: firstFiniteNumber([machineData.no_of_spindles, machineData.spindles], 140),
        shift_time: defaultSetupShiftTime,
        default_waste: machineData.default_waste != null && machineData.default_waste !== ''
          ? parseFloat(machineData.default_waste)
          : null
      }
    })

    return { machine, setup, reactivated: false, context }
    })
    const { context, ...result } = created
    const syncedDetails = await addMissingSimplexProductionDetails(context.headerId)
    return { ...result, syncedHeaders: 1, syncedDetails }
  } catch (error) {
    throw error
  }
}

// Remove simplex machine (soft delete)
export async function removeSimplexMachines(machineIds, entryContext) {
  return prisma.$transaction(tx => deactivateEntryMachines({
    headerModel: tx.simplex_production_header,
    machineModel: tx.simplex_machines,
    machineIds,
    context: entryContext,
    label: 'Simplex production entry'
  }))
}

export async function removeSimplexMachine(machineId, entryContext) {
  const result = await removeSimplexMachines([machineId], entryContext)
  return { id: machineId, is_active: false, deactivated_at: result.entryDate }
}

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getSimplexAvailableDates(beforeDate, shift, limit = 30) {
  const data = await prisma.simplex_production_header.findMany({
    where: {
      shift: parseInt(shift),
      entry_date: { lt: new Date(beforeDate) }
    },
    select: { entry_date: true, shift: true },
    orderBy: { entry_date: 'desc' },
    take: limit
  });
  
  return data || [];
}

// Copy data from a previous date
export async function copySimplexFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  // If no sourceDate provided, calculate yesterday's date
  let previousDate = sourceDate;
  if (!previousDate) {
    const targetDateObj = new Date(targetDate);
    const yesterdayDateObj = new Date(targetDateObj);
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
    previousDate = yesterdayDateObj.toISOString().split('T')[0];
  }
  
  // Get source header
  const sourceHeader = await getSimplexProductionByDateShift(previousDate, targetShift);
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`);
  }
  
  // Get source production details
  const sourceDetails = await prisma.simplex_production_detail.findMany({
    where: { header_id: sourceHeader.id }
  });
  
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`);
  }
  
  // Get source stoppage entries
  const sourceStoppages = await prisma.simplex_stoppage_entry.findMany({
    where: {
      production_detail_id: { in: sourceDetails.map(d => d.id) }
    }
  });
  
  // Get target's existing production details
  const targetDetails = await prisma.simplex_production_detail.findMany({
    where: { header_id: targetHeaderId }
  });
  
  // Create a map of machine_id to source data
  const sourceDataMap = {};
  sourceDetails.forEach(d => {
    sourceDataMap[d.machine_id] = d;
  });
  
  const sourceStoppageMap = {};
  sourceStoppages?.forEach(s => {
    // Find which machine this stoppage belongs to
    const detail = sourceDetails.find(d => d.id === s.production_detail_id);
    if (detail) {
      sourceStoppageMap[detail.machine_id] = s;
    }
  });
  
  // Update target details with source data
  const updatePromises = targetDetails.map(async (targetDetail) => {
    const sourceData = sourceDataMap[targetDetail.machine_id];
    if (!sourceData) return null;
    
    // Copy production values
    const data = await prisma.simplex_production_detail.update({
      where: { id: targetDetail.id },
      data: {
        employee_name: sourceData.employee_name,
        prodn_mixing: sourceData.prodn_mixing,
        run_hrs: sourceData.run_hrs,
        run_min: sourceData.run_min,
        idle_spindles: sourceData.idle_spindles,
        waste: sourceData.waste,
        act_prodn: sourceData.act_prodn,
        waste_percent: sourceData.waste_percent,
        act_effi_percent: sourceData.act_effi_percent,
        uti_percent: sourceData.uti_percent,
        std_hrs: sourceData.std_hrs,
        work_time: sourceData.work_time,
        session_no: sourceData.session_no
      }
    });
    return data;
  });
  
  await Promise.all(updatePromises.filter(Boolean));
  
  // Update target stoppage entries
  // First get target stoppage entries
  const targetStoppages = await prisma.simplex_stoppage_entry.findMany({
    where: {
      production_detail_id: { in: targetDetails.map(d => d.id) }
    }
  });

  const targetDetailById = {}
  targetDetails.forEach(d => { targetDetailById[d.id] = d })
  
  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetDetailById[targetStoppage.production_detail_id]?.machine_id;
    const sourceStoppage = sourceStoppageMap[machineId];
    if (!sourceStoppage) return null;
    
    const data = await prisma.simplex_stoppage_entry.update({
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
    });
    return data;
  }) || [];
  
  await Promise.all(stoppageUpdatePromises.filter(Boolean));
  
  return {
    success: true,
    copiedFrom: previousDate,
    machinesUpdated: targetDetails.length
  };
}

// Backward compatibility wrapper
export async function copySimplexFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copySimplexFromPreviousDate(targetDate, targetShift, targetHeaderId, null);
}
