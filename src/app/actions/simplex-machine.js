'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/simplexMachineQueries'

export async function getSimplexMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getSimplexMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexMachinePageDataAction() {
  await requireUser()
  try {
    const [machinesResult, countOptionsResult] = await Promise.allSettled([
      queries.getSimplexMachines(),
      queries.getSimplexCountOptions()
    ])

    if (machinesResult.status === 'rejected') throw machinesResult.reason

    return {
      success: true,
      data: serializeData({
        machines: machinesResult.value,
        countOptions: countOptionsResult.status === 'fulfilled' ? countOptionsResult.value : []
      })
    }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createSimplexMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.createSimplexMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSimplexMachineAction(id, machineData) {
  await requireUser()
  try {
    const data = await queries.updateSimplexMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSimplexMachineAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteSimplexMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchSimplexMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchSimplexMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSimplexCountOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getSimplexCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
