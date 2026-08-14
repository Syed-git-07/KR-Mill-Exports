'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { disabledMasterDeleteResult } from '@/lib/masterSafety'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, spinningCountCreateSchema, spinningCountUpdateSchema } from '@/lib/validation/masterSchemas'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/spinningCountQueries'

export async function getSpinningCountsAction() {
  await requireUser()
  try {
    const data = await queries.getSpinningCounts()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createSpinningCountAction(countData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = spinningCountCreateSchema.parse(countData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.spinning-count', changes: validated
    }, () => queries.createSpinningCount(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningCountAction(id, countData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = spinningCountUpdateSchema.parse(countData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.spinning-count', targetId: validatedId, changes: validated
    }, () => queries.updateSpinningCount(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSpinningCountAction() {
  await requireRole('ADMIN')
  return disabledMasterDeleteResult()
}

export async function searchSpinningCountsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchSpinningCounts(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
