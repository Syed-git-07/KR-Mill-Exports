import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';
import { applyPermanentRemoval } from '../machineLifecycle';
import { softDeleteMasterRecord } from './masterSoftDelete';

const machineCountSelect = { id: true, count_name: true };

function flattenMachineCount(machine) {
  if (!machine) return machine;
  const { spinning_counts: selectedCount, ...data } = machine;
  return {
    ...data,
    count_id: selectedCount?.id ?? data.count_id ?? null,
    count: selectedCount?.count_name ?? data.count ?? null,
    count_name: selectedCount?.count_name ?? data.count ?? null
  };
}

async function resolveActiveCount(db, countId) {
  if (!countId) return null;
  const count = await db.spinning_counts.findUnique({
    where: { id: countId },
    select: { id: true, count_name: true, is_active: true, autoconer_active: true }
  });
  if (!count?.is_active || !count?.autoconer_active) {
    throw new Error('Selected count is not enabled for Autoconer');
  }
  return count;
}

export async function getAutoconerCounts() {
  return prisma.spinning_counts.findMany({
    where: { is_active: true, autoconer_active: true },
    select: { id: true, count_name: true },
    orderBy: { count_name: 'asc' }
  });
}

/**
 * Autoconer Machine Master CRUD Operations
 */

// Get all autoconer machines - sorted by group_id then machine number (active only)
export async function getAutoconerMachines() {
  const rows = await prisma.autoconer_machines.findMany({
    include: { spinning_counts: { select: machineCountSelect } }
  });
  const data = rows.map(flattenMachineCount);
  
  // Sort: active first, then by group_id, then machine_no naturally
  if (data) {
    data.sort((a, b) => {
      // Active machines come first
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

      // Then sort by group_id numerically
      const groupA = a.group_id || 999;
      const groupB = b.group_id || 999;
      if (groupA !== groupB) return groupA - groupB;
      
      // Then sort by machine_no naturally (AC1-1, AC1-2, AC1-3, etc.)
      const machineNoA = a.machine_no || '';
      const machineNoB = b.machine_no || '';
      
      // Extract group and sub-number for natural sorting
      const matchA = machineNoA.match(/^AC(\d+)-(\d+)$/i);
      const matchB = machineNoB.match(/^AC(\d+)-(\d+)$/i);
      
      if (matchA && matchB) {
        const groupNumA = parseInt(matchA[1], 10);
        const groupNumB = parseInt(matchB[1], 10);
        if (groupNumA !== groupNumB) return groupNumA - groupNumB;
        
        const subNumA = parseInt(matchA[2], 10);
        const subNumB = parseInt(matchB[2], 10);
        return subNumA - subNumB;
      }
      
      // Fallback to string comparison
      return machineNoA.localeCompare(machineNoB, undefined, { numeric: true });
    });
  }
  
  return data;
}

// Get next available mc_id
export async function getNextMcId() {
  const data = await prisma.autoconer_machines.findFirst({
    orderBy: { mc_id: 'desc' },
    select: { mc_id: true }
  });
  
  // Return next available mc_id (max + 1, or 1 if no records)
  return data && data.mc_id ? data.mc_id + 1 : 1;
}

// Create a machine master record. Dated setup snapshots are initialized only
// when a production entry is created or the machine is added to that entry.
export async function createAutoconerMachine(machineData) {
  const processedData = { ...machineData };
  // Auto-generate mc_id if not provided
  if (!processedData.mc_id) {
    processedData.mc_id = await getNextMcId();
  }

  // Convert date string to Date object if it exists
  if (processedData.installed_date && typeof processedData.installed_date === 'string') {
    processedData.installed_date = new Date(processedData.installed_date);
  }
  const selectedCount = await resolveActiveCount(prisma, processedData.count_id);
  processedData.count = selectedCount?.count_name ?? null;
  processedData.speed = null;
  processedData.act_effi = null;
  // Set activated_at to today when creating a new machine
  processedData.activated_at = new Date();

  try {
    const newMachine = await prisma.autoconer_machines.create({
      data: processedData,
      include: { spinning_counts: { select: machineCountSelect } }
    });

    // No dated rows are changed here. Future entries initialize this master;
    // an explicit add in Machine Setup can attach it to the current entry.

    return flattenMachineCount(newMachine);
  } catch (error) {
    console.error('Prisma error creating autoconer machine:', error);
    throw new Error(error.message || 'Failed to create autoconer machine');
  }
}

// Update autoconer machine
export async function updateAutoconerMachine(id, machineData) {
  // Convert date string to Date object if it exists
  const processedData = { ...machineData };
  if (processedData.installed_date && typeof processedData.installed_date === 'string') {
    processedData.installed_date = new Date(processedData.installed_date);
  }
  if (Object.hasOwn(processedData, 'count_id')) {
    const selectedCount = await resolveActiveCount(prisma, processedData.count_id);
    processedData.count = selectedCount?.count_name ?? null;
  }
  
  const existing = await prisma.autoconer_machines.findUnique({ where: { id } });
  if (!existing) throw new Error('Autoconer machine not found');
  if (existing.is_active === false) {
    throw new Error('Removed machines are historical records and cannot be changed or restored');
  }
  Object.assign(processedData, applyPermanentRemoval(existing, processedData));

  // Status-only operations are lifecycle changes, not revisions.
  const changedKeys = Object.keys(processedData).filter(key => processedData[key] !== existing[key]);
  const isStatusOnly = changedKeys.every(key => ['is_active', 'activated_at', 'deactivated_at'].includes(key));
  if (isStatusOnly) {
    return prisma.autoconer_machines.update({ where: { id }, data: processedData });
  }

  // Keep the old row as the immutable snapshot referenced by earlier production
  // details. The replacement becomes the active master used by future entries.
  const revisionTime = new Date();
  return prisma.$transaction(async tx => {
    await tx.autoconer_machines.update({
      where: { id },
      data: { is_active: false, deactivated_at: revisionTime }
    });

    const {
      id: _id,
      active_machine_no: _activeMachineNo,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...oldValues
    } = existing;
    return tx.autoconer_machines.create({
      data: {
        ...oldValues,
        ...processedData,
        speed: null,
        act_effi: null,
        is_active: true,
        activated_at: revisionTime,
        deactivated_at: null
      },
      include: { spinning_counts: { select: machineCountSelect } }
    });
  });
}

// Soft-delete an autoconer machine while retaining historical entries.
export async function deleteAutoconerMachine(id) {
  return softDeleteMasterRecord(prisma.autoconer_machines, id, {
    recordLabel: 'Autoconer machine',
    trackRemovalDate: true
  });
}

// Search autoconer machines (active only)
export async function searchAutoconerMachines(field, condition, value) {
  const whereClause = buildTypedSearchWhere(field, condition, value, {
    machine_no: 'text', description: 'text', make_name: 'text'
  });

  const data = await prisma.autoconer_machines.findMany({
    where: whereClause,
    orderBy: { machine_no: 'asc' },
    include: { spinning_counts: { select: machineCountSelect } }
  });
  
  return data.map(flattenMachineCount);
}
