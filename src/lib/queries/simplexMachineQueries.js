import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';
import { machineRemovalDate } from '../machineLifecycle';

function parseCountTpi(tpiValue) {
  if (tpiValue == null) return null;
  const match = String(tpiValue).match(/\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Simplex Machine Master - CRUD Operations
 * Following the pattern from Department queries
 * NOTE: Simplex has 3 additional fields: mc_effi, tpi, no_of_spindles
 */

// Get all simplex machines (active first, then inactive)
export async function getSimplexMachines() {
  const data = await prisma.simplex_machines.findMany({});
  
  // Sort by natural machine number order (SF-1, SF-2, ... SF-10, SF-11)
  const byNumber = data?.sort((a, b) => {
    const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];

  return byNumber.sort((a, b) => {
    if (a.is_active === b.is_active) return 0;
    return a.is_active ? -1 : 1;
  });
}

// Get a single simplex machine by ID
export async function getSimplexMachineById(id) {
  const data = await prisma.simplex_machines.findUnique({
    where: { id }
  });
  return data;
}

// Create a new simplex machine
export async function createSimplexMachine(machineData) {
  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Ensure mc_id is a valid number
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;
  const parsedCountTpi = parseCountTpi(machineData.count_tpi);
  const effectiveTpi = machineData.tpi ?? parsedCountTpi;

  const existing = await prisma.simplex_machines.findFirst({
    where: { machine_no: machineData.machine_no, is_active: true }
  });

  if (existing) {
    throw new Error(`Machine ${machineData.machine_no} already exists and is available`);
  }

  const maxSortResult = await prisma.simplex_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

  const data = await prisma.simplex_machines.create({
    data: {
      machine_no: machineData.machine_no,
      mc_id: mcId,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      mc_effi: machineData.mc_effi,
      tpi: effectiveTpi,
      no_of_spindles: machineData.no_of_spindles, // Number of Spindles (NEW)
      installed_date: installedDate,
      is_active: machineData.is_active ?? true,
      activated_at: new Date(),
      sort_order: nextSortOrder,
      direct_hank_entry: machineData.direct_hank_entry ?? false,
      direct_kgs_entry: machineData.direct_kgs_entry ?? false,
    }
  });
  return data;
}

// Update an existing simplex machine
export async function updateSimplexMachine(id, machineData) {
  const hasField = (field) => Object.hasOwn(machineData, field);

  // Convert date string to Date object if needed
  let installedDate = machineData.installed_date;
  if (installedDate && typeof installedDate === 'string') {
    installedDate = new Date(installedDate);
  }

  // Ensure mc_id is a valid number
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;
  const parsedCountTpi = parseCountTpi(machineData.count_tpi);
  const effectiveTpi = machineData.tpi ?? parsedCountTpi;
  const shouldUpdateTpi = hasField('tpi') || hasField('count_tpi');

  const currentMachine = await prisma.simplex_machines.findUnique({ where: { id }, select: { is_active: true } });
  if (currentMachine?.is_active === false) throw new Error('Removed machines cannot be changed or restored');
  const isActivating = machineData.is_active === true && currentMachine?.is_active !== true;
  const isDeactivating = machineData.is_active === false && currentMachine?.is_active !== false;

  const data = await prisma.simplex_machines.update({
    where: { id },
    data: {
      ...(hasField('machine_no') && { machine_no: machineData.machine_no }),
      ...(hasField('mc_id') && { mc_id: mcId }),
      ...(hasField('description') && { description: machineData.description }),
      ...(hasField('make_name') && { make_name: machineData.make_name }),
      ...(hasField('model') && { model: machineData.model }),
      ...(hasField('prodn_mixing') && { prodn_mixing: machineData.prodn_mixing }),
      ...(hasField('speed') && { speed: machineData.speed }),
      ...(hasField('prodn_effi') && { prodn_efficiency: machineData.prodn_effi }),
      ...(hasField('mc_effi') && { mc_effi: machineData.mc_effi }),
      ...(shouldUpdateTpi && { tpi: effectiveTpi }),
      ...(hasField('no_of_spindles') && { no_of_spindles: machineData.no_of_spindles }),
      ...(hasField('installed_date') && { installed_date: installedDate }),
      ...(hasField('is_active') && { is_active: machineData.is_active }),
      ...(isActivating && { activated_at: new Date(), deactivated_at: null }),
      ...(isDeactivating && { deactivated_at: machineRemovalDate() }),
      ...(hasField('direct_hank_entry') && { direct_hank_entry: machineData.direct_hank_entry }),
      ...(hasField('direct_kgs_entry') && { direct_kgs_entry: machineData.direct_kgs_entry }),
      updated_at: new Date(),
    }
  });
  return data;
}

// Delete a simplex machine permanently
export async function deleteSimplexMachine(id) {
  await prisma.simplex_machines.delete({ where: { id } });
  return true;
}

// Search simplex machines (only active ones)
export async function searchSimplexMachines(field, condition, value) {
  const where = buildTypedSearchWhere(field, condition, value, {
    machine_no: 'text', description: 'text', make_name: 'text', prodn_mixing: 'text'
  });

  const data = await prisma.simplex_machines.findMany({
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

// Get active simplex machines only
export async function getActiveSimplexMachines() {
  const data = await prisma.simplex_machines.findMany({
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

// Get active count options (for count-name selectors)
export async function getSimplexCountOptions() {
  const data = await prisma.spinning_counts.findMany({
    where: { is_active: true },
    select: {
      id: true,
      count_name: true,
      tpi: true,
      act_count: true,
      mixing_name: true,
    },
    orderBy: { count_name: 'asc' }
  });

  return data || [];
}
