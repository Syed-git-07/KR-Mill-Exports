'use server'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/drawingFinisherQueries'

export async function getDrawingFinisherMachinesAction() {
  try {
    const data = await queries.getDrawingFinisherMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createDrawingFinisherMachineAction(machineData) {
  try {
    const data = await queries.createDrawingFinisherMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateDrawingFinisherMachineAction(id, machineData) {
  try {
    const data = await queries.updateDrawingFinisherMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteDrawingFinisherMachineAction(id) {
  try {
    const data = await queries.deleteDrawingFinisherMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchDrawingFinisherMachinesAction(field, condition, value) {
  try {
    const data = await queries.searchDrawingFinisherMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
