'use server'

import * as autoconerQueries from '@/lib/queries/autoconerQueries'
import { serializeData } from '@/lib/serialize'

export async function getAutoconerMachinesAction() {
  try {
    const data = await autoconerQueries.getAutoconerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createAutoconerMachineAction(machineData) {
  try {
    const data = await autoconerQueries.createAutoconerMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateAutoconerMachineAction(id, machineData) {
  try {
    const data = await autoconerQueries.updateAutoconerMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteAutoconerMachineAction(id) {
  try {
    const data = await autoconerQueries.deleteAutoconerMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchAutoconerMachinesAction(field, condition, value) {
  try {
    const data = await autoconerQueries.searchAutoconerMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
