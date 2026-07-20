'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/finisherDrawingEntryQueries'
import { resolveFinisherDrawingShiftFallbackTime } from '@/lib/finisherDrawingShiftFallback'

// ============================================
// SHIFT CONFIGURATION ACTIONS
// ============================================

export async function getFinisherDrawingShiftConfigAction(shift) {
  try {
    const data = await queries.getFinisherDrawingShiftConfig(shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTION HEADER ACTIONS
// ============================================

export async function getFinisherDrawingProductionByDateShiftAction(date, shift) {
  try {
    const data = await queries.getFinisherDrawingProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getOrCreateFinisherDrawingHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    const data = await queries.getOrCreateFinisherDrawingHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateFinisherDrawingHeaderAction(id, updates) {
  try {
    const data = await queries.updateFinisherDrawingHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getFinisherDrawingProductionDetailsAction(headerId) {
  try {
    const data = await queries.getFinisherDrawingProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getFinisherDrawingProductionWithSetupAction(headerId) {
  try {
    const data = await queries.getFinisherDrawingProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function initializeFinisherDrawingDetailsAction(headerId) {
  try {
    const data = await queries.initializeFinisherDrawingDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function syncFinisherDrawingNewMachinesToHeaderAction(headerId) {
  try {
    const data = await queries.syncFinisherDrawingNewMachinesToHeader(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateFinisherDrawingDetailAction(id, updates) {
  try {
    const data = await queries.updateFinisherDrawingDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateFinisherDrawingDetailsAction(updates) {
  try {
    const data = await queries.bulkUpdateFinisherDrawingDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getFinisherDrawingStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getFinisherDrawingStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateFinisherDrawingStoppageEntryAction(id, updates) {
  try {
    const data = await queries.updateFinisherDrawingStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getStoppageDetailsAction() {
  try {
    const data = await queries.getStoppageDetails()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applyFinisherDrawingFullStoppageAction(headerId, stoppageData) {
  try {
    const { stoppageId, stoppageTime, slot } = stoppageData
    const result = await queries.applyFinisherDrawingFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: result.success, data: serializeData(result.data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getFinisherDrawingStoppageReasonsAction() {
  try {
    const data = await queries.getFinisherDrawingStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applyFinisherDrawingPartialStoppageAction(headerId, fromMachine, toMachine, stoppageId, stoppageTime) {
  try {
    const result = await queries.applyFinisherDrawingPartialStoppage(headerId, fromMachine, toMachine, stoppageId, stoppageTime)
    return { 
      success: result.success, 
      data: {
        updatedCount: result.data.updatedCount,
        skippedCount: result.data.skippedCount,
        overflowCount: result.data.overflowCount,
        appliedRows: serializeData(result.data.appliedRows)
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getFinisherDrawingMachineSetupsAction(shift = 1) {
  try {
    const data = await queries.getFinisherDrawingMachineSetups()
    const shiftConfig = await queries.getFinisherDrawingShiftConfig(shift)
    const shiftTime = shiftConfig?.shiftTime || resolveFinisherDrawingShiftFallbackTime(shift)

    const modifiedData = (data || []).map(setup => ({
      ...setup,
      shift_time: shiftTime
    }))

    return { success: true, data: serializeData(modifiedData) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateFinisherDrawingMachineSetupAction(machineId, updates) {
  try {
    const data = await queries.updateFinisherDrawingMachineSetup(machineId, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateFinisherDrawingMachineSpeedAction(machineId, newSpeed) {
  try {
    const data = await queries.updateFinisherDrawingMachineSpeed(machineId, newSpeed)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getFinisherDrawingMixingOptionsAction() {
  try {
    const data = await queries.getFinisherDrawingMixingOptions()
    return { success: true, data: data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getFinisherDrawingMachinesAction() {
  try {
    const data = await queries.getFinisherDrawingMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function addFinisherDrawingMachineAction(machineData) {
  try {
    const data = await queries.addFinisherDrawingMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeFinisherDrawingMachineAction(machineId) {
  try {
    const data = await queries.removeFinisherDrawingMachine(machineId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateFinisherDrawingMachineMixingAction(machineIds, mixingValue) {
  try {
    const data = await queries.bulkUpdateFinisherDrawingMachineMixing(machineIds, mixingValue)
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

export async function copyFinisherDrawingFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copyFinisherDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getFinisherDrawingAvailableDatesAction(currentDate, shift) {
  try {
    const data = await queries.getFinisherDrawingAvailableDates(currentDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSpinningCountOptionsAction() {
  try {
    const data = await queries.getSpinningCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function lookupFinisherDrawingMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupFinisherDrawingMachineByNo(machineNo)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
