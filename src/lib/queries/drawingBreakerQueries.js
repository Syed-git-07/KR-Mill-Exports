import { prisma } from '../prisma';

/**
 * Drawing Breaker Machine Master - CRUD Operations
 */

// Sort helper: natural order by numeric part of machine_no, active first
function sortMachines(data) {
  return (data || [])
    .sort((a, b) => {
      const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
      const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
      return aNum - bNum;
    })
    .sort((a, b) => {
      if (a.is_active === b.is_active) return 0;
      return a.is_active ? -1 : 1;
    });
}

// Get all drawing breaker machines — active first, inactive at bottom (shown in red)
export async function getDrawingBreakerMachines() {
  const data = await prisma.drawing_breaker_machines.findMany({});
  return sortMachines(data);
}

// Get a single drawing breaker machine by ID
export async function getDrawingBreakerMachineById(id) {
  return prisma.drawing_breaker_machines.findUnique({ where: { id } });
}

// Look up a machine by machine_no (for setup tab auto-fill)
export async function lookupDrawingBreakerMachineByNo(machineNo) {
  const machine = await prisma.drawing_breaker_machines.findFirst({
    where: { machine_no: { equals: machineNo } }
  });
  if (!machine) return null;

  // Check if already in setup
  const setup = await prisma.breaker_drawing_machine_setup.findFirst({
    where: { machine_id: machine.id }
  });

  return {
    ...machine,
    delivery: machine.delivery ?? null,
    sliver_hank: machine.sliver_hank != null ? parseFloat(machine.sliver_hank) : null,
    std_efficiency_factor: setup?.std_efficiency_factor != null ? parseFloat(setup.std_efficiency_factor) : null,
    // Also return setup's hank_constant so form can pre-fill for deactivated machines
    setup_hank_constant: setup?.hank_constant != null ? parseFloat(setup.hank_constant) : null,
    has_setup: !!setup,
  };
}

// Create a new drawing breaker machine
export async function createDrawingBreakerMachine(machineData) {
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Reactivate if inactive machine with same machine_no exists
  const existing = await prisma.drawing_breaker_machines.findFirst({
    where: { machine_no: machineData.machine_no }
  });
  if (existing) {
    if (!existing.is_active) {
      const reactivated = await prisma.drawing_breaker_machines.update({
        where: { id: existing.id },
        data: {
          description: machineData.description,
          make_name: machineData.make_name,
          model: machineData.model,
          prodn_mixing: machineData.prodn_mixing,
          speed: machineData.speed,
          delivery: machineData.delivery ?? null,
          sliver_hank: machineData.sliver_hank != null ? machineData.sliver_hank : null,
          prodn_efficiency: machineData.prodn_effi,
          installed_date: installedDate,
          is_active: true,
          direct_hank_entry: machineData.direct_hank_entry ?? false,
          direct_kgs_entry: machineData.direct_kgs_entry ?? false,
          activated_at: installedDate || new Date(),
          deactivated_at: null,
        }
      });

      // Keep master-side behavior aligned with spinning:
      // reactivating from master must not auto-enroll in Machine Setup.
      await prisma.breaker_drawing_machine_setup.deleteMany({
        where: { machine_id: existing.id }
      });

      return reactivated;
    } else {
      throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
    }
  }

  // Fetch max sort_order so new machine goes to the end
  const maxSortResult = await prisma.drawing_breaker_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

  return prisma.drawing_breaker_machines.create({
    data: {
      machine_no: machineData.machine_no,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      delivery: machineData.delivery ?? null,
      sliver_hank: machineData.sliver_hank != null ? machineData.sliver_hank : null,
      prodn_efficiency: machineData.prodn_effi,
      installed_date: installedDate,
      is_active: machineData.is_active ?? true,
      direct_hank_entry: machineData.direct_hank_entry ?? false,
      direct_kgs_entry: machineData.direct_kgs_entry ?? false,
      activated_at: new Date(),
      sort_order: nextSortOrder,
    }
  }).then(async (created) => {
    // Important: master-side creation must NOT auto-enroll the machine into setup.
    // If a DB trigger auto-creates breaker_drawing_machine_setup, remove it here.
    await prisma.breaker_drawing_machine_setup.deleteMany({
      where: { machine_id: created.id }
    });
    return created;
  });
}

// Update an existing drawing breaker machine
export async function updateDrawingBreakerMachine(id, machineData) {
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  return prisma.drawing_breaker_machines.update({
    where: { id },
    data: {
      machine_no: machineData.machine_no,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      delivery: machineData.delivery ?? null,
      sliver_hank: machineData.sliver_hank != null ? machineData.sliver_hank : null,
      prodn_efficiency: machineData.prodn_effi,
      installed_date: installedDate,
      ...(machineData.is_active !== undefined && { is_active: machineData.is_active }),
      direct_hank_entry: machineData.direct_hank_entry,
      direct_kgs_entry: machineData.direct_kgs_entry,
      updated_at: new Date(),
      ...((machineData.is_active === true  || machineData.is_active === 1)  && { activated_at: new Date(), deactivated_at: null }),
      ...((machineData.is_active === false || machineData.is_active === 0) && { deactivated_at: new Date() }),
    }
  });
}

// Delete a drawing breaker machine
export async function deleteDrawingBreakerMachine(id) {
  await prisma.drawing_breaker_machines.delete({ where: { id } });
  return true;
}

// Search drawing breaker machines (all, no is_active filter)
export async function searchDrawingBreakerMachines(field, condition, value) {
  let where = {};

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

  const data = await prisma.drawing_breaker_machines.findMany({ where });
  return sortMachines(data);
}

// Get active drawing breaker machines only (used by production entry screens)
export async function getActiveDrawingBreakerMachines() {
  const data = await prisma.drawing_breaker_machines.findMany({
    where: { is_active: true }
  });
  return sortMachines(data);
}

// Get count options from spinning_counts (for the Count field in machine form)
export async function getDrawingBreakerCountOptions() {
  const data = await prisma.spinning_counts.findMany({
    where: { is_active: true },
    select: { id: true, count_name: true, act_count: true, sliver_hank: true },
    orderBy: { count_name: 'asc' }
  });
  return data || [];
}

