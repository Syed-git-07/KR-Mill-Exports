'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/comberEntryQueries'
import { resolveComberShiftFallbackTime } from '@/lib/comberShiftFallback'
import { assertWorkingDate } from '@/lib/holidayValidation'

// ============================================
// SHIFT CONFIGURATION ACTIONS
// ============================================

export async function getComberShiftConfigAction(shift) {
  try {
    const data = await queries.getComberShiftConfig(shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getComberShiftTimeAction(shift) {
  try {
    const shiftTime = await queries.getComberShiftTime(shift)
    return { success: true, data: shiftTime }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: resolveComberShiftFallbackTime(shift)
    }
  }
}

export async function getComberShiftConfigurationAction(shift) {
  try {
    const config = await queries.getComberShiftConfiguration(shift)
    return { success: true, data: config }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: {
        totalTime: resolveComberShiftFallbackTime(shift)
      }
    }
  }
}

// ============================================
// PRODUCTION HEADER ACTIONS
// ============================================

export async function getComberProductionByDateShiftAction(date, shift) {
  try {
    const data = await queries.getComberProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getOrCreateComberProductionHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateComberProductionHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateComberProductionHeaderAction(id, updates) {
  try {
    const data = await queries.updateComberProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getComberProductionDetailsAction(headerId) {
  try {
    const data = await queries.getComberProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function initializeComberProductionDetailsAction(headerId, shift = 1) {
  try {
    // Get shift configuration for totalTime
    const shiftConfig = await queries.getComberShiftConfiguration(shift)
    const data = await queries.initializeComberProductionDetails(
      headerId, 
      shiftConfig.totalTime
    )
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateComberProductionDetailAction(id, updates) {
  try {
    const data = await queries.updateComberProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateComberProductionDetailsAction(updates) {
  try {
    const data = await queries.bulkUpdateComberProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getComberStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getComberStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateComberStoppageEntryAction(id, updates) {
  try {
    const data = await queries.updateComberStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getComberStoppageReasonsAction() {
  try {
    const data = await queries.getComberStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function syncNewMachinesToComberHeaderAction(headerId, shift = 1) {
  try {
    const data = await queries.syncNewMachinesToComberHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getComberMachineSetupsAction() {
  try {
    const data = await queries.getComberMachineSetups()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateComberMachineSetupAction(id, updates) {
  try {
    const data = await queries.updateComberMachineSetup(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function addComberMachineAction(machineData) {
  try {
    const data = await queries.addComberMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeComberMachineAction(machineId) {
  try {
    const data = await queries.removeComberMachine(machineId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateComberMachineCountAction(machineId, newCount) {
  try {
    const data = await queries.updateComberMachineCount(machineId, newCount)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateComberMachineCountAction(machineIds, newCount) {
  try {
    const data = await queries.bulkUpdateComberMachineCount(machineIds, newCount)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getComberCountOptionsAction() {
  try {
    const data = await queries.getComberCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getComberMachinesAction() {
  try {
    const data = await queries.getComberMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getComberProductionWithSetupAction(headerId) {
  try {
    const data = await queries.getComberProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applyComberFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  try {
    const result = await queries.applyComberFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: result.success, data: serializeData(result.data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applyComberPartialStoppageAction(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const result = await queries.applyComberPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime)
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
// SUPERVISOR ACTIONS
// ============================================

export async function getSupervisorsAction() {
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// COPY FROM PREVIOUS DATE ACTIONS
// ============================================

export async function getComberAvailablePreviousDatesAction(beforeDate, shift, limit = 30) {
  try {
    const data = await queries.getComberAvailableDates(beforeDate, shift, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function copyComberFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate, sourceShift) {
  try {
    const data = await queries.copyComberFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate, sourceShift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
