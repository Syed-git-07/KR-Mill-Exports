'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { disabledMasterDeleteResult } from '@/lib/masterSafety'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, stoppageDetailCreateSchema, stoppageDetailUpdateSchema } from '@/lib/validation/masterSchemas'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/stoppageDetailQueries'

export async function getStoppageDetailsAction() {
  await requireUser()
  try {
    const data = await queries.getStoppageDetails()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createStoppageDetailAction(stoppageData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = stoppageDetailCreateSchema.parse(stoppageData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.stoppage-detail', changes: validated
    }, () => queries.createStoppageDetail(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateStoppageDetailAction(id, stoppageData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = stoppageDetailUpdateSchema.parse(stoppageData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.stoppage-detail', targetId: validatedId, changes: validated
    }, () => queries.updateStoppageDetail(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteStoppageDetailAction() {
  await requireRole('ADMIN')
  return disabledMasterDeleteResult()
}

export async function searchStoppageDetailsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchStoppageDetails(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getStoppageHeadsAction() {
  await requireUser()
  try {
    const data = await queries.getStoppageHeadsForDropdown()
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
