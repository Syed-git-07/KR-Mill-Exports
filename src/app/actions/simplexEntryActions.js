'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/simplexEntryQueries'
import { resolveSimplexShiftFallbackTime } from '@/lib/simplexFormulaFallback'
import { assertWorkingDate } from '@/lib/holidayValidation'

// ============================================
// SHIFT CONFIG ACTIONS
// ============================================

export async function getSimplexShiftConfigAction(shift) {
  await requireUser()
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
      error: safeActionError(error),
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
  await requireUser()
  try {
    const data = await queries.getSimplexProductionHeaders()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexProductionByDateShiftAction(date, shift) {
  await requireUser()
  try {
    const data = await queries.getSimplexProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getOrCreateSimplexProductionHeaderAction(date, shift, supervisorId, maisitryId) {
  await requireUser()
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateSimplexProductionHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSimplexProductionHeaderAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateSimplexProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getSimplexProductionDetailsAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getSimplexProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexProductionWithSetupAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getSimplexProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function initializeSimplexProductionDetailsAction(headerId) {
  await requireUser()
  try {
    const data = await queries.initializeSimplexProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function addMissingSimplexProductionDetailsAction(headerId) {
  await requireUser()
  try {
    const data = await queries.addMissingSimplexProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSimplexProductionDetailAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateSimplexProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkUpdateSimplexProductionDetailsAction(updates) {
  await requireUser()
  try {
    const data = await queries.bulkUpdateSimplexProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getSimplexStoppageEntriesAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getSimplexStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSimplexStoppageEntryAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateSimplexStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applySimplexFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  await requireUser()
  try {
    const data = await queries.applySimplexFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applySimplexPartialStoppageAction(headerId, fromMachine, toMachine, stoppageId, stoppageTime) {
  await requireUser()
  try {
    const data = await queries.applySimplexPartialStoppage(headerId, fromMachine, toMachine, stoppageId, stoppageTime)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexStoppageReasonsAction() {
  await requireUser()
  try {
    const data = await queries.getSimplexStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getSimplexMachineSetupsAction(headerId = null) {
  await requireUser()
  try {
    const data = await queries.getSimplexMachineSetups(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexMachineSetupByMachineIdAction(machineId) {
  await requireUser()
  try {
    const data = await queries.getSimplexMachineSetupByMachineId(machineId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSimplexMachineSetupAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateSimplexMachineSetup(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function upsertSimplexMachineSetupAction(machineId, setupData) {
  await requireUser()
  try {
    const data = await queries.upsertSimplexMachineSetup(machineId, setupData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MACHINE ACTIONS
// ============================================

export async function getSimplexMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getSimplexMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

export async function getSupervisorsAction() {
  await requireUser()
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getStoppageDetailsAction() {
  await requireUser()
  try {
    const data = await queries.getStoppageDetails()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexEmployeesAction() {
  await requireUser()
  try {
    const data = await queries.getSimplexEmployees()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchSimplexEmployeesAction(searchTerm) {
  await requireUser()
  try {
    const data = await queries.searchSimplexEmployees(searchTerm)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// CALCULATION HELPERS (exposed as actions)
// ============================================

export async function parseRunHoursToMinutesAction(runHrs) {
  await requireUser()
  return { success: true, data: queries.parseRunHoursToMinutes(runHrs) }
}

export async function minutesToRunHoursAction(minutes) {
  await requireUser()
  return { success: true, data: queries.minutesToRunHours(minutes) }
}

// ============================================
// MACHINE MANAGEMENT ACTIONS
// ============================================

export async function getSimplexCountOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getSimplexCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function addSimplexMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.addSimplexEntryMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupSimplexMachineByNoAction(machineNo, entryDate = null) {
  await requireUser()
  try {
    const data = await queries.lookupSimplexMachineByNo(machineNo, entryDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeSimplexMachineAction(machineId, headerId) {
  await requireUser()
  try {
    const data = await queries.removeSimplexMachine(machineId, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// COPY PREVIOUS DATA ACTIONS
// ============================================

export async function getSimplexAvailableDatesAction(beforeDate, shift, limit = 30) {
  await requireUser()
  try {
    const data = await queries.getSimplexAvailableDates(beforeDate, shift, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function copySimplexFromPreviousDateAction(...args) {
  await requireUser()
  void args
  return { success: false, error: 'Simplex speed is fixed and cannot be copied.' }
}

export async function copySimplexFromYesterdayAction(targetDate, targetShift, targetHeaderId) {
  await requireUser()
  try {
    const data = await queries.copySimplexFromYesterday(targetDate, targetShift, targetHeaderId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
