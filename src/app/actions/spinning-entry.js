'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/spinningEntryQueries'
import { resolveSpinningShiftFallbackTime } from '@/lib/spinningShiftFallback'

// ============================================
// SHIFT CONFIG ACTIONS
// ============================================

export async function getSpinningShiftConfigAction(shift) {
  try {
    const config = await queries.getSpinningShiftConfiguration(shift)
    return { 
      success: true, 
      data: {
        shiftTime: config.totalTime,
        defaultStoppage: config.defaultStoppage,
        workTime: config.workTime
      }
    }
  } catch (error) {
    const fallbackShiftTime = resolveSpinningShiftFallbackTime(shift)
    return { 
      success: false, 
      error: error.message,
      data: {
        shiftTime: fallbackShiftTime,
        defaultStoppage: 0,
        workTime: fallbackShiftTime
      }
    }
  }
}

// ============================================
// HEADER ACTIONS
// ============================================

export async function getSpinningProductionByDateShiftAction(date, shift) {
  try {
    const data = await queries.getSpinningProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getOrCreateSpinningHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    const data = await queries.getOrCreateSpinningHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSpinningProductionHeaderAction(id, updates) {
  try {
    const data = await queries.updateSpinningProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getSpinningProductionDetailsAction(headerId) {
  try {
    const data = await queries.getSpinningProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function syncNewMachinesToSpinningHeaderAction(headerId, shift = 1) {
  try {
    const data = await queries.syncNewMachinesToSpinningHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSpinningProductionDetailAction(id, updates) {
  try {
    const data = await queries.updateSpinningProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function batchUpdateSpinningProductionDetailsAction(updates) {
  try {
    const data = await queries.batchUpdateSpinningProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Calculate production values
export async function calculateSpinningProductionAction(params) {
  try {
    const result = queries.calculateSpinningProduction(params)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// STOPPAGE ACTIONS
// ============================================

export async function getSpinningStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getSpinningStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSpinningStoppageEntryAction(stoppageId, updates) {
  try {
    const data = await queries.updateSpinningStoppageEntry(stoppageId, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applySpinningFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  try {
    const data = await queries.applyFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applySpinningPartialStoppageAction(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const data = await queries.applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSpinningStoppageReasonsAction() {
  try {
    const data = await queries.getSpinningStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchSpinningStoppageReasonsAction(searchTerm = '', limit = 20) {
  try {
    const data = await queries.searchSpinningStoppageReasons(searchTerm, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getSpinningMachineSetupsAction(shift = 1, entryDate) {
  try {
    const data = await queries.getSpinningMachineSetups(entryDate, shift)
    // Get shift-based time values
    const shiftTime = await queries.getSpinningShiftTime(shift)
    
    // Override run_time in each setup with the dynamic shift-based value
    const modifiedData = data.map(setup => ({
      ...setup,
      run_time: shiftTime
    }))
    
    return { success: true, data: serializeData(modifiedData) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSpinningMachineSetupAction(id, updates, shift = null) {
  try {
    const data = await queries.updateSpinningMachineSetup(id, updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function upsertSpinningMachineSetupAction(machineId, entryDate, setupData) {
  try {
    const data = await queries.upsertSpinningMachineSetup(machineId, entryDate, setupData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function batchUpdateSpinningMachineSetupsAction(updates, shift = null) {
  try {
    const data = await queries.batchUpdateSpinningMachineSetups(updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

export async function getSpinningMachinesAction() {
  try {
    const data = await queries.getSpinningMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getAllSpinningMachinesAction() {
  try {
    const data = await queries.getAllSpinningMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function lookupSpinningMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupSpinningMachineByNo(machineNo)
    return { success: true, data: data ? serializeData(data) : null }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSpinningCountsAction() {
  try {
    const data = await queries.getSpinningCounts()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSupervisorsAction() {
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getMaisitriesAction() {
  try {
    const data = await queries.getMaisitries()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MACHINE MANAGEMENT ACTIONS
// ============================================

export async function addSpinningMachineAction(machineData) {
  try {
    const data = await queries.addSpinningMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeSpinningMachineAction(id) {
  try {
    const data = await queries.removeSpinningMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeSpinningMachineSetupsAction(setupIds) {
  try {
    const data = await queries.removeSpinningMachineSetups(setupIds)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applySpinningOptionCheckAction(payload) {
  try {
    const data = await queries.applySpinningOptionCheck(payload)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// COPY PREVIOUS DATA ACTIONS
// ============================================

export async function getSpinningAvailableDatesAction(beforeDate, shift, limit = 30) {
  try {
    const data = await queries.getSpinningAvailablePreviousDates(beforeDate, shift, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function copySpinningFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copySpinningFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
