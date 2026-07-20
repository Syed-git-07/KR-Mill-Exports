'use server';

import { serializeData } from '@/lib/serialize';
import {
  getLapFormerMachines,
  createLapFormerMachine,
  updateLapFormerMachine,
  deleteLapFormerMachine,
  searchLapFormerMachines,
  getActiveLapFormerMachines,
  getSpinningCountOptions
} from '@/lib/queries/lapFormerQueries';

export async function getLapFormerMachinesAction() {
  try {
    const machines = await getLapFormerMachines();
    return { success: true, data: serializeData(machines) };
  } catch (error) {
    console.error('Get lap former machines error:', error);
    return { success: false, error: error.message };
  }
}

export async function createLapFormerMachineAction(data) {
  try {
    const machine = await createLapFormerMachine(data);
    return { success: true, data: serializeData(machine) };
  } catch (error) {
    console.error('Create lap former machine error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateLapFormerMachineAction(id, data) {
  try {
    const machine = await updateLapFormerMachine(id, data);
    return { success: true, data: serializeData(machine) };
  } catch (error) {
    console.error('Update lap former machine error:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteLapFormerMachineAction(id) {
  try {
    await deleteLapFormerMachine(id);
    return { success: true };
  } catch (error) {
    console.error('Delete lap former machine error:', error);
    return { success: false, error: error.message };
  }
}

export async function searchLapFormerMachinesAction(field, condition, value) {
  try {
    const machines = await searchLapFormerMachines(field, condition, value);
    return { success: true, data: serializeData(machines) };
  } catch (error) {
    console.error('Search lap former machines error:', error);
    return { success: false, error: error.message };
  }
}

export async function getActiveLapFormerMachinesAction() {
  try {
    const machines = await getActiveLapFormerMachines();
    return { success: true, data: serializeData(machines) };
  } catch (error) {
    console.error('Get active lap former machines error:', error);
    return { success: false, error: error.message };
  }
}

export async function getLapFormerCountOptionsAction() {
  try {
    const data = await getSpinningCountOptions();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Get lap former count options error:', error);
    return { success: false, error: error.message };
  }
}
