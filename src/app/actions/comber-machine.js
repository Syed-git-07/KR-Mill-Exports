'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { disabledMasterDeleteResult } from '@/lib/masterSafety'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { comberMachineCreateSchema, comberMachineUpdateSchema, masterUuidSchema } from '@/lib/validation/masterSchemas'

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
  const user = await requireRole('ADMIN')
  try {
    const validated = comberMachineCreateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.comber-machine', changes: validated
    }, () => queries.createComberMachine(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateComberMachineAction(id, machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = comberMachineUpdateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.comber-machine', targetId: validatedId, changes: validated
    }, () => queries.updateComberMachine(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteComberMachineAction() {
  await requireRole('ADMIN')
  return disabledMasterDeleteResult()
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
