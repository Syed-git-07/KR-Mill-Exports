import { prisma } from '../prisma';
import { deleteUnusedMachine } from './machineDeletion';
import { buildMachineLifecycleUpdate, normalizeMachineMasterData } from './machineMasterValidation';

const CARDING_MASTER_NUMBERS = {
  speed: { label: 'Speed', required: true, max: 1000000 },
  prodn_effi: { label: 'Production efficiency', required: true, max: 100 },
  hank_constant: { label: 'Hank constant', max: 1000 },
  mc_id: { label: 'Machine id number', max: 1000000, integer: true }
};

/**
 * Carding Machine Master - CRUD Operations
 * Following the pattern from Department queries
 */

// Get all carding machines — active first, inactive at bottom (shown in red in UI)
export async function getCardingMachines() {
  const data = await prisma.carding_machines.findMany({});
  const byNumber = (data || []).sort((a, b) => {
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  });
  return byNumber.sort((a, b) => {
    if (a.is_active === b.is_active) return 0;
    return a.is_active ? -1 : 1;
  });
}

// Get a single carding machine by ID
export async function getCardingMachineById(id) {
  const data = await prisma.carding_machines.findUnique({
    where: { id }
  });
  
  return data;
}

// Create a new carding machine
export async function createCardingMachine(machineData) {
  machineData = normalizeMachineMasterData(machineData, CARDING_MASTER_NUMBERS);
  const installedDate = machineData.installed_date;

  // Ensure mc_id is a valid number
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;

  // A reused number starts a new lifecycle row; historical rows stay immutable.
  const existing = await prisma.carding_machines.findFirst({
    where: { machine_no: machineData.machine_no, is_active: true }
  });
  if (existing) {
    throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
  }

  // Fetch max sort_order so new machine goes to the end
  const maxSortResult = await prisma.carding_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

  const data = await prisma.carding_machines.create({
    data: {
      machine_no: machineData.machine_no,
      mc_id: mcId,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      hank_constant: machineData.hank_constant != null ? machineData.hank_constant : null,
      installed_date: installedDate,
      is_active: machineData.is_active ?? true,
      direct_hank_entry: machineData.direct_hank_entry ?? false,
      direct_kgs_entry: machineData.direct_kgs_entry ?? false,
      activated_at: new Date(),
      sort_order: nextSortOrder,
    }
  });
  
  return data;
}

// Update an existing carding machine
export async function updateCardingMachine(id, machineData) {
  machineData = normalizeMachineMasterData(machineData, CARDING_MASTER_NUMBERS);
  const installedDate = machineData.installed_date;
  const existing = await prisma.carding_machines.findUnique({ where: { id }, select: { is_active: true } });
  if (!existing) throw new Error('Carding machine not found');
  const duplicate = await prisma.carding_machines.findFirst({
    where: { id: { not: id }, machine_no: machineData.machine_no, is_active: true },
    select: { id: true }
  });
  if (duplicate) throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
  const lifecycleUpdate = buildMachineLifecycleUpdate(existing.is_active, machineData.is_active);

  // Ensure mc_id is a valid number
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;

  const data = await prisma.carding_machines.update({
    where: { id },
    data: {
      machine_no: machineData.machine_no,
      mc_id: mcId,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      hank_constant: machineData.hank_constant != null ? machineData.hank_constant : undefined,
      installed_date: installedDate,
      // Only update is_active / mc_id if explicitly provided (undefined = preserve existing)
      ...lifecycleUpdate,
      ...(machineData.mc_id !== undefined && machineData.mc_id !== null && { mc_id: parseInt(machineData.mc_id, 10) }),
      direct_hank_entry: machineData.direct_hank_entry,
      direct_kgs_entry: machineData.direct_kgs_entry,
      updated_at: new Date(),
    }
  });
  
  return data;
}

// Get count options from spinning_counts for the machine master form
export async function getCardingCountOptions() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: { id: true, count_name: true, act_count: true, sliver_hank: true },
      orderBy: { count_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Delete a carding machine
export async function deleteCardingMachine(id) {
  return deleteUnusedMachine({
    id,
    machineModel: 'carding_machines',
    setupModel: 'carding_machine_setup',
    productionDetailModel: 'carding_production_detail',
    label: 'carding machine'
  });
}

// Search carding machines
export async function searchCardingMachines(field, condition, value) {
  let whereClause = {};

  // Apply search condition based on field and condition type
  // MySQL is case-insensitive by default, no need for mode option
  switch (condition) {
    case 'contains':
      whereClause[field] = { contains: value };
      break;
    case 'equals':
      whereClause[field] = value;
      break;
    case 'startsWith':
      whereClause[field] = { startsWith: value };
      break;
    case 'endsWith':
      whereClause[field] = { endsWith: value };
      break;
    default:
      whereClause[field] = { contains: value };
  }

  const data = await prisma.carding_machines.findMany({
    where: whereClause,
    orderBy: { mc_id: 'asc' }
  });

  // Sort by natural machine number order (CA-1, CA-2, ... CA-10, CA-11, ... CA-22)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];
}

// Get active carding machines only
export async function getActiveCardingMachines() {
  const data = await prisma.carding_machines.findMany({
    where: { is_active: true },
    orderBy: { mc_id: 'asc' }
  });
  
  // Sort by natural machine number order (CA-1, CA-2, ... CA-10, CA-11, ... CA-22)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];
}

// Check if machine_no exists (for validation)
export async function checkMachineNoExists(machineNo, excludeId = null) {
  const whereClause = { machine_no: machineNo };
  
  if (excludeId) {
    whereClause.id = { not: excludeId };
  }

  const data = await prisma.carding_machines.findMany({
    where: whereClause,
    select: { id: true }
  });
  
  return data && data.length > 0;
}
