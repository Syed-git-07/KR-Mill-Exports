'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/autoconerEntryQueries'
import { resolveAutoconerShiftFallbackTime } from '@/lib/autoconerShiftFallback'
import { assertWorkingDate } from '@/lib/holidayValidation'
import { hydratePayrollEmployeeNames } from '@/lib/payroll/employees'

// ============================================
// SHIFT CONFIG ACTIONS
// ============================================

export async function getAutoconerShiftConfigAction(shift) {
  await requireUser()
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
// HEADER ACTIONS
// ============================================

export async function getAutoconerProductionByDateShiftAction(date, shift) {
  await requireUser()
  try {
    const data = await queries.getAutoconerProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    console.error(`[HEADER] Error:`, error)
    return { success: false, error: safeActionError(error) }
  }
}

export async function getOrCreateAutoconerHeaderAction(date, shift, supervisorId) {
  await requireUser()
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateAutoconerHeader(date, shift, supervisorId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateAutoconerProductionHeaderAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateAutoconerProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getAutoconerProductionDetailsAction(headerId) {
  await requireUser()
  try {
    const rows = await queries.getAutoconerProductionDetails(headerId)
    const data = await hydratePayrollEmployeeNames(rows, [
      { nameField: 'emp_name', idField: 'payroll_employee_id' }
    ])
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Sync new machines to existing header (creates details for machines added after header was created)
// Also initializes details if header exists but has no details (fixes Shift 3 issue)
export async function syncNewMachinesToAutoconerHeaderAction(headerId, shift = 1) {
  await requireUser()
  try {
    const data = await queries.syncNewMachinesToAutoconerHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    console.error(`[SYNC] Error:`, error)
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateAutoconerProductionDetailAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateAutoconerProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function batchUpdateAutoconerProductionDetailsAction(updates) {
  await requireUser()
  try {
    const data = await queries.batchUpdateAutoconerProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// STOPPAGE ACTIONS
// ============================================

export async function getAutoconerStoppageEntriesAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getAutoconerStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateAutoconerStoppageEntryAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateAutoconerStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applyAutoconerFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  await requireUser()
  try {
    const data = await queries.applyFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applyAutoconerPartialStoppageAction(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  await requireUser()
  try {
    const data = await queries.applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime)
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

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getAutoconerMachineSetupsAction(shift = 1, entryDate) {
  await requireUser()
  try {
    if (!entryDate) {
      throw new Error('entryDate is required for getAutoconerMachineSetupsAction')
    }
    const data = await queries.getAutoconerMachineSetups(entryDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateAutoconerMachineSetupAction(id, updates, shift = null) {
  await requireUser()
  try {
    const data = await queries.updateAutoconerMachineSetup(id, updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function batchUpdateAutoconerMachineSetupsAction(updates, shift = null) {
  await requireUser()
  try {
    const data = await queries.batchUpdateAutoconerMachineSetups(updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MASTER DATA ACTIONS
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

export async function getAutoconerMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getAutoconerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupAutoconerMachineByNoAction(machineNo, entryDate = null) {
  await requireUser()
  try {
    const data = await queries.lookupAutoconerMachineByNo(machineNo, entryDate)
    return { success: true, data: data ? serializeData(data) : null }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getAutoconerGroupsAction() {
  await requireUser()
  try {
    const data = await queries.getAutoconerGroups()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSpinningCountsAction() {
  await requireUser()
  try {
    const data = await queries.getSpinningCounts()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function addAutoconerMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.addAutoconerEntryMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeAutoconerMachineAction(id, headerId) {
  await requireUser()
  try {
    const data = await queries.removeAutoconerMachine(id, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getIdleReasonsAction() {
  await requireUser()
  return { success: true, data: queries.getIdleReasons() }
}


export async function getAutoconerEntryTabDataAction(tab, context = {}) {
  await requireUser()
  try {
    const { shift = 1, entryDate, headerId } = context

    if (tab === 'setup') {
      const [setupsResult, countsResult, machinesResult] = await Promise.all([
        getAutoconerMachineSetupsAction(shift, entryDate),
        getSpinningCountsAction(),
        getAutoconerMachinesAction()
      ])
      return { success: true, data: { setupsResult, countsResult, machinesResult } }
    }

    if (tab === 'production') {
      const syncResult = await syncNewMachinesToAutoconerHeaderAction(headerId, shift)
      const [detailsResult, idleReasonsResult] = await Promise.all([
        getAutoconerProductionDetailsAction(headerId),
        getIdleReasonsAction()
      ])
      return { success: true, data: { syncResult, detailsResult, idleReasonsResult } }
    }

    if (tab === 'stoppage') {
      const syncResult = await syncNewMachinesToAutoconerHeaderAction(headerId, shift)
      const [stoppagesResult, reasonsResult, machinesResult] = await Promise.all([
        getAutoconerStoppageEntriesAction(headerId),
        getStoppageDetailsAction(),
        getAutoconerMachinesAction()
      ])
      return { success: true, data: { syncResult, stoppagesResult, reasonsResult, machinesResult } }
    }

    throw new Error('Invalid Autoconer entry tab')
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function runAutoconerEntryBatchAction(operation, items = [], context = {}) {
  await requireUser()
  try {
    const handlers = {
      'stoppage-update': item => updateAutoconerStoppageEntryAction(item.id, item.updates),
      'machine-remove': item => removeAutoconerMachineAction(item.id, context.headerId)
    }
    const handler = handlers[operation]
    if (!handler) throw new Error('Invalid Autoconer batch operation')
    const results = await Promise.all(items.map(handler))
    return { success: true, data: results }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
