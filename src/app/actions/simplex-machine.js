'use server'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/simplexMachineQueries'

export async function getSimplexMachinesAction() {
  try {
    const data = await queries.getSimplexMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createSimplexMachineAction(machineData) {
  try {
    const data = await queries.createSimplexMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSimplexMachineAction(id, machineData) {
  try {
    const data = await queries.updateSimplexMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSimplexMachineAction(id) {
  try {
    const data = await queries.deleteSimplexMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchSimplexMachinesAction(field, condition, value) {
  try {
    const data = await queries.searchSimplexMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexCountOptionsAction() {
  try {
    const data = await queries.getSimplexCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
