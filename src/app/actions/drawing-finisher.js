'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/drawingFinisherQueries'
import { getSpinningCountOptions } from '@/lib/queries/finisherDrawingEntryQueries'

export async function getDrawingFinisherMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getDrawingFinisherMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getDrawingFinisherPageDataAction() {
  await requireUser()
  try {
    const [machinesResult, countOptionsResult] = await Promise.allSettled([
      queries.getDrawingFinisherMachines(),
      getSpinningCountOptions()
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

export async function createDrawingFinisherMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.createDrawingFinisherMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateDrawingFinisherMachineAction(id, machineData) {
  await requireUser()
  try {
    const data = await queries.updateDrawingFinisherMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteDrawingFinisherMachineAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteDrawingFinisherMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchDrawingFinisherMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchDrawingFinisherMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
