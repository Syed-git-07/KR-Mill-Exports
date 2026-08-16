'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/finisherDrawingEntryQueries'
import { resolveFinisherDrawingShiftFallbackTime } from '@/lib/finisherDrawingShiftFallback'
import { assertWorkingDate } from '@/lib/holidayValidation'

// ============================================
// SHIFT CONFIGURATION ACTIONS
// ============================================

export async function getFinisherDrawingShiftConfigAction(shift) {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingShiftConfig(shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION HEADER ACTIONS
// ============================================

export async function getFinisherDrawingProductionByDateShiftAction(date, shift) {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingProductionByDateShift(date, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getOrCreateFinisherDrawingHeaderAction(date, shift, supervisorId, maisitryId) {
  await requireUser()
  try {
    await assertWorkingDate(date)
    const data = await queries.getOrCreateFinisherDrawingHeader(date, shift, supervisorId, maisitryId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateFinisherDrawingHeaderAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateFinisherDrawingHeader(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// PRODUCTION DETAIL ACTIONS
// ============================================

export async function getFinisherDrawingProductionDetailsAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingProductionDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getFinisherDrawingProductionWithSetupAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingProductionWithSetup(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function initializeFinisherDrawingDetailsAction(headerId) {
  await requireUser()
  try {
    const data = await queries.initializeFinisherDrawingDetails(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function syncFinisherDrawingNewMachinesToHeaderAction(headerId) {
  await requireUser()
  try {
    const data = await queries.syncFinisherDrawingNewMachinesToHeader(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateFinisherDrawingDetailAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateFinisherDrawingDetail(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkUpdateFinisherDrawingDetailsAction(updates) {
  await requireUser()
  try {
    const data = await queries.bulkUpdateFinisherDrawingDetails(updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

// ============================================
// STOPPAGE ENTRY ACTIONS
// ============================================

export async function getFinisherDrawingStoppageEntriesAction(headerId) {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingStoppageEntries(headerId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateFinisherDrawingStoppageEntryAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateFinisherDrawingStoppageEntry(id, updates)
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

export async function applyFinisherDrawingFullStoppageAction(headerId, stoppageData) {
  await requireUser()
  try {
    const { stoppageId, stoppageTime, slot } = stoppageData
    const result = await queries.applyFinisherDrawingFullStoppage(headerId, stoppageId, stoppageTime, slot)
    return { success: result.success, data: serializeData(result.data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getFinisherDrawingStoppageReasonsAction() {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingStoppageReasons()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function applyFinisherDrawingPartialStoppageAction(headerId, fromMachine, toMachine, stoppageId, stoppageTime) {
  await requireUser()
  try {
    const result = await queries.applyFinisherDrawingPartialStoppage(headerId, fromMachine, toMachine, stoppageId, stoppageTime)
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
// MACHINE SETUP ACTIONS
// ============================================

export async function getFinisherDrawingMachineSetupsAction(shift = 1, headerId = null) {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingMachineSetups(headerId)
    const shiftConfig = await queries.getFinisherDrawingShiftConfig(shift)
    const shiftTime = shiftConfig?.shiftTime || resolveFinisherDrawingShiftFallbackTime(shift)

    const modifiedData = (data || []).map(setup => ({
      ...setup,
      shift_time: shiftTime
    }))

    return { success: true, data: serializeData(modifiedData) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateFinisherDrawingMachineSetupAction(machineId, updates) {
  await requireUser()
  try {
    const data = await queries.updateFinisherDrawingMachineSetup(machineId, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getFinisherDrawingMixingOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingMixingOptions()
    return { success: true, data: data }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getFinisherDrawingMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function addFinisherDrawingMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.addFinisherDrawingEntryMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function removeFinisherDrawingMachineAction(machineId, headerId) {
  await requireUser()
  try {
    const data = await queries.removeFinisherDrawingMachine(machineId, headerId)
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

export async function copyFinisherDrawingFromPreviousDateAction(targetDate, targetShift, targetHeaderId, sourceDate) {
  await requireUser()
  try {
    const data = await queries.copyFinisherDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getFinisherDrawingAvailableDatesAction(currentDate, shift) {
  await requireUser()
  try {
    const data = await queries.getFinisherDrawingAvailableDates(currentDate, shift)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSpinningCountOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getSpinningCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupFinisherDrawingMachineByNoAction(machineNo, entryDate = null) {
  await requireUser()
  try {
    const data = await queries.lookupFinisherDrawingMachineByNo(machineNo, entryDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getFinisherDrawingEntryTabDataAction(tab, context = {}) {
  await requireUser()
  try {
    const { shift = 1, headerId } = context

    if (tab === 'setup') {
      const [setupsResult, mixingsResult, countsResult] = await Promise.all([
        getFinisherDrawingMachineSetupsAction(shift, headerId),
        getFinisherDrawingMixingOptionsAction(),
        getSpinningCountOptionsAction()
      ])
      return { success: true, data: { setupsResult, mixingsResult, countsResult } }
    }

    if (tab === 'production') {
      const syncResult = await syncFinisherDrawingNewMachinesToHeaderAction(headerId)
      const [detailsResult, setupsResult] = await Promise.all([
        getFinisherDrawingProductionWithSetupAction(headerId),
        getFinisherDrawingMachineSetupsAction(shift, headerId)
      ])
      return { success: true, data: { syncResult, detailsResult, setupsResult } }
    }

    if (tab === 'stoppage') {
      const syncResult = await syncFinisherDrawingNewMachinesToHeaderAction(headerId)
      const [stoppagesResult, reasonsResult, machinesResult, setupsResult] = await Promise.all([
        getFinisherDrawingStoppageEntriesAction(headerId),
        getFinisherDrawingStoppageReasonsAction(),
        getFinisherDrawingMachinesAction(),
        getFinisherDrawingMachineSetupsAction(shift, headerId)
      ])
      return { success: true, data: { syncResult, stoppagesResult, reasonsResult, machinesResult, setupsResult } }
    }

    throw new Error('Invalid Finisher Drawing entry tab')
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function runFinisherDrawingEntryBatchAction(operation, items = [], context = {}) {
  await requireUser()
  try {
    const handlers = {
      'setup-update': item => updateFinisherDrawingMachineSetupAction(item.id, item.updates),
      'production-update': item => updateFinisherDrawingDetailAction(item.id, item.updates),
      'stoppage-update': item => updateFinisherDrawingStoppageEntryAction(item.id, item.updates),
      'machine-remove': item => removeFinisherDrawingMachineAction(item.id, context.headerId)
    }
    const handler = handlers[operation]
    if (!handler) throw new Error('Invalid Finisher Drawing batch operation')
    const results = await Promise.all(items.map(handler))
    return { success: true, data: results }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
