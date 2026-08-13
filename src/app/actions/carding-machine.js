'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/cardingMachineQueries'

export async function getCardingMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getCardingMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getCardingMachinePageDataAction() {
  await requireUser()
  try {
    const [machinesResult, countOptionsResult] = await Promise.allSettled([
      queries.getCardingMachines(),
      queries.getCardingCountOptions()
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

export async function createCardingMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.createCardingMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateCardingMachineAction(id, machineData) {
  await requireUser()
  try {
    const data = await queries.updateCardingMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteCardingMachineAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteCardingMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchCardingMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchCardingMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getCardingCountOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getCardingCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
