'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/cardingEntryQueries'

// ============================================
// SHIFT CONFIGURATION ACTIONS
// ============================================

export async function getCardingShiftConfigAction(shift) {
  try {
    const shiftTime = await queries.getCardingShiftTime(shift)
    const defaultStoppage = await queries.getCardingDefaultStoppage(shift)
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

export async function getCardingProductionByDateShiftAction(date, shift) {
  try {
    const data = await queries.getCardingProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getOrCreateProductionHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    const data = await queries.getOrCreateProductionHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateProductionHeaderAction(id, updates) {
  try {
    const data = await queries.updateProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getCardingProductionDetailsAction(headerId) {
  try {
    const data = await queries.getCardingProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getCardingProductionWithSetupAction(headerId) {
  try {
    const data = await queries.getCardingProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function initializeProductionDetailsAction(headerId, shift = 1) {
  try {
    const data = await queries.initializeProductionDetails(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function syncNewMachinesToHeaderAction(headerId, shift = 1) {
  try {
    const data = await queries.syncNewMachinesToHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateProductionDetailAction(id, updates) {
  try {
    const data = await queries.updateProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateProductionDetailsAction(updates) {
  try {
    const data = await queries.bulkUpdateProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getCardingStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getCardingStoppageEntries(headerId)
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

export async function applyFullStoppageAction(headerId, stoppageId, stoppageTime, slot) {
  try {
    const data = await queries.applyFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applyPartialStoppageAction(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const data = await queries.applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getCardingMachineSetupsAction(entryDate, shift = 1) {
  try {
    const data = await queries.getCardingMachineSetups(entryDate, shift)
    // Get shift-based time values (await async function)
    const shiftTime = await queries.getCardingShiftTime(shift)
    
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

export async function updateMachineSetupAction(machineId, updates, entryDate = null, shift = null) {
  try {
    const data = await queries.updateMachineSetup(machineId, updates, entryDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function upsertMachineSetupAction(machineId, setupData, entryDate = null, shift = null) {
  try {
    const data = await queries.upsertMachineSetup(machineId, setupData, entryDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

export async function getStoppageDetailsAction() {
  try {
    const data = await queries.getStoppageDetails()
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

// ============================================
// COPY PREVIOUS DATA ACTIONS
// ============================================

export async function getCardingAvailablePreviousDatesAction(beforeDate, shift, limit = 30) {
  try {
    const data = await queries.getCardingAvailablePreviousDates(beforeDate, shift, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function copyCardingFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copyCardingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// CARDING MACHINE ACTIONS
// ============================================

export async function getCardingMachinesAction() {
  try {
    const data = await queries.getCardingMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getCardingStoppageReasonsAction() {
  try {
    const data = await queries.getCardingStoppageReasons()
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

export async function addCardingMachineAction(machineData) {
  try {
    const data = await queries.addCardingMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function lookupCardingMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupCardingMachineByNo(machineNo)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeCardingMachineAction(machineId) {
  try {
    const data = await queries.removeCardingMachine(machineId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateMachineCountAction(machineId, countMixing) {
  try {
    const data = await queries.updateMachineCount(machineId, countMixing)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateMachineCountAction(machineIds, countMixing, hank_constant) {
  try {
    const data = await queries.bulkUpdateMachineCount(machineIds, countMixing, hank_constant ?? null)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
