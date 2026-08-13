'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/spinningMachineQueries'

export async function getSpinningMachinesAction() {
  await requireUser()
  try {
    const data = await queries.getSpinningMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createSpinningMachineAction(machineData) {
  await requireUser()
  try {
    const data = await queries.createSpinningMachine(machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningMachineAction(id, machineData) {
  await requireUser()
  try {
    const data = await queries.updateSpinningMachine(id, machineData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSpinningMachineAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteSpinningMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function activateSpinningMachineAction(id) {
  await requireUser()
  try {
    const data = await queries.activateSpinningMachine(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchSpinningMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchSpinningMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getSpinningMachineWithSetupAction(id) {
  await requireUser()
  try {
    const data = await queries.getSpinningMachineWithSetup(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
