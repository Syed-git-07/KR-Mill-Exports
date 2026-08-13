'use server';

import { requireUser } from '@/lib/security/auth'

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
    const data = await getHOKEntryById(hokId);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching HOK entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function createBulkHOKEntriesAction(entriesData) {
  await requireUser()
  try {
    const data = await createBulkHOKEntries(entriesData);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error creating HOK entries:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function updateHOKEntryAction(hokId, hokData) {
  await requireUser()
  try {
    const data = await updateHOKEntry(hokId, hokData);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error updating HOK entry:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function deleteHOKEntryAction(hokId) {
  await requireUser()
  try {
    await deleteHOKEntry(hokId);
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
