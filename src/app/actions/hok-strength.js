'use server';

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
  try {
    const data = await getHOKEntries();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching HOK entries:', error);
    return { success: false, error: error.message };
  }
}

export async function getHOKEntryByIdAction(hokId) {
  try {
    const data = await getHOKEntryById(hokId);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching HOK entry:', error);
    return { success: false, error: error.message };
  }
}

export async function createBulkHOKEntriesAction(entriesData) {
  try {
    const data = await createBulkHOKEntries(entriesData);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error creating HOK entries:', error);
    return { success: false, error: error.message };
  }
}

export async function updateHOKEntryAction(hokId, hokData) {
  try {
    const data = await updateHOKEntry(hokId, hokData);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error updating HOK entry:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteHOKEntryAction(hokId) {
  try {
    await deleteHOKEntry(hokId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting HOK entry:', error);
    return { success: false, error: error.message };
  }
}

export async function searchHOKEntriesAction(searchParams) {
  try {
    const data = await searchHOKEntries(searchParams);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error searching HOK entries:', error);
    return { success: false, error: error.message };
  }
}

export async function getDepartmentsForDropdownAction() {
  try {
    const data = await getDepartmentsForDropdown();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching departments for dropdown:', error);
    return { success: false, error: error.message };
  }
}
