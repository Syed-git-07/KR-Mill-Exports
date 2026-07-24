import { prisma } from '../prisma';
import { resolveLapFormerShiftFallbackTime } from '../lapFormerShiftFallback';
import {
  LAP_FORMER_FORMULA_FALLBACK,
  calculateLapFormerStdProdn,
  getLapFormerActProdnConstant,
  resolveLapFormerFormulaInputs,
} from '../lapFormerFormulaFallback';
import { getOrCreateDateScopedSetups } from './dateScopedMachineSetup';
import { findFirstFreeStoppageSlot, getStoppageTotal } from '../stoppageSlotUtils';

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
  // Convert date string to Date object if needed
  let installed_date = machineData.installed_date;
  if (installed_date && typeof installed_date === 'string') {
    installed_date = new Date(installed_date);
  }
  
  // Parse mc_id to avoid NaN
  const mcId = machineData.mc_id ? parseInt(machineData.mc_id, 10) : null;
  
  const maxSortResult = await prisma.lap_former_machines.aggregate({ _max: { sort_order: true } });
  const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;
  
  const data = await prisma.lap_former_machines.create({
    data: {
      machine_no: machineData.machine_no,
      mc_id: mcId,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      installed_date: installed_date,
      is_active: machineData.is_active ?? true,
      activated_at: new Date(),
      deactivated_at: null,
      sort_order: nextSortOrder,
      direct_hank_entry: machineData.direct_hank_entry ?? false,
      direct_kgs_entry: machineData.direct_kgs_entry ?? false,
    }
  });
  return data;
}

// Update an existing lap former machine
export async function updateLapFormerMachine(id, machineData) {
  // Convert date string to Date object if needed
  let installed_date = machineData.installed_date;
  if (installed_date && typeof installed_date === 'string') {
    installed_date = new Date(installed_date);
  }
  
  const data = await prisma.lap_former_machines.update({
    where: { id },
    data: {
      machine_no: machineData.machine_no,
      ...(machineData.mc_id !== undefined && {
        mc_id: machineData.mc_id ? parseInt(machineData.mc_id, 10) : null
      }),
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      installed_date: installed_date,
      is_active: machineData.is_active,
      ...(machineData.is_active === true && { activated_at: new Date(), deactivated_at: null }),
      ...(machineData.is_active === false && { deactivated_at: new Date() }),
      direct_hank_entry: machineData.direct_hank_entry,
      direct_kgs_entry: machineData.direct_kgs_entry,
      updated_at: new Date(),
    }
  });
  return data;
}

// Delete a lap former machine (Permanent delete from master screen)
export async function deleteLapFormerMachine(id) {
  await prisma.lap_former_machines.delete({
    where: { id }
  });
  return true;
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
    where: {
      is_active: true,
      activated_at: { lte: entryDate },
      OR: [
        { deactivated_at: null },
        { deactivated_at: { gt: entryDate } }
      ]
    },
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
  const data = await prisma.lap_former_production_header.create({
    data: {
      entry_date: new Date(date),
      shift: shift,
      supervisor_id: supervisorId || null,
      maisitry_id: maisitryId || null,
      total_time: totalTime
    }
  });
  return data;
}

// Update production header
export async function updateLapFormerHeader(id, updates) {
  const data = await prisma.lap_former_production_header.update({
    where: { id },
    data: updates
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
    select: { entry_date: true }
  });
  const entryDate = header?.entry_date || new Date();

  // Only machines configured in machine setup should appear in production/stoppage
  const machineIdsWithSetup = (await prisma.lap_former_machine_setup.findMany({
    select: { machine_id: true }
  })).map(s => s.machine_id);

  // Get all lap former machines WITH SPEED visible on the entry date
  const machines = await prisma.lap_former_machines.findMany({
    where: {
      id: { in: machineIdsWithSetup },
      activated_at: { lte: entryDate },
      OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
    },
    select: { id: true, machine_no: true, prodn_mixing: true, speed: true, description: true },
    orderBy: { sort_order: 'asc' }
  });

  const newMachines = machines.filter(m => !existingMachineIds.includes(m.id));
  if (newMachines.length === 0) return existingDetails;

  // Get machine setup for default values
  const setups = await prisma.lap_former_machine_setup.findMany();

  // Create a map of machine_id to setup
  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });

  // Create detail records for each machine
  // Default stoppage: 0 mins for Lap Former
  const defaultStoppage = 0;
  const totalTime = Number(header?.total_time) || await getLapFormerShiftTime(header?.shift || 1);
  const defaultWorkTime = totalTime - defaultStoppage;

  const details = newMachines.map(machine => {
    const setup = setupMap[machine.id] || {};
    
    const stdProdn = calculateLapFormerStdProdn(setup, totalTime, machine.speed);
    // Exp.Prodn = Std.Prodn × (WorkTime / TotalTime)
    const expProdn = stdProdn * (defaultWorkTime / totalTime);
    
    return {
      header_id: headerId,
      machine_id: machine.id,
      prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: Math.round(stdProdn * 100) / 100,
      exp_prodn: Math.round(expProdn * 100) / 100,
      effi_percent: 0,
      uti_percent: Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100,
      waste: setup.default_waste ?? null,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      total_stoppage_mins: defaultStoppage, // Store total stoppage mins
      session_no: 1
    };
  });

  const data = await prisma.lap_former_production_detail.createMany({
    data: details
  });

  // Get created details
  const createdDetails = await prisma.lap_former_production_detail.findMany({
    where: {
      header_id: headerId,
      machine_id: { in: newMachines.map(m => m.id) }
    }
  });

  // Initialize stoppage entries for each detail (no default stoppage for Lap Former)
  const stoppageEntries = createdDetails.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_id: null,
    stoppage1_time: 0,
    stoppage2_id: null,
    stoppage2_time: 0,
    total_stoppage_time: 0
  }));

  await prisma.lap_former_stoppage_entry.createMany({
    data: stoppageEntries
  });

  return createdDetails;
}

// Sync newly added machines to an existing production header
// This function adds production details for machines that don't have entries yet
export async function syncNewMachinesToLapFormerHeader(headerId) {
  // Get header entry_date for date-based machine visibility
  const header = await prisma.lap_former_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true, shift: true, total_time: true }
  });
  const entryDate = header?.entry_date || new Date();

  const machineIdsWithSetup = (await prisma.lap_former_machine_setup.findMany({
    select: { machine_id: true }
  })).map(s => s.machine_id);

  // Get all active lap former machines based on entry date
  const allMachines = await prisma.lap_former_machines.findMany({
    where: {
      id: { in: machineIdsWithSetup },
      activated_at: { lte: entryDate },
      OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
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
  const allExistingMachines = existingMachineIds.length > 0
    ? await prisma.lap_former_machines.findMany({
        where: { id: { in: existingMachineIds } }
      })
    : [];

  const existingMachineMap = {};
  allExistingMachines.forEach(m => { existingMachineMap[m.id] = m; });

  const deactivatedDetailIds = existingDetails
    .filter(d => {
      const m = existingMachineMap[d.machine_id];
      if (!m) return false;
      if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return true;
      if (!machineIdsWithSetup.includes(m.id)) return true;
      return false;
    })
    .map(d => d.id);

  if (deactivatedDetailIds.length > 0) {
    await prisma.lap_former_stoppage_entry.deleteMany({
      where: { production_detail_id: { in: deactivatedDetailIds } }
    });
    await prisma.lap_former_production_detail.deleteMany({
      where: { id: { in: deactivatedDetailIds } }
    });
  }

  // Find machines that don't have details yet
  const remainingMachineIds = existingDetails
    .filter(d => !deactivatedDetailIds.includes(d.id))
    .map(d => d.machine_id);
  const newMachines = allMachines?.filter(m => !remainingMachineIds.includes(m.id)) || [];

  if (newMachines.length === 0) {
    return []; // No new machines to add
  }

  // Get machine setups
  const setups = await prisma.lap_former_machine_setup.findMany();

  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });

  // Default values
  const defaultStoppage = 0;
  const totalTime = Number(header?.total_time) || await getLapFormerShiftTime(header?.shift || 1);
  const defaultWorkTime = totalTime - defaultStoppage;

  // Create detail records for new machines
  const details = newMachines.map(machine => {
    const setup = setupMap[machine.id] || {};
    const stdProdn = calculateLapFormerStdProdn(setup, totalTime, machine.speed);
    const expProdn = stdProdn * (defaultWorkTime / totalTime);
    
    return {
      header_id: headerId,
      machine_id: machine.id,
      prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: Math.round(stdProdn * 100) / 100,
      exp_prodn: Math.round(expProdn * 100) / 100,
      effi_percent: 0,
      uti_percent: Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100,
      waste: setup.default_waste ?? null,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      total_stoppage_mins: defaultStoppage,
      session_no: 1
    };
  });

  await prisma.lap_former_production_detail.createMany({
    data: details
  });

  const createdDetails = await prisma.lap_former_production_detail.findMany({
    where: {
      header_id: headerId,
      machine_id: { in: newMachines.map(m => m.id) }
    }
  });

  // Create stoppage entries for new details
  const stoppageEntries = createdDetails.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_id: null,
    stoppage1_time: 0,
    stoppage2_id: null,
    stoppage2_time: 0,
    total_stoppage_time: 0
  }));

  await prisma.lap_former_stoppage_entry.createMany({
    data: stoppageEntries
  });

  return createdDetails;
}

// Update production detail
export async function updateLapFormerDetail(id, updates) {
  // Remove any fields that shouldn't be updated
  const { speed, machine, stoppage, ...cleanUpdates } = updates;
  
  try {
    const data = await prisma.lap_former_production_detail.update({
      where: { id },
      data: cleanUpdates
    });
    return data;
  } catch (error) {
    console.error('updateLapFormerDetail error:', error);
    throw new Error(`Failed to update production detail: ${error.message}`);
  }
}

// Bulk update production details
export async function bulkUpdateLapFormerDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    prisma.lap_former_production_detail.update({
      where: { id },
      data
    })
  );

  const results = await Promise.all(promises);
  return results;
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
  try {
    // First, fetch the existing record to get current stoppage values and production_detail_id
    const existing = await prisma.lap_former_stoppage_entry.findUnique({
      where: { id },
      select: {
        production_detail_id: true,
        stoppage1_time: true,
        stoppage2_time: true,
        stoppage3_time: true,
        stoppage4_time: true
      }
    });

    if (!existing) {
      throw new Error(`Stoppage entry ${id} not found`);
    }

    // Merge existing values with updates - use updated value if provided, else keep existing
    const mergedStoppages = {
      stoppage1_time: updates.stoppage1_time ?? existing?.stoppage1_time ?? 0,
      stoppage2_time: updates.stoppage2_time ?? existing?.stoppage2_time ?? 0,
      stoppage3_time: updates.stoppage3_time ?? existing?.stoppage3_time ?? 0,
      stoppage4_time: updates.stoppage4_time ?? existing?.stoppage4_time ?? 0
    };

    // Calculate total stoppage time from merged values
    const total = mergedStoppages.stoppage1_time + 
                  mergedStoppages.stoppage2_time + 
                  mergedStoppages.stoppage3_time + 
                  mergedStoppages.stoppage4_time;

    const data = await prisma.lap_former_stoppage_entry.update({
      where: { id },
      data: {
        ...updates,
        ...mergedStoppages,
        total_stoppage_time: total
      }
    });

    // Also update the total_stoppage_mins, work_time, and uti_percent in production_detail
    const detail = await prisma.lap_former_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: { header_id: true }
    });

    const header = detail?.header_id
      ? await prisma.lap_former_production_header.findUnique({
          where: { id: detail.header_id },
          select: { total_time: true, shift: true }
        })
      : null;

    const totalTime = Number(header?.total_time) || await getLapFormerShiftTime(header?.shift || 1)
    const workTime = totalTime - total
    const utiPercent = Math.round((workTime / totalTime) * 100 * 100) / 100

    await prisma.lap_former_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        total_stoppage_mins: total,
        work_time: workTime,
        uti_percent: utiPercent
      }
    });

    return data;
  } catch (error) {
    console.error('Error updating stoppage entry:', error);
    throw new Error(`Failed to fetch/update stoppage entry: ${error.message}`);
  }
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
          where: {
            id: { in: machineIds },
            is_active: true
          },
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
  const [machines, headerDetails] = await Promise.all([
    prisma.lap_former_machines.findMany({
      where: { is_active: true },
      select: {
        id: true,
        machine_no: true,
        description: true,
        make_name: true,
        prodn_mixing: true,
        speed: true,
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

  const machineIds = machines.map(m => m.id);
  const data = await getOrCreateDateScopedSetups({
    setupModel: prisma.lap_former_machine_setup,
    headerModel: prisma.lap_former_production_header,
    headerId: validHeaderId,
    machineIds
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
    data: updates
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

  if (!lapFormerDept?.id) return [];

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
// Constst = (1 / 2.20456 / Hank) × Delivery
// Act Prodn = Act Hank × Constst
// Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery
// Exp Prodn = Std Prodn × (Work Time / Total Time)
// Act Effi % = Actual Prodn / Exp Prodn × 100
// UTI % = Work Time / Total Time × 100
// Waste % = Waste / Actual Prodn × 100
// Work Time = Total Time − Total Stoppage
//
// KEY DIFFERENCE: Lap Former uses Hank = 0.0082 (not 0.14 like Breaker Drawing)

export function calculateLapFormerValues(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed = null) {
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveLapFormerFormulaInputs(setup, machineSpeed);
  const waste = setup?.default_waste ?? null;

  // Constst = (1 / 2.20456 / Hank) × Delivery
  const constst = getLapFormerActProdnConstant({ hank_constant: hankConstant, delivery });
  // Act Prodn = manually entered value (if provided), else Act Hank × Constst
  const hasManualActProdn = actProdn !== null && actProdn !== undefined && !Number.isNaN(Number(actProdn));
  const calculatedActProdn = hasManualActProdn ? Number(actProdn) : (actHank * constst);

  // Work Time = Total Time - Stoppage Time
  const workTime = totalTime - stoppageTime;
  
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
  const expProdn = stdProdn * (workTime / totalTime);

  // Effi% = Act Prodn / Exp Prodn × 100
  const effiPercent = expProdn > 0 ? (calculatedActProdn / expProdn) * 100 : 0;

  // UTI% = Work Time / Total Time × 100
  const utiPercent = (workTime / totalTime) * 100;

  // Waste% = Waste / Act Prodn × 100
  const wastePercent = calculatedActProdn > 0 ? (waste / calculatedActProdn) * 100 : 0;

  return {
    act_prodn: Math.round(calculatedActProdn * 100) / 100,
    std_prodn: Math.round(stdProdn * 100) / 100,
    exp_prodn: Math.round(expProdn * 100) / 100,
    effi_percent: Math.round(effiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    waste,
    waste_percent: Math.round(wastePercent * 100) / 100,
    run_time: totalTime,
    work_time: workTime,
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
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getLapFormerAvailableDates(beforeDate, shift, limit = 30) {
  const data = await prisma.lap_former_production_header.findMany({
    where: {
      shift: shift,
      entry_date: { lt: new Date(beforeDate) }
    },
    select: { entry_date: true, shift: true },
    orderBy: { entry_date: 'desc' },
    take: limit
  });
  
  return data || [];
}

// Copy data from a previous date
export async function copyLapFormerFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  // If no sourceDate provided, calculate yesterday's date
  let previousDate = sourceDate;
  if (!previousDate) {
    const targetDateObj = new Date(targetDate);
    const yesterdayDateObj = new Date(targetDateObj);
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
    previousDate = yesterdayDateObj.toISOString().split('T')[0];
  }
  
  // Get source header
  const sourceHeader = await getLapFormerProductionByDateShift(previousDate, targetShift);
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`);
  }
  
  // Get source production details
  const sourceDetails = await prisma.lap_former_production_detail.findMany({
    where: { header_id: sourceHeader.id }
  });
  
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`);
  }
  
  // Get source stoppage entries
  const sourceStoppages = await prisma.lap_former_stoppage_entry.findMany({
    where: {
      production_detail_id: { in: sourceDetails.map(d => d.id) }
    }
  });
  
  // Get target's existing production details
  const targetDetails = await prisma.lap_former_production_detail.findMany({
    where: { header_id: targetHeaderId }
  });
  
  // Create a map of machine_id to source data
  const sourceDataMap = {};
  sourceDetails.forEach(d => {
    sourceDataMap[d.machine_id] = d;
  });
  
  const sourceStoppageMap = {};
  sourceStoppages?.forEach(s => {
    const detail = sourceDetails.find(d => d.id === s.production_detail_id);
    if (detail) {
      sourceStoppageMap[detail.machine_id] = s;
    }
  });
  
  // Update target details with source data
  const updatePromises = targetDetails.map(async (targetDetail) => {
    const sourceData = sourceDataMap[targetDetail.machine_id];
    if (!sourceData) return null;
    
    const data = await prisma.lap_former_production_detail.update({
      where: { id: targetDetail.id },
      data: {
        employee_name: sourceData.employee_name,
        prodn_mixing: sourceData.prodn_mixing,
        act_hank: sourceData.act_hank,
        act_prodn: sourceData.act_prodn,
        std_prodn: sourceData.std_prodn,
        exp_prodn: sourceData.exp_prodn,
        effi_percent: sourceData.effi_percent,
        uti_percent: sourceData.uti_percent,
        waste: sourceData.waste,
        waste_percent: sourceData.waste_percent,
        work_time: sourceData.work_time,
        run_time: sourceData.run_time
      }
    });
    return data;
  });
  
  await Promise.all(updatePromises.filter(Boolean));
  
  // Update target stoppage entries
  const targetStoppages = await prisma.lap_former_stoppage_entry.findMany({
    where: {
      production_detail_id: { in: targetDetails.map(d => d.id) }
    },
    include: {
      production_detail: { select: { machine_id: true } }
    }
  });
  
  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetStoppage.production_detail?.machine_id;
    const sourceStoppage = sourceStoppageMap[machineId];
    if (!sourceStoppage) return null;
    
    const data = await prisma.lap_former_stoppage_entry.update({
      where: { id: targetStoppage.id },
      data: {
        stoppage1_id: sourceStoppage.stoppage1_id,
        stoppage1_time: sourceStoppage.stoppage1_time,
        stoppage2_id: sourceStoppage.stoppage2_id,
        stoppage2_time: sourceStoppage.stoppage2_time,
        stoppage3_id: sourceStoppage.stoppage3_id,
        stoppage3_time: sourceStoppage.stoppage3_time,
        stoppage4_id: sourceStoppage.stoppage4_id,
        stoppage4_time: sourceStoppage.stoppage4_time,
        total_stoppage_time: sourceStoppage.total_stoppage_time
      }
    });
    return data;
  }) || [];
  
  await Promise.all(stoppageUpdatePromises.filter(Boolean));
  
  return {
    success: true,
    copiedFrom: previousDate,
    machinesUpdated: targetDetails.length
  };
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
export async function addLapFormerMachine(machineData) {
  if (machineData.machine_no) {
    const existingMachine = await prisma.lap_former_machines.findFirst({
      where: { machine_no: machineData.machine_no }
    });

    if (existingMachine) {
      let machine = existingMachine;
      let reactivated = false;

      if (!existingMachine.is_active) {
        machine = await prisma.lap_former_machines.update({
          where: { id: existingMachine.id },
          data: {
            is_active: true,
            activated_at: new Date(),
            deactivated_at: null,
            description: machineData.description || existingMachine.description,
            make_name: machineData.make_name || existingMachine.make_name || 'LMW',
            model: machineData.model || existingMachine.model || null,
            installed_date: machineData.installed_date
              ? new Date(machineData.installed_date)
              : existingMachine.installed_date,
            prodn_mixing: machineData.prodn_mixing || existingMachine.prodn_mixing || '64COMBED GOLD',
            speed: machineData.speed || existingMachine.speed || LAP_FORMER_FORMULA_FALLBACK.speed,
            prodn_efficiency: machineData.prodn_effi ?? existingMachine.prodn_efficiency
          }
        });
        reactivated = true;
      }

      const existingSetup = await prisma.lap_former_machine_setup.findFirst({
        where: { machine_id: machine.id }
      });

      if (existingSetup) {
        if (!reactivated) {
          throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
        }
        return { machine, setup: existingSetup, reactivated: true };
      }

      const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveLapFormerFormulaInputs(
        {
          speed: machineData.speed,
          hank_constant: machineData.hank_constant,
          std_efficiency_factor: machineData.std_efficiency_factor,
          divisor_constant: machineData.divisor_constant,
          delivery: machineData.delivery,
        },
        machine.speed
      );
      const shiftTime = machineData.shift_time || resolveLapFormerShiftFallbackTime(1);
      const stdProdn = calculateLapFormerStdProdn(
        {
          speed,
          hank_constant: hankConstant,
          std_efficiency_factor: stdEfficiencyFactor,
          divisor_constant: divisorConstant,
          delivery,
        },
        shiftTime,
        speed
      );

      const setup = await prisma.lap_former_machine_setup.create({
        data: {
          machine_id: machine.id,
          speed,
          hank_constant: hankConstant,
          std_efficiency_factor: stdEfficiencyFactor,
          shift_time: shiftTime,
          divisor_constant: divisorConstant,
          default_waste: machineData.default_waste ?? null,
          delivery,
          std_prodn: Math.round(stdProdn * 100) / 100
        }
      });

      return { machine, setup, reactivated };
    }
  }

  // Get the max mc_id to generate next one
  const maxMachine = await prisma.lap_former_machines.findFirst({
    select: { mc_id: true, machine_no: true },
    orderBy: { mc_id: 'desc' }
  });

  const nextMcId = (maxMachine?.mc_id || 0) + 1;
  const nextMachineNo = machineData.machine_no || `LF${nextMcId}`;

  const maxSortResult = await prisma.lap_former_machines.findFirst({
    orderBy: { sort_order: 'desc' },
    select: { sort_order: true }
  });
  const nextSortOrder = (maxSortResult?.sort_order || 0) + 1;

  // Insert new machine
  const newMachine = await prisma.lap_former_machines.create({
    data: {
      machine_no: nextMachineNo,
      mc_id: nextMcId,
      description: machineData.description || `Lap Former Machine ${nextMcId}`,
      make_name: machineData.make_name || 'LMW',
      model: machineData.model || null,
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      speed: machineData.speed || LAP_FORMER_FORMULA_FALLBACK.speed,
      prodn_efficiency: machineData.prodn_effi ?? null,
      installed_date: machineData.installed_date ? new Date(machineData.installed_date) : null,
      is_active: true,
      activated_at: new Date(),
      deactivated_at: null,
      sort_order: nextSortOrder
    }
  });

  // Create machine setup for the new machine
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveLapFormerFormulaInputs({
    speed: machineData.speed,
    hank_constant: machineData.hank_constant,
    std_efficiency_factor: machineData.std_efficiency_factor,
    divisor_constant: machineData.divisor_constant,
    delivery: machineData.delivery,
  }, machineData.speed);
  const shiftTime = machineData.shift_time || resolveLapFormerShiftFallbackTime(1);
  const stdProdn = calculateLapFormerStdProdn(
    {
      speed,
      hank_constant: hankConstant,
      std_efficiency_factor: stdEfficiencyFactor,
      divisor_constant: divisorConstant,
      delivery,
    },
    shiftTime,
    speed
  );

  const newSetup = await prisma.lap_former_machine_setup.create({
    data: {
      machine_id: newMachine.id,
      speed: speed,
      hank_constant: hankConstant,
      std_efficiency_factor: stdEfficiencyFactor,
      shift_time: shiftTime,
      divisor_constant: divisorConstant,
      default_waste: machineData.default_waste ?? null,
      delivery: delivery,
      std_prodn: Math.round(stdProdn * 100) / 100
    }
  });

  return { machine: newMachine, setup: newSetup, reactivated: false };
}

// Remove (delete) lap former machine
export async function removeLapFormerMachine(machineId) {
  // Soft delete machine
  const data = await prisma.lap_former_machines.update({
    where: { id: machineId },
    data: { is_active: false, deactivated_at: new Date() }
  });
  return data;
}

// Update machine mixing/count on setup table and header details
export async function updateLapFormerMachineMixing(machineId, newMixing, headerId = null) {
  if (headerId) {
    await prisma.lap_former_production_detail.updateMany({
      where: { header_id: headerId, machine_id: machineId },
      data: { prodn_mixing: newMixing }
    });
  }
  const data = await prisma.lap_former_machine_setup.updateMany({
    where: { machine_id: machineId },
    data: { prodn_mixing: newMixing }
  });
  return data;
}

// Bulk update machine mixing/count on setup table and header details
export async function bulkUpdateLapFormerMachineMixing(machineIds, newMixing, headerId = null) {
  if (headerId && machineIds?.length > 0) {
    await prisma.lap_former_production_detail.updateMany({
      where: { header_id: headerId, machine_id: { in: machineIds } },
      data: { prodn_mixing: newMixing }
    });
  }
  const data = await prisma.lap_former_machine_setup.updateMany({
    where: { machine_id: { in: machineIds } },
    data: { prodn_mixing: newMixing }
  });
  return data;
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
