'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/spinningEntryQueries'
import { resolveSpinningShiftFallbackTime } from '@/lib/spinningShiftFallback'
import { assertWorkingDate } from '@/lib/holidayValidation'
import { SPINNING_OPTION_CHECK_ERROR_CODE } from '@/lib/spinningOptionCheck'
import { hydratePayrollEmployeeNames } from '@/lib/payroll/employees'

// ============================================
// SHIFT CONFIG ACTIONS
// ============================================

export async function getSpinningShiftConfigAction(shift) {
  await requireUser()
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

export async function getSpinningProductionByDateShiftAction(date, shift) {
  await requireUser()
  try {
    const data = await queries.getSpinningProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getOrCreateSpinningHeaderAction(date, shift, supervisorId, maisitryId) {
  await requireUser()
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateSpinningHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningProductionHeaderAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateSpinningProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getSpinningProductionDetailsAction(headerId) {
  await requireUser()
  try {
    const rows = await queries.getSpinningProductionDetails(headerId)
    const data = await hydratePayrollEmployeeNames(rows, [
      { nameField: 'sider1_name', idField: 'sider1_payroll_employee_id' },
      { nameField: 'sider2_name', idField: 'sider2_payroll_employee_id' }
    ])
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function syncNewMachinesToSpinningHeaderAction(headerId, shift = 1) {
  await requireUser()
  try {
    const data = await queries.syncNewMachinesToSpinningHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningProductionDetailAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateSpinningProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function batchUpdateSpinningProductionDetailsAction(updates) {
  await requireUser()
  try {
    const data = await queries.batchUpdateSpinningProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// Calculate production values
export async function calculateSpinningProductionAction(params) {
  await requireUser()
  try {
    const result = queries.calculateSpinningProduction(params)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// STOPPAGE ACTIONS
// ============================================

export async function getSpinningStoppageEntriesAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getSpinningStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningStoppageEntryAction(stoppageId, updates) {
  await requireUser()
  try {
    const data = await queries.updateSpinningStoppageEntry(stoppageId, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applySpinningFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  await requireUser()
  try {
    const data = await queries.applyFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applySpinningPartialStoppageAction(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  await requireUser()
  try {
    const data = await queries.applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSpinningStoppageReasonsAction() {
  await requireUser()
  try {
    const data = await queries.getSpinningStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchSpinningStoppageReasonsAction(searchTerm = '', limit = 20) {
  await requireUser()
  try {
    const data = await queries.searchSpinningStoppageReasons(searchTerm, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getSpinningMachineSetupsAction(shift = 1, entryDate) {
  await requireUser()
  try {
    const data = await queries.getSpinningMachineSetups(entryDate, shift)
    // Each count run owns its saved portion of the shift. Unsplit rows are
    // initialized with the full shift time by the query layer.
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningMachineSetupAction(id, updates, shift = null) {
  await requireUser()
  try {
    const data = await queries.updateSpinningMachineSetup(id, updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function batchUpdateSpinningMachineSetupsAction(updates, shift = null) {
  await requireUser()
  try {
    const data = await queries.batchUpdateSpinningMachineSetups(updates, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

export async function getSpinningMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getSpinningMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getAllSpinningMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getAllSpinningMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupSpinningMachineByNoAction(machineNo, entryDate = null) {
  await requireUser()
  try {
    const data = await queries.lookupSpinningMachineByNo(machineNo, entryDate)
    return { success: true, data: data ? serializeData(data) : null }
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

export async function getSupervisorsAction() {
  await requireUser()
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getMaisitriesAction() {
  await requireUser()
  try {
    const data = await queries.getMaisitries()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MACHINE MANAGEMENT ACTIONS
// ============================================

export async function addSpinningMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.addSpinningEntryMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeSpinningMachineAction(id, headerId) {
  await requireUser()
  try {
    const data = await queries.removeSpinningMachine(id, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applySpinningOptionCheckAction(payload) {
  await requireUser()
  try {
    const data = await queries.applySpinningOptionCheck(payload)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return {
      success: false,
      error: error?.code === SPINNING_OPTION_CHECK_ERROR_CODE
        ? error.message
        : safeActionError(error)
    }
  }
}

export async function getSpinningOptionCheckSourceAction(payload) {
  await requireUser()
  try {
    const data = await queries.getSpinningOptionCheckSource(payload)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return {
      success: false,
      error: error?.code === SPINNING_OPTION_CHECK_ERROR_CODE
        ? error.message
        : safeActionError(error)
    }
  }
}

// ============================================
// COPY PREVIOUS DATA ACTIONS
// ============================================

export async function getSpinningAvailableDatesAction(beforeDate, shift, limit = 30) {
  await requireUser()
  try {
    const data = await queries.getSpinningAvailablePreviousDates(beforeDate, shift, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function copySpinningFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  await requireUser()
  try {
    const data = await queries.copySpinningFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSpinningEntryTabDataAction(tab, context = {}) {
  await requireUser()
  try {
    const { shift = 1, entryDate, headerId } = context

    if (tab === 'setup') {
      const [setupsResult, countsResult, machinesResult] = await Promise.all([
        getSpinningMachineSetupsAction(shift, entryDate),
        getSpinningCountsAction(),
        getAllSpinningMachinesAction()
      ])
      return { success: true, data: { setupsResult, countsResult, machinesResult } }
    }

    if (tab === 'production') {
      const syncResult = await syncNewMachinesToSpinningHeaderAction(headerId, shift)
      const detailsResult = await getSpinningProductionDetailsAction(headerId)
      return { success: true, data: { syncResult, detailsResult } }
    }

    if (tab === 'stoppage') {
      const [stoppageResult, reasonsResult, machinesResult] = await Promise.all([
        getSpinningStoppageEntriesAction(headerId),
        getSpinningStoppageReasonsAction(),
        getSpinningMachinesAction()
      ])
      return { success: true, data: { stoppageResult, reasonsResult, machinesResult } }
    }

    throw new Error('Invalid Spinning entry tab')
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function runSpinningEntryBatchAction(operation, items = [], context = {}) {
  await requireUser()
  try {
    const handlers = {
      'stoppage-update': item => updateSpinningStoppageEntryAction(item.id, item.updates),
      'machine-remove': item => removeSpinningMachineAction(item.id, context.headerId)
    }
    const handler = handlers[operation]
    if (!handler) throw new Error('Invalid Spinning batch operation')
    const results = await Promise.all(items.map(handler))
    return { success: true, data: results }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
