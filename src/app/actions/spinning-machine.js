'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, spinningMachineCreateSchema, spinningMachineUpdateSchema } from '@/lib/validation/masterSchemas'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/spinningMachineQueries'
import { getSpinningMasterEfficiency, setSpinningMasterEfficiency } from '@/lib/queries/spinningMachineDefaults'

export async function getSpinningMasterEfficiencyAction() {
  await requireUser()
  try {
    return { success: true, data: await getSpinningMasterEfficiency() }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function setSpinningMasterEfficiencyAction(percent) {
  const user = await requireRole('ADMIN')
  try {
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.spinning-machine',
      changes: { efficiencyPercent: percent }
    }, () => setSpinningMasterEfficiency(percent))
    return { success: true, data: Number(data.efficiency) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

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
  const user = await requireRole('ADMIN')
  try {
    const validated = spinningMachineCreateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.spinning-machine', changes: validated
    }, () => queries.createSpinningMachine(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningMachineAction(id, machineData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = spinningMachineUpdateSchema.parse(machineData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.spinning-machine', targetId: validatedId, changes: validated
    }, () => queries.updateSpinningMachine(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSpinningMachineAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const data = await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.spinning-machine', targetId: validatedId,
      changes: { is_active: false }
    }, () => queries.deleteSpinningMachine(validatedId))
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
