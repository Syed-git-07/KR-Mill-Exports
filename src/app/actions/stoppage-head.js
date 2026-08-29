'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, stoppageHeadCreateSchema, stoppageHeadUpdateSchema } from '@/lib/validation/masterSchemas'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/stoppageHeadQueries'

export async function getStoppageHeadsAction() {
  await requireUser()
  try {
    const data = await queries.getStoppageHeads()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createStoppageHeadAction(stoppageData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = stoppageHeadCreateSchema.parse(stoppageData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.stoppage-head', changes: validated
    }, () => queries.createStoppageHead(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateStoppageHeadAction(id, stoppageData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = stoppageHeadUpdateSchema.parse(stoppageData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.stoppage-head', targetId: validatedId, changes: validated
    }, () => queries.updateStoppageHead(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteStoppageHeadAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const data = await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.stoppage-head', targetId: validatedId,
      changes: { is_active: false }
    }, () => queries.deleteStoppageHead(validatedId))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchStoppageHeadsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchStoppageHeads(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function generateStoppageCodeAction(deptId) {
  await requireUser()
  try {
    const data = await queries.generateStoppageCode(deptId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
