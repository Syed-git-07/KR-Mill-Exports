import { prisma } from '../prisma';
import { deleteUnusedMachine } from './machineDeletion';
import { parseStrictDate } from '../strictDate';

const AUTOCONER_FIELDS = new Set([
  'machine_no', 'description', 'make_name', 'act_effi', 'is_active', 'mc_id',
  'group_id', 'model', 'from_drum', 'to_drum', 'no_of_drums', 'speed',
  'count', 'installed_date', 'direct_prod_entry'
]);
const AUTOCONER_BOOLEAN_FIELDS = new Set(['is_active', 'direct_prod_entry']);
const AUTOCONER_INTEGER_FIELDS = new Set([
  'act_effi', 'mc_id', 'group_id', 'from_drum', 'to_drum', 'no_of_drums', 'speed'
]);

/**
 * Autoconer Machine Master CRUD Operations
 */

// Get all autoconer machines - sorted by group_id then machine number (active only)
export async function getAutoconerMachines() {
  const data = await prisma.autoconer_machines.findMany({});
  
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

function normalizeMachineNumber(value) {
  const machineNo = String(value ?? '').trim();
  if (!machineNo) throw new Error('Machine number is required');
  return machineNo;
}

async function findMachineNumberDuplicates(client, machineNo, excludeId = null) {
  return client.autoconer_machines.findMany({
    where: {
      machine_no: { equals: machineNo },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true, is_active: true }
  });
}

function lifecycleReactivationError() {
  const error = new Error(
    'An inactive machine is a historical lifecycle record and cannot be reactivated in place. Use Add New with the same machine number to create the new lifecycle.'
  );
  error.code = 'MACHINE_REACTIVATION_REQUIRES_NEW';
  return error;
}

export function cleanAutoconerMachineInput(machineData = {}, { creating = false } = {}) {
  const data = {};
  for (const [key, value] of Object.entries(machineData)) {
    if (!AUTOCONER_FIELDS.has(key) || value === undefined) continue;

    if (key === 'machine_no') data.machine_no = normalizeMachineNumber(value);
    else if (key === 'description') {
      data.description = String(value ?? '').trim();
      if (!data.description) throw new Error('Description is required');
    } else if (key === 'make_name') {
      data.make_name = String(value ?? '').trim() || 'MURT';
    } else if (key === 'model' || key === 'count') {
      data[key] = value == null || value === '' ? null : String(value).trim();
    } else if (key === 'installed_date') {
      data.installed_date = value == null || value === ''
        ? null
        : parseStrictDate(value, 'Installed date');
    } else if (AUTOCONER_BOOLEAN_FIELDS.has(key)) {
      if (typeof value !== 'boolean') throw new Error(`${key} must be true or false`);
      data[key] = value;
    } else if (AUTOCONER_INTEGER_FIELDS.has(key)) {
      if (value == null || value === '') data[key] = null;
      else {
        const number = Number(value);
        if (!Number.isInteger(number) || number < 0) {
          throw new Error(`${key} must be a non-negative whole number`);
        }
        data[key] = number;
      }
    }
  }

  if (data.group_id != null && data.group_id < 1) throw new Error('Group ID must be at least 1');
  if (data.mc_id != null && data.mc_id < 1) throw new Error('Machine ID must be at least 1');
  if (data.act_effi != null && data.act_effi > 100) throw new Error('Actual efficiency cannot exceed 100');

  const hasFrom = data.from_drum != null;
  const hasTo = data.to_drum != null;
  if (hasFrom || hasTo) {
    if (!hasFrom || !hasTo) data.no_of_drums = 0;
    else {
      if (data.to_drum < data.from_drum) throw new Error('To drum must be greater than or equal to From drum');
      data.no_of_drums = data.to_drum - data.from_drum + 1;
    }
  }

  if (creating) {
    if (!data.machine_no) throw new Error('Machine number is required');
    if (!data.description) throw new Error('Description is required');
    if (data.is_active === undefined) data.is_active = true;
  }
  return data;
}

// Create new autoconer machine (with setup and add to existing headers)
export async function createAutoconerMachine(machineData) {
  const processedData = cleanAutoconerMachineInput(machineData, { creating: true });

  try {
    return await prisma.$transaction(async transaction => {
      const duplicates = await findMachineNumberDuplicates(
        transaction,
        processedData.machine_no
      );
      if (duplicates.some(machine => machine.is_active)) {
        throw new Error(`Machine ${processedData.machine_no} already exists and is active`);
      }
      if (!processedData.mc_id) {
        const latest = await transaction.autoconer_machines.findFirst({
          orderBy: { mc_id: 'desc' },
          select: { mc_id: true }
        });
        processedData.mc_id = (latest?.mc_id ?? 0) + 1;
      }

      // An inactive row is a completed lifecycle snapshot referenced by past
      // production. Reactivation therefore creates a new row instead of
      // rewriting its activation window and changing historical visibility.
      const now = new Date();
      const isActive = processedData.is_active !== false;
      return transaction.autoconer_machines.create({
        data: {
          ...processedData,
          is_active: isActive,
          activated_at: isActive ? now : null,
          deactivated_at: isActive ? null : now,
          updated_at: now,
        }
      });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    console.error('Prisma error creating autoconer machine:', error);
    throw new Error(error.message || 'Failed to create autoconer machine');
  }
}

// Helper function to add machine to existing production headers
async function addMachineToExistingProductionHeaders(machineId, machineData) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get existing production headers
  const headers = await prisma.autoconer_production_header.findMany({
    where: {
      entry_date: { gte: sevenDaysAgo }
    },
    select: { id: true }
  });

  if (!headers || headers.length === 0) return;

  for (const header of headers) {
    // Check if already exists
    const existing = await prisma.autoconer_production_detail.findFirst({
      where: {
        header_id: header.id,
        machine_id: machineId
      }
    });

    if (existing) continue;

    // Create production detail
    try {
      const detail = await prisma.autoconer_production_detail.create({
        data: {
          header_id: header.id,
          machine_id: machineId,
          count_name: machineData?.count_name || null,
          count_id: machineData?.count_id || null,
          session_no: 1,
          work_time: 510,
          total_stoppage_mins: 0
        }
      });

      // Create stoppage entry
      await prisma.autoconer_stoppage_entry.create({
        data: {
          production_detail_id: detail.id,
          run_time: 510,
          total_stoppage_time: 0
        }
      });
    } catch (detailError) {
      console.error('Error creating production detail:', detailError);
      continue;
    }
  }
}

// Update autoconer machine
export async function updateAutoconerMachine(id, machineData) {
  if (!id) throw new Error('Machine ID is required');
  const processedData = cleanAutoconerMachineInput(machineData);

  return prisma.$transaction(async transaction => {
    const existing = await transaction.autoconer_machines.findUnique({
      where: { id },
      select: { id: true, machine_no: true, is_active: true }
    });
    if (!existing) throw new Error('Autoconer machine not found');

    if (processedData.machine_no && processedData.machine_no !== existing.machine_no) {
      throw new Error('Machine number is an immutable lifecycle key and cannot be changed');
    }
    if (!existing.is_active && processedData.is_active === true) {
      throw lifecycleReactivationError();
    }

    const now = new Date();
    const isDeactivating = existing.is_active !== false && processedData.is_active === false;
    return transaction.autoconer_machines.update({
      where: { id },
      data: {
        ...processedData,
        updated_at: now,
        ...(isDeactivating ? { deactivated_at: now } : {}),
      }
    });
  });
}

// Delete autoconer machine
export async function deleteAutoconerMachine(id) {
  return deleteUnusedMachine({
    id,
    machineModel: 'autoconer_machines',
    setupModel: 'autoconer_machine_setup',
    productionDetailModel: 'autoconer_production_detail',
    label: 'autoconer machine'
  });
}

// Search autoconer machines (active only)
export async function searchAutoconerMachines(field, condition, value) {
  const searchableFields = new Set(['machine_no', 'description', 'make_name']);
  const supportedConditions = new Set(['Like', 'Equal', 'Not Equal', 'Greater', 'Less']);
  if (!searchableFields.has(field)) throw new Error('Unsupported Autoconer search field');
  if (!supportedConditions.has(condition)) throw new Error('Unsupported Autoconer search condition');

  const searchValue = String(value ?? '').trim();
  let whereClause = {};
  if (searchValue) {
    const filters = {
      Like: { contains: searchValue },
      Equal: { equals: searchValue },
      'Not Equal': { not: searchValue },
      Greater: { gt: searchValue },
      Less: { lt: searchValue },
    };
    whereClause = { [field]: filters[condition] };
  }

  const data = await prisma.autoconer_machines.findMany({
    where: whereClause,
    orderBy: { machine_no: 'asc' }
  });
  
  return data;
}
