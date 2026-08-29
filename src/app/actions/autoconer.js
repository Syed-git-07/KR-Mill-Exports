'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { autoconerMachineCreateSchema, autoconerMachineUpdateSchema, masterUuidSchema } from '@/lib/validation/masterSchemas'

import * as autoconerQueries from '@/lib/queries/autoconerQueries'
import { serializeData } from '@/lib/serialize'

export async function getAutoconerMachinesAction() {
  await requireUser()
  try {
    const data = await autoconerQueries.getAutoconerMachines()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createAutoconerMachineAction(machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = autoconerMachineCreateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.autoconer-machine', changes: validated
    }, () => autoconerQueries.createAutoconerMachine(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateAutoconerMachineAction(id, machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = autoconerMachineUpdateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.autoconer-machine', targetId: validatedId, changes: validated
    }, () => autoconerQueries.updateAutoconerMachine(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteAutoconerMachineAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const data = await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.autoconer-machine', targetId: validatedId,
      changes: { is_active: false }
    }, () => autoconerQueries.deleteAutoconerMachine(validatedId))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getAutoconerCountsAction() {
  await requireUser()
  try {
    const data = await autoconerQueries.getAutoconerCounts()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchAutoconerMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await autoconerQueries.searchAutoconerMachines(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
