'use server'

import { safeActionError } from '@/lib/security/errors'

import * as autoconerQueries from '@/lib/queries/autoconerQueries'
import { serializeData } from '@/lib/serialize'

export async function getAutoconerMachinesAction() {
  try {
    const data = await autoconerQueries.getAutoconerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createAutoconerMachineAction(machineData) {
  try {
    const data = await autoconerQueries.createAutoconerMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateAutoconerMachineAction(id, machineData) {
  try {
    const data = await autoconerQueries.updateAutoconerMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteAutoconerMachineAction(id) {
  try {
    const data = await autoconerQueries.deleteAutoconerMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchAutoconerMachinesAction(field, condition, value) {
  try {
    const data = await autoconerQueries.searchAutoconerMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
