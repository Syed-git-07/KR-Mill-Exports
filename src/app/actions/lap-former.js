'use server';

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'
import { disabledMasterDeleteResult } from '@/lib/masterSafety'
import { executeAuditedMasterMutation } from '@/lib/security/masterAudit'
import { lapFormerCreateSchema, lapFormerUpdateSchema, masterUuidSchema } from '@/lib/validation/masterSchemas'

import { serializeData } from '@/lib/serialize';
import {
  getLapFormerMachines,
  createLapFormerMachine,
  updateLapFormerMachine,
  searchLapFormerMachines,
  getActiveLapFormerMachines,
  getSpinningCountOptions
} from '@/lib/queries/lapFormerQueries';

export async function getLapFormerMachinesAction() {
  await requireUser()
  try {
    const machines = await getLapFormerMachines();
    return { success: true, data: serializeData(machines) };
  } catch (error) {
    console.error('Get lap former machines error:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function getLapFormerPageDataAction() {
  await requireUser()
  try {
    const [machinesResult, countOptionsResult] = await Promise.allSettled([
      getLapFormerMachines(),
      getSpinningCountOptions()
    ]);

    if (machinesResult.status === 'rejected') throw machinesResult.reason;

    return {
      success: true,
      data: serializeData({
        machines: machinesResult.value,
        countOptions: countOptionsResult.status === 'fulfilled' ? countOptionsResult.value : []
      })
    };
  } catch (error) {
    console.error('Get lap former page data error:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function createLapFormerMachineAction(data) {
  const user = await requireRole('ADMIN')
  try {
    const validated = lapFormerCreateSchema.parse(data)
    const machine = await executeAuditedMasterMutation({
      user, action: 'CREATE', resource: 'master.lap-former-machine', changes: validated
    }, () => createLapFormerMachine(validated));
    return { success: true, data: serializeData(machine) };
  } catch (error) {
    console.error('Create lap former machine error:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function updateLapFormerMachineAction(id, data) {
  const user = await requireRole('ADMIN')
  try {
    const validatedId = masterUuidSchema.parse(id)
    const validated = lapFormerUpdateSchema.parse(data)
    const machine = await executeAuditedMasterMutation({
      user, action: 'UPDATE', resource: 'master.lap-former-machine', targetId: validatedId, changes: validated
    }, () => updateLapFormerMachine(validatedId, validated));
    return { success: true, data: serializeData(machine) };
  } catch (error) {
    console.error('Update lap former machine error:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function deleteLapFormerMachineAction() {
  await requireRole('ADMIN')
  return disabledMasterDeleteResult()
}

export async function searchLapFormerMachinesAction(field, condition, value) {
  await requireUser()
  try {
    const machines = await searchLapFormerMachines(field, condition, value);
    return { success: true, data: serializeData(machines) };
  } catch (error) {
    console.error('Search lap former machines error:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function getActiveLapFormerMachinesAction() {
  await requireUser()
  try {
    const machines = await getActiveLapFormerMachines();
    return { success: true, data: serializeData(machines) };
  } catch (error) {
    console.error('Get active lap former machines error:', error);
    return { success: false, error: safeActionError(error) };
  }
}

export async function getLapFormerCountOptionsAction() {
  await requireUser()
  try {
    const data = await getSpinningCountOptions();
    return { success: true, data: serializeData(data) };
  } catch (error) {
    console.error('Get lap former count options error:', error);
    return { success: false, error: safeActionError(error) };
  }
}
