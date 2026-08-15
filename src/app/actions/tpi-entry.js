'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, tpiEntryCreateSchema, tpiEntryUpdateSchema } from '@/lib/validation/masterSchemas'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/tpiEntryQueries'

export async function getTPIEntriesAction() {
  await requireUser()
  try {
    const data = await queries.getTPIEntries()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createTPIEntryAction(entryData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = tpiEntryCreateSchema.parse(entryData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.tpi-entry', changes: validated
    }, () => queries.createTPIEntry(validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateTPIEntryAction(id, entryData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = tpiEntryUpdateSchema.parse(entryData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.tpi-entry', targetId: validatedId, changes: validated
    }, () => queries.updateTPIEntry(validatedId, validated))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteTPIEntryAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const data = await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.tpi-entry', targetId: validatedId
    }, () => queries.deleteTPIEntry(validatedId))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchTPIEntriesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchTPIEntries(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getCountsForDropdownAction() {
  await requireUser()
  try {
    const data = await queries.getCountsForDropdown()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
