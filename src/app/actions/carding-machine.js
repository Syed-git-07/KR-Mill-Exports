'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { cardingMachineCreateSchema, cardingMachineUpdateSchema, masterUuidSchema } from '@/lib/validation/masterSchemas'

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
  const user = await requireRole('ADMIN')
  try {
    const validated = cardingMachineCreateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.carding-machine', changes: validated
    }, () => queries.createCardingMachine(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateCardingMachineAction(id, machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = cardingMachineUpdateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.carding-machine', targetId: validatedId, changes: validated
    }, () => queries.updateCardingMachine(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteCardingMachineAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const data = await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.carding-machine', targetId: validatedId,
      changes: { is_active: false }
    }, () => queries.deleteCardingMachine(validatedId))
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
