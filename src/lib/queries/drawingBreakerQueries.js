import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';
import { machineLookupWhere, machineRemovalDate } from '../machineLifecycle';

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
export async function lookupDrawingBreakerMachineByNo(machineNo, entryDate = null) {
  const machine = await prisma.drawing_breaker_machines.findFirst({
    where: machineLookupWhere(machineNo, entryDate),
    orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }]
  });
  if (!machine) return null;

  return {
    ...machine,
    delivery: machine.delivery ?? null,
    sliver_hank: machine.sliver_hank != null ? parseFloat(machine.sliver_hank) : null,
    std_efficiency_factor: machine.prodn_efficiency != null
      ? (Number(machine.prodn_efficiency) > 1 ? Number(machine.prodn_efficiency) / 100 : Number(machine.prodn_efficiency))
      : null,
    setup_hank_constant: machine.sliver_hank != null ? parseFloat(machine.sliver_hank) : null,
    has_setup: false,
  };
}

// Create a new drawing breaker machine
export async function createDrawingBreakerMachine(machineData) {
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Removed rows are immutable history. A reused number creates a new record.
  const existing = await prisma.drawing_breaker_machines.findFirst({
    where: { machine_no: machineData.machine_no, is_active: true }
  });
  if (existing) {
    if (!existing.is_active) {
      return prisma.$transaction(async (tx) => {
        const reactivated = await tx.drawing_breaker_machines.update({
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

        // Reactivation must never erase dated historical setup snapshots. Remove
        // only the legacy template row so master-side reactivation does not
        // automatically enroll the machine in a new setup.
        await tx.breaker_drawing_machine_setup.deleteMany({
          where: {
            machine_id: existing.id,
            entry_date: new Date('1970-01-01T00:00:00.000Z'),
            shift: 1
          }
        });

        return reactivated;
      });
    } else {
      throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
    }
  }

  // Fetch max sort_order so new machine goes to the end
  const maxSortResult = await prisma.drawing_breaker_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    const created = await tx.drawing_breaker_machines.create({
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
    });

    // A legacy database trigger may create one baseline setup row. Delete only
    // that row; dated setup history must never be removed from a master action.
    await tx.breaker_drawing_machine_setup.deleteMany({
      where: {
        machine_id: created.id,
        entry_date: new Date('1970-01-01T00:00:00.000Z'),
        shift: 1
      }
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

  const currentMachine = await prisma.drawing_breaker_machines.findUnique({ where: { id }, select: { is_active: true } });
  if (currentMachine?.is_active === false) throw new Error('Removed machines cannot be changed or restored');
  const wantsActive = machineData.is_active === true || machineData.is_active === 1;
  const wantsInactive = machineData.is_active === false || machineData.is_active === 0;
  const isActivating = wantsActive && currentMachine?.is_active !== true;
  const isDeactivating = wantsInactive && currentMachine?.is_active !== false;

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
      ...(isActivating && { activated_at: new Date(), deactivated_at: null }),
      ...(isDeactivating && { deactivated_at: machineRemovalDate() }),
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
  const where = buildTypedSearchWhere(field, condition, value, {
    machine_no: 'text', description: 'text', make_name: 'text'
  });

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

