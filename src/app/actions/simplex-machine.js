'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, simplexMachineCreateSchema, simplexMachineUpdateSchema } from '@/lib/validation/masterSchemas'

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
  const user = await requireRole('ADMIN')
  try {
    const validated = simplexMachineCreateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.simplex-machine', changes: validated
    }, () => queries.createSimplexMachine(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSimplexMachineAction(id, machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = simplexMachineUpdateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.simplex-machine', targetId: validatedId, changes: validated
    }, () => queries.updateSimplexMachine(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSimplexMachineAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const data = await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.simplex-machine', targetId: validatedId,
      changes: { is_active: false }
    }, () => queries.deleteSimplexMachine(validatedId))
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
