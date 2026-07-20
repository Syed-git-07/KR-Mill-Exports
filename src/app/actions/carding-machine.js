'use server'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/cardingMachineQueries'

export async function getCardingMachinesAction() {
  try {
    const data = await queries.getCardingMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createCardingMachineAction(machineData) {
  try {
    const data = await queries.createCardingMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateCardingMachineAction(id, machineData) {
  try {
    const data = await queries.updateCardingMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteCardingMachineAction(id) {
  try {
    const data = await queries.deleteCardingMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchCardingMachinesAction(field, condition, value) {
  try {
    const data = await queries.searchCardingMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getCardingCountOptionsAction() {
  try {
    const data = await queries.getCardingCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
