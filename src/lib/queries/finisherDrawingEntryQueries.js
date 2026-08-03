import { prisma } from '../prisma';
import { resolveFinisherDrawingShiftFallbackTime } from '../finisherDrawingShiftFallback';
import {
  FINISHER_DRAWING_FORMULA_FALLBACK,
  resolveFinisherDrawingFormulaInputs,
  calculateFinisherDrawingStdProdn,
} from '../finisherDrawingFormulaFallback';
import { calculateTimeAdjustedProductionMetrics } from '../productionFormulaMath';
import {
  assertPositiveSetupFields,
  efficiencyFactorOrFallback,
  getOrCreateDateScopedSetups,
  positiveNumberOrFallback
} from './dateScopedMachineSetup';
import { buildStoppageUpdate, findFirstFreeStoppageSlot, getStoppageTotal } from '../stoppageSlotUtils';
import { assertActiveStoppageReasons, filterReasonsWithActiveHeads } from './stoppageValidation';
import { copyPreviousSpeeds, getAvailablePreviousSpeedDates } from './copyPreviousSpeed';
import { isUniqueConstraintError } from './databaseErrors';
import { sanitizeProductionDetailUpdate, sanitizeProductionHeaderUpdate } from './productionDetailUpdate';
import { assertMachineUpdateCount, normalizeMixingValue, resolveMachineMixingContext } from './machineMixingUpdate';
import { buildMachineVisibilityWhere, isMachineVisibleOnDate } from './machineDateVisibility';
import { sanitizeFinisherDrawingSetupUpdate } from '../preparatorySetupValidation';
import {
  assertLifecycleCanStart,
  deactivateEntryMachines,
  normalizeMachineNumber,
  resolveEntryMachineContext,
  validateInstalledDateForActivation
} from './entryMachineLifecycle';

function normalizeFinisherDrawingWaste(wasteValue, actProdnValue) {
  const waste = Number.parseFloat(wasteValue)
  void actProdnValue

  if (!Number.isFinite(waste) || waste < 0) {
    return 0
  }

  return waste
}

/**
 * Finisher Drawing Entry Module - CRUD Operations
 * Following the pattern from Lap Former queries
 * Tables: finisher_drawing_production_header, finisher_drawing_production_detail,
 *         finisher_drawing_stoppage_entry, finisher_drawing_machine_setup
 * 
 * KEY DIFFERENCES FROM LAP FORMER:
 * - Hank Constant: 0.14 (vs 0.0082 for Lap Former)
 * - Std Efficiency: 90% (vs 85% for Lap Former)
 * - Speed: 350 m/min (uniform for all FD machines)
 * - Std Prodn: 677.79 kg
 * - Default Waste: 0.41 kg (vs 0.85 for Lap Former)
 * - Machines: FD4-FD10 (7 machines)
 */

// ============================================
// SHIFT CONFIGURATION QUERIES
// ============================================

// Get shift configuration for finisher drawing based on shift number
export async function getFinisherDrawingShiftConfig(shift) {
  const shiftNo = parseInt(shift)
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'FINISHER_DRAWING',
        shift: shiftNo,
        is_active: true
      }
    })
    // Primary source: shift_config. Fallback is centralized helper only.
    return {
      shiftTime: data?.shift_time || resolveFinisherDrawingShiftFallbackTime(shiftNo)
    }
  } catch (error) {
    console.error('Error fetching Finisher Drawing shift config:', error)
    throw error
  }
}

async function getFinisherDrawingShiftTime(shift) {
  const config = await getFinisherDrawingShiftConfig(shift)
  return config?.shiftTime || resolveFinisherDrawingShiftFallbackTime(shift)
}

async function resolveFinisherDrawingSetupShiftTime(shiftTimeValue, shiftValue) {
  const parsedShiftTime = Number.parseFloat(shiftTimeValue)
  if (Number.isFinite(parsedShiftTime) && parsedShiftTime > 0) {
    return parsedShiftTime
  }

  const parsedShift = Number.parseInt(String(shiftValue), 10)
  const safeShift = Number.isInteger(parsedShift) && parsedShift >= 1 && parsedShift <= 3 ? parsedShift : 1
  return await getFinisherDrawingShiftTime(safeShift)
}

// ============================================
// FINISHER DRAWING MACHINE QUERIES
// ============================================

// Get all finisher drawing machines (all active FD machines)
export async function getFinisherDrawingMachines() {
  try {
    const data = await prisma.drawing_finisher_machines.findMany({
      where: { is_active: true },
      orderBy: {
        mc_id: 'asc'
      }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Get active finisher drawing machines
export async function getActiveFinisherDrawingMachines() {
  try {
    const data = await prisma.drawing_finisher_machines.findMany({
      where: { is_active: true },
      orderBy: {
        mc_id: 'asc'
      }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// ============================================
// FINISHER DRAWING PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers with supervisor info
export async function getFinisherDrawingProductionHeaders() {
  try {
    const data = await prisma.finisher_drawing_production_header.findMany({
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
export async function getFinisherDrawingProductionByDateShift(date, shift) {
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
      SELECT * FROM finisher_drawing_production_header 
      WHERE DATE(entry_date) = ${dateStr} 
      AND shift = ${shift}
      LIMIT 1
    `
    
    if (results.length === 0) return null
    
    const header = results[0]
    
    // Manually fetch supervisor and maisitry if needed
    let supervisor = null
    let maisitry = null
    
    if (header.supervisor_id) {
      supervisor = await prisma.supervisors.findUnique({
        where: { id: header.supervisor_id },
        select: { id: true, supervisor_name: true }
      })
    }
    
    if (header.maisitry_id) {
      maisitry = await prisma.supervisors.findUnique({
        where: { id: header.maisitry_id },
        select: { id: true, supervisor_name: true }
      })
    }
    
    return { ...header, supervisor, maisitry }
  } catch (error) {
    throw error
  }
}

// Create or get production header
export async function getOrCreateFinisherDrawingHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getFinisherDrawingProductionByDateShift(date, shift)
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

  // Get shift-specific time
  const shiftConfig = await getFinisherDrawingShiftConfig(shift)
  const totalTime = shiftConfig.shiftTime

  // Create new header using raw SQL to avoid timezone issues
  try {
    await prisma.$executeRaw`
      INSERT INTO finisher_drawing_production_header (id, entry_date, shift, supervisor_id, maisitry_id, total_time)
      VALUES (UUID(), ${dateStr}, ${shift}, ${supervisorId || null}, ${maisitryId || null}, ${totalTime})
    `
    
    // Fetch the created record
    const data = await getFinisherDrawingProductionByDateShift(date, shift)
    return data
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const concurrentHeader = await getFinisherDrawingProductionByDateShift(date, shift)
      if (concurrentHeader) return concurrentHeader
    }
    throw error
  }
}

// Update production header
export async function updateFinisherDrawingHeader(id, updates) {
  try {
    const data = await prisma.finisher_drawing_production_header.update({
      where: { id },
      data: {
        ...sanitizeProductionHeaderUpdate('finisher_drawing_production_header', updates),
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// FINISHER DRAWING PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getFinisherDrawingProductionDetails(headerId) {
  try {
    const data = await prisma.finisher_drawing_production_detail.findMany({
      where: { 
        header_id: headerId
      }
    })

    const machineIds = [...new Set((data || []).map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.drawing_finisher_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            description: true,
            prodn_mixing: true,
            mc_id: true,
            speed: true,
            is_active: true,
            activated_at: true,
            deactivated_at: true,
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const header = await prisma.finisher_drawing_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const enriched = (data || [])
      .map(d => ({
        ...d,
        waste: normalizeFinisherDrawingWaste(d.waste, d.act_prodn),
        machine: machineMap[d.machine_id] || null
      }))
      .filter(detail => !header?.entry_date || isMachineVisibleOnDate(detail.machine, header.entry_date))
    
    // Sort by natural machine number order (FD4, FD5, FD6, etc.)
    return enriched?.sort((a, b) => {
      const aNum = a.machine?.mc_id || parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
      const bNum = b.machine?.mc_id || parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
      return aNum - bNum
    }) || []
  } catch (error) {
    throw error
  }
}

// Get production details with machine setup for a header (for display)
export async function getFinisherDrawingProductionWithSetup(headerId) {
  try {
    const data = await prisma.finisher_drawing_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    const detailIds = (data || []).map(d => d.id)
    const machineIds = [...new Set((data || []).map(d => d.machine_id).filter(Boolean))]
    const header = await prisma.finisher_drawing_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })

    const [machines, stoppageEntries] = await Promise.all([
      machineIds.length > 0
        ? prisma.drawing_finisher_machines.findMany({
            where: { id: { in: machineIds } },
            select: {
              id: true,
              machine_no: true,
              description: true,
              prodn_mixing: true,
              mc_id: true,
              speed: true,
              is_active: true,
              activated_at: true,
              deactivated_at: true
            }
          })
        : Promise.resolve([]),
      detailIds.length > 0
        ? prisma.finisher_drawing_stoppage_entry.findMany({
            where: { production_detail_id: { in: detailIds } }
          })
        : Promise.resolve([])
    ])

    const reasonIds = [...new Set(
      (stoppageEntries || []).flatMap(s => [s.stoppage1_id, s.stoppage2_id, s.stoppage3_id, s.stoppage4_id]).filter(Boolean)
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

    const reasonMap = {}
    reasons.forEach(r => {
      reasonMap[r.id] = r
    })

    const stoppageMap = {}
    stoppageEntries.forEach(s => {
      const enrichedStoppage = {
        ...s,
        stoppage1: s.stoppage1_id ? (reasonMap[s.stoppage1_id] || null) : null,
        stoppage2: s.stoppage2_id ? (reasonMap[s.stoppage2_id] || null) : null,
        stoppage3: s.stoppage3_id ? (reasonMap[s.stoppage3_id] || null) : null,
        stoppage4: s.stoppage4_id ? (reasonMap[s.stoppage4_id] || null) : null
      }
      if (!stoppageMap[s.production_detail_id]) {
        stoppageMap[s.production_detail_id] = []
      }
      stoppageMap[s.production_detail_id].push(enrichedStoppage)
    })

    const enriched = (data || [])
      .map(d => ({
        ...d,
        waste: normalizeFinisherDrawingWaste(d.waste, d.act_prodn),
        machine: machineMap[d.machine_id] || null,
        stoppage: stoppageMap[d.id] || []
      }))
      .filter(detail => !header?.entry_date || isMachineVisibleOnDate(detail.machine, header.entry_date))

    // Sort by natural machine number order (FD4, FD5, FD6, etc.)
    return enriched?.sort((a, b) => {
      const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
      const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
      return aNum - bNum
    }) || []
  } catch (error) {
    throw error
  }
}

// Initialize production details for all finisher drawing machines
export async function initializeFinisherDrawingDetails(headerId) {
  try {
    // Fetch header info for date-based machine filtering and shift-driven runtime
    const header = await prisma.finisher_drawing_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true, total_time: true }
    })
    if (!header) throw new Error(`Finisher Drawing production header ${headerId} not found`)
    const entryDate = header.entry_date
    const totalTime = header.total_time || await getFinisherDrawingShiftTime(header.shift)
    const defaultWorkTime = Math.max(totalTime, 0)

    // Get machines active on entry_date
    const machines = await prisma.drawing_finisher_machines.findMany({
      where: buildMachineVisibilityWhere(entryDate),
      select: {
        id: true,
        machine_no: true,
        prodn_mixing: true,
        speed: true
      },
      orderBy: { sort_order: 'asc' }
    })

    const setups = await getFinisherDrawingMachineSetups(headerId)

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    const machinesWithSetup = machines.filter(m => !!setupMap[m.id])

    const details = machinesWithSetup.map(machine => {
      const setup = setupMap[machine.id] || {}
      const stdProdn = calculateFinisherDrawingStdProdn(setup, totalTime, machine.speed)
      // Exp.Prodn = Std.Prodn × (WorkTime / TotalTime)
      const workRatio = totalTime > 0 ? defaultWorkTime / totalTime : 0
      const expProdn = stdProdn * workRatio

      return {
        header_id: headerId,
        machine_id: machine.id,
        prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
        act_hank: 0,
        act_prodn: 0,
        std_prodn: Math.round(stdProdn * 100) / 100,
        exp_prodn: Math.round(expProdn * 100) / 100,
        effi_percent: 0,
        uti_percent: Math.round(workRatio * 100 * 100) / 100,
        waste: 0,
        waste_percent: 0,
        run_time: totalTime,
        work_time: defaultWorkTime,
        session_no: 1
      }
    })

    return await prisma.$transaction(async tx => {
      if (details.length > 0) {
        await tx.finisher_drawing_production_detail.createMany({ data: details, skipDuplicates: true })
      }
      const createdDetails = await tx.finisher_drawing_production_detail.findMany({
        where: { header_id: headerId, machine_id: { in: machinesWithSetup.map(machine => machine.id) } }
      })
      const existingStoppages = createdDetails.length > 0
        ? await tx.finisher_drawing_stoppage_entry.findMany({
            where: { production_detail_id: { in: createdDetails.map(detail => detail.id) } },
            select: { production_detail_id: true }
          })
        : []
      const stoppedIds = new Set(existingStoppages.map(entry => entry.production_detail_id))
      const missingStoppages = createdDetails
        .filter(detail => !stoppedIds.has(detail.id))
        .map(detail => ({ production_detail_id: detail.id, total_stoppage_time: 0 }))
      if (missingStoppages.length > 0) {
        await tx.finisher_drawing_stoppage_entry.createMany({ data: missingStoppages, skipDuplicates: true })
      }
      return createdDetails
    })
  } catch (error) {
    throw error
  }
}

// Sync new machines to existing header (for machines added after header was created)
export async function syncFinisherDrawingNewMachinesToHeader(headerId) {
  try {
    // Fetch header info for date-based machine filtering and shift-driven runtime
    const header = await prisma.finisher_drawing_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true, total_time: true }
    })
    if (!header) throw new Error(`Finisher Drawing production header ${headerId} not found`)
    const entryDate = header.entry_date
    const totalTime = header.total_time || await getFinisherDrawingShiftTime(header.shift)

    // Get machines active on entry_date
    const machines = await prisma.drawing_finisher_machines.findMany({
      where: buildMachineVisibilityWhere(entryDate),
      select: {
        id: true,
        machine_no: true,
        prodn_mixing: true,
        speed: true
      },
      orderBy: { sort_order: 'asc' }
    })

    const setups = await getFinisherDrawingMachineSetups(headerId)

    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Only machines with setup should participate in entry rows
    const machinesWithSetup = machines.filter(m => !!setupMap[m.id])

    // Get existing production details for this header
    const existingDetails = await prisma.finisher_drawing_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    const existingMachineIds = existingDetails.map(d => d.machine_id)

    // Loading or synchronizing an entry must never delete historical rows.
    // Non-visible rows are simply excluded by the entry-date snapshot queries.

    // Find machines that don't have entries
    const newMachines = machinesWithSetup.filter(m => !existingMachineIds.includes(m.id))

    // Default values for Finisher Drawing
    const defaultWorkTime = Math.max(totalTime, 0)
    const defaultUti = totalTime > 0
      ? Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100
      : 0

    // Create detail records for new machines
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const stdProdn = calculateFinisherDrawingStdProdn(setup, totalTime, machine.speed)
      
      return {
        header_id: headerId,
        machine_id: machine.id,
        prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
        act_hank: 0,
        act_prodn: 0,
        std_prodn: Math.round(stdProdn * 100) / 100,
        exp_prodn: Math.round(stdProdn * 100) / 100,
        effi_percent: 0,
        uti_percent: defaultUti,
        waste: 0,
        waste_percent: 0,
        run_time: totalTime,
        work_time: defaultWorkTime,
        total_stoppage_mins: 0,
        session_no: 1
      }
    })

    return await prisma.$transaction(async tx => {
      if (details.length > 0) {
        await tx.finisher_drawing_production_detail.createMany({ data: details, skipDuplicates: true })
      }
      const visibleDetails = machinesWithSetup.length > 0
        ? await tx.finisher_drawing_production_detail.findMany({
            where: {
              header_id: headerId,
              machine_id: { in: machinesWithSetup.map(machine => machine.id) }
            }
          })
        : []
      const existingStoppages = visibleDetails.length > 0
        ? await tx.finisher_drawing_stoppage_entry.findMany({
            where: { production_detail_id: { in: visibleDetails.map(detail => detail.id) } },
            select: { production_detail_id: true }
          })
        : []
      const stoppedIds = new Set(existingStoppages.map(entry => entry.production_detail_id))
      const missingStoppages = visibleDetails
        .filter(detail => !stoppedIds.has(detail.id))
        .map(detail => ({ production_detail_id: detail.id, total_stoppage_time: 0 }))
      if (missingStoppages.length > 0) {
        await tx.finisher_drawing_stoppage_entry.createMany({ data: missingStoppages, skipDuplicates: true })
      }
      return { added: newMachines.length, machines: newMachines.map(machine => machine.machine_no) }
    })
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateFinisherDrawingDetail(id, updates) {
  try {
    // Remove any fields that shouldn't be updated
    const cleanUpdates = sanitizeProductionDetailUpdate('finisher_drawing_production_detail', updates)
    
    const data = await prisma.finisher_drawing_production_detail.update({
      where: { id },
      data: {
        ...cleanUpdates,
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    console.error('updateFinisherDrawingDetail error:', error)
    throw new Error(`Failed to update production detail: ${error.message}`)
  }
}

// Bulk update production details
export async function bulkUpdateFinisherDrawingDetails(updates) {
  const updatedAt = new Date()
  return prisma.$transaction(
    updates.map(({ id, ...data }) =>
      prisma.finisher_drawing_production_detail.update({
        where: { id },
        data: {
          ...sanitizeProductionDetailUpdate('finisher_drawing_production_detail', data),
          updated_at: updatedAt
        }
      })
    )
  )
}

// ============================================
// FINISHER DRAWING STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getFinisherDrawingStoppageEntries(headerId) {
  try {
    // First get production details for this header (no is_active filter — deactivated machines must still show in past entries)
    const details = await prisma.finisher_drawing_production_detail.findMany({
      where: {
        header_id: headerId
      },
      select: { id: true }
    })

    const detailIds = details?.map(d => d.id) || []
    
    if (detailIds.length === 0) return []
    
    // Now get stoppage entries only for these production details
    const data = await prisma.finisher_drawing_stoppage_entry.findMany({
      where: {
        production_detail_id: {
          in: detailIds
        }
      },
      orderBy: {
        production_detail_id: 'asc'
      }
    })

    const productionDetailIds = [...new Set((data || []).map(s => s.production_detail_id).filter(Boolean))]
    const productionDetails = productionDetailIds.length > 0
      ? await prisma.finisher_drawing_production_detail.findMany({
          where: { id: { in: productionDetailIds } }
        })
      : []

    const machineIds = [...new Set((productionDetails || []).map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.drawing_finisher_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            speed: true,
            is_active: true
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

    const productionDetailMap = {}
    productionDetails.forEach(d => {
      productionDetailMap[d.id] = {
        ...d,
        machine: machineMap[d.machine_id] || null
      }
    })

    const reasonMap = {}
    reasons.forEach(r => {
      reasonMap[r.id] = r
    })

    return (data || []).map(s => ({
      ...s,
      production_detail: productionDetailMap[s.production_detail_id]
        ? {
            ...productionDetailMap[s.production_detail_id],
            waste: normalizeFinisherDrawingWaste(
              productionDetailMap[s.production_detail_id].waste,
              productionDetailMap[s.production_detail_id].act_prodn
            )
          }
        : null,
      stoppage1: s.stoppage1_id ? (reasonMap[s.stoppage1_id] || null) : null,
      stoppage2: s.stoppage2_id ? (reasonMap[s.stoppage2_id] || null) : null,
      stoppage3: s.stoppage3_id ? (reasonMap[s.stoppage3_id] || null) : null,
      stoppage4: s.stoppage4_id ? (reasonMap[s.stoppage4_id] || null) : null
    }))
  } catch (error) {
    throw error
  }
}

// Update stoppage entry
export async function updateFinisherDrawingStoppageEntry(id, updates) {
  return prisma.$transaction(async tx => {
    try {
    // First, fetch the existing record to get current stoppage values and production_detail_id
    const existing = await tx.finisher_drawing_stoppage_entry.findUnique({
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
    await assertActiveStoppageReasons(tx, stoppageUpdate, ['Finisher Drawing', 'FINISHER DRAWING'])
    const total = stoppageUpdate.total_stoppage_time

    const data = await tx.finisher_drawing_stoppage_entry.update({
      where: { id },
      data: stoppageUpdate
    })

    // Recalculate every field that depends on stoppage time in the same transaction.
    const detail = await tx.finisher_drawing_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: {
        id: true,
        machine_id: true,
        act_hank: true,
        act_prodn: true,
        waste: true,
        run_time: true,
        header_id: true,
      }
    })
    if (!detail) throw new Error('The production row for this stoppage no longer exists')

    const header = detail?.header_id
      ? await tx.finisher_drawing_production_header.findUnique({
          where: { id: detail.header_id },
          select: { shift: true, total_time: true, entry_date: true }
        })
      : null
    if (!header) throw new Error('The production header for this stoppage no longer exists')

    const shiftConfig = await tx.shift_config.findFirst({
      where: { department_code: 'FINISHER_DRAWING', shift: header.shift, is_active: true },
      select: { shift_time: true }
    })
    const shiftTime = shiftConfig?.shift_time || resolveFinisherDrawingShiftFallbackTime(header.shift)
    const totalTime = header?.total_time || detail?.run_time || shiftTime
    if (total > totalTime) {
      const error = new Error('Stoppage time cannot exceed the shift time')
      error.code = 'INVALID_STOPPAGE'
      throw error
    }
    const [setup, machine] = await Promise.all([
      tx.finisher_drawing_machine_setup.findFirst({
        where: {
          machine_id: detail.machine_id,
          entry_date: header.entry_date,
          shift: header.shift
        }
      }),
      tx.drawing_finisher_machines.findUnique({
        where: { id: detail.machine_id },
        select: { speed: true }
      })
    ])
    const calculated = calculateFinisherDrawingValues(
      detail.act_hank,
      detail.act_prodn,
      totalTime,
      total,
      setup,
      machine?.speed,
      detail.waste
    )
    delete calculated.speed

    await tx.finisher_drawing_production_detail.update({
      where: { id: detail.id },
      data: {
        total_stoppage_mins: total,
        ...calculated,
        updated_at: new Date()
      }
    })

    return data
    } catch (error) {
      console.error('updateFinisherDrawingStoppageEntry error:', error)
      throw error
    }
  })
}

// Apply full stoppage to all machines and recalculate production
export async function applyFinisherDrawingFullStoppage(headerId, stoppageId, stoppageTime) {
  try {
    const header = await prisma.finisher_drawing_production_header.findUnique({
      where: { id: headerId },
      select: { shift: true, total_time: true }
    })
    const totalTime = header?.total_time || await getFinisherDrawingShiftTime(header?.shift || 1)

    // Get all stoppage entries for this header
    const stoppages = await getFinisherDrawingStoppageEntries(headerId)
    
    if (!stoppages || stoppages.length === 0) {
      throw new Error('No stoppage entries found for this header')
    }
    
    // Get machine setups for recalculation
    const setups = await getFinisherDrawingMachineSetups(headerId)
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    const appliedRows = []

    // Update stoppage entries
    for (const s of stoppages) {
      const slot = findFirstFreeStoppageSlot(s)
      if (!slot) continue
      const updateData = {}
      updateData[`stoppage${slot}_id`] = stoppageId
      updateData[`stoppage${slot}_time`] = parseInt(stoppageTime) || 0

      const result = await updateFinisherDrawingStoppageEntry(s.id, updateData)
      appliedRows.push(result)
    }
    
    // Recalculate production for each machine
    const prodPromises = appliedRows.map(async (appliedRow) => {
      const s = stoppages.find(entry => entry.id === appliedRow.id)
      if (!s.production_detail) return null
      
      const prodDetail = s.production_detail
      const machineId = prodDetail.machine_id
      const setup = setupMap[machineId]
      const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed
      
      // Calculate new total stoppage
      const newTotalStoppage = getStoppageTotal(appliedRow)
      
      // Recalculate with machine speed from machine table
      const calculated = calculateFinisherDrawingValues(
        prodDetail.act_hank || 0,
        prodDetail.act_prodn || 0,
        totalTime,
        newTotalStoppage,
        setup,
        machineSpeed
      )

      const preservedWaste = prodDetail.waste ?? 0
      const actProdn = prodDetail.act_prodn || 0
      calculated.waste = preservedWaste
      calculated.waste_percent = actProdn > 0
        ? Math.round((preservedWaste / actProdn) * 100 * 100) / 100
        : 0
      
      return updateFinisherDrawingDetail(prodDetail.id, calculated)
    })
    
    await Promise.all(prodPromises.filter(Boolean))

    return {
      success: true,
      data: appliedRows
    }
  } catch (error) {
    console.error('applyFinisherDrawingFullStoppage error:', error)
    throw error
  }
}

// Apply partial stoppage to selected machines with auto-slot allocation (no manual slot parameter)
export async function applyFinisherDrawingPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
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

    // Get all production details
    const details = await prisma.finisher_drawing_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    const machineIds = [...new Set((details || []).map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.drawing_finisher_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            mc_id: true,
            speed: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const activeDetails = (details || [])
      .map(d => ({ ...d, machine: machineMap[d.machine_id] || null }))
      .filter(d => d.machine)

    // Filter by machine range
    const fromNum = parseInt(String(fromMachineNo || '').replace(/\D/g, '') || '0')
    const toNum = parseInt(String(toMachineNo || '').replace(/\D/g, '') || '999')
    const minNum = Math.min(fromNum, toNum)
    const maxNum = Math.max(fromNum, toNum)

    const filteredDetails = activeDetails?.filter(d => {
      if (!d.machine?.machine_no) return false  // Skip orphaned records
      const mcNum = parseInt(d.machine.machine_no.replace(/\D/g, ''))
      return mcNum >= minNum && mcNum <= maxNum
    }) || []

    if (filteredDetails.length === 0) {
      throw new Error(`No machines found in range ${fromMachineNo} to ${toMachineNo}`)
    }

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id)
    const stoppages = await prisma.finisher_drawing_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: detailIds }
      }
    })

    let updatedCount = 0
    let overflowCount = 0
    let skippedCount = Math.max(filteredDetails.length - stoppages.length, 0)
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

      // Update the stoppage entry
      const result = await updateFinisherDrawingStoppageEntry(stoppage.id, updateData)
      appliedRows.push(result)
      updatedCount++
    }
    // updateFinisherDrawingStoppageEntry already persists the merged stoppage
    // and its dependent production formula values atomically. Recalculating
    // again from `stoppages` used the pre-update total and reverted efficiency.

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
    console.error('applyFinisherDrawingPartialStoppage error:', error)
    throw error
  }
}

// ============================================
// FINISHER DRAWING MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info (all active machines)
export async function getFinisherDrawingMachineSetups(headerId = null) {
  try {
    const validHeaderId = typeof headerId === 'string' && headerId.trim() ? headerId.trim() : null
    const header = validHeaderId
      ? await prisma.finisher_drawing_production_header.findUnique({
          where: { id: validHeaderId },
          select: { entry_date: true }
        })
      : null
    if (validHeaderId && !header) throw new Error(`Finisher drawing production header ${validHeaderId} not found`)

    const machines = await prisma.drawing_finisher_machines.findMany({
      where: header ? buildMachineVisibilityWhere(header.entry_date) : { is_active: true },
      select: {
        id: true,
        machine_no: true,
        description: true,
        make_name: true,
        prodn_mixing: true,
        speed: true,
        prodn_efficiency: true,
        is_active: true,
        activated_at: true,
        deactivated_at: true
      }
    })
    const machineById = new Map(machines.map(machine => [machine.id, machine]))
    const machineSpeedMap = {};
    const machineSetupOverridesMap = {};
    machines.forEach(m => {
      const speed = positiveNumberOrFallback(m.speed, 350)
      const efficiency = efficiencyFactorOrFallback(m.prodn_efficiency, 0.9)
      machineSpeedMap[m.id] = speed;
      machineSetupOverridesMap[m.id] = {
        speed,
        std_efficiency_factor: efficiency,
        make_name: m.make_name || null,
        prodn_mixing: m.prodn_mixing || '64COMBED GOLD'
      };
    });
    const data = await getOrCreateDateScopedSetups({
      setupModel: prisma.finisher_drawing_machine_setup,
      headerModel: prisma.finisher_drawing_production_header,
      headerId: validHeaderId,
      machineIds: machines.map(machine => machine.id),
      machineSpeedMap,
      machineSetupOverridesMap,
      defaultSetupFactory: ({ machineId, totalTime }) => {
        const machine = machineById.get(machineId)
        if (!machine) throw new Error(`Finisher Drawing machine ${machineId} not found`)
        return {
          machine_id: machineId,
          speed: positiveNumberOrFallback(machine.speed, 350),
          hank_constant: 0.14,
          std_efficiency_factor: efficiencyFactorOrFallback(machine.prodn_efficiency, 0.9),
          default_waste: null,
          std_prodn: 0,
          shift_time: positiveNumberOrFallback(totalTime, 510),
          default_stoppage: 0,
          divisor_constant: 1693,
          delivery: 1,
          make_name: machine.make_name || null,
          machine_type: 'FINISHER',
          prodn_mixing: machine.prodn_mixing || '64COMBED GOLD'
        }
      },
      validateDefaultSetup: setup => assertPositiveSetupFields(
        setup,
        ['speed', 'hank_constant', 'std_efficiency_factor', 'shift_time', 'divisor_constant', 'delivery'],
        'Finisher Drawing setup'
      )
    })
    const headerDetails = validHeaderId
      ? await prisma.finisher_drawing_production_detail.findMany({ where: { header_id: validHeaderId }, select: { machine_id: true, prodn_mixing: true } })
      : []

    const machineMap = {}
    if (Array.isArray(machines)) {
      machines.forEach(machine => { machineMap[machine.id] = machine })
    }

    const mixingMap = {}
    if (Array.isArray(headerDetails)) {
      headerDetails.forEach(d => {
        if (d.prodn_mixing) mixingMap[d.machine_id] = d.prodn_mixing
      })
    }

    return (data || [])
      .map(setup => {
        const machine = machineMap[setup.machine_id] || null
        const dateMixing = mixingMap[setup.machine_id] ?? setup.prodn_mixing ?? machine?.prodn_mixing
        return {
          ...setup,
          machine: machine ? { ...machine, prodn_mixing: dateMixing } : null,
          prodn_mixing: dateMixing,
          speed: setup.speed ?? machine?.speed
        }
      })
      .filter(setup => setup.machine)
  } catch (error) {
    throw error
  }
}

// Update machine setup - accepts machine_id
export async function updateFinisherDrawingMachineSetup(setupId, updates) {
  try {
    updates = sanitizeFinisherDrawingSetupUpdate(updates)
    const hasSpeedUpdate = updates.speed != null
    const hasFormulaRuntimeUpdate = (
      hasSpeedUpdate ||
      updates.hank_constant != null ||
      updates.std_efficiency_factor != null ||
      updates.shift_time != null ||
      updates.delivery != null ||
      updates.divisor_constant != null
    )

    const existingSetup = await prisma.finisher_drawing_machine_setup.findUnique({
      where: { id: setupId },
      select: {
        id: true,
        machine_id: true,
        speed: true,
        hank_constant: true,
        std_efficiency_factor: true,
        shift_time: true,
        divisor_constant: true,
        delivery: true
      }
    })

    // If speed is being updated, update it in setup table and machine table
    if (hasSpeedUpdate) {
      const normalizedSpeed = Number.parseInt(String(updates.speed), 10)
      if (!Number.isFinite(normalizedSpeed) || normalizedSpeed < 0) {
        throw new Error('Invalid speed value')
      }
      updates.speed = normalizedSpeed
    }

    // Recalculate std_prodn if other params change
    if (hasFormulaRuntimeUpdate) {
      // Get current speed from machine table
      const machine = await prisma.drawing_finisher_machines.findUnique({
        where: { id: existingSetup.machine_id },
        select: { speed: true }
      })

      const effectiveSpeed = updates.speed ?? existingSetup?.speed ?? machine?.speed
      const resolved = resolveFinisherDrawingFormulaInputs({
        hank_constant: updates.hank_constant ?? existingSetup?.hank_constant,
        std_efficiency_factor: updates.std_efficiency_factor ?? existingSetup?.std_efficiency_factor,
        divisor_constant: updates.divisor_constant ?? existingSetup?.divisor_constant,
        delivery: updates.delivery ?? existingSetup?.delivery,
        speed: effectiveSpeed,
      }, effectiveSpeed)

      const shiftTime = await resolveFinisherDrawingSetupShiftTime(
        updates.shift_time ?? existingSetup?.shift_time,
        updates.shift
      )
      updates.std_prodn = Math.round(
        calculateFinisherDrawingStdProdn(
          {
            hank_constant: resolved.hankConstant,
            std_efficiency_factor: resolved.stdEfficiencyFactor,
            divisor_constant: resolved.divisorConstant,
            delivery: resolved.delivery,
            speed: resolved.speed,
          },
          shiftTime,
          resolved.speed
        ) * 100
      ) / 100
    }

    if (!existingSetup) throw new Error(`Finisher drawing setup ${setupId} not found`)

    if (Object.keys(updates).length === 0) {
      const data = await prisma.finisher_drawing_machine_setup.findUnique({ where: { id: setupId } })

      const machine = await prisma.drawing_finisher_machines.findUnique({
        where: { id: existingSetup.machine_id },
        select: {
          id: true,
          machine_no: true,
          speed: true
        }
      })

      return { ...data, machine: machine || null, speed: machine?.speed ?? data?.speed }
    }

    const data = await prisma.finisher_drawing_machine_setup.update({
      where: { id: setupId },
      data: {
        ...updates,
        updated_at: new Date()
      }
    })

    const machine = await prisma.drawing_finisher_machines.findUnique({
      where: { id: existingSetup.machine_id },
      select: {
        id: true,
        machine_no: true,
        speed: true
      }
    })

    return { ...data, machine: machine || null, speed: machine?.speed ?? data.speed }
  } catch (error) {
    console.error('Error updating machine setup:', error)
    throw new Error(`Failed to update machine setup: ${error.message || JSON.stringify(error)}`)
  }
}

async function recalculateFinisherDrawingDetailsForMachine(machineId) {
  const [machine, setup] = await Promise.all([
    prisma.drawing_finisher_machines.findUnique({
      where: { id: machineId },
      select: { id: true, speed: true }
    }),
    prisma.finisher_drawing_machine_setup.findFirst({
      where: { machine_id: machineId },
      orderBy: { updated_at: 'desc' }
    })
  ])

  if (!machine || !setup) return

  const details = await prisma.finisher_drawing_production_detail.findMany({
    where: { machine_id: machineId },
    select: {
      id: true,
      header_id: true,
      act_hank: true,
      act_prodn: true,
      waste: true,
    }
  })

  if (!details?.length) return

  const headerIds = [...new Set(details.map(d => d.header_id).filter(Boolean))]
  const headers = headerIds.length > 0
    ? await prisma.finisher_drawing_production_header.findMany({
        where: { id: { in: headerIds } },
        select: { id: true, shift: true, total_time: true }
      })
    : []
  const headerMap = {}
  headers.forEach(h => {
    headerMap[h.id] = h
  })

  const stoppageRows = await prisma.finisher_drawing_stoppage_entry.findMany({
    where: { production_detail_id: { in: details.map(d => d.id) } },
    select: {
      production_detail_id: true,
      total_stoppage_time: true,
    }
  })
  const stoppageMap = {}
  stoppageRows.forEach(s => {
    stoppageMap[s.production_detail_id] = Number.parseFloat(s.total_stoppage_time) || 0
  })

  for (const detail of details) {
    const header = headerMap[detail.header_id]
    const shiftTime = await getFinisherDrawingShiftTime(header?.shift || 1)
    const totalTime = header?.total_time || shiftTime
    const stoppageTime = stoppageMap[detail.id] || 0
    const calc = calculateFinisherDrawingValues(
      detail.act_hank || 0,
      detail.act_prodn || 0,
      totalTime,
      stoppageTime,
      setup,
      machine.speed
    )

    const waste = normalizeFinisherDrawingWaste(detail.waste, detail.act_prodn)
    const actProdn = detail.act_prodn || 0
    calc.waste = waste
    calc.waste_percent = actProdn > 0
      ? Math.round((waste / actProdn) * 100 * 100) / 100
      : 0

    // `speed` is returned for UI calculations, but it's not a production_detail column.
    const { speed: _ignoredSpeed, ...detailUpdateData } = calc

    await prisma.finisher_drawing_production_detail.update({
      where: { id: detail.id },
      data: {
        ...detailUpdateData,
      }
    })
  }
}

// Update machine speed
export async function updateFinisherDrawingMachineSpeed(machineId, newSpeed) {
  try {
    const data = await prisma.drawing_finisher_machines.update({
      where: { id: machineId },
      data: {
        speed: newSpeed,
        updated_at: new Date()
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// CALCULATION HELPERS - FINISHER DRAWING FORMULAS
// ============================================
// From finisher_drawing-formula.md:
// Constant = 1 / 2.20456 / 0.14 ≈ 3.240
// Act Prodn = Prod Hank × Constant
// Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery
// Exp Prodn = Std Prodn × (Work Time / Total Time)
// Act Effi % = Actual Prodn / Exp Prodn × 100
// UTI % = Work Time / Total Time × 100
// Waste % = Waste / Actual Prodn × 100
// Work Time = Total Time − Total Stoppage
//
// KEY: Finisher Drawing uses Hank = 0.14, Std Effi = 90%, Speed = 350

export function calculateFinisherDrawingValues(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed = null, waste = 0) {
  const {
    speed,
    hankConstant,
    stdEfficiencyFactor,
    divisorConstant,
    delivery,
  } = resolveFinisherDrawingFormulaInputs(setup, machineSpeed)
  
  const stdProdn = (speed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery

  // Exp Prodn = Std Prodn × (Work Time / Total Time) - based on actual working time

  // Effi% = Act Prodn / Exp Prodn × 100

  // UTI% = Work Time / Total Time × 100 (how much of shift was actually worked)

  // Waste% = Waste / Act Prodn × 100
  const metrics = calculateTimeAdjustedProductionMetrics({
    actualProduction: actProdn,
    standardProduction: stdProdn,
    waste,
    totalTime,
    stoppageTime,
  })

  return {
    std_prodn: metrics.standardProduction,
    exp_prodn: metrics.expectedProduction,
    effi_percent: metrics.efficiencyPercent,
    uti_percent: metrics.utilizationPercent,
    waste,
    waste_percent: metrics.wastePercent,
    run_time: metrics.totalTime,
    work_time: metrics.workTime,
    speed
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get finisher drawing stoppage reasons (filtered by Finisher Drawing department)
export async function getFinisherDrawingStoppageReasons() {
  try {
    // First get the Finisher Drawing department ID
    const finisherDept = await prisma.departments.findFirst({
      where: { 
        OR: [
          { dept_name: 'Finisher Drawing' },
          { dept_name: 'FINISHER DRAWING' }
        ]
      }
    });
    
    if (!finisherDept?.id) throw new Error('FINISHER DRAWING department not found')

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
        AND sd.department_id = ${finisherDept.id}
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

// Get supervisors
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

// Get mixing options
export async function getFinisherDrawingMixingOptions() {
  try {
    const data = await prisma.drawing_finisher_machines.findMany({
      where: {
        prodn_mixing: {
          not: null
        }
      },
      select: {
        prodn_mixing: true
      },
      distinct: ['prodn_mixing']
    })
    
    const uniqueMixings = [...new Set(data?.map(d => d.prodn_mixing) || [])]
    return uniqueMixings.sort()
  } catch (error) {
    throw error
  }
}
// ============================================
// COPY PREVIOUS SPEED FUNCTIONALITY
// ============================================

export async function getFinisherDrawingAvailableDates(beforeDate, shift, limit = 30) {
  return getAvailablePreviousSpeedDates(
    prisma.finisher_drawing_machine_setup,
    beforeDate,
    shift,
    limit
  );
}

export async function copyFinisherDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  return copyPreviousSpeeds({
    setupModel: prisma.finisher_drawing_machine_setup,
    headerModel: prisma.finisher_drawing_production_header,
    targetHeaderId,
    targetDate,
    targetShift,
    sourceDate,
    buildUpdateData: (setup, speed) => {
      const shiftTime = Number(setup.shift_time || resolveFinisherDrawingShiftFallbackTime(targetShift))
      return {
        speed,
        std_prodn: Math.round(
          calculateFinisherDrawingStdProdn({ ...setup, speed }, shiftTime, speed) * 100
        ) / 100
      }
    }
  });
}

// Backward compatibility wrapper
export async function copyFinisherDrawingFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copyFinisherDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, null);
}

// Get spinning count options for dropdown from spinning_counts master table
export async function getSpinningCountOptions() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: { 
        id: true,
        count_name: true, 
        act_count: true 
      },
      orderBy: { count_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// ============================================
// MACHINE MANAGEMENT QUERIES
// ============================================

// Add new finisher drawing machine
export async function addFinisherDrawingMachine(machineData, entryContext) {
  if (!machineData.machine_no) {
    throw new Error('Machine number is required')
  }

  const created = await prisma.$transaction(async tx => {
  const context = await resolveEntryMachineContext({
    headerModel: tx.finisher_drawing_production_header,
    context: entryContext,
    label: 'Finisher Drawing production entry'
  })
  const machineNo = normalizeMachineNumber(machineData.machine_no)
  const matchingLifecycles = await tx.drawing_finisher_machines.findMany({
    where: { machine_no: machineNo },
    select: { id: true, is_active: true, activated_at: true, deactivated_at: true }
  })
  assertLifecycleCanStart(matchingLifecycles, context.entryDate, machineNo)
  const installedDate = validateInstalledDateForActivation(machineData.installed_date, context.entryDate)
  const prodnEffi = machineData.prodn_effi != null ? parseFloat(machineData.prodn_effi) : null

  // Check if machine already exists (including inactive)
  const existingMachine = await tx.drawing_finisher_machines.findFirst({
    // Preserve inactive rows as completed historical lifecycles.
    where: { machine_no: machineNo, is_active: true },
    select: {
      id: true,
      is_active: true,
      machine_no: true,
      description: true,
      make_name: true,
      model: true,
      installed_date: true,
      prodn_efficiency: true,
      prodn_mixing: true,
      speed: true,
    }
  })

  if (existingMachine && !existingMachine.is_active) {
    // Reactivate the machine — clear deactivated_at, set new activated_at
    const reactivatedMachine = await tx.drawing_finisher_machines.update({
      where: { id: existingMachine.id },
      data: {
        is_active: true,
        description: machineData.description || existingMachine.machine_no,
        make_name: machineData.make_name || 'LMW',
        model: machineData.model || existingMachine.model || null,
        installed_date: installedDate || existingMachine.installed_date || null,
        prodn_efficiency: prodnEffi ?? existingMachine.prodn_efficiency,
        prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
        speed: resolveFinisherDrawingFormulaInputs(machineData, machineData.speed).speed,
        activated_at: context.entryDate,
        deactivated_at: null,
      }
    })

    // Update or create setup for the reactivated machine
    const existingSetup = await tx.finisher_drawing_machine_setup.findFirst({
      where: { machine_id: existingMachine.id },
      orderBy: { updated_at: 'desc' }
    })

    const shiftTime = context.totalTime > 0
      ? context.totalTime
      : await resolveFinisherDrawingSetupShiftTime(machineData.shift_time, context.shift)
    const formulaInputs = resolveFinisherDrawingFormulaInputs(machineData, machineData.speed)
    const stdProdn = calculateFinisherDrawingStdProdn(
      {
        hank_constant: formulaInputs.hankConstant,
        std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
        divisor_constant: formulaInputs.divisorConstant,
        delivery: formulaInputs.delivery,
        speed: formulaInputs.speed,
      },
      shiftTime,
      formulaInputs.speed
    )

    let setup
    if (existingSetup) {
      setup = await tx.finisher_drawing_machine_setup.update({
        where: { id: existingSetup.id },
        data: {
          speed: formulaInputs.speed,
          hank_constant: formulaInputs.hankConstant,
          std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
          shift_time: shiftTime,
          divisor_constant: formulaInputs.divisorConstant,
          delivery: formulaInputs.delivery,
          std_prodn: stdProdn,
        }
      })
    } else {
      setup = await tx.finisher_drawing_machine_setup.create({
        data: {
          machine_id: existingMachine.id,
          entry_date: context.entryDate,
          shift: context.shift,
          speed: formulaInputs.speed,
          hank_constant: formulaInputs.hankConstant,
          std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
          shift_time: shiftTime,
          divisor_constant: formulaInputs.divisorConstant,
          delivery: formulaInputs.delivery,
          std_prodn: stdProdn,
          prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD'
        }
      })
    }
    // Do NOT proactively sync past headers — sync runs on each entry page load.
    return { machine: reactivatedMachine, setup, reactivated: true, syncedHeaders: 0 }
  }

  if (existingMachine && existingMachine.is_active) {
    // Active machine — check if setup exists
    const existingSetup = await tx.finisher_drawing_machine_setup.findFirst({
      where: { machine_id: existingMachine.id },
      orderBy: { updated_at: 'desc' }
    })
    if (existingSetup) {
      throw new Error(`Machine ${machineNo} already exists and is active`)
    }
    // Active but no setup yet (created via master form) — update machine then create setup
    await tx.drawing_finisher_machines.update({
      where: { id: existingMachine.id },
      data: {
        description: machineData.description || existingMachine.description || existingMachine.machine_no,
        make_name: machineData.make_name || existingMachine.make_name || 'LMW',
        model: machineData.model || existingMachine.model || null,
        installed_date: installedDate || existingMachine.installed_date || null,
        prodn_efficiency: prodnEffi ?? existingMachine.prodn_efficiency,
        prodn_mixing: machineData.prodn_mixing || existingMachine.prodn_mixing || '64COMBED GOLD',
        speed: resolveFinisherDrawingFormulaInputs(
          { speed: machineData.speed === '' || machineData.speed == null ? existingMachine.speed : machineData.speed },
          existingMachine.speed
        ).speed,
      }
    })

    const shiftTime = context.totalTime > 0
      ? context.totalTime
      : await resolveFinisherDrawingSetupShiftTime(machineData.shift_time, context.shift)
    const formulaInputs = resolveFinisherDrawingFormulaInputs(machineData, machineData.speed)
    const newSetup = await tx.finisher_drawing_machine_setup.create({
      data: {
        machine_id: existingMachine.id,
        entry_date: context.entryDate,
        shift: context.shift,
        speed: formulaInputs.speed,
        hank_constant: formulaInputs.hankConstant,
        std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
        shift_time: shiftTime,
        divisor_constant: formulaInputs.divisorConstant,
        delivery: formulaInputs.delivery,
        std_prodn: calculateFinisherDrawingStdProdn(
          {
            hank_constant: formulaInputs.hankConstant,
            std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
            divisor_constant: formulaInputs.divisorConstant,
            delivery: formulaInputs.delivery,
            speed: formulaInputs.speed,
          },
          shiftTime,
          formulaInputs.speed
        )
      }
    })
    return { machine: existingMachine, setup: newSetup, reactivated: false, syncedHeaders: 0 }
  }

  // New machine — compute sort_order
  const maxSortResult = await tx.drawing_finisher_machines.aggregate({ _max: { sort_order: true } })
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1

  const newMachine = await tx.drawing_finisher_machines.create({
    data: {
      machine_no: machineNo,
      description: machineData.description || `Finisher Drawing Machine ${machineNo}`,
      make_name: machineData.make_name || 'LMW',
      model: machineData.model || null,
      installed_date: installedDate || null,
      prodn_efficiency: prodnEffi,
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      speed: resolveFinisherDrawingFormulaInputs(machineData, machineData.speed).speed,
      is_active: true,
      activated_at: context.entryDate,
      sort_order: nextSortOrder,
    }
  })

  const shiftTime = context.totalTime > 0
    ? context.totalTime
    : await resolveFinisherDrawingSetupShiftTime(machineData.shift_time, context.shift)
  const formulaInputs = resolveFinisherDrawingFormulaInputs(machineData, machineData.speed)

  const newSetup = await tx.finisher_drawing_machine_setup.create({
    data: {
      machine_id: newMachine.id,
      entry_date: context.entryDate,
      shift: context.shift,
      speed: formulaInputs.speed,
      hank_constant: formulaInputs.hankConstant,
      std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
      shift_time: shiftTime,
      divisor_constant: formulaInputs.divisorConstant,
      delivery: formulaInputs.delivery,
      std_prodn: Math.round(calculateFinisherDrawingStdProdn(
        {
          hank_constant: formulaInputs.hankConstant,
          std_efficiency_factor: formulaInputs.stdEfficiencyFactor,
          divisor_constant: formulaInputs.divisorConstant,
          delivery: formulaInputs.delivery,
          speed: formulaInputs.speed,
        },
        shiftTime,
        formulaInputs.speed
      ) * 100) / 100,
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD'
    }
  })

  // Do NOT proactively sync past headers — sync runs on each entry page load.
  return { machine: newMachine, setup: newSetup, reactivated: false, context }
  })
  const { context, ...result } = created
  const syncedDetails = await syncFinisherDrawingNewMachinesToHeader(context.headerId)
  return { ...result, syncedHeaders: 1, syncedDetails }
}

// Remove (deactivate) finisher drawing machine
export async function removeFinisherDrawingMachines(machineIds, entryContext) {
  return prisma.$transaction(tx => deactivateEntryMachines({
    headerModel: tx.finisher_drawing_production_header,
    machineModel: tx.drawing_finisher_machines,
    machineIds,
    context: entryContext,
    label: 'Finisher Drawing production entry'
  }))
}

export async function removeFinisherDrawingMachine(machineId, entryContext) {
  const result = await removeFinisherDrawingMachines([machineId], entryContext)
  return { id: machineId, is_active: false, deactivated_at: result.entryDate }
}

// Lookup finisher drawing machine by machine_no (for setup tab auto-fill)
export async function lookupFinisherDrawingMachineByNo(machineNo) {
  const machine = await prisma.drawing_finisher_machines.findFirst({
    where: { machine_no: { equals: machineNo } }
  })
  if (!machine) return null

  const setup = await prisma.finisher_drawing_machine_setup.findFirst({
    where: { machine_id: machine.id }
  })

  return {
    ...machine,
    std_efficiency_factor: setup?.std_efficiency_factor != null ? parseFloat(setup.std_efficiency_factor) : null,
    setup_hank_constant: setup?.hank_constant != null ? parseFloat(setup.hank_constant) : null,
    has_setup: !!setup,
  }
}

// Atomically update canonical, current header, and current date/shift mixing.
export async function updateFinisherDrawingMachineMixing(machineId, newMixing, headerId = null) {
  return bulkUpdateFinisherDrawingMachineMixing([machineId], newMixing, headerId)
}

// Bulk variant of the same canonical/current-snapshot update.
export async function bulkUpdateFinisherDrawingMachineMixing(machineIds, newMixing, headerId = null) {
  const mixing = normalizeMixingValue(newMixing)

  return prisma.$transaction(async tx => {
    const context = await resolveMachineMixingContext({
      headerModel: tx.finisher_drawing_production_header,
      machineModel: tx.drawing_finisher_machines,
      headerId,
      machineIds
    })
    const updatedAt = new Date()

    const machines = await tx.drawing_finisher_machines.updateMany({
      where: { id: { in: context.machineIds }, is_active: true },
      data: { prodn_mixing: mixing, updated_at: updatedAt }
    })
    const productionDetails = context.header
      ? await tx.finisher_drawing_production_detail.updateMany({
          where: {
            header_id: context.header.id,
            machine_id: { in: context.machineIds }
          },
          data: { prodn_mixing: mixing, updated_at: updatedAt }
        })
      : { count: 0 }
    const setups = context.header
      ? await Promise.all(context.machineIds.map(machineId => (
          tx.finisher_drawing_machine_setup.upsert({
            where: {
              idx_finisher_setup_date: {
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
