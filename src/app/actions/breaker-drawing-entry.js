'use server'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/breakerDrawingQueries'
import { assertWorkingDate } from '@/lib/holidayValidation'

// ============================================
// SHIFT CONFIGURATION ACTIONS
// ============================================

export async function getBreakerDrawingShiftConfigAction(shift) {
  try {
    const shiftTime = await queries.getBreakerDrawingShiftTime(shift)
    const defaultStoppage = await queries.getBreakerDrawingDefaultStoppage(shift)
    return { 
      success: true, 
      data: {
        shiftTime: shiftTime,
        defaultStoppage: defaultStoppage,
        workTime: shiftTime - defaultStoppage
      }
    }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION HEADER ACTIONS
// ============================================

export async function getBreakerDrawingProductionByDateShiftAction(date, shift) {
  try {
    const data = await queries.getBreakerDrawingProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getOrCreateBreakerDrawingHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateBreakerDrawingHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateBreakerDrawingHeaderAction(id, updates) {
  try {
    const data = await queries.updateBreakerDrawingHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getBreakerDrawingProductionDetailsAction(headerId) {
  try {
    const data = await queries.getBreakerDrawingProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getBreakerDrawingProductionWithSetupAction(headerId) {
  try {
    const data = await queries.getBreakerDrawingProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function initializeBreakerDrawingDetailsAction(headerId, shift = 1) {
  try {
    const data = await queries.initializeBreakerDrawingDetails(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function syncNewMachinesToHeaderAction(headerId, shift = 1) {
  try {
    const data = await queries.syncNewMachinesToBreakerDrawingHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Alias for backward compatibility
export const syncNewMachinesToBreakerDrawingHeaderAction = syncNewMachinesToHeaderAction

export async function updateProductionDetailAction(id, updates) {
  try {
    const data = await queries.updateBreakerDrawingDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkUpdateBreakerDrawingDetailsAction(updates) {
  try {
    const data = await queries.bulkUpdateBreakerDrawingDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Alias for backward compatibility
export const updateBreakerDrawingDetailAction = updateProductionDetailAction

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getBreakerDrawingStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getBreakerDrawingStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateStoppageEntryAction(id, updates) {
  try {
    const data = await queries.updateStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getBreakerDrawingStoppageReasonsAction() {
  try {
    const data = await queries.getBreakerDrawingStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getBreakerDrawingMachineSetupsAction(shift = 1, headerId = null) {
  try {
    const data = await queries.getBreakerDrawingMachineSetups(headerId)
    // Get shift-based time values (await async function)
    const shiftTime = await queries.getBreakerDrawingShiftTime(shift)
    
    // Override shift_time in each setup with the dynamic shift-based value
    const modifiedData = data.map(setup => ({
      ...setup,
      shift_time: shiftTime  // Override with shift-specific time
    }))
    
    return { success: true, data: serializeData(modifiedData) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateMachineSetupAction(machineId, updates) {
  try {
    const data = await queries.updateMachineSetup(machineId, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function upsertMachineSetupAction(machineId, setupData) {
  try {
    const data = await queries.upsertMachineSetup(machineId, setupData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getCountOptionsAction() {
  try {
    const data = await queries.getCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function addBreakerDrawingMachineAction(machineData, entryContext) {
  try {
    const data = await queries.addBreakerDrawingMachine(machineData, entryContext)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeBreakerDrawingMachineAction(machineId, entryContext) {
  try {
    const data = await queries.removeBreakerDrawingMachine(machineId, entryContext)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeBreakerDrawingMachinesAction(machineIds, entryContext) {
  try {
    const data = await queries.removeBreakerDrawingMachines(machineIds, entryContext)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateMachineCountAction(machineId, count, headerId = null) {
  try {
    const data = await queries.updateMachineCount(machineId, count, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkUpdateMachineCountAction(machineIds, count, headerId = null) {
  try {
    const data = await queries.bulkUpdateMachineCount(machineIds, count, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Get mixing options
export async function getMixingOptionsAction() {
  try {
    const data = await queries.getMixingOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Update machine mixing
export async function updateBreakerDrawingMachineMixingAction(machineId, mixing, headerId = null) {
  try {
    const data = await queries.updateBreakerDrawingMachineMixing(machineId, mixing, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Bulk update machine mixing
export async function bulkUpdateBreakerDrawingMachineMixingAction(machineIds, mixing, headerId = null) {
  try {
    const data = await queries.bulkUpdateBreakerDrawingMachineMixing(machineIds, mixing, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

export async function getSupervisorsAction() {
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function copyBreakerDrawingFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copyBreakerDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getBreakerDrawingAvailableDatesAction(currentDate, shift) {
  try {
    const data = await queries.getBreakerDrawingAvailableDates(currentDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Get machines list
export async function getBreakerDrawingMachinesAction() {
  try {
    const data = await queries.getBreakerDrawingMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Apply full stoppage to all machines
export async function applyBreakerDrawingFullStoppageAction(headerId, stoppageId, stoppageTime, slot) {
  try {
    const data = await queries.applyBreakerDrawingFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Apply partial stoppage (with auto-slot allocation)
export async function applyBreakerDrawingPartialStoppageAction(headerId, fromMachine, toMachine, stoppageId, stoppageTime) {
  try {
    const data = await queries.applyBreakerDrawingPartialStoppage(headerId, fromMachine, toMachine, stoppageId, stoppageTime)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
