'use server'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/spinningMachineQueries'

export async function getSpinningMachinesAction() {
  try {
    const data = await queries.getSpinningMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createSpinningMachineAction(machineData) {
  try {
    const data = await queries.createSpinningMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSpinningMachineAction(id, machineData) {
  try {
    const data = await queries.updateSpinningMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteSpinningMachineAction(id) {
  try {
    const data = await queries.deleteSpinningMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function activateSpinningMachineAction(id) {
  try {
    const data = await queries.activateSpinningMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchSpinningMachinesAction(field, condition, value) {
  try {
    const data = await queries.searchSpinningMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getSpinningMachineWithSetupAction(id) {
  try {
    const data = await queries.getSpinningMachineWithSetup(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
