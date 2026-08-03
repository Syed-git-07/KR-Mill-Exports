import { prisma } from '../prisma';
import { deleteUnusedMachine } from './machineDeletion';
import { parseStrictDate } from '../strictDate';

const SPINNING_DEFAULT_SETUP_DATE = new Date('2026-04-01T00:00:00.000Z');
const MACHINE_FIELDS = new Set([
  'machine_no', 'description', 'make_name', 'model', 'allocated_spindles',
  'installed_date', 'is_active', 'production_kgs_manual_entry', 'direct_hank_entry'
]);
const SETUP_FIELDS = new Set(['speed', 'count_name', 'act_count', 'tpi']);
const BOOLEAN_FIELDS = new Set([
  'is_active', 'production_kgs_manual_entry', 'direct_hank_entry'
]);

async function upsertDefaultSpinningSetup(machineId, setupFields, client = prisma) {
  const data = Object.fromEntries(
    Object.entries(setupFields).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(data).length === 0) return null;
  data.updated_at = new Date();

  return client.spinning_machine_setup.upsert({
    where: {
      idx_spinning_machine_setup_date: {
        machine_id: machineId,
        entry_date: SPINNING_DEFAULT_SETUP_DATE,
        shift: 1,
      }
    },
    update: data,
    create: {
      machine_id: machineId,
      entry_date: SPINNING_DEFAULT_SETUP_DATE,
      shift: 1,
      ...data,
    }
  });
}

function lifecycleReactivationError() {
  const error = new Error(
    'An inactive machine is a historical lifecycle record and cannot be reactivated in place. Use Add New with the same machine number to create the new lifecycle.'
  );
  error.code = 'MACHINE_REACTIVATION_REQUIRES_NEW';
  return error;
}

function optionalNonNegativeNumber(value, label, { integer = false } = {}) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} must be a non-negative ${integer ? 'whole ' : ''}number`);
  }
  return number;
}

function cleanSpinningMachineInput(machineData = {}, { creating = false } = {}) {
  const machineFields = {};
  const setupFields = {};

  for (const [key, value] of Object.entries(machineData)) {
    if (MACHINE_FIELDS.has(key)) {
      if (key === 'machine_no') machineFields.machine_no = normalizeMachineNumber(value);
      else if (key === 'description') {
        machineFields.description = String(value ?? '').trim();
        if (!machineFields.description) throw new Error('Description is required');
      } else if (key === 'make_name') {
        machineFields.make_name = String(value ?? '').trim() || 'LMW';
      } else if (key === 'model') {
        machineFields.model = value == null || value === '' ? null : String(value).trim();
      } else if (key === 'allocated_spindles') {
        machineFields.allocated_spindles = optionalNonNegativeNumber(
          value,
          'Allocated spindles',
          { integer: true }
        );
        if (machineFields.allocated_spindles == null) {
          throw new Error('Allocated spindles is required');
        }
      } else if (key === 'installed_date') {
        machineFields.installed_date = value == null || value === ''
          ? null
          : parseStrictDate(value, 'Installed date');
      } else if (BOOLEAN_FIELDS.has(key)) {
        if (typeof value !== 'boolean') throw new Error(`${key} must be true or false`);
        machineFields[key] = value;
      }
    } else if (SETUP_FIELDS.has(key)) {
      if (key === 'count_name') {
        setupFields.count_name = value == null || value === '' ? null : String(value).trim();
      } else {
        setupFields[key] = optionalNonNegativeNumber(value, key, {
          integer: key === 'speed'
        });
      }
    }
  }

  if (creating) {
    if (!machineFields.machine_no) throw new Error('Machine number is required');
    if (!machineFields.description) throw new Error('Description is required');
    if (machineFields.allocated_spindles == null) machineFields.allocated_spindles = 1104;
    if (machineFields.is_active === undefined) machineFields.is_active = true;
  }

  return { machineFields, setupFields };
}

function normalizeMachineNumber(value) {
  const machineNo = String(value ?? '').trim()
  if (!machineNo) throw new Error('Machine number is required')
  return machineNo
}

async function findMachineNumberDuplicates(client, machineNo, excludeId = null) {
  return client.spinning_machines.findMany({
    where: {
      machine_no: { equals: machineNo },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, is_active: true },
  })
}

/**
 * Spinning Machine Master CRUD Operations
 */

// Get all spinning machines
export async function getSpinningMachines() {
  const data = await prisma.spinning_machines.findMany({});

  // Sort: active machines first, then by numeric machine_no
  const sorted = sortMachinesByNumber(data || []);
  return sorted.sort((a, b) => {
    if (a.is_active === b.is_active) return 0;
    return a.is_active ? -1 : 1;
  });
}

// Helper function to sort machines by number properly
function sortMachinesByNumber(machines) {
  return machines.sort((a, b) => {
    const aNum = parseInt(a.machine_no.replace(/[^0-9]/g, '')) || 0;
    const bNum = parseInt(b.machine_no.replace(/[^0-9]/g, '')) || 0;
    
    // First compare numeric part
    if (aNum !== bNum) {
      return aNum - bNum;
    }
    
    // If same number, pure numbers come before alphanumeric (1 before 1A)
    const aHasLetter = /[A-Za-z]/.test(a.machine_no);
    const bHasLetter = /[A-Za-z]/.test(b.machine_no);
    
    if (!aHasLetter && bHasLetter) return -1;
    if (aHasLetter && !bHasLetter) return 1;
    
    // Both have letters or both don't - sort alphabetically
    return a.machine_no.localeCompare(b.machine_no);
  });
}

// Create new spinning machine
export async function createSpinningMachine(machineData) {
  try {
    const { machineFields, setupFields } = cleanSpinningMachineInput(machineData, { creating: true });

    return await prisma.$transaction(async transaction => {
      const duplicates = await findMachineNumberDuplicates(
        transaction,
        machineFields.machine_no,
      );
      const activeDuplicate = duplicates.find(machine => machine.is_active);
      if (activeDuplicate) {
        throw new Error(`Machine ${machineFields.machine_no} already exists and is active`);
      }

      const maxSortResult = await transaction.spinning_machines.aggregate({ _max: { sort_order: true } });
      const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;
      const now = new Date();
      const isActive = machineFields.is_active !== false;
      const machine = await transaction.spinning_machines.create({
        data: {
          ...machineFields,
          is_active: isActive,
          activated_at: isActive ? now : null,
          deactivated_at: isActive ? null : now,
          sort_order: nextSortOrder,
          updated_at: now,
        }
      });
      await upsertDefaultSpinningSetup(machine.id, {
        ...setupFields,
        allocated_spindles: machineFields.allocated_spindles,
      }, transaction);
      return machine;
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    console.error('Prisma error creating spinning machine:', error);
    throw new Error(error.message || 'Failed to create spinning machine');
  }
}

// Update spinning machine
export async function updateSpinningMachine(id, machineData) {
  if (!id) throw new Error('Machine ID is required');
  // Extract setup-specific fields — they don't exist as columns in spinning_machines
  const { machineFields, setupFields } = cleanSpinningMachineInput(machineData);

  return prisma.$transaction(async transaction => {
    const existing = await transaction.spinning_machines.findUnique({
      where: { id },
      select: { id: true, machine_no: true, is_active: true },
    });
    if (!existing) throw new Error('Spinning machine not found');

    if (machineFields.machine_no && machineFields.machine_no !== existing.machine_no) {
      throw new Error('Machine number is an immutable lifecycle key and cannot be changed');
    }
    if (!existing.is_active && machineFields.is_active === true) {
      throw lifecycleReactivationError();
    }

    const now = new Date();
    const isDeactivating = existing.is_active !== false && machineFields.is_active === false;
    const data = await transaction.spinning_machines.update({
      where: { id },
      data: {
        ...machineFields,
        updated_at: now,
        ...(isDeactivating ? { deactivated_at: now } : {}),
      }
    });
    await upsertDefaultSpinningSetup(id, {
      ...setupFields,
      ...(machineFields.allocated_spindles !== undefined
        ? { allocated_spindles: machineFields.allocated_spindles }
        : {}),
    }, transaction);
    return data;
  });
}

// Get spinning machine with its setup data (for the edit form)
export async function getSpinningMachineWithSetup(id) {
  const machine = await prisma.spinning_machines.findUnique({ where: { id } });
  if (!machine) return null;

  const setup = await prisma.spinning_machine_setup.findFirst({
    where: { 
      machine_id: id,
      entry_date: new Date('2026-04-01'),
      shift: 1
    }
  });

  return {
    ...machine,
    count_name: setup?.count_name || null,
    act_count: setup?.act_count != null ? parseFloat(setup.act_count) : null,
    tpi: setup?.tpi != null ? parseFloat(setup.tpi) : null,
    speed: setup?.speed ?? null,
  };
}

// Activate (reactivate) a spinning machine
export async function activateSpinningMachine(id) {
  if (!id) throw new Error('Machine ID is required');
  return prisma.$transaction(async transaction => {
    const existing = await transaction.spinning_machines.findUnique({ where: { id } });
    if (!existing) throw new Error('Spinning machine not found');
    if (existing.is_active) return existing;

    const duplicates = await findMachineNumberDuplicates(transaction, existing.machine_no, id);
    if (duplicates.some(machine => machine.is_active)) {
      throw new Error(`Machine ${existing.machine_no} already exists and is active`);
    }

    const maxSortResult = await transaction.spinning_machines.aggregate({ _max: { sort_order: true } });
    const historicalId = existing.id;
    const copy = {
      machine_no: existing.machine_no,
      description: existing.description,
      make_name: existing.make_name,
      allocated_spindles: existing.allocated_spindles,
      remarks: existing.remarks,
      frame_no: existing.frame_no,
      mc_id: existing.mc_id,
      model: existing.model,
      group_no: existing.group_no,
      installed_date: existing.installed_date,
      production_kgs_manual_entry: existing.production_kgs_manual_entry,
      direct_hank_entry: existing.direct_hank_entry,
    };
    const now = new Date();
    const machine = await transaction.spinning_machines.create({
      data: {
        ...copy,
        is_active: true,
        activated_at: now,
        deactivated_at: null,
        sort_order: (maxSortResult._max.sort_order ?? 0) + 1,
        created_at: now,
        updated_at: now,
      }
    });

    const baseline = await transaction.spinning_machine_setup.findFirst({
      where: { machine_id: historicalId },
      orderBy: [{ entry_date: 'desc' }, { shift: 'desc' }],
    });
    if (baseline) {
      await upsertDefaultSpinningSetup(machine.id, {
        speed: baseline.speed,
        count_name: baseline.count_name,
        act_count: baseline.act_count,
        tpi: baseline.tpi,
        allocated_spindles: baseline.allocated_spindles,
      }, transaction);
    }
    return machine;
  }, { isolationLevel: 'Serializable' });
}

// Delete spinning machine
export async function deleteSpinningMachine(id) {
  return deleteUnusedMachine({
    id,
    machineModel: 'spinning_machines',
    setupModel: 'spinning_machine_setup',
    productionDetailModel: 'spinning_production_detail',
    label: 'spinning machine'
  });
}

// Search spinning machines
export async function searchSpinningMachines(field, condition, value) {
  const allowedFields = new Set(['machine_no', 'description', 'make_name']);
  const allowedConditions = new Set(['Like', 'Equal', 'Not Equal', 'Greater', 'Less']);
  if (!allowedFields.has(field)) throw new Error('Unsupported spinning machine search field');
  if (!allowedConditions.has(condition)) throw new Error('Unsupported spinning machine search condition');
  let whereClause = {};

  const trimmedValue = String(value ?? '').trim();
  if (trimmedValue !== '') {
    switch (condition) {
      case 'Like':
        whereClause[field] = { contains: trimmedValue };
        break;
      case 'Equal':
        whereClause[field] = trimmedValue;
        break;
      case 'Not Equal':
        whereClause[field] = { not: trimmedValue };
        break;
      case 'Greater':
        whereClause[field] = { gt: trimmedValue };
        break;
      case 'Less':
        whereClause[field] = { lt: trimmedValue };
        break;
    }
  }
  
  const data = await prisma.spinning_machines.findMany({
    where: whereClause
  });
  
  // Apply proper numeric sorting
  return sortMachinesByNumber(data || []);
}
