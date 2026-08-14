'use server';

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { masterUuidSchema, twcEntryCreateSchema, twcEntryUpdateSchema } from '@/lib/validation/masterSchemas'

import {
  getTWCEntries,
  createTWCEntry,
  updateTWCEntry,
  deleteTWCEntry,
  searchTWCEntries,
  getCountsForDropdown
} from '@/lib/queries/twcEntryQueries';
import { serializeData } from '@/lib/serialize';

export async function getTWCEntriesAction() {
  await requireUser()
  try {
    const data = await getTWCEntries();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching TWC entries:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function createTWCEntryAction(entryData) {
  const user = await requireRole('ADMIN')
  try {
    const validated = twcEntryCreateSchema.parse(entryData)
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.twc-entry', changes: validated
    }, () => createTWCEntry(validated));
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error creating TWC entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function updateTWCEntryAction(id, entryData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = twcEntryUpdateSchema.parse(entryData)
    const data = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.twc-entry', targetId: validatedId, changes: validated
    }, () => updateTWCEntry(validatedId, validated));
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error updating TWC entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function deleteTWCEntryAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.twc-entry', targetId: validatedId
    }, () => deleteTWCEntry(validatedId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting TWC entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function searchTWCEntriesAction(field, condition, value) {
  await requireUser()
  try {
    const data = await searchTWCEntries(field, condition, value);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error searching TWC entries:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function getCountsForDropdownAction() {
  await requireUser()
  try {
    const data = await getCountsForDropdown();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching counts for dropdown:', error);
    return { success: false, error: safeActionError(error) };
  }
}
