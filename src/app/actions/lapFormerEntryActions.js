'use server'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/lapFormerQueries'
import { assertWorkingDate } from '@/lib/holidayValidation'

// ============================================
// SHIFT CONFIGURATION ACTIONS
// ============================================

export async function getLapFormerShiftConfigAction(shift) {
  try {
    const shiftTime = await queries.getLapFormerShiftTime(shift)
    const defaultStoppage = await queries.getLapFormerDefaultStoppage(shift)
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

export async function getLapFormerProductionByDateShiftAction(date, shift) {
  try {
    const data = await queries.getLapFormerProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getOrCreateLapFormerHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateLapFormerHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateLapFormerHeaderAction(id, updates) {
  try {
    const data = await queries.updateLapFormerHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getLapFormerProductionDetailsAction(headerId) {
  try {
    const data = await queries.getLapFormerProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getLapFormerProductionWithSetupAction(headerId) {
  try {
    const data = await queries.getLapFormerProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function initializeLapFormerDetailsAction(headerId) {
  try {
    const data = await queries.initializeLapFormerDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function syncNewMachinesToLapFormerHeaderAction(headerId) {
  try {
    const data = await queries.syncNewMachinesToLapFormerHeader(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateLapFormerDetailAction(id, updates) {
  try {
    const data = await queries.updateLapFormerDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkUpdateLapFormerDetailsAction(updates) {
  try {
    const data = await queries.bulkUpdateLapFormerDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getLapFormerStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getLapFormerStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateLapFormerStoppageEntryAction(id, updates) {
  try {
    const data = await queries.updateLapFormerStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applyLapFormerFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  try {
    const result = await queries.applyLapFormerFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return {
      success: result.success,
      data: {
        updatedCount: result.data?.updatedCount || 0,
        skippedCount: result.data?.skippedCount || 0,
        overflowCount: result.data?.overflowCount || 0,
        appliedRows: serializeData(result.data?.appliedRows || [])
      }
    }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applyLapFormerPartialStoppageAction(headerId, fromMachine, toMachine, stoppageId, stoppageTime) {
  try {
    const result = await queries.applyLapFormerPartialStoppage(headerId, fromMachine, toMachine, stoppageId, stoppageTime)
    return {
      success: result.success,
      data: {
        updatedCount: result.data?.updatedCount || 0,
        skippedCount: result.data?.skippedCount || 0,
        overflowCount: result.data?.overflowCount || 0,
        appliedRows: serializeData(result.data?.appliedRows || [])
      }
    }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getLapFormerStoppageReasonsAction() {
  try {
    const data = await queries.getLapFormerStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getLapFormerMachineSetupsAction(headerId = null) {
  try {
    const data = await queries.getLapFormerMachineSetups(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateLapFormerMachineSetupAction(machineId, updates) {
  try {
    const data = await queries.updateLapFormerMachineSetup(machineId, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateLapFormerMachineSpeedAction(machineId, newSpeed) {
  try {
    const data = await queries.updateLapFormerMachineSpeed(machineId, newSpeed)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getLapFormerMixingOptionsAction() {
  try {
    const data = await queries.getLapFormerMixingOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getLapFormerMachinesAction() {
  try {
    const data = await queries.getActiveLapFormerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function addLapFormerMachineAction(machineData, entryContext) {
  try {
    const data = await queries.addLapFormerMachine(machineData, entryContext)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeLapFormerMachineAction(machineId, entryContext) {
  try {
    const data = await queries.removeLapFormerMachine(machineId, entryContext)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeLapFormerMachinesAction(machineIds, entryContext) {
  try {
    const data = await queries.removeLapFormerMachines(machineIds, entryContext)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkUpdateLapFormerMachineMixingAction(machineIds, mixingValue, headerId = null) {
  try {
    const data = await queries.bulkUpdateLapFormerMachineMixing(machineIds, mixingValue, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSpinningCountOptionsAction() {
  try {
    const data = await queries.getSpinningCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupLapFormerMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupLapFormerMachineByNo(machineNo)
    return { success: true, data: data ? serializeData(data) : null }
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

export async function copyLapFormerFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copyLapFormerFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getLapFormerAvailableDatesAction(currentDate, shift) {
  try {
    const data = await queries.getLapFormerAvailableDates(currentDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// CALCULATION ACTIONS
// ============================================

export async function calculateLapFormerValuesAction(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed = null) {
  try {
    const data = queries.calculateLapFormerValues(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
