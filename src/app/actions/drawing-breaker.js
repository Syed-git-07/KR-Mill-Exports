'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { disabledMasterDeleteResult } from '@/lib/masterSafety'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { drawingBreakerCreateSchema, drawingBreakerUpdateSchema, masterUuidSchema } from '@/lib/validation/masterSchemas'

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
  const user = await requireRole('ADMIN')
  try {
    const validated = drawingBreakerCreateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.drawing-breaker-machine', changes: validated
    }, () => queries.createDrawingBreakerMachine(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateDrawingBreakerMachineAction(id, machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = drawingBreakerUpdateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.drawing-breaker-machine', targetId: validatedId, changes: validated
    }, () => queries.updateDrawingBreakerMachine(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteDrawingBreakerMachineAction() {
  await requireRole('ADMIN')
  return disabledMasterDeleteResult()
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
