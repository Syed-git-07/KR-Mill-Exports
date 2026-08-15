'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { disabledMasterDeleteResult } from '@/lib/masterSafety'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, supervisorCreateSchema, supervisorUpdateSchema } from '@/lib/validation/masterSchemas'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/supervisorQueries'

export async function getSupervisorsAction() {
  await requireUser()
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createSupervisorAction(supervisorData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = supervisorCreateSchema.parse(supervisorData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.supervisor', changes: validated
    }, () => queries.createSupervisor(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSupervisorAction(id, supervisorData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = supervisorUpdateSchema.parse(supervisorData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.supervisor', targetId: validatedId, changes: validated
    }, () => queries.updateSupervisor(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSupervisorAction() {
  await requireRole('ADMIN')
  return disabledMasterDeleteResult()
}

export async function searchSupervisorsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchSupervisors(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getDepartmentsAction() {
  await requireUser()
  try {
    const data = await queries.getDepartmentsForDropdown()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
