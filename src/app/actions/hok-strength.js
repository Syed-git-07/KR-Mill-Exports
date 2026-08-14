'use server';

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import {
  getHOKEntries,
  getHOKEntryById,
  createBulkHOKEntries,
  updateHOKEntry,
  deleteHOKEntry,
  searchHOKEntries,
  getDepartmentsForDropdown
} from '@/lib/queries/hokStrengthQueries';
import { serializeData } from '@/lib/serialize';
import { hokEntrySchema, hokIdSchema } from '@/lib/validation/masterSchemas';
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit';

export async function getHOKEntriesAction() {
  await requireUser()
  try {
    const data = await getHOKEntries();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching HOK entries:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function getHOKEntryByIdAction(hokId) {
  await requireUser()
  try {
    const data = await getHOKEntryById(hokIdSchema.parse(hokId));
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching HOK entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function createBulkHOKEntriesAction(entriesData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedData = hokEntrySchema.parse(entriesData);
    const data = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.hok-strength', changes: validatedData
    }, () => createBulkHOKEntries(validatedData));
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error creating HOK entries:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function updateHOKEntryAction(hokId, hokData) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = hokIdSchema.parse(hokId);
    const validatedData = hokEntrySchema.parse(hokData);
    const data = await executeAuditedMasterMutation({
      user,
      action: 'UPDATE',
      resource: 'master.hok-strength',
      targetId: validatedId,
      changes: validatedData
    }, () => updateHOKEntry(validatedId, validatedData));
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error updating HOK entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function deleteHOKEntryAction(hokId) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = hokIdSchema.parse(hokId);
    await executeAuditedMasterMutation({
      user, action: 'DELETE', resource: 'master.hok-strength', targetId: validatedId
    }, () => deleteHOKEntry(validatedId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting HOK entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function searchHOKEntriesAction(searchParams) {
  await requireUser()
  try {
    const data = await searchHOKEntries(searchParams);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error searching HOK entries:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function getDepartmentsForDropdownAction() {
  await requireUser()
  try {
    const data = await getDepartmentsForDropdown();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching departments for dropdown:', error);
    return { success: false, error: safeActionError(error) };
  }
}
