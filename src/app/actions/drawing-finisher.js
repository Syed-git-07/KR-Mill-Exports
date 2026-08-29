'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { drawingFinisherCreateSchema, drawingFinisherUpdateSchema, masterUuidSchema } from '@/lib/validation/masterSchemas'

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
  const user = await requireRole('ADMIN')
  try {
    const validated = drawingFinisherCreateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.drawing-finisher-machine', changes: validated
    }, () => queries.createDrawingFinisherMachine(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateDrawingFinisherMachineAction(id, machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = drawingFinisherUpdateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.drawing-finisher-machine', targetId: validatedId, changes: validated
    }, () => queries.updateDrawingFinisherMachine(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteDrawingFinisherMachineAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const data = await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.drawing-finisher-machine', targetId: validatedId,
      changes: { is_active: false }
    }, () => queries.deleteDrawingFinisherMachine(validatedId))
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
