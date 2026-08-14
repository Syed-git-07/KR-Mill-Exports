import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';

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

  // Fetch max sort_order for new machine
  const maxSortResult = await prisma.comber_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

  const data = await prisma.comber_machines.create({
    data: {
      machine_no: machineData.machine_no,
      ...(machineData.mc_id !== undefined && machineData.mc_id !== null && {
        mc_id: parseInt(machineData.mc_id, 10)
      }),
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

  // Older Comber headers may not yet have their own dated setup row. Capture
  // the pre-update template for those existing entries before changing master
  // data, so a later read can never materialize them from the new master.
  const [currentMachine, templateSetup, existingDetails, headers] = await Promise.all([
    prisma.comber_machines.findUnique({ where: { id }, select: { is_active: true } }),
    prisma.comber_machine_setup.findFirst({
      where: {
        machine_id: id,
        entry_date: new Date('1970-01-01T00:00:00.000Z'),
        shift: 1
      }
    }),
    prisma.comber_production_detail.findMany({
      where: { machine_id: id },
      select: { header_id: true }
    }),
    prisma.comber_production_header.findMany({
      select: { id: true, entry_date: true, shift: true }
    })
  ]);

  let missingSnapshots = [];
  if (templateSetup && existingDetails.length > 0) {
    const headerIds = new Set(existingDetails.map(detail => detail.header_id));
    const snapshotHeaders = headers.filter(header => headerIds.has(header.id));
    const existingSnapshots = await prisma.comber_machine_setup.findMany({
      where: {
        machine_id: id,
        OR: snapshotHeaders.map(header => ({
          entry_date: header.entry_date,
          shift: Number(header.shift)
        }))
      },
      select: { entry_date: true, shift: true }
    });
    const existingSnapshotKeys = new Set(
      existingSnapshots.map(setup => `${setup.entry_date.toISOString()}-${setup.shift}`)
    );
    const { id: setupId, created_at, updated_at, entry_date, shift, ...templateValues } = templateSetup;
    missingSnapshots = snapshotHeaders
      .filter(header => !existingSnapshotKeys.has(`${header.entry_date.toISOString()}-${Number(header.shift)}`))
      .map(header => ({
        ...templateValues,
        entry_date: header.entry_date,
        shift: Number(header.shift)
      }));
  }

  // Handle activation/deactivation timestamps
  const timestampData = {};
  if (machineData.is_active === true && currentMachine?.is_active !== true) {
    timestampData.activated_at = new Date();
    timestampData.deactivated_at = null;
  } else if (machineData.is_active === false && currentMachine?.is_active !== false) {
    timestampData.deactivated_at = new Date();
  }

  // Update only the undated master setup template. Dated rows belong to
  // already-created production entries and must remain historical snapshots.
  const templateUpdates = {};
  if (machineData.speed !== undefined) templateUpdates.speed = machineData.speed;
  if (machineData.prodn_mixing !== undefined) templateUpdates.prodn_mixing = machineData.prodn_mixing;
  if (machineData.sliver_hank !== undefined) templateUpdates.sl_hank = machineData.sliver_hank;
  if (machineData.mc_effi !== undefined) templateUpdates.mc_effi = machineData.mc_effi;
  return prisma.$transaction(async (tx) => {
    if (missingSnapshots.length > 0) {
      await tx.comber_machine_setup.createMany({
        data: missingSnapshots,
        skipDuplicates: true
      });
    }

    const data = await tx.comber_machines.update({
      where: { id },
      data: {
        machine_no: machineData.machine_no,
        ...(machineData.mc_id !== undefined && machineData.mc_id !== null && {
          mc_id: parseInt(machineData.mc_id, 10)
        }),
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

    if (Object.keys(templateUpdates).length > 0) {
      await tx.comber_machine_setup.updateMany({
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

// Delete a comber machine
export async function deleteComberMachine(id) {
  await prisma.comber_machines.delete({
    where: { id }
  });
  return true;
}

// Search comber machines (all machines)
export async function searchComberMachines(field, condition, value) {
  const where = buildTypedSearchWhere(field, condition, value, {
    machine_no: 'text', description: 'text', make_name: 'text', prodn_mixing: 'text'
  });

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
