'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/comberMachineQueries'

export async function getComberMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getComberMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getComberMachinePageDataAction() {
  await requireUser()
  try {
    const [machinesResult, countOptionsResult] = await Promise.allSettled([
      queries.getComberMachines(),
      queries.getComberCountOptions()
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

export async function createComberMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.createComberMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateComberMachineAction(id, machineData) {
  await requireUser()
  try {
    const data = await queries.updateComberMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteComberMachineAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteComberMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchComberMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchComberMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupComberMachineByNoAction(machineNo) {
  await requireUser()
  try {
    const data = await queries.lookupComberMachineByNo(machineNo)
    return { success: true, data: data ? serializeData(data) : null }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getComberCountOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getComberCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
