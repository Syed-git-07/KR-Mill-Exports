'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { disabledMasterDeleteResult } from '@/lib/masterSafety'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { departmentCreateSchema, departmentUpdateSchema, masterUuidSchema } from '@/lib/validation/masterSchemas'

import { getDepartments, createDepartment, updateDepartment, searchDepartments } from '@/lib/queries/queries'
import { serializeData } from '@/lib/serialize'

export async function getDepartmentsAction() {
  await requireUser()
  try {
    const data = await getDepartments()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createDepartmentAction(departmentData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = departmentCreateSchema.parse(departmentData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.department', changes: validated
    }, () => createDepartment(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateDepartmentAction(id, departmentData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = departmentUpdateSchema.parse(departmentData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.department', targetId: validatedId, changes: validated
    }, () => updateDepartment(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteDepartmentAction() {
  await requireRole('ADMIN')
  return disabledMasterDeleteResult()
}

export async function searchDepartmentsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await searchDepartments(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
