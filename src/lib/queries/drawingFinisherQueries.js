import { prisma } from '../prisma';

/**
 * Drawing Finisher Machine Master - CRUD Operations
 * Following the pattern from Department queries
 * Same structure as Drawing Breaker (NO mc_effi field)
 */

function sortDrawingFinisherMachines(machines) {
  const sortedByNumber = (machines || []).sort((a, b) => {
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  });

  return sortedByNumber.sort((a, b) => {
    if (a.is_active === b.is_active) return 0;
    return a.is_active ? -1 : 1;
  });
}

// Get all drawing finisher machines (active + inactive)
export async function getDrawingFinisherMachines() {
  const data = await prisma.drawing_finisher_machines.findMany({});
  return sortDrawingFinisherMachines(data);
}

// Get a single drawing finisher machine by ID
export async function getDrawingFinisherMachineById(id) {
  const data = await prisma.drawing_finisher_machines.findUnique({
    where: { id }
  });
  return data;
}

// Create a new drawing finisher machine
export async function createDrawingFinisherMachine(machineData) {
  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Reactivate if inactive machine with same machine_no exists
  const existing = await prisma.drawing_finisher_machines.findFirst({
    where: { machine_no: machineData.machine_no }
  });
  if (existing) {
    if (!existing.is_active) {
      return prisma.drawing_finisher_machines.update({
        where: { id: existing.id },
        data: {
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
          activated_at: installedDate || new Date(),
          deactivated_at: null,
        }
      });
    } else {
      throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
    }
  }

  // Fetch max sort_order so new machine goes to the end
  const maxSortResult = await prisma.drawing_finisher_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

  const data = await prisma.drawing_finisher_machines.create({
    data: {
      machine_no: machineData.machine_no,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
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

// Update an existing drawing finisher machine
export async function updateDrawingFinisherMachine(id, machineData) {
  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  const processedData = {
    machine_no: machineData.machine_no,
    description: machineData.description,
    make_name: machineData.make_name,
    model: machineData.model,
    prodn_mixing: machineData.prodn_mixing,
    speed: machineData.speed,
    prodn_efficiency: machineData.prodn_effi,
    installed_date: installedDate,
    is_active: machineData.is_active,
    direct_hank_entry: machineData.direct_hank_entry,
    direct_kgs_entry: machineData.direct_kgs_entry,
    updated_at: new Date(),
  };

  if (machineData.is_active === true) {
    processedData.activated_at = new Date();
    processedData.deactivated_at = null;
  } else if (machineData.is_active === false) {
    processedData.deactivated_at = new Date();
  }

  const data = await prisma.drawing_finisher_machines.update({
    where: { id },
    data: processedData
  });
  return data;
}

// Delete a drawing finisher machine
export async function deleteDrawingFinisherMachine(id) {
  await prisma.drawing_finisher_machines.delete({
    where: { id }
  });
  return true;
}

// Search drawing finisher machines (active + inactive)
export async function searchDrawingFinisherMachines(field, condition, value) {
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

  const data = await prisma.drawing_finisher_machines.findMany({
    where
  });

  return sortDrawingFinisherMachines(data);
}

// Get active drawing finisher machines only
export async function getActiveDrawingFinisherMachines() {
  const data = await prisma.drawing_finisher_machines.findMany({
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
