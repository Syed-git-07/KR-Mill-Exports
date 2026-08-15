import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';

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
  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Ensure mc_id is a valid number
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;

  // If a machine with the same machine_no exists (inactive), reactivate it
  const existing = await prisma.carding_machines.findFirst({
    where: { machine_no: machineData.machine_no }
  });
  if (existing) {
    if (!existing.is_active) {
      return await prisma.carding_machines.update({
        where: { id: existing.id },
        data: {
          machine_no: machineData.machine_no,
          mc_id: mcId,
          description: machineData.description,
          make_name: machineData.make_name,
          model: machineData.model,
          prodn_mixing: machineData.prodn_mixing,
          speed: machineData.speed,
          prodn_efficiency: machineData.prodn_effi,
          installed_date: installedDate,
          is_active: true,
          direct_hank_entry: machineData.direct_hank_entry ?? false,
          direct_kgs_entry: machineData.direct_kgs_entry ?? false,
          activated_at: new Date(),
          deactivated_at: null,
        }
      });
    } else {
      throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
    }
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
  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  const currentMachine = await prisma.carding_machines.findUnique({
    where: { id },
    select: { is_active: true }
  });

  const isActivating = (machineData.is_active === true || machineData.is_active === 1)
    && currentMachine?.is_active !== true;
  const isDeactivating = (machineData.is_active === false || machineData.is_active === 0)
    && currentMachine?.is_active !== false;

  // Keep only the undated master setup template in sync. Dated setup rows are
  // entry snapshots and must never be rewritten by a later master change.
  const templateUpdates = {};
  if (machineData.speed !== undefined) templateUpdates.speed = machineData.speed;
  if (machineData.hank_constant !== undefined) templateUpdates.hank_constant = machineData.hank_constant;
  if (machineData.prodn_effi !== undefined && machineData.prodn_effi !== null && machineData.prodn_effi !== '') {
    const efficiency = Number(machineData.prodn_effi);
    if (Number.isFinite(efficiency)) {
      templateUpdates.std_efficiency_factor = efficiency > 1 ? efficiency / 100 : efficiency;
    }
  }
  return prisma.$transaction(async (tx) => {
    const data = await tx.carding_machines.update({
      where: { id },
      data: {
        machine_no: machineData.machine_no,
        description: machineData.description,
        make_name: machineData.make_name,
        model: machineData.model,
        prodn_mixing: machineData.prodn_mixing,
        speed: machineData.speed,
        prodn_efficiency: machineData.prodn_effi,
        hank_constant: machineData.hank_constant != null ? machineData.hank_constant : undefined,
        installed_date: installedDate,
        ...(machineData.is_active !== undefined && { is_active: machineData.is_active }),
        ...(machineData.mc_id !== undefined && machineData.mc_id !== null && { mc_id: parseInt(machineData.mc_id, 10) }),
        direct_hank_entry: machineData.direct_hank_entry,
        direct_kgs_entry: machineData.direct_kgs_entry,
        updated_at: new Date(),
        ...(isActivating && { activated_at: new Date(), deactivated_at: null }),
        ...(isDeactivating && { deactivated_at: new Date() }),
      }
    });

    if (Object.keys(templateUpdates).length > 0) {
      await tx.carding_machine_setup.updateMany({
        where: {
          machine_id: id,
          entry_date: new Date('1970-01-01T00:00:00.000Z'),
          shift: 1
        },
        data: templateUpdates
      });
    }

    return data;
  });
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
  await prisma.carding_machines.delete({
    where: { id }
  });
  
  return true;
}

// Search carding machines
export async function searchCardingMachines(field, condition, value) {
  const whereClause = buildTypedSearchWhere(field, condition, value, {
    machine_no: 'text', description: 'text', model: 'text'
  });

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
