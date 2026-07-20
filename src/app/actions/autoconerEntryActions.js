'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/autoconerEntryQueries'
import { resolveAutoconerShiftFallbackTime } from '@/lib/autoconerShiftFallback'

// ============================================
// SHIFT CONFIG ACTIONS
// ============================================

export async function getAutoconerShiftConfigAction(shift) {
  try {
    const config = await queries.getAutoconerShiftConfiguration(shift)
    return { 
      success: true, 
      data: {
        shiftTime: config.totalTime,
        defaultStoppage: config.defaultStoppage,
        workTime: config.workTime
      }
    }
  } catch (error) {
    const fallbackShiftTime = resolveAutoconerShiftFallbackTime(shift)
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

export async function getAutoconerProductionByDateShiftAction(date, shift) {
  try {
    console.log(`[HEADER] Getting header for date: ${date}, shift: ${shift}`)
    const data = await queries.getAutoconerProductionByDateShift(date, shift)
    console.log(`[HEADER] Found header: ${data?.id || 'null'}`)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    console.error(`[HEADER] Error:`, error)
    return { success: false, error: error.message }
  }
}

export async function getOrCreateAutoconerHeaderAction(date, shift, supervisorId) {
  try {
    const data = await queries.getOrCreateAutoconerHeader(date, shift, supervisorId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateAutoconerProductionHeaderAction(id, updates) {
  try {
    const data = await queries.updateAutoconerProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getAutoconerProductionDetailsAction(headerId) {
  try {
    const data = await queries.getAutoconerProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Sync new machines to existing header (creates details for machines added after header was created)
// Also initializes details if header exists but has no details (fixes Shift 3 issue)
export async function syncNewMachinesToAutoconerHeaderAction(headerId, shift = 1) {
  try {
    console.log(`[SYNC] Syncing machines for headerId: ${headerId}, shift: ${shift}`)
    const data = await queries.syncNewMachinesToAutoconerHeader(headerId, shift)
    console.log(`[SYNC] Result:`, data)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    console.error(`[SYNC] Error:`, error)
    return { success: false, error: error.message }
  }
}

export async function updateAutoconerProductionDetailAction(id, updates) {
  try {
    const data = await queries.updateAutoconerProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function batchUpdateAutoconerProductionDetailsAction(updates) {
  try {
    const data = await queries.batchUpdateAutoconerProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// STOPPAGE ACTIONS
// ============================================

export async function getAutoconerStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getAutoconerStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateAutoconerStoppageEntryAction(id, updates) {
  try {
    const data = await queries.updateAutoconerStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applyAutoconerFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  try {
    const data = await queries.applyFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applyAutoconerPartialStoppageAction(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const data = await queries.applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime)
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

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getAutoconerMachineSetupsAction(shift = 1, entryDate) {
  try {
    if (!entryDate) {
      throw new Error('entryDate is required for getAutoconerMachineSetupsAction')
    }
    const data = await queries.getAutoconerMachineSetups(entryDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateAutoconerMachineSetupAction(id, updates, shift = null) {
  try {
    const data = await queries.updateAutoconerMachineSetup(id, updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function upsertAutoconerMachineSetupAction(machineId, entryDate, shift, updates) {
  try {
    const data = await queries.upsertAutoconerMachineSetup(machineId, entryDate, shift, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function batchUpdateAutoconerMachineSetupsAction(updates, shift = null) {
  try {
    const data = await queries.batchUpdateAutoconerMachineSetups(updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MASTER DATA ACTIONS
// ============================================

export async function getSupervisorsAction() {
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getAutoconerMachinesAction() {
  try {
    const data = await queries.getAutoconerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function lookupAutoconerMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupAutoconerMachineByNo(machineNo)
    return { success: true, data: data ? serializeData(data) : null }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getAutoconerGroupsAction() {
  try {
    const data = await queries.getAutoconerGroups()
    return { success: true, data: serializeData(data) }
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

export async function addAutoconerMachineAction(machineData) {
  try {
    const data = await queries.addAutoconerMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeAutoconerMachineAction(id, entryDate) {
  try {
    const data = await queries.removeAutoconerMachine(id, entryDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeAutoconerMachineSetupsAction(setupIds) {
  try {
    const data = await queries.removeAutoconerMachineSetups(setupIds)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getIdleReasonsAction() {
  return { success: true, data: queries.getIdleReasons() }
}

// ============================================
// COPY PREVIOUS DATA ACTIONS
// ============================================

export async function getAutoconerAvailableDatesAction(beforeDate, shift, limit = 30) {
  try {
    const data = await queries.getAutoconerAvailablePreviousDates(beforeDate, shift, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function copyAutoconerFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copyAutoconerFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
