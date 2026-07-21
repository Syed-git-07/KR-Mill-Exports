'use server'

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
    return { success: false, error: error.message }
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
    return { success: false, error: error.message }
  }
}

export async function getOrCreateBreakerDrawingHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateBreakerDrawingHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateBreakerDrawingHeaderAction(id, updates) {
  try {
    const data = await queries.updateBreakerDrawingHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
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
    return { success: false, error: error.message }
  }
}

export async function getBreakerDrawingProductionWithSetupAction(headerId) {
  try {
    const data = await queries.getBreakerDrawingProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function initializeBreakerDrawingDetailsAction(headerId, shift = 1) {
  try {
    const data = await queries.initializeBreakerDrawingDetails(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function syncNewMachinesToHeaderAction(headerId, shift = 1) {
  try {
    const data = await queries.syncNewMachinesToBreakerDrawingHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Alias for backward compatibility
export const syncNewMachinesToBreakerDrawingHeaderAction = syncNewMachinesToHeaderAction

export async function updateProductionDetailAction(id, updates) {
  try {
    const data = await queries.updateBreakerDrawingDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
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
    return { success: false, error: error.message }
  }
}

export async function updateStoppageEntryAction(id, updates) {
  try {
    const data = await queries.updateStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getBreakerDrawingStoppageReasonsAction() {
  try {
    const data = await queries.getBreakerDrawingStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
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
    return { success: false, error: error.message }
  }
}

export async function updateMachineSetupAction(machineId, updates) {
  try {
    const data = await queries.updateMachineSetup(machineId, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function upsertMachineSetupAction(machineId, setupData) {
  try {
    const data = await queries.upsertMachineSetup(machineId, setupData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getCountOptionsAction() {
  try {
    const data = await queries.getCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function addBreakerDrawingMachineAction(machineData) {
  try {
    const data = await queries.addBreakerDrawingMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeBreakerDrawingMachineAction(machineId) {
  try {
    const data = await queries.removeBreakerDrawingMachine(machineId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateMachineCountAction(machineId, count) {
  try {
    const data = await queries.updateMachineCount(machineId, count)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateMachineCountAction(machineIds, count) {
  try {
    const data = await queries.bulkUpdateMachineCount(machineIds, count)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get mixing options
export async function getMixingOptionsAction() {
  try {
    const data = await queries.getMixingOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update machine mixing
export async function updateBreakerDrawingMachineMixingAction(machineId, mixing, headerId = null) {
  try {
    const data = await queries.updateBreakerDrawingMachineMixing(machineId, mixing, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Bulk update machine mixing
export async function bulkUpdateBreakerDrawingMachineMixingAction(machineIds, mixing, headerId = null) {
  try {
    const data = await queries.bulkUpdateBreakerDrawingMachineMixing(machineIds, mixing, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
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
    return { success: false, error: error.message }
  }
}

export async function copyBreakerDrawingFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copyBreakerDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getBreakerDrawingAvailableDatesAction(currentDate, shift) {
  try {
    const data = await queries.getBreakerDrawingAvailableDates(currentDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get machines list
export async function getBreakerDrawingMachinesAction() {
  try {
    const data = await queries.getBreakerDrawingMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Apply full stoppage to all machines
export async function applyBreakerDrawingFullStoppageAction(headerId, stoppageId, stoppageTime, slot) {
  try {
    const data = await queries.applyBreakerDrawingFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Apply partial stoppage (with auto-slot allocation)
export async function applyBreakerDrawingPartialStoppageAction(headerId, fromMachine, toMachine, stoppageId, stoppageTime) {
  try {
    const data = await queries.applyBreakerDrawingPartialStoppage(headerId, fromMachine, toMachine, stoppageId, stoppageTime)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
