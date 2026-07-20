'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/drawingBreakerQueries'

export async function getDrawingBreakerMachinesAction() {
  try {
    const data = await queries.getDrawingBreakerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createDrawingBreakerMachineAction(machineData) {
  try {
    const data = await queries.createDrawingBreakerMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateDrawingBreakerMachineAction(id, machineData) {
  try {
    const data = await queries.updateDrawingBreakerMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteDrawingBreakerMachineAction(id) {
  try {
    const data = await queries.deleteDrawingBreakerMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchDrawingBreakerMachinesAction(field, condition, value) {
  try {
    const data = await queries.searchDrawingBreakerMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getDrawingBreakerCountOptionsAction() {
  try {
    const data = await queries.getDrawingBreakerCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function lookupDrawingBreakerMachineByNoAction(machineNo) {
  try {
    const data = await queries.lookupDrawingBreakerMachineByNo(machineNo)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
