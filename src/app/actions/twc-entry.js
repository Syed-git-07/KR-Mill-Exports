'use server';

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
  try {
    const data = await getTWCEntries();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching TWC entries:', error);
    return { success: false, error: error.message };
  }
}

export async function createTWCEntryAction(entryData) {
  try {
    const data = await createTWCEntry(entryData);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error creating TWC entry:', error);
    return { success: false, error: error.message };
  }
}

export async function updateTWCEntryAction(id, entryData) {
  try {
    const data = await updateTWCEntry(id, entryData);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error updating TWC entry:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteTWCEntryAction(id) {
  try {
    await deleteTWCEntry(id);
    return { success: true };
  } catch (error) {
    console.error('Error deleting TWC entry:', error);
    return { success: false, error: error.message };
  }
}

export async function searchTWCEntriesAction(field, condition, value) {
  try {
    const data = await searchTWCEntries(field, condition, value);
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error searching TWC entries:', error);
    return { success: false, error: error.message };
  }
}

export async function getCountsForDropdownAction() {
  try {
    const data = await getCountsForDropdown();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Error fetching counts for dropdown:', error);
    return { success: false, error: error.message };
  }
}
