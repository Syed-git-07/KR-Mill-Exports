'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/simplexEntryQueries'
import { resolveSimplexShiftFallbackTime } from '@/lib/simplexFormulaFallback'
import { assertWorkingDate } from '@/lib/holidayValidation'

// ============================================
// SHIFT CONFIG ACTIONS
// ============================================

export async function getSimplexShiftConfigAction(shift) {
  try {
    const config = await queries.getSimplexShiftConfiguration(shift)
    return { 
      success: true, 
      data: {
        shiftTime: config.totalTime,
        defaultStoppage: config.defaultStoppage,
        workTime: config.workTime
      }
    }
  } catch (error) {
    const fallbackShiftTime = resolveSimplexShiftFallbackTime(shift)
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
// PRODUCTION HEADER ACTIONS
// ============================================

export async function getSimplexProductionHeadersAction() {
  try {
    const data = await queries.getSimplexProductionHeaders()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSimplexProductionByDateShiftAction(date, shift) {
  try {
    const data = await queries.getSimplexProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getOrCreateSimplexProductionHeaderAction(date, shift, supervisorId, maisitryId) {
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateSimplexProductionHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSimplexProductionHeaderAction(id, updates) {
  try {
    const data = await queries.updateSimplexProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getSimplexProductionDetailsAction(headerId) {
  try {
    const data = await queries.getSimplexProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSimplexProductionWithSetupAction(headerId) {
  try {
    const data = await queries.getSimplexProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function initializeSimplexProductionDetailsAction(headerId) {
  try {
    const data = await queries.initializeSimplexProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function addMissingSimplexProductionDetailsAction(headerId) {
  try {
    const data = await queries.addMissingSimplexProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSimplexProductionDetailAction(id, updates) {
  try {
    const data = await queries.updateSimplexProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkUpdateSimplexProductionDetailsAction(updates) {
  try {
    const data = await queries.bulkUpdateSimplexProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getSimplexStoppageEntriesAction(headerId) {
  try {
    const data = await queries.getSimplexStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSimplexStoppageEntryAction(id, updates) {
  try {
    const data = await queries.updateSimplexStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applySimplexFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  try {
    const data = await queries.applySimplexFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function applySimplexPartialStoppageAction(headerId, fromMachine, toMachine, stoppageId, stoppageTime) {
  try {
    const data = await queries.applySimplexPartialStoppage(headerId, fromMachine, toMachine, stoppageId, stoppageTime)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSimplexStoppageReasonsAction() {
  try {
    const data = await queries.getSimplexStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getSimplexMachineSetupsAction(headerId = null) {
  try {
    const data = await queries.getSimplexMachineSetups(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSimplexMachineSetupByMachineIdAction(machineId) {
  try {
    const data = await queries.getSimplexMachineSetupByMachineId(machineId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSimplexMachineSetupAction(id, updates) {
  try {
    const data = await queries.updateSimplexMachineSetup(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function upsertSimplexMachineSetupAction(machineId, setupData) {
  try {
    const data = await queries.upsertSimplexMachineSetup(machineId, setupData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// MACHINE ACTIONS
// ============================================

export async function getSimplexMachinesAction() {
  try {
    const data = await queries.getSimplexMachines()
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

export async function getStoppageDetailsAction() {
  try {
    const data = await queries.getStoppageDetails()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSimplexEmployeesAction() {
  try {
    const data = await queries.getSimplexEmployees()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchSimplexEmployeesAction(searchTerm) {
  try {
    const data = await queries.searchSimplexEmployees(searchTerm)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// CALCULATION HELPERS (exposed as actions)
// ============================================

export async function parseRunHoursToMinutesAction(runHrs) {
  return { success: true, data: queries.parseRunHoursToMinutes(runHrs) }
}

export async function minutesToRunHoursAction(minutes) {
  return { success: true, data: queries.minutesToRunHours(minutes) }
}

// ============================================
// MACHINE MANAGEMENT ACTIONS
// ============================================

export async function bulkUpdateSimplexMachineCountAction(machineIds, countValue, headerId = null) {
  try {
    const data = await queries.bulkUpdateSimplexMachineCount(machineIds, countValue, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSimplexCountOptionsAction() {
  try {
    const data = await queries.getSimplexCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function addSimplexMachineAction(machineData) {
  try {
    const data = await queries.addSimplexMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function lookupSimplexMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupSimplexMachineByNo(machineNo)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function removeSimplexMachineAction(machineId) {
  try {
    const data = await queries.removeSimplexMachine(machineId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// COPY PREVIOUS DATA ACTIONS
// ============================================

export async function getSimplexAvailableDatesAction(beforeDate, shift, limit = 30) {
  try {
    const data = await queries.getSimplexAvailableDates(beforeDate, shift, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function copySimplexFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  try {
    const data = await queries.copySimplexFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function copySimplexFromYesterdayAction(targetDate, targetShift, targetHeaderId) {
  try {
    const data = await queries.copySimplexFromYesterday(targetDate, targetShift, targetHeaderId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
