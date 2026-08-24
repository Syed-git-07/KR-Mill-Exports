'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/comberEntryQueries'
import { lookupComberMachineByNo } from '@/lib/queries/comberMachineQueries'
import { resolveComberShiftFallbackTime } from '@/lib/comberShiftFallback'
import { assertWorkingDate } from '@/lib/holidayValidation'
import { hydratePayrollEmployeeNames } from '@/lib/payroll/employees'

const hydrateEmployeeNames = rows => hydratePayrollEmployeeNames(rows, [
  { nameField: 'employee_name', idField: 'payroll_employee_id' }
])

// ============================================
// SHIFT CONFIGURATION ACTIONS
// ============================================

export async function getComberShiftConfigAction(shift) {
  await requireUser()
  try {
    const data = await queries.getComberShiftConfig(shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getComberShiftTimeAction(shift) {
  await requireUser()
  try {
    const shiftTime = await queries.getComberShiftTime(shift)
    return { success: true, data: shiftTime }
  } catch (error) {
    return {
      success: false,
      error: safeActionError(error),
      data: resolveComberShiftFallbackTime(shift)
    }
  }
}

export async function getComberShiftConfigurationAction(shift) {
  await requireUser()
  try {
    const config = await queries.getComberShiftConfiguration(shift)
    return { success: true, data: config }
  } catch (error) {
    return {
      success: false,
      error: safeActionError(error),
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
  await requireUser()
  try {
    const data = await queries.getComberProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getOrCreateComberProductionHeaderAction(date, shift, supervisorId, maisitryId) {
  await requireUser()
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateComberProductionHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateComberProductionHeaderAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateComberProductionHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getComberProductionDetailsAction(headerId) {
  await requireUser()
  try {
    const data = await hydrateEmployeeNames(await queries.getComberProductionWithSetup(headerId))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function initializeComberProductionDetailsAction(headerId, shift = 1) {
  await requireUser()
  try {
    // Get shift configuration for totalTime
    const shiftConfig = await queries.getComberShiftConfiguration(shift)
    const data = await queries.initializeComberProductionDetails(
      headerId, 
      shiftConfig.totalTime
    )
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateComberProductionDetailAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateComberProductionDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkUpdateComberProductionDetailsAction(updates) {
  await requireUser()
  try {
    const data = await queries.bulkUpdateComberProductionDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getComberStoppageEntriesAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getComberStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateComberStoppageEntryAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateComberStoppageEntry(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getComberStoppageReasonsAction() {
  await requireUser()
  try {
    const data = await queries.getComberStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function syncNewMachinesToComberHeaderAction(headerId, shift = 1) {
  await requireUser()
  try {
    const data = await queries.syncNewMachinesToComberHeader(headerId, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// MACHINE SETUP ACTIONS
// ============================================

export async function getComberMachineSetupsAction(headerId = null) {
  await requireUser()
  try {
    const data = await queries.getComberMachineSetups(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateComberMachineSetupAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateComberMachineSetup(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function addComberMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.addComberEntryMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeComberMachineAction(machineId, headerId) {
  await requireUser()
  try {
    const data = await queries.removeComberMachine(machineId, headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateComberMachineCountAction(machineId, newCount) {
  await requireUser()
  try {
    const data = await queries.updateComberMachineCount(machineId, newCount)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getComberCountOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getComberCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getComberMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getComberMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupComberMachineByNoAction(machineNo, entryDate = null) {
  await requireUser()
  try {
    const data = await lookupComberMachineByNo(machineNo, entryDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getComberProductionWithSetupAction(headerId) {
  await requireUser()
  try {
    const data = await hydrateEmployeeNames(await queries.getComberProductionWithSetup(headerId))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applyComberFullStoppageAction(headerId, stoppageId, stoppageTime, slot = 1) {
  await requireUser()
  try {
    const result = await queries.applyComberFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: result.success, data: serializeData(result.data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applyComberPartialStoppageAction(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  await requireUser()
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
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// SUPERVISOR ACTIONS
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


export async function getComberEntryTabDataAction(tab, context = {}) {
  await requireUser()
  try {
    const { headerId, shift = 1 } = context

    if (tab === 'setup') {
      const [setupsResult, countsResult, shiftConfigResult] = await Promise.all([
        getComberMachineSetupsAction(headerId),
        getComberCountOptionsAction(),
        getComberShiftConfigurationAction(shift)
      ])
      return { success: true, data: { setupsResult, countsResult, shiftConfigResult } }
    }

    if (tab === 'production') {
      const syncResult = await syncNewMachinesToComberHeaderAction(headerId)
      const [detailsResult, setupsResult] = await Promise.all([
        getComberProductionWithSetupAction(headerId),
        getComberMachineSetupsAction(headerId)
      ])
      return { success: true, data: { syncResult, detailsResult, setupsResult } }
    }

    if (tab === 'stoppage') {
      const syncResult = await syncNewMachinesToComberHeaderAction(headerId)
      const [stoppagesResult, reasonsResult, machineListResult, setupsResult] = await Promise.all([
        getComberStoppageEntriesAction(headerId),
        getComberStoppageReasonsAction(),
        getComberMachinesAction(),
        getComberMachineSetupsAction(headerId)
      ])
      return { success: true, data: { syncResult, stoppagesResult, reasonsResult, machineListResult, setupsResult } }
    }

    throw new Error('Invalid Comber entry tab')
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function runComberEntryBatchAction(operation, items = [], context = {}) {
  await requireUser()
  try {
    const handlers = {
      'setup-update': item => updateComberMachineSetupAction(item.id, item.updates),
      'production-update': item => updateComberProductionDetailAction(item.id, item.updates),
      'stoppage-update': item => updateComberStoppageEntryAction(item.id, item.updates),
      'machine-remove': item => removeComberMachineAction(item.id, context.headerId)
    }
    const handler = handlers[operation]
    if (!handler) throw new Error('Invalid Comber batch operation')
    const results = await Promise.all(items.map(handler))
    return { success: true, data: results }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
