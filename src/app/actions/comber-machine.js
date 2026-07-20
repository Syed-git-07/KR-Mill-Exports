'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/comberMachineQueries'

export async function getComberMachinesAction() {
  try {
    const data = await queries.getComberMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createComberMachineAction(machineData) {
  try {
    const data = await queries.createComberMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateComberMachineAction(id, machineData) {
  try {
    const data = await queries.updateComberMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteComberMachineAction(id) {
  try {
    const data = await queries.deleteComberMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchComberMachinesAction(field, condition, value) {
  try {
    const data = await queries.searchComberMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function lookupComberMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupComberMachineByNo(machineNo)
    return { success: true, data: data ? serializeData(data) : null }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getComberCountOptionsAction() {
  try {
    const data = await queries.getComberCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
