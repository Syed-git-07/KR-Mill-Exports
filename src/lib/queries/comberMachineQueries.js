import { prisma } from '../prisma';

/**
 * Comber Machine Master - CRUD Operations
 * Following the pattern from Department queries
 * NOTE: Comber has additional mc_effi field (Machine Efficiency)
 */

// Get all comber machines (active first, then inactive, sorted by machine number)
export async function getComberMachines() {
  const data = await prisma.comber_machines.findMany({});

  // Sort: active first, then by natural machine number order
  return data?.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];
}

// Get a single comber machine by ID
export async function getComberMachineById(id) {
  const data = await prisma.comber_machines.findUnique({
    where: { id }
  });
  return data;
}

// Create a new comber machine
export async function createComberMachine(machineData) {
  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Ensure mc_id is a valid number
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;

  // Fetch max sort_order for new machine
  const maxSortResult = await prisma.comber_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

  const data = await prisma.comber_machines.create({
    data: {
      machine_no: machineData.machine_no,
      mc_id: mcId,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      sliver_hank: machineData.sliver_hank ?? null,
      mc_effi: machineData.mc_effi,
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

// Update an existing comber machine
export async function updateComberMachine(id, machineData) {
  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Ensure mc_id is a valid number
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;

  // Handle activation/deactivation timestamps
  const timestampData = {};
  if (machineData.is_active === true) {
    timestampData.activated_at = new Date();
    timestampData.deactivated_at = null;
  } else if (machineData.is_active === false) {
    timestampData.deactivated_at = new Date();
  }

  const data = await prisma.comber_machines.update({
    where: { id },
    data: {
      machine_no: machineData.machine_no,
      mc_id: mcId,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      sliver_hank: machineData.sliver_hank ?? null,
      mc_effi: machineData.mc_effi,
      installed_date: installedDate,
      is_active: machineData.is_active,
      direct_hank_entry: machineData.direct_hank_entry,
      direct_kgs_entry: machineData.direct_kgs_entry,
      ...timestampData,
      updated_at: new Date(),
    }
  });
  return data;
}

// Delete a comber machine
export async function deleteComberMachine(id) {
  await prisma.comber_machines.delete({
    where: { id }
  });
  return true;
}

// Search comber machines (all machines)
export async function searchComberMachines(field, condition, value) {
  let where = {};

  // Apply search condition based on field and condition type
  // MySQL is case-insensitive by default
  switch (condition) {
    case 'contains':
      where[field] = { contains: value };
      break;
    case 'equals':
      where[field] = value;
      break;
    case 'startsWith':
      where[field] = { startsWith: value };
      break;
    case 'endsWith':
      where[field] = { endsWith: value };
      break;
    default:
      where[field] = { contains: value };
  }

  const data = await prisma.comber_machines.findMany({
    where,
    orderBy: { mc_id: 'asc' }
  });

  // Sort by natural machine number order
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];
}

// Lookup a single comber machine by machine_no (for setup tab auto-fill)
export async function lookupComberMachineByNo(machineNo) {
  const machine = await prisma.comber_machines.findFirst({
    where: { machine_no: machineNo }
  });
  if (!machine) return null;

  const setup = await prisma.comber_machine_setup.findFirst({
    where: { machine_id: machine.id }
  });

  return {
    ...machine,
    sl_hank: setup?.sl_hank ?? machine.sliver_hank ?? null,
    mc_effi: machine.mc_effi ?? setup?.mc_effi ?? null,
    prodn_mixing: machine.prodn_mixing ?? setup?.prodn_mixing ?? null,
    has_setup: !!setup,
  };
}

// Get count options for comber
export async function getComberCountOptions() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: { id: true, count_name: true, act_count: true, sliver_hank: true },
      orderBy: { count_name: 'asc' }
    });
    return data || [];
  } catch (error) {
    throw error;
  }
}

// Get active comber machines only
export async function getActiveComberMachines() {
  const data = await prisma.comber_machines.findMany({
    where: { is_active: true },
    orderBy: { mc_id: 'asc' }
  });
  
  // Sort by natural machine number order
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];
}
