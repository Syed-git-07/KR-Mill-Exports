'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/drawingBreakerQueries'

export async function getDrawingBreakerMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getDrawingBreakerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getDrawingBreakerPageDataAction() {
  await requireUser()
  try {
    const [machinesResult, countOptionsResult] = await Promise.allSettled([
      queries.getDrawingBreakerMachines(),
      queries.getDrawingBreakerCountOptions()
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

export async function createDrawingBreakerMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.createDrawingBreakerMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateDrawingBreakerMachineAction(id, machineData) {
  await requireUser()
  try {
    const data = await queries.updateDrawingBreakerMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteDrawingBreakerMachineAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteDrawingBreakerMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchDrawingBreakerMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchDrawingBreakerMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getDrawingBreakerCountOptionsAction() {
  await requireUser()
  try {
    const data = await queries.getDrawingBreakerCountOptions()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function lookupDrawingBreakerMachineByNoAction(machineNo) {
  await requireUser()
  try {
    const data = await queries.lookupDrawingBreakerMachineByNo(machineNo)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
