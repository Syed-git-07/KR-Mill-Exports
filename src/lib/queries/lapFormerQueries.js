import { prisma } from '../prisma';
import { copyPreviousSpeeds, getAvailablePreviousSpeedDates } from './copyPreviousSpeed';
import { resolveLapFormerShiftFallbackTime } from '../lapFormerShiftFallback';
import {
  LAP_FORMER_FORMULA_FALLBACK,
  calculateLapFormerStdProdn,
  getLapFormerActProdnConstant,
  resolveLapFormerFormulaInputs,
} from '../lapFormerFormulaFallback';
import { calculateTimeAdjustedProductionMetrics } from '../productionFormulaMath';
import {
  assertPositiveSetupFields,
  efficiencyFactorOrFallback,
  getOrCreateDateScopedSetups,
  positiveNumberOrFallback
} from './dateScopedMachineSetup';
import { buildStoppageUpdate, findFirstFreeStoppageSlot, getStoppageTotal } from '../stoppageSlotUtils';
import { assertActiveStoppageReasons } from './stoppageValidation';
import { deleteUnusedMachine } from './machineDeletion';
import { sanitizeProductionDetailUpdate, sanitizeProductionHeaderUpdate } from './productionDetailUpdate';
import { assertMachineUpdateCount, normalizeMixingValue, resolveMachineMixingContext } from './machineMixingUpdate';
import { buildMachineVisibilityWhere } from './machineDateVisibility';
import { sanitizeLapFormerSetupUpdate } from '../preparatorySetupValidation';
import { buildMachineLifecycleUpdate, normalizeMachineMasterData } from './machineMasterValidation';
import {
  assertLifecycleCanStart,
  deactivateEntryMachines,
  normalizeMachineNumber,
  resolveEntryMachineContext,
  validateInstalledDateForActivation
} from './entryMachineLifecycle';

function compareLapFormerMachines(a, b) {
  const sortA = a?.sort_order ?? 9999;
  const sortB = b?.sort_order ?? 9999;
  if (sortA !== sortB) return sortA - sortB;

  const aNo = String(a?.machine_no || '');
  const bNo = String(b?.machine_no || '');
  const aNum = parseInt(aNo.replace(/\D/g, ''), 10) || 0;
  const bNum = parseInt(bNo.replace(/\D/g, ''), 10) || 0;
  if (aNum !== bNum) return aNum - bNum;

  return aNo.localeCompare(bNo);
}

/**
 * Lap Former Machine Master - CRUD Operations
 * Following the pattern from Department queries
 * Same structure as Drawing Breaker/Finisher (NO mc_effi, tpi, spindles)
 */

// ============================================
// SHIFT CONFIGURATION QUERIES
// ============================================

// Get shift configuration for LAP FORMER department from database
export async function getLapFormerShiftConfig(shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'LAPFORMER',
        shift: parseInt(shift),
        is_active: true
      }
    });
    return data;
  } catch (error) {
    throw error;
  }
}

// Get shift time for lap former based on shift_config (DB-first)
export async function getLapFormerShiftTime(shift) {
  const config = await getLapFormerShiftConfig(shift);
  return config?.shift_time || resolveLapFormerShiftFallbackTime(shift);
}

// No default stoppage for lap former - always 0
export async function getLapFormerDefaultStoppage(shift) {
  return 0;
}

// Get shift configuration object (for use in functions that need totalTime)
export async function getLapFormerShiftConfiguration(shift) {
  const config = await getLapFormerShiftConfig(shift);
  const shiftTime = config?.shift_time || resolveLapFormerShiftFallbackTime(shift);
  return { 
    totalTime: shiftTime,
    defaultStoppage: 0
  };
}

// ============================================
// LAP FORMER MACHINE QUERIES
// ============================================

const LAP_FORMER_MASTER_NUMERIC_RULES = Object.freeze({
  mc_id: { label: 'Machine id', integer: true, min: 0, max: 1000000 },
  speed: { label: 'Speed', required: true, integer: true, min: 0, max: 1000000 },
  prodn_effi: { label: 'Production efficiency', required: true, min: 0, max: 100 },
  hank_constant: { label: 'Hank constant', min: 0, max: 100 },
  std_efficiency_factor: { label: 'Standard efficiency factor', min: 0, max: 1 },
  divisor_constant: { label: 'Divisor constant', min: 0, max: 1000000000 },
  delivery: { label: 'Delivery', integer: true, min: 0, max: 1000 },
  shift_time: { label: 'Shift time', integer: true, min: 0, max: 1440 }
});

function normalizeLapFormerMachineData(machineData, current = null) {
  return normalizeMachineMasterData({
    ...(current || {}),
    ...(machineData || {}),
    machine_no: machineData?.machine_no ?? current?.machine_no,
    speed: machineData?.speed ?? current?.speed,
    prodn_effi: machineData?.prodn_effi ?? current?.prodn_efficiency
  }, LAP_FORMER_MASTER_NUMERIC_RULES);
}

// Get all lap former machines (active only - updated for date modification)
export async function getLapFormerMachines() {
  const data = await prisma.lap_former_machines.findMany({});
  // Natural sort by machine number (LF-1, LF-2, ... LF-22), active first
  const sorted = (data || []).sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    const numA = parseInt(a.machine_no?.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.machine_no?.replace(/\D/g, '') || '0', 10);
    return numA - numB;
  });
  return sorted;
}

// Get a single lap former machine by ID
export async function getLapFormerMachineById(id) {
  const data = await prisma.lap_former_machines.findUnique({
    where: { id }
  });
  return data;
}

// Create a new lap former machine
export async function createLapFormerMachine(machineData) {
  const normalized = normalizeLapFormerMachineData(machineData);
  const duplicate = await prisma.lap_former_machines.findFirst({
    where: { machine_no: normalized.machine_no, is_active: true },
    select: { id: true }
  });
  if (duplicate) throw new Error(`Machine ${normalized.machine_no} already exists and is active`);

  const mcId = normalized.mc_id ? Number.parseInt(String(normalized.mc_id), 10) : null;
  const maxSortResult = await prisma.lap_former_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;
  const now = new Date();
  const isActive = normalized.is_active ?? true;

  const data = await prisma.lap_former_machines.create({
    data: {
      machine_no: normalized.machine_no,
      mc_id: mcId,
      description: normalized.description,
      make_name: normalized.make_name,
      model: normalized.model,
      prodn_mixing: normalized.prodn_mixing,
      speed: normalized.speed,
      prodn_efficiency: normalized.prodn_effi,
      installed_date: normalized.installed_date,
      is_active: isActive,
      activated_at: isActive ? now : null,
      deactivated_at: isActive ? null : now,
      sort_order: nextSortOrder,
      direct_hank_entry: normalized.direct_hank_entry ?? false,
      direct_kgs_entry: normalized.direct_kgs_entry ?? false,
    }
  });
  return data;
}

// Update an existing lap former machine
export async function updateLapFormerMachine(id, machineData) {
  const current = await prisma.lap_former_machines.findUnique({ where: { id } });
  if (!current) throw new Error('Lap Former machine not found');
  if (!current.is_active) {
    throw new Error('Inactive Lap Former lifecycle rows cannot be edited or reactivated; add a new machine lifecycle instead');
  }

  const normalized = normalizeLapFormerMachineData(machineData, current);
  const duplicate = await prisma.lap_former_machines.findFirst({
    where: {
      id: { not: id },
      machine_no: normalized.machine_no,
      is_active: true
    },
    select: { id: true }
  });
  if (duplicate) throw new Error(`Machine ${normalized.machine_no} already exists and is active`);

  const lifecycleUpdate = buildMachineLifecycleUpdate(current.is_active, machineData?.is_active);
  const data = await prisma.lap_former_machines.update({
    where: { id },
    data: {
      machine_no: normalized.machine_no,
      mc_id: normalized.mc_id === '' || normalized.mc_id == null ? null : normalized.mc_id,
      description: normalized.description,
      make_name: normalized.make_name,
      model: normalized.model,
      prodn_mixing: normalized.prodn_mixing,
      speed: normalized.speed,
      prodn_efficiency: normalized.prodn_effi,
      installed_date: normalized.installed_date,
      ...lifecycleUpdate,
      direct_hank_entry: normalized.direct_hank_entry,
      direct_kgs_entry: normalized.direct_kgs_entry,
      updated_at: new Date(),
    }
  });
  return data;
}

// Delete a lap former machine (Permanent delete from master screen)
export async function deleteLapFormerMachine(id) {
  return deleteUnusedMachine({
    id,
    machineModel: 'lap_former_machines',
    setupModel: 'lap_former_machine_setup',
    productionDetailModel: 'lap_former_production_detail',
    label: 'lap former machine'
  });
}

// Search lap former machines
export async function searchLapFormerMachines(field, condition, value) {
  let where = {};

  // Apply search condition based on field and condition type
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

  const data = await prisma.lap_former_machines.findMany({ where });
  
  // Natural sort by machine number, active first
  const sorted = (data || []).sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    const numA = parseInt(a.machine_no?.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.machine_no?.replace(/\D/g, '') || '0', 10);
    return numA - numB;
  });
  
  return sorted;
}

// Get active lap former machines only (Date based)
export async function getActiveLapFormerMachines(entryDate = new Date()) {
  const data = await prisma.lap_former_machines.findMany({
    where: buildMachineVisibilityWhere(entryDate),
    orderBy: { sort_order: 'asc' }
  });
  
  return data;
}

// ============================================
// LAP FORMER PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers
export async function getLapFormerProductionHeaders() {
  const data = await prisma.lap_former_production_header.findMany({
    orderBy: { entry_date: 'desc' }
  });
  return data;
}

// Get production header by date and shift
export async function getLapFormerProductionByDateShift(date, shift) {
  const data = await prisma.lap_former_production_header.findFirst({
    where: {
      entry_date: new Date(date),
      shift: shift
    }
  });
  return data;
}

// Create or get production header
export async function getOrCreateLapFormerHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getLapFormerProductionByDateShift(date, shift);
  if (existing) return existing;

  const totalTime = await getLapFormerShiftTime(shift);

  // Create new header
  try {
    return await prisma.lap_former_production_header.create({
      data: {
        entry_date: new Date(date),
        shift: shift,
        supervisor_id: supervisorId || null,
        maisitry_id: maisitryId || null,
        total_time: totalTime
      }
    });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const concurrentHeader = await getLapFormerProductionByDateShift(date, shift);
    if (!concurrentHeader) throw error;
    return concurrentHeader;
  }
}

// Update production header
export async function updateLapFormerHeader(id, updates) {
  const data = await prisma.lap_former_production_header.update({
    where: { id },
    data: {
      ...sanitizeProductionHeaderUpdate('lap_former_production_header', updates),
      updated_at: new Date()
    }
  });
  return data;
}

// ============================================
// LAP FORMER PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getLapFormerProductionDetails(headerId) {
  const data = await prisma.lap_former_production_detail.findMany({
    where: { header_id: headerId }
  });

  if (!data || data.length === 0) return [];

  const header = await prisma.lap_former_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true, shift: true, total_time: true }
  });
  const entryDate = header?.entry_date || new Date();

  const machineIds = data.map(d => d.machine_id);
  const machines = await prisma.lap_former_machines.findMany({
    where: { id: { in: machineIds } },
    orderBy: { sort_order: 'asc' }
  });

  const machineMap = {};
  machines?.forEach(m => { machineMap[m.id] = m; });

  return data
    .map(detail => ({
      ...detail,
      machine: machineMap[detail.machine_id] || null
    }))
    .filter(detail => {
      const m = detail.machine;
      if (!m) return false;
      if (m.activated_at && new Date(m.activated_at) > entryDate) return false;
      if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false;
      return true;
    })
    .sort((a, b) => compareLapFormerMachines(a.machine, b.machine));
}

// Get production details with machine setup for a header (for display)
export async function getLapFormerProductionWithSetup(headerId) {
  const data = await prisma.lap_former_production_detail.findMany({
    where: {
      header_id: headerId
    }
  });

  if (!data || data.length === 0) return [];

  const detailIds = data.map(d => d.id);
  const machineIds = data.map(d => d.machine_id);

  const machines = await prisma.lap_former_machines.findMany({
    where: { id: { in: machineIds } },
    orderBy: { sort_order: 'asc' }
  });

  const stoppages = await prisma.lap_former_stoppage_entry.findMany({
    where: { production_detail_id: { in: detailIds } }
  });

  const machineMap = {};
  machines?.forEach(m => { machineMap[m.id] = m; });

  const stoppageMap = {};
  stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s; });
  
  const header = await prisma.lap_former_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true }
  });
  const entryDate = header?.entry_date || new Date();

  return (data || [])
    .map(detail => ({
      ...detail,
      machine: machineMap[detail.machine_id] || null,
      stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
    }))
    .filter(detail => {
      const m = detail.machine;
      if (!m) return false;
      if (m.activated_at && new Date(m.activated_at) > entryDate) return false;
      if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false;
      return true;
    })
    .sort((a, b) => compareLapFormerMachines(a.machine, b.machine));
}

// Initialize production details for all lap former machines
export async function initializeLapFormerDetails(headerId) {
  const existingDetails = await prisma.lap_former_production_detail.findMany({
    where: { header_id: headerId },
    select: { machine_id: true }
  });

  const existingMachineIds = existingDetails?.map(d => d.machine_id) || [];

  // Get header entry_date for date-based machine visibility
  const header = await prisma.lap_former_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true, shift: true, total_time: true }
  });
  if (!header) throw new Error(`Lap Former production header ${headerId} not found`);
  const entryDate = header.entry_date;

  // Get all lap former machines WITH SPEED visible on the entry date
  const machines = await prisma.lap_former_machines.findMany({
    where: {
      ...buildMachineVisibilityWhere(entryDate)
    },
    select: { id: true, machine_no: true, prodn_mixing: true, speed: true, description: true },
    orderBy: { sort_order: 'asc' }
  });

  // Materialize and read only this header's exact date/shift setup snapshot.
  const setups = await getLapFormerMachineSetups(headerId);

  // Create a map of machine_id to setup
  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });
  const machinesWithSetup = machines.filter(machine => !!setupMap[machine.id]);
  const newMachines = machinesWithSetup.filter(m => !existingMachineIds.includes(m.id));

  // Create detail records for each machine
  // Default stoppage: 0 mins for Lap Former
  const defaultStoppage = 0;
  const totalTime = Number(header.total_time) || await getLapFormerShiftTime(header.shift);
  const defaultWorkTime = totalTime - defaultStoppage;

  const details = newMachines.map(machine => {
    const setup = setupMap[machine.id] || {};
    
    const stdProdn = calculateLapFormerStdProdn(setup, totalTime, machine.speed);
    // Exp.Prodn = Std.Prodn × (WorkTime / TotalTime)
    const workRatio = totalTime > 0 ? defaultWorkTime / totalTime : 0;
    const expProdn = stdProdn * workRatio;
    
    return {
      header_id: headerId,
      machine_id: machine.id,
      prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: Math.round(stdProdn * 100) / 100,
      exp_prodn: Math.round(expProdn * 100) / 100,
      effi_percent: 0,
      uti_percent: Math.round(workRatio * 100 * 100) / 100,
      waste: setup.default_waste ?? null,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      total_stoppage_mins: defaultStoppage, // Store total stoppage mins
      session_no: 1
    };
  });

  return prisma.$transaction(async tx => {
    if (details.length > 0) {
      await tx.lap_former_production_detail.createMany({ data: details, skipDuplicates: true });
    }
    const visibleDetails = machinesWithSetup.length > 0
      ? await tx.lap_former_production_detail.findMany({
          where: {
            header_id: headerId,
            machine_id: { in: machinesWithSetup.map(machine => machine.id) }
          }
        })
      : [];
    const existingStoppages = visibleDetails.length > 0
      ? await tx.lap_former_stoppage_entry.findMany({
          where: { production_detail_id: { in: visibleDetails.map(detail => detail.id) } },
          select: { production_detail_id: true }
        })
      : [];
    const stoppedIds = new Set(existingStoppages.map(entry => entry.production_detail_id));
    const missingStoppages = visibleDetails
      .filter(detail => !stoppedIds.has(detail.id))
      .map(detail => ({ production_detail_id: detail.id, total_stoppage_time: 0 }));
    if (missingStoppages.length > 0) {
      await tx.lap_former_stoppage_entry.createMany({ data: missingStoppages, skipDuplicates: true });
    }
    const newMachineIds = new Set(newMachines.map(machine => machine.id));
    return visibleDetails.filter(detail => newMachineIds.has(detail.machine_id));
  });
}

// Sync newly added machines to an existing production header
// This function adds production details for machines that don't have entries yet
export async function syncNewMachinesToLapFormerHeader(headerId) {
  // Get header entry_date for date-based machine visibility
  const header = await prisma.lap_former_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true, shift: true, total_time: true }
  });
  if (!header) throw new Error(`Lap Former production header ${headerId} not found`);
  const entryDate = header.entry_date;

  // Get all active lap former machines based on entry date
  const allMachines = await prisma.lap_former_machines.findMany({
    where: {
      ...buildMachineVisibilityWhere(entryDate)
    },
    select: { id: true, machine_no: true, prodn_mixing: true, speed: true, description: true },
    orderBy: { sort_order: 'asc' }
  });

  // Get existing production details for this header
  const existingDetails = await prisma.lap_former_production_detail.findMany({
    where: { header_id: headerId },
    select: { id: true, machine_id: true }
  });

  const existingMachineIds = existingDetails?.map(d => d.machine_id) || [];
  // Materialize and read only this header's exact date/shift setup snapshot.
  const setups = await getLapFormerMachineSetups(headerId);

  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });
  const machinesWithSetup = allMachines.filter(machine => !!setupMap[machine.id]);
  // Synchronization is additive; historical rows are never removed on page load.
  const newMachines = machinesWithSetup.filter(m => !existingMachineIds.includes(m.id));

  // Default values
  const defaultStoppage = 0;
  const totalTime = Number(header.total_time) || await getLapFormerShiftTime(header.shift);
  const defaultWorkTime = totalTime - defaultStoppage;

  // Create detail records for new machines
  const details = newMachines.map(machine => {
    const setup = setupMap[machine.id] || {};
    const stdProdn = calculateLapFormerStdProdn(setup, totalTime, machine.speed);
    const workRatio = totalTime > 0 ? defaultWorkTime / totalTime : 0;
    const expProdn = stdProdn * workRatio;
    
    return {
      header_id: headerId,
      machine_id: machine.id,
      prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: Math.round(stdProdn * 100) / 100,
      exp_prodn: Math.round(expProdn * 100) / 100,
      effi_percent: 0,
      uti_percent: Math.round(workRatio * 100 * 100) / 100,
      waste: setup.default_waste ?? null,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      total_stoppage_mins: defaultStoppage,
      session_no: 1
    };
  });

  return prisma.$transaction(async tx => {
    if (details.length > 0) {
      await tx.lap_former_production_detail.createMany({ data: details, skipDuplicates: true });
    }
    const visibleDetails = machinesWithSetup.length > 0
      ? await tx.lap_former_production_detail.findMany({
          where: {
            header_id: headerId,
            machine_id: { in: machinesWithSetup.map(machine => machine.id) }
          }
        })
      : [];
    const existingStoppages = visibleDetails.length > 0
      ? await tx.lap_former_stoppage_entry.findMany({
          where: { production_detail_id: { in: visibleDetails.map(detail => detail.id) } },
          select: { production_detail_id: true }
        })
      : [];
    const stoppedIds = new Set(existingStoppages.map(entry => entry.production_detail_id));
    const missingStoppages = visibleDetails
      .filter(detail => !stoppedIds.has(detail.id))
      .map(detail => ({ production_detail_id: detail.id, total_stoppage_time: 0 }));
    if (missingStoppages.length > 0) {
      await tx.lap_former_stoppage_entry.createMany({ data: missingStoppages, skipDuplicates: true });
    }
    const newMachineIds = new Set(newMachines.map(machine => machine.id));
    return visibleDetails.filter(detail => newMachineIds.has(detail.machine_id));
  });
}

// Update production detail
export async function updateLapFormerDetail(id, updates) {
  // Remove any fields that shouldn't be updated
  const cleanUpdates = sanitizeProductionDetailUpdate('lap_former_production_detail', updates);
  
  try {
    const data = await prisma.lap_former_production_detail.update({
      where: { id },
      data: {
        ...cleanUpdates,
        updated_at: new Date()
      }
    });
    return data;
  } catch (error) {
    console.error('updateLapFormerDetail error:', error);
    throw new Error(`Failed to update production detail: ${error.message}`);
  }
}

// Bulk update production details
export async function bulkUpdateLapFormerDetails(updates) {
  const updatedAt = new Date();
  return prisma.$transaction(
    updates.map(({ id, ...data }) =>
      prisma.lap_former_production_detail.update({
        where: { id },
        data: {
          ...sanitizeProductionDetailUpdate('lap_former_production_detail', data),
          updated_at: updatedAt
        }
      })
    )
  );
}

// ============================================
// LAP FORMER STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getLapFormerStoppageEntries(headerId) {
  const details = await prisma.lap_former_production_detail.findMany({
    where: { header_id: headerId }
  });

  if (!details || details.length === 0) return [];

  const header = await prisma.lap_former_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true }
  });
  const entryDate = header?.entry_date || new Date();

  const detailIds = details.map(d => d.id);
  const stoppages = await prisma.lap_former_stoppage_entry.findMany({
    where: { production_detail_id: { in: detailIds } }
  });

  const stoppageReasonIds = [];
  stoppages?.forEach(s => {
    if (s.stoppage1_id) stoppageReasonIds.push(s.stoppage1_id);
    if (s.stoppage2_id) stoppageReasonIds.push(s.stoppage2_id);
    if (s.stoppage3_id) stoppageReasonIds.push(s.stoppage3_id);
    if (s.stoppage4_id) stoppageReasonIds.push(s.stoppage4_id);
  });

  const stoppageReasons = stoppageReasonIds.length > 0
    ? await prisma.stoppage_details.findMany({
        where: { id: { in: [...new Set(stoppageReasonIds)] } },
        select: { id: true, stoppage_name: true, short_code: true }
      })
    : [];

  const machineIds = details.map(d => d.machine_id);
  const machines = await prisma.lap_former_machines.findMany({
    where: { id: { in: machineIds } },
    orderBy: { sort_order: 'asc' }
  });

  const machineMap = {};
  machines?.forEach(m => { machineMap[m.id] = m; });

  const stoppageMap = {};
  stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s; });

  const reasonMap = {};
  stoppageReasons?.forEach(r => { reasonMap[r.id] = r; });

  return details
    .filter(detail => {
      const m = machineMap[detail.machine_id];
      if (!m) return false;
      if (m.activated_at && new Date(m.activated_at) > entryDate) return false;
      if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return false;
      return true;
    })
    .sort((a, b) => compareLapFormerMachines(machineMap[a.machine_id], machineMap[b.machine_id]))
    .map(detail => {
      const machine = machineMap[detail.machine_id];
      const stoppage = stoppageMap[detail.id] || {};
      return {
        ...stoppage,
        production_detail_id: detail.id,
        production_detail: {
          ...detail,
          machine
        },
        stoppage1: reasonMap[stoppage.stoppage1_id] || null,
        stoppage2: reasonMap[stoppage.stoppage2_id] || null,
        stoppage3: reasonMap[stoppage.stoppage3_id] || null,
        stoppage4: reasonMap[stoppage.stoppage4_id] || null
      };
    });
}

// Update stoppage entry
export async function updateLapFormerStoppageEntry(id, updates) {
  return prisma.$transaction(async tx => {
    try {
    // First, fetch the existing record to get current stoppage values and production_detail_id
    const existing = await tx.lap_former_stoppage_entry.findUnique({
      where: { id },
      select: {
        production_detail_id: true,
        stoppage1_id: true,
        stoppage1_time: true,
        stoppage2_id: true,
        stoppage2_time: true,
        stoppage3_id: true,
        stoppage3_time: true,
        stoppage4_id: true,
        stoppage4_time: true
      }
    });

    if (!existing) {
      throw new Error(`Stoppage entry ${id} not found`);
    }

    const stoppageUpdate = buildStoppageUpdate(existing, updates);
    await assertActiveStoppageReasons(tx, stoppageUpdate, ['LAP FORMER']);
    const total = stoppageUpdate.total_stoppage_time;

    const data = await tx.lap_former_stoppage_entry.update({
      where: { id },
      data: stoppageUpdate
    });

    // Recalculate every field that depends on stoppage time in the same transaction.
    const detail = await tx.lap_former_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: {
        id: true,
        header_id: true,
        machine_id: true,
        act_hank: true,
        act_prodn: true,
        waste: true
      }
    });
    if (!detail) throw new Error('The production row for this stoppage no longer exists');

    const header = detail?.header_id
      ? await tx.lap_former_production_header.findUnique({
          where: { id: detail.header_id },
          select: { total_time: true, shift: true, entry_date: true }
        })
      : null;
    if (!header) throw new Error('The production header for this stoppage no longer exists');

    const shiftConfig = await tx.shift_config.findFirst({
      where: { department_code: 'LAPFORMER', shift: header.shift, is_active: true },
      select: { shift_time: true }
    })
    const totalTime = Number(header.total_time)
      || shiftConfig?.shift_time
      || resolveLapFormerShiftFallbackTime(header.shift)
    if (total > totalTime) {
      const error = new Error('Stoppage time cannot exceed the shift time');
      error.code = 'INVALID_STOPPAGE';
      throw error;
    }
    const [setup, machine] = await Promise.all([
      tx.lap_former_machine_setup.findFirst({
        where: {
          machine_id: detail.machine_id,
          entry_date: header.entry_date,
          shift: header.shift
        }
      }),
      tx.lap_former_machines.findUnique({
        where: { id: detail.machine_id },
        select: { speed: true }
      })
    ])
    const calculated = calculateLapFormerValues(
      detail.act_hank,
      detail.act_prodn,
      totalTime,
      total,
      setup,
      machine?.speed,
      detail.waste
    )
    delete calculated.speed

    await tx.lap_former_production_detail.update({
      where: { id: detail.id },
      data: {
        total_stoppage_mins: total,
        ...calculated,
        updated_at: new Date()
      }
    });

    return data;
    } catch (error) {
      console.error('Error updating stoppage entry:', error);
      throw error;
    }
  })
}

// Apply full stoppage to all machines and recalculate production
export async function applyLapFormerFullStoppage(headerId, stoppageId, stoppageTime) {
  const header = await prisma.lap_former_production_header.findUnique({
    where: { id: headerId },
    select: { total_time: true, shift: true }
  });
  const totalTime = Number(header?.total_time) || await getLapFormerShiftTime(header?.shift || 1);

  // Get all stoppage entries for this header
  const stoppages = await getLapFormerStoppageEntries(headerId);
  
  // Get machine setups for recalculation
  const setups = await getLapFormerMachineSetups(headerId);
  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });

  // Update the first free slot independently for every machine.
  const updates = stoppages.flatMap(s => {
    const slot = findFirstFreeStoppageSlot(s);
    if (!slot) return [];
    return [{
      id: s.id,
      slot,
      [`stoppage${slot}_id`]: stoppageId,
      [`stoppage${slot}_time`]: stoppageTime,
      is_full_stoppage: true
    }];
  });

  const stoppagePromises = updates.map(({ id, slot: _slot, ...data }) =>
    updateLapFormerStoppageEntry(id, data)
  );

  const appliedRows = await Promise.all(stoppagePromises);
  
  // Recalculate production for each machine
  const prodPromises = updates.map(async ({ id, slot }) => {
    const s = stoppages.find(entry => entry.id === id);
    if (!s.production_detail) return null;
    
    const prodDetail = s.production_detail;
    const machineId = prodDetail.machine_id;
    const setup = setupMap[machineId];
    const { speed: machineSpeed } = resolveLapFormerFormulaInputs(setup, prodDetail.machine?.speed);
    
    // Calculate new total stoppage (all 4 stoppages)
    const currentStoppage = s;
    const newTotalStoppage = getStoppageTotal({
      ...currentStoppage,
      [`stoppage${slot}_time`]: stoppageTime
    });
    
    // Recalculate with machine speed from machine table
    const calculated = calculateLapFormerValues(
      prodDetail.act_hank || 0,
      prodDetail.act_prodn || 0,
      totalTime,
      newTotalStoppage,
      setup,
      machineSpeed
    );

    const recalculatedFields = {
      std_prodn: calculated.std_prodn,
      exp_prodn: calculated.exp_prodn,
      effi_percent: calculated.effi_percent,
      uti_percent: calculated.uti_percent,
      run_time: calculated.run_time,
      work_time: calculated.work_time,
      total_stoppage_mins: newTotalStoppage
    };

    return updateLapFormerDetail(prodDetail.id, recalculatedFields);
  });
  
  await Promise.all(prodPromises.filter(Boolean));

  return {
    success: true,
    data: {
      updatedCount: appliedRows.length,
      skippedCount: stoppages.length - appliedRows.length,
      overflowCount: stoppages.length - appliedRows.length,
      appliedRows
    }
  }
}

// Apply partial stoppage to selected machines and recalculate production (auto-slot allocation)
export async function applyLapFormerPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const pickFirstAvailableSlot = (entry) => {
      for (let i = 1; i <= 4; i++) {
        const slotValue = entry?.[`stoppage${i}_id`]
        if (slotValue === null || slotValue === undefined || slotValue === '') {
          return i
        }
      }
      return null
    }

    const header = await prisma.lap_former_production_header.findUnique({
      where: { id: headerId },
      select: { total_time: true, shift: true }
    });
    const totalTime = Number(header?.total_time) || await getLapFormerShiftTime(header?.shift || 1);

    // Get machine setups for recalculation (speed already merged from machine table)
    const setups = await getLapFormerMachineSetups(headerId);
    const setupMap = {};
    setups?.forEach(s => {
      setupMap[s.machine_id] = s;
    });
    
    // Get all production details and enrich with machine info (this model has no Prisma relation include).
    const details = await prisma.lap_former_production_detail.findMany({
      where: {
        header_id: headerId
      }
    });

    const machineIds = [...new Set((details || []).map(d => d.machine_id).filter(Boolean))]
    const machines = machineIds.length > 0
      ? await prisma.lap_former_machines.findMany({
          where: { id: { in: machineIds } },
          select: {
            id: true,
            machine_no: true,
            mc_id: true,
            speed: true
          }
        })
      : []

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })

    const detailsWithMachine = (details || [])
      .map(d => ({ ...d, machine: machineMap[d.machine_id] || null }))
      .filter(d => d.machine)

    // Filter by machine range
    // Filter by machine range (also filter out any null machines as safety)
    const fromNum = parseInt(String(fromMachineNo || '').replace(/\D/g, '') || '0', 10)
    const toNum = parseInt(String(toMachineNo || '').replace(/\D/g, '') || '999', 10)
    const minNum = Math.min(fromNum, toNum)
    const maxNum = Math.max(fromNum, toNum)

    const filteredDetails = detailsWithMachine?.filter(d => {
      if (!d.machine?.machine_no) return false;  // Skip orphaned records
      const mcNum = parseInt(d.machine.machine_no.replace(/\D/g, ''));
      return mcNum >= minNum && mcNum <= maxNum;
    }) || [];

    if (filteredDetails.length === 0) {
      throw new Error(`No machines found in range ${fromMachineNo} to ${toMachineNo}`);
    }

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id);

    const stoppages = await prisma.lap_former_stoppage_entry.findMany({
      where: { production_detail_id: { in: detailIds } }
    });

    const stoppageByDetailId = {}
    stoppages.forEach(s => {
      stoppageByDetailId[s.production_detail_id] = s
    })

    let updatedCount = 0
    let overflowCount = 0
    let skippedCount = 0
    const appliedRows = []
    const updatedStoppageByDetailId = {}
    const parsedStoppageTime = parseInt(stoppageTime) || 0

    // Strict per-machine slot assignment: always pick first available slot (1 -> 2 -> 3 -> 4).
    for (const detail of filteredDetails) {
      const stoppageEntry = stoppageByDetailId[detail.id]
      if (!stoppageEntry) {
        skippedCount++
        continue
      }

      const resolvedSlot = pickFirstAvailableSlot(stoppageEntry)

      if (!resolvedSlot) {
        overflowCount++
        continue
      }

      const updateData = {}
      updateData[`stoppage${resolvedSlot}_id`] = stoppageId
      updateData[`stoppage${resolvedSlot}_time`] = parsedStoppageTime

      const updated = await updateLapFormerStoppageEntry(stoppageEntry.id, updateData)
      appliedRows.push(updated)
      updatedCount++
      updatedStoppageByDetailId[stoppageEntry.production_detail_id] = updated
    }

    if (updatedCount === 0) {
      return {
        success: true,
        data: {
          updatedCount,
          skippedCount,
          overflowCount,
          appliedRows
        }
      }
    }
    
    // Recalculate production for affected machines
    const prodPromises = filteredDetails.map(async (prodDetail) => {
      const stoppageEntry = updatedStoppageByDetailId[prodDetail.id] || stoppageByDetailId[prodDetail.id]
      if (!stoppageEntry) return null;
      
      const setup = setupMap[prodDetail.machine_id];
      // Speed from machine table (source of truth)
      const { speed: machineSpeed } = resolveLapFormerFormulaInputs(setup, prodDetail.machine?.speed);
      
      // Calculate new total stoppage (all 4 stoppage slots)
      const newTotalStoppage = 
        (stoppageEntry.stoppage1_time || 0) +
        (stoppageEntry.stoppage2_time || 0) +
        (stoppageEntry.stoppage3_time || 0) +
        (stoppageEntry.stoppage4_time || 0);
      
      // Recalculate with machine speed
      const calculated = calculateLapFormerValues(
        prodDetail.act_hank || 0,
        prodDetail.act_prodn || 0,
        totalTime,
        newTotalStoppage,
        setup,
        machineSpeed  // Pass machine speed explicitly
      );

      const recalculatedFields = {
        std_prodn: calculated.std_prodn,
        exp_prodn: calculated.exp_prodn,
        effi_percent: calculated.effi_percent,
        uti_percent: calculated.uti_percent,
        run_time: calculated.run_time,
        work_time: calculated.work_time,
        total_stoppage_mins: newTotalStoppage
      };

      return updateLapFormerDetail(prodDetail.id, recalculatedFields);
    });
    
    await Promise.all(prodPromises.filter(Boolean));

    return {
      success: true,
      data: {
        updatedCount,
        skippedCount,
        overflowCount,
        appliedRows
      }
    }
  } catch (error) {
    console.error('applyLapFormerPartialStoppage error:', error);
    throw error;
  }
}

// ============================================
// LAP FORMER MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info
export async function getLapFormerMachineSetups(headerId = null) {
  const validHeaderId = typeof headerId === 'string' && headerId.trim() ? headerId.trim() : null;
  const header = validHeaderId
    ? await prisma.lap_former_production_header.findUnique({
        where: { id: validHeaderId },
        select: { entry_date: true }
      })
    : null;
  if (validHeaderId && !header) throw new Error(`Lap former production header ${validHeaderId} not found`);

  const [machines, headerDetails] = await Promise.all([
    prisma.lap_former_machines.findMany({
      where: header ? buildMachineVisibilityWhere(header.entry_date) : { is_active: true },
      select: {
        id: true,
        machine_no: true,
        description: true,
        make_name: true,
        prodn_mixing: true,
        speed: true,
        prodn_efficiency: true,
        is_active: true,
        activated_at: true,
        deactivated_at: true,
        sort_order: true
      }
    }),
    validHeaderId
      ? prisma.lap_former_production_detail.findMany({
          where: { header_id: validHeaderId },
          select: { machine_id: true, prodn_mixing: true }
        })
      : Promise.resolve([])
  ]);

  const machineById = new Map(machines.map(machine => [machine.id, machine]));
  const machineIds = machines.map(m => m.id);
  const machineSpeedMap = {};
  const machineSetupOverridesMap = {};
  machines.forEach(m => {
    const speed = positiveNumberOrFallback(m.speed, 90);
    const efficiency = efficiencyFactorOrFallback(m.prodn_efficiency, 0.85);
    machineSpeedMap[m.id] = speed;
    machineSetupOverridesMap[m.id] = {
      speed,
      std_efficiency_factor: efficiency
    };
  });
  const data = await getOrCreateDateScopedSetups({
    setupModel: prisma.lap_former_machine_setup,
    headerModel: prisma.lap_former_production_header,
    headerId: validHeaderId,
    machineIds,
    machineSpeedMap,
    machineSetupOverridesMap,
    defaultSetupFactory: ({ machineId, totalTime }) => {
      const machine = machineById.get(machineId);
      if (!machine) throw new Error(`Lap Former machine ${machineId} not found`);
      return {
        machine_id: machineId,
        speed: positiveNumberOrFallback(machine.speed, 90),
        hank_constant: 0.0082,
        std_efficiency_factor: efficiencyFactorOrFallback(machine.prodn_efficiency, 0.85),
        default_waste: 0.85,
        std_prodn: 0,
        shift_time: positiveNumberOrFallback(totalTime, 510),
        default_stoppage: 0,
        divisor_constant: 1693,
        delivery: 1
      };
    },
    validateDefaultSetup: setup => assertPositiveSetupFields(
      setup,
      ['speed', 'hank_constant', 'std_efficiency_factor', 'shift_time', 'divisor_constant', 'delivery'],
      'Lap Former setup'
    )
  });

  const machineMap = {};
  if (Array.isArray(machines)) {
    machines.forEach(m => { machineMap[m.id] = m; });
  }

  const mixingMap = {};
  if (Array.isArray(headerDetails)) {
    headerDetails.forEach(d => {
      if (d.prodn_mixing) mixingMap[d.machine_id] = d.prodn_mixing;
    });
  }

  // Filter out any setups where machine is null, and sort by sort_order
  const filteredData = data?.filter(setup => !!machineMap[setup.machine_id]).map(setup => {
    const machine = machineMap[setup.machine_id];
    const dateMixing = mixingMap[setup.machine_id] ?? setup.prodn_mixing ?? machine?.prodn_mixing;
    return {
      ...setup,
      machine: machine ? { ...machine, prodn_mixing: dateMixing } : null,
      prodn_mixing: dateMixing,
      speed: setup.speed ?? machine?.speed
    };
  }) || [];
  
  return filteredData.sort((a, b) => {
    return (a.machine?.sort_order || 0) - (b.machine?.sort_order || 0);
  });
}

// Update or create machine setup
export async function updateLapFormerMachineSetup(setupId, updates) {
  updates = sanitizeLapFormerSetupUpdate(updates);
  const existingSetup = await prisma.lap_former_machine_setup.findUnique({
    where: { id: setupId },
    select: {
      id: true,
      machine_id: true,
      speed: true,
      hank_constant: true,
      std_efficiency_factor: true,
      shift_time: true,
      divisor_constant: true,
      delivery: true
    }
  });
  if (!existingSetup) throw new Error(`Lap former setup ${setupId} not found`);
  const machineId = existingSetup.machine_id;

  const speedWasUpdated = updates.speed !== undefined;

  // Store speed only in this date/shift snapshot.
  if (speedWasUpdated) {
    const numSpeed = Number(updates.speed) || 0;
    updates.speed = numSpeed;
  }

  // Recalculate std_prodn if any formula input changes
  if (
    speedWasUpdated ||
    updates.hank_constant !== undefined ||
    updates.std_efficiency_factor !== undefined ||
    updates.shift_time !== undefined ||
    updates.delivery !== undefined ||
    updates.divisor_constant !== undefined
  ) {
    // Get current speed from machine table
    const machine = await prisma.lap_former_machines.findUnique({
      where: { id: machineId },
      select: { speed: true }
    });

    const effectiveSpeed = updates.speed ?? existingSetup?.speed ?? machine?.speed;

    const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveLapFormerFormulaInputs(
      {
        speed: effectiveSpeed,
        hank_constant: updates.hank_constant ?? existingSetup?.hank_constant,
        std_efficiency_factor: updates.std_efficiency_factor ?? existingSetup?.std_efficiency_factor,
        divisor_constant: updates.divisor_constant ?? existingSetup?.divisor_constant,
        delivery: updates.delivery ?? existingSetup?.delivery,
      },
      effectiveSpeed
    );

    const shiftTime =
      updates.shift_time ??
      existingSetup?.shift_time ??
      await getLapFormerShiftTime(1);

    updates.std_prodn = Math.round(
      calculateLapFormerStdProdn(
        {
          speed,
          hank_constant: hankConstant,
          std_efficiency_factor: stdEfficiencyFactor,
          divisor_constant: divisorConstant,
          delivery,
        },
        shiftTime,
        speed
      ) * 100
    ) / 100;
  }

  if (Object.keys(updates).length === 0) {
    const data = await prisma.lap_former_machine_setup.findUnique({ where: { id: setupId } });

    const machine = await prisma.lap_former_machines.findUnique({
      where: { id: machineId },
      select: { id: true, machine_no: true, speed: true }
    });

    return { ...data, machine, speed: machine?.speed ?? data?.speed };
  }

  const data = await prisma.lap_former_machine_setup.update({
    where: { id: setupId },
    data: { ...updates, updated_at: new Date() }
  });

  const machine = await prisma.lap_former_machines.findUnique({
    where: { id: machineId },
    select: { id: true, machine_no: true, speed: true }
  });

  return { ...data, machine, speed: machine?.speed ?? data.speed };
}

// Update machine speed
export async function updateLapFormerMachineSpeed(machineId, newSpeed) {
  const data = await prisma.lap_former_machines.update({
    where: { id: machineId },
    data: { speed: newSpeed }
  });
  return data;
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get lap former stoppage reasons (filtered by LAP FORMER department)
export async function getLapFormerStoppageReasons() {
  // First get the LAP FORMER department ID
  const lapFormerDept = await prisma.departments.findFirst({
    where: { dept_name: 'LAP FORMER' }
  });

  if (!lapFormerDept?.id) throw new Error('LAP FORMER department not found');

  const rows = await prisma.$queryRaw`
    SELECT
      sd.id,
      sd.stoppage_name,
      sd.short_code,
      sd.stoppage_head_id,
      COALESCE(sh.stoppage_head_name, 'General') AS stoppage_head_name
    FROM stoppage_details sd
    LEFT JOIN stoppage_heads sh ON sh.id = sd.stoppage_head_id
    WHERE sd.is_active = 1
      AND sd.department_id = ${lapFormerDept.id}
      AND (sd.stoppage_head_id IS NULL OR sh.is_active = 1)
    ORDER BY sd.stoppage_name ASC
  `;

  return (rows || []).map(item => ({
    ...item,
    category: item.stoppage_head_name || 'General'
  }));
}

// ============================================
// SUPERVISORS QUERIES
// ============================================

// Get all supervisors
export async function getSupervisors() {
  const data = await prisma.supervisors.findMany({
    where: { is_active: true },
    orderBy: { supervisor_name: 'asc' }
  });
  return data;
}

// ============================================
// CALCULATION HELPERS - LAP FORMER FORMULAS
// ============================================
// From lap-former-formula.md:
// Constant = 1 / 2.20456 / Hank
// Act Prodn = Act Hank × Constst
// Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery
// Exp Prodn = Std Prodn × (Work Time / Total Time)
// Act Effi % = Actual Prodn / Exp Prodn × 100
// UTI % = Work Time / Total Time × 100
// Waste % = Waste / Actual Prodn × 100
// Work Time = Total Time − Total Stoppage
//
// KEY DIFFERENCE: Lap Former uses Hank = 0.0082 (not 0.14 like Breaker Drawing)

export function calculateLapFormerValues(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed = null, currentWaste = null) {
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveLapFormerFormulaInputs(setup, machineSpeed);
  const waste = currentWaste ?? setup?.default_waste ?? null;

  // Constant = 1 / 2.20456 / Hank
  const constst = getLapFormerActProdnConstant({ hank_constant: hankConstant });
  // Act Prodn = manually entered value (if provided), else Act Hank × Constst
  const hasManualActProdn = actProdn !== null && actProdn !== undefined && !Number.isNaN(Number(actProdn));
  const calculatedActProdn = hasManualActProdn ? Number(actProdn) : (actHank * constst);

  // Work Time = Total Time - Stoppage Time
  
  // Std Prodn = (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  const stdProdn = calculateLapFormerStdProdn(
    {
      speed,
      hank_constant: hankConstant,
      std_efficiency_factor: stdEfficiencyFactor,
      divisor_constant: divisorConstant,
      delivery,
    },
    totalTime,
    speed
  );

  // Exp Prodn = Std Prodn × (Work Time / Total Time)

  // Effi% = Act Prodn / Exp Prodn × 100

  // UTI% = Work Time / Total Time × 100

  // Waste% = Waste / Act Prodn × 100
  const metrics = calculateTimeAdjustedProductionMetrics({
    actualProduction: calculatedActProdn,
    standardProduction: stdProdn,
    waste,
    totalTime,
    stoppageTime,
  });

  return {
    act_prodn: metrics.actualProduction,
    std_prodn: metrics.standardProduction,
    exp_prodn: metrics.expectedProduction,
    effi_percent: metrics.efficiencyPercent,
    uti_percent: metrics.utilizationPercent,
    waste,
    waste_percent: metrics.wastePercent,
    run_time: metrics.totalTime,
    work_time: metrics.workTime,
    speed
  };
}

// Get mixing options
export async function getLapFormerMixingOptions() {
  const data = await prisma.lap_former_machines.findMany({
    where: { prodn_mixing: { not: null } },
    select: { prodn_mixing: true },
    distinct: ['prodn_mixing']
  });
  
  const uniqueMixings = [...new Set(data?.map(d => d.prodn_mixing) || [])];
  return uniqueMixings.sort();
}

// ============================================
// COPY PREVIOUS SPEED FUNCTIONALITY
// ============================================

export async function getLapFormerAvailableDates(beforeDate, shift, limit = 30) {
  return getAvailablePreviousSpeedDates(
    prisma.lap_former_machine_setup,
    beforeDate,
    shift,
    limit
  );
}

export async function copyLapFormerFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  return copyPreviousSpeeds({
    setupModel: prisma.lap_former_machine_setup,
    headerModel: prisma.lap_former_production_header,
    targetHeaderId,
    targetDate,
    targetShift,
    sourceDate,
    buildUpdateData: (setup, speed) => {
      const shiftTime = Number(setup.shift_time || resolveLapFormerShiftFallbackTime(targetShift))
      return {
        speed,
        std_prodn: Math.round(
          calculateLapFormerStdProdn({ ...setup, speed }, shiftTime, speed) * 100
        ) / 100
      }
    }
  });
}

// Backward compatibility wrapper
export async function copyLapFormerFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copyLapFormerFromPreviousDate(targetDate, targetShift, targetHeaderId, null);
}

// ============================================
// MACHINE MANAGEMENT QUERIES
// ============================================

// Lookup lap former machine by machine number for setup autofill
export async function lookupLapFormerMachineByNo(machineNo) {
  const activeMachine = await prisma.lap_former_machines.findFirst({
    where: { machine_no: { equals: machineNo }, is_active: true }
  });

  const machine = activeMachine || await prisma.lap_former_machines.findFirst({
    where: { machine_no: { equals: machineNo } },
    orderBy: { is_active: 'desc' }
  });

  if (!machine) return null;

  let setup = activeMachine
    ? await prisma.lap_former_machine_setup.findFirst({ where: { machine_id: activeMachine.id } })
    : null;

  if (!setup) {
    const allIds = (await prisma.lap_former_machines.findMany({
      where: { machine_no: { equals: machineNo } },
      select: { id: true }
    })).map(m => m.id);

    setup = await prisma.lap_former_machine_setup.findFirst({
      where: { machine_id: { in: allIds } }
    });
  }

  return {
    ...machine,
    speed: setup?.speed ?? machine.speed ?? null,
    hank_constant: setup?.hank_constant ?? null,
    std_efficiency_factor: setup?.std_efficiency_factor ?? null,
    delivery: setup?.delivery ?? null,
    shift_time: setup?.shift_time ?? null,
    has_setup: !!setup
  };
}

// Add new lap former machine
export async function addLapFormerMachine(machineData, entryContext) {
  if (!machineData || typeof machineData !== 'object' || Array.isArray(machineData)) {
    throw new Error('Lap Former machine data must be an object');
  }

  return prisma.$transaction(async tx => {
    const context = await resolveEntryMachineContext({
      headerModel: tx.lap_former_production_header,
      context: entryContext,
      label: 'Lap Former production entry'
    });
    const maxMachine = await tx.lap_former_machines.findFirst({
      select: { mc_id: true },
      orderBy: { mc_id: 'desc' }
    });
    const nextMcId = (maxMachine?.mc_id || 0) + 1;
    const nextMachineNo = normalizeMachineNumber(machineData.machine_no || `LF${nextMcId}`);

    const matchingLifecycles = await tx.lap_former_machines.findMany({
      where: { machine_no: nextMachineNo },
      select: { id: true, is_active: true, activated_at: true, deactivated_at: true }
    });
    assertLifecycleCanStart(matchingLifecycles, context.entryDate, nextMachineNo);

    // An inactive row is a completed historical lifecycle. Adding the same
    // machine number creates a new row instead of mutating that history.
    const normalized = normalizeLapFormerMachineData({
      ...machineData,
      machine_no: nextMachineNo,
      mc_id: machineData.mc_id ?? nextMcId,
      speed: machineData.speed ?? LAP_FORMER_FORMULA_FALLBACK.speed,
      prodn_effi: machineData.prodn_effi
        ?? Math.round(LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor * 100)
    });
    if (normalized.is_active === false) {
      throw new Error('A machine added from entry setup must be active');
    }

    const setupValues = sanitizeLapFormerSetupUpdate({
      speed: normalized.speed,
      hank_constant: machineData.hank_constant ?? LAP_FORMER_FORMULA_FALLBACK.hankConstant,
      std_efficiency_factor: machineData.std_efficiency_factor
        ?? efficiencyFactorOrFallback(normalized.prodn_effi, LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor),
      shift_time: Number.isFinite(context.totalTime) && context.totalTime > 0
        ? context.totalTime
        : resolveLapFormerShiftFallbackTime(context.shift),
      divisor_constant: machineData.divisor_constant ?? LAP_FORMER_FORMULA_FALLBACK.divisorConstant,
      default_waste: machineData.default_waste ?? 0.85,
      delivery: machineData.delivery ?? LAP_FORMER_FORMULA_FALLBACK.delivery
    });
    assertPositiveSetupFields(
      setupValues,
      ['speed', 'hank_constant', 'std_efficiency_factor', 'shift_time', 'divisor_constant', 'delivery'],
      'Lap Former setup'
    );

    const maxSortResult = await tx.lap_former_machines.aggregate({ _max: { sort_order: true } });
    const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;
    const installedDate = validateInstalledDateForActivation(normalized.installed_date, context.entryDate);
    const newMachine = await tx.lap_former_machines.create({
      data: {
        machine_no: normalized.machine_no,
        mc_id: normalized.mc_id,
        description: normalized.description || `Lap Former Machine ${nextMcId}`,
        make_name: normalized.make_name || 'LMW',
        model: normalized.model || null,
        prodn_mixing: normalized.prodn_mixing || '64COMBED GOLD',
        speed: normalized.speed,
        prodn_efficiency: normalized.prodn_effi,
        installed_date: installedDate,
        is_active: true,
        activated_at: context.entryDate,
        deactivated_at: null,
        sort_order: nextSortOrder,
        direct_hank_entry: normalized.direct_hank_entry ?? false,
        direct_kgs_entry: normalized.direct_kgs_entry ?? false
      }
    });

    const stdProdn = calculateLapFormerStdProdn(
      setupValues,
      setupValues.shift_time,
      setupValues.speed
    );
    const newSetup = await tx.lap_former_machine_setup.create({
      data: {
        machine_id: newMachine.id,
        entry_date: context.entryDate,
        shift: context.shift,
        ...setupValues,
        std_prodn: Math.round(stdProdn * 100) / 100
      }
    });

    const totalTime = setupValues.shift_time;
    const workTime = Math.max(totalTime, 0);
    const detail = await tx.lap_former_production_detail.create({
      data: {
        header_id: context.headerId,
        machine_id: newMachine.id,
        prodn_mixing: newMachine.prodn_mixing,
        act_hank: 0,
        act_prodn: 0,
        std_prodn: Math.round(stdProdn * 100) / 100,
        exp_prodn: Math.round(stdProdn * 100) / 100,
        effi_percent: 0,
        uti_percent: totalTime > 0 ? 100 : 0,
        waste: setupValues.default_waste,
        waste_percent: 0,
        run_time: totalTime,
        work_time: workTime,
        total_stoppage_mins: 0,
        session_no: 1
      }
    });
    await tx.lap_former_stoppage_entry.create({
      data: { production_detail_id: detail.id, total_stoppage_time: 0 }
    });

    return { machine: newMachine, setup: newSetup, detail, reactivated: false };
  });
}

// Remove (delete) lap former machine
export async function removeLapFormerMachines(machineIds, entryContext) {
  return prisma.$transaction(tx => deactivateEntryMachines({
    headerModel: tx.lap_former_production_header,
    machineModel: tx.lap_former_machines,
    machineIds,
    context: entryContext,
    label: 'Lap Former production entry'
  }));
}

export async function removeLapFormerMachine(machineId, entryContext) {
  const result = await removeLapFormerMachines([machineId], entryContext);
  return {
    id: machineId,
    is_active: false,
    deactivated_at: result.entryDate
  };
}

// Update the current entry plus the canonical machine value used by new entries.
export async function updateLapFormerMachineMixing(machineId, newMixing, headerId = null) {
  return bulkUpdateLapFormerMachineMixing([machineId], newMixing, headerId);
}

// Bulk update the current entry plus canonical machine values used by new entries.
export async function bulkUpdateLapFormerMachineMixing(machineIds, newMixing, headerId = null) {
  const mixing = normalizeMixingValue(newMixing);

  return prisma.$transaction(async tx => {
    const context = await resolveMachineMixingContext({
      headerModel: tx.lap_former_production_header,
      machineModel: tx.lap_former_machines,
      headerId,
      machineIds
    });
    const updatedAt = new Date();

    const machines = await tx.lap_former_machines.updateMany({
      where: { id: { in: context.machineIds }, is_active: true },
      data: { prodn_mixing: mixing, updated_at: updatedAt }
    });
    const productionDetails = context.header
      ? await tx.lap_former_production_detail.updateMany({
          where: {
            header_id: context.header.id,
            machine_id: { in: context.machineIds }
          },
          data: { prodn_mixing: mixing, updated_at: updatedAt }
        })
      : { count: 0 };

    assertMachineUpdateCount(machines.count, context.machineIds.length, 'canonical machine');
    if (context.header) {
      assertMachineUpdateCount(productionDetails.count, context.machineIds.length, 'production detail');
    }

    return {
      machineCount: machines.count,
      productionDetailCount: productionDetails.count
    };
  }, { maxWait: 5000, timeout: 30000 });
}

// Get spinning count options for mixing dropdown
export async function getSpinningCountOptions() {
  const data = await prisma.spinning_counts.findMany({
    where: { is_active: true },
    select: {
      id: true,
      count_name: true,
      act_count: true,
      mixing_name: true
    },
    orderBy: { count_name: 'asc' }
  });
  return data || [];
}
