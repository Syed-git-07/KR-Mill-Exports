import { prisma } from '../prisma';
import { resolveBreakerDrawingShiftFallbackTime } from '../breakerDrawingShiftFallback';
import { calculateBreakerDrawingStdProdn, resolveBreakerDrawingFormulaInputs, BREAKER_DRAWING_FORMULA_FALLBACK } from '../breakerDrawingFormulaFallback';

// ============================================
// SHIFT CONFIGURATION QUERIES
// ============================================

// Get shift configuration for BREAKER DRAWING department from database
export async function getBreakerDrawingShiftConfig(shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'BREAKER',
        shift: parseInt(shift),
        is_active: true
      }
    });
    return data;
  } catch (error) {
    throw error;
  }
}

// Get shift time for breaker drawing based on shift number
export async function getBreakerDrawingShiftTime(shift) {
  const config = await getBreakerDrawingShiftConfig(shift);
  return config?.shift_time || resolveBreakerDrawingShiftFallbackTime(shift);
}

// No default stoppage for breaker drawing - always 0
export async function getBreakerDrawingDefaultStoppage(shift) {
  return 0;
}

// Get shift configuration object (for use in functions that need totalTime)
export async function getBreakerDrawingShiftConfiguration(shift) {
  const config = await getBreakerDrawingShiftConfig(shift);
  const shiftTime = config?.shift_time || resolveBreakerDrawingShiftFallbackTime(shift);
  return { 
    totalTime: shiftTime,
    defaultStoppage: 0
  };
}

function isBreakerMachineVisibleOnDate(machine, entryDate) {
  if (!machine) return false;
  const date = entryDate ? new Date(entryDate) : null;
  if (!date) return true;
  const activated = machine.activated_at ? new Date(machine.activated_at) : null;
  const deactivated = machine.deactivated_at ? new Date(machine.deactivated_at) : null;
  if (activated && activated > date) return false;
  if (deactivated && deactivated <= date) return false;
  return true;
}

// ============================================
// BREAKER DRAWING PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers
export async function getBreakerDrawingProductionHeaders() {
  const data = await prisma.breaker_drawing_production_header.findMany({
    orderBy: { entry_date: 'desc' }
  });
  return data;
}

// Get production header by date and shift
export async function getBreakerDrawingProductionByDateShift(date, shift) {
  const data = await prisma.breaker_drawing_production_header.findFirst({
    where: {
      entry_date: new Date(date),
      shift: shift
    }
  });
  return data;
}

// Create or get production header
export async function getOrCreateBreakerDrawingHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getBreakerDrawingProductionByDateShift(date, shift);
  if (existing) return existing;

  // Get shift configuration for total_time from database
  const shiftConfig = await getBreakerDrawingShiftConfiguration(shift);

  // Create new header
  const data = await prisma.breaker_drawing_production_header.create({
    data: {
      entry_date: new Date(date),
      shift: shift,
      supervisor_id: supervisorId || null,
      maisitry_id: maisitryId || null,
      total_time: shiftConfig.totalTime
    }
  });
  return data;
}

// Update production header
export async function updateBreakerDrawingHeader(id, updates) {
  const data = await prisma.breaker_drawing_production_header.update({
    where: { id },
    data: updates
  });
  return data;
}

// ============================================
// BREAKER DRAWING PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getBreakerDrawingProductionDetails(headerId) {
  const data = await prisma.breaker_drawing_production_detail.findMany({
    where: { header_id: headerId },
    orderBy: { machine_id: 'asc' }
  });

  const machineIds = [...new Set((data || []).map(d => d.machine_id).filter(Boolean))];
  const machines = machineIds.length > 0
    ? await prisma.drawing_breaker_machines.findMany({
        where: { id: { in: machineIds } },
        select: {
          id: true,
          machine_no: true,
          description: true,
          prodn_mixing: true,
          activated_at: true,
          deactivated_at: true
        }
      })
    : [];

  const machineMap = {};
  machines.forEach(m => {
    machineMap[m.id] = m;
  });

  const header = await prisma.breaker_drawing_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true }
  });
  const entryDate = header?.entry_date || null;

  return (data || [])
    .map(d => ({ ...d, machine: machineMap[d.machine_id] || null }))
    .filter(d => isBreakerMachineVisibleOnDate(d.machine, entryDate));
}

// Get production details with machine setup for a header (for display)
// Speed is fetched from machine table (source of truth)
export async function getBreakerDrawingProductionWithSetup(headerId) {
  const data = await prisma.breaker_drawing_production_detail.findMany({
    where: {
      header_id: headerId
    }
  });

  const detailIds = (data || []).map(d => d.id);
  const machineIds = [...new Set((data || []).map(d => d.machine_id).filter(Boolean))];

  const [machines, stoppages] = await Promise.all([
    machineIds.length > 0
      ? prisma.drawing_breaker_machines.findMany({
          where: { id: { in: machineIds } },
          select: { id: true, machine_no: true, description: true, prodn_mixing: true, mc_id: true, speed: true, is_active: true }
        })
      : Promise.resolve([]),
    detailIds.length > 0
      ? prisma.breaker_drawing_stoppage_entry.findMany({
          where: { production_detail_id: { in: detailIds } }
        })
      : Promise.resolve([])
  ]);

  const machineMap = {};
  machines.forEach(m => {
    machineMap[m.id] = m;
  });

  const stoppageMap = {};
  stoppages.forEach(s => {
    if (!stoppageMap[s.production_detail_id]) stoppageMap[s.production_detail_id] = [];
    stoppageMap[s.production_detail_id].push(s);
  });

  const enriched = (data || []).map(d => ({
    ...d,
    machine: machineMap[d.machine_id] || null,
    stoppage: stoppageMap[d.id] || []
  }));
  
  // Sort by natural machine number order (BD1, BD2, BD3, BD4)
  return enriched?.sort((a, b) => {
    const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];
}

// Initialize production details for all breaker drawing machines
// Speed is fetched from machine table (source of truth)
export async function initializeBreakerDrawingDetails(headerId, shift = 1) {
  // Get shift configuration from database
  const shiftConfig = await getBreakerDrawingShiftConfiguration(shift);
  const totalTime = shiftConfig.totalTime;
  const defaultStoppage = shiftConfig.defaultStoppage;
  
  // Get entry_date from header for date-based machine visibility
  const headerForDate = await prisma.breaker_drawing_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true }
  });
  const entryDate = headerForDate?.entry_date || new Date();

  // Get all breaker drawing machines visible on this entry date (not yet deactivated)
  // Only include machines that have a setup entry — master-only machines (no setup) are excluded
  const machines = await prisma.drawing_breaker_machines.findMany({
    where: {
      activated_at: { lte: entryDate },
      OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
    },
    select: { id: true, machine_no: true, prodn_mixing: true, speed: true },
    orderBy: { mc_id: 'asc' }
  });

  // Get machine setup for default values (except speed which comes from machine)
  const setups = await prisma.breaker_drawing_machine_setup.findMany();
  const setupMachineIds = new Set((setups || []).map(s => s.machine_id));
  const machinesWithSetup = (machines || []).filter(m => setupMachineIds.has(m.id));

  // Create a map of machine_id to setup
  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });

  // Create detail records for each machine
  const defaultWorkTime = totalTime - defaultStoppage;

  const details = machinesWithSetup.map(machine => {
    const setup = setupMap[machine.id] || {};
    // Use machine/setup values with centralized fallback-only defaults.
    const stdProdn = calculateBreakerDrawingStdProdn(setup, totalTime, machine.speed);
    // Exp.Prodn = Std.Prodn × (WorkTime / TotalTime)
    const expProdn = stdProdn * (defaultWorkTime / totalTime);
    
    return {
      header_id: headerId,
      machine_id: machine.id,
      prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: stdProdn,
      exp_prodn: Math.round(expProdn * 100) / 100,
      effi_percent: 0,
      uti_percent: Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100,
      waste: setup.default_waste ?? null,
      waste_percent: 0,
      run_time: totalTime,  // Run time = Shift time
      work_time: defaultWorkTime,
      session_no: 1
    };
  });

  await prisma.breaker_drawing_production_detail.createMany({
    data: details
  });

  const createdData = await prisma.breaker_drawing_production_detail.findMany({
    where: { header_id: headerId }
  });

  // Initialize stoppage entries for each detail with no pre-filled stoppages
  const stoppageEntries = createdData.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_id: null,
    stoppage1_time: 0,
    stoppage2_id: null,
    stoppage2_time: 0,
    total_stoppage_time: 0
  }));

  await prisma.breaker_drawing_stoppage_entry.createMany({
    data: stoppageEntries
  });

  return createdData;
}

// Sync newly added machines to an existing header
// This adds production details and stoppage entries for any active machines
// that don't already have records in this header
export async function syncNewMachinesToBreakerDrawingHeader(headerId, shift = 1) {
  // Get shift configuration from database
  const shiftConfig = await getBreakerDrawingShiftConfiguration(shift);
  const totalTime = shiftConfig.totalTime;
  const defaultStoppage = shiftConfig.defaultStoppage;
  
  // Get entry_date from header for date-based machine visibility
  const headerForDate = await prisma.breaker_drawing_production_header.findUnique({
    where: { id: headerId },
    select: { entry_date: true }
  });
  const entryDate = headerForDate?.entry_date || new Date();

  // Get all machines visible on this entry date
  // Only include machines with a setup entry — master-only machines (no setup) are excluded
  const allMachines = await prisma.drawing_breaker_machines.findMany({
    where: {
      activated_at: { lte: entryDate },
      OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
    },
    select: { id: true, machine_no: true, prodn_mixing: true, speed: true },
    orderBy: { mc_id: 'asc' }
  });

  const setups = await prisma.breaker_drawing_machine_setup.findMany();
  const setupMachineIds = new Set((setups || []).map(s => s.machine_id));
  const allMachinesWithSetup = (allMachines || []).filter(m => setupMachineIds.has(m.id));

  // Get existing production details for this header
  const existingDetails = await prisma.breaker_drawing_production_detail.findMany({
    where: { header_id: headerId },
    select: { id: true, machine_id: true }
  });

  // Delete rows for machines that are no longer visible on this entry date
  const existingMachineIdsList = existingDetails?.map(d => d.machine_id) || [];
  const allExistingMachines = existingMachineIdsList.length > 0
    ? await prisma.drawing_breaker_machines.findMany({
        where: { id: { in: existingMachineIdsList } },
        select: { id: true, deactivated_at: true }
      })
    : [];
  const existingMachineMap = {};
  allExistingMachines.forEach(m => { existingMachineMap[m.id] = m; });

  const staleDetailIds = existingDetails
    .filter(d => {
      const m = existingMachineMap[d.machine_id];
      // Remove if machine was deactivated on or before the entry date
      if (m?.deactivated_at && new Date(m.deactivated_at) <= entryDate) return true;
      // Remove if machine has no setup (was created via master only, not via Machine Setup tab)
      if (m && !setupMachineIds.has(m.id)) return true;
      return false;
    })
    .map(d => d.id);

  if (staleDetailIds.length > 0) {
    await prisma.breaker_drawing_stoppage_entry.deleteMany({
      where: { production_detail_id: { in: staleDetailIds } }
    });
    await prisma.breaker_drawing_production_detail.deleteMany({
      where: { id: { in: staleDetailIds } }
    });
  }

  // Find only truly new machines (after stale row cleanup)
  const remainingMachineIds = existingDetails
    .filter(d => !staleDetailIds.includes(d.id))
    .map(d => d.machine_id);
  const newMachines = allMachinesWithSetup?.filter(m => !remainingMachineIds.includes(m.id)) || [];

  if (newMachines.length === 0) {
    return []; // No new machines to add
  }

  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });

  // Use shift-based configuration
  const defaultWorkTime = totalTime - defaultStoppage;

  // Create detail records for new machines
  const details = newMachines.map(machine => {
    const setup = setupMap[machine.id] || {};
    const stdProdn = calculateBreakerDrawingStdProdn(setup, totalTime, machine.speed);
    const expProdn = stdProdn * (defaultWorkTime / totalTime);
    
    return {
      header_id: headerId,
      machine_id: machine.id,
      prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: stdProdn,
      exp_prodn: Math.round(expProdn * 100) / 100,
      effi_percent: 0,
      uti_percent: Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100,
      waste: setup.default_waste ?? null,
      waste_percent: 0,
      run_time: totalTime,  // Run time = Shift time
      work_time: defaultWorkTime,
      session_no: 1
    };
  });

  await prisma.breaker_drawing_production_detail.createMany({
    data: details
  });

  const createdData = await prisma.breaker_drawing_production_detail.findMany({
    where: {
      header_id: headerId,
      machine_id: { in: newMachines.map(m => m.id) }
    }
  });

  // Create stoppage entries for new details with no pre-filled stoppages
  const stoppageEntries = createdData.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_id: null,
    stoppage1_time: 0,
    stoppage2_id: null,
    stoppage2_time: 0,
    total_stoppage_time: 0
  }));

  await prisma.breaker_drawing_stoppage_entry.createMany({
    data: stoppageEntries
  });

  return createdData;
}

// Update production detail
export async function updateBreakerDrawingDetail(id, updates) {
  // Remove any fields that shouldn't be updated (like speed from calculations)
  const { speed, machine, stoppage, ...cleanUpdates } = updates;
  
  try {
    const data = await prisma.breaker_drawing_production_detail.update({
      where: { id },
      data: cleanUpdates
    });
    return data;
  } catch (error) {
    console.error('updateBreakerDrawingDetail error:', error);
    throw new Error(`Failed to update production detail: ${error.message}`);
  }
}

// Bulk update production details
export async function bulkUpdateBreakerDrawingDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    prisma.breaker_drawing_production_detail.update({
      where: { id },
      data
    })
  );

  const results = await Promise.all(promises);
  return results;
}

// ============================================
// BREAKER DRAWING STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
// Speed is fetched from machine table (source of truth)
export async function getBreakerDrawingStoppageEntries(headerId) {
  const data = await prisma.breaker_drawing_stoppage_entry.findMany({
    orderBy: { production_detail_id: 'asc' }
  });

  // Filter to only include entries for this header (no is_active filter — deactivated machines must still show in past entries)
  const details = await prisma.breaker_drawing_production_detail.findMany({
    where: {
      header_id: headerId
    },
    select: { id: true }
  });

  const detailIds = details?.map(d => d.id) || [];
  const filtered = data?.filter(s => detailIds.includes(s.production_detail_id)) || [];

  const productionDetails = detailIds.length > 0
    ? await prisma.breaker_drawing_production_detail.findMany({
        where: { id: { in: detailIds } },
        select: {
          id: true,
          machine_id: true,
          std_prodn: true,
          exp_prodn: true,
          effi_percent: true,
          uti_percent: true,
          work_time: true,
          session_no: true,
          act_hank: true,
          act_prodn: true,
          waste: true,
          run_time: true
        }
      })
    : [];

  const machineIds = [...new Set((productionDetails || []).map(d => d.machine_id).filter(Boolean))];
  const reasonIds = [...new Set(
    filtered.flatMap(s => [s.stoppage1_id, s.stoppage2_id, s.stoppage3_id, s.stoppage4_id]).filter(Boolean)
  )];

  const [machines, reasons] = await Promise.all([
    machineIds.length > 0
      ? prisma.drawing_breaker_machines.findMany({
          where: { id: { in: machineIds } },
          select: { id: true, machine_no: true, speed: true, is_active: true }
        })
      : Promise.resolve([]),
    reasonIds.length > 0
      ? prisma.stoppage_details.findMany({
          where: { id: { in: reasonIds } },
          select: { id: true, stoppage_name: true, short_code: true }
        })
      : Promise.resolve([])
  ]);

  const machineMap = {};
  machines.forEach(m => { machineMap[m.id] = m; });
  const detailMap = {};
  productionDetails.forEach(d => {
    detailMap[d.id] = { ...d, machine: machineMap[d.machine_id] || null };
  });
  const reasonMap = {};
  reasons.forEach(r => { reasonMap[r.id] = r; });

  return filtered.map(s => ({
    ...s,
    production_detail: detailMap[s.production_detail_id] || null,
    stoppage1: s.stoppage1_id ? (reasonMap[s.stoppage1_id] || null) : null,
    stoppage2: s.stoppage2_id ? (reasonMap[s.stoppage2_id] || null) : null,
    stoppage3: s.stoppage3_id ? (reasonMap[s.stoppage3_id] || null) : null,
    stoppage4: s.stoppage4_id ? (reasonMap[s.stoppage4_id] || null) : null
  }));
}

// Update stoppage entry
export async function updateBreakerDrawingStoppageEntry(id, updates) {
  try {
    // First, fetch the existing record to get current stoppage values
    const existing = await prisma.breaker_drawing_stoppage_entry.findUnique({
      where: { id },
      select: {
        stoppage1_time: true,
        stoppage2_time: true,
        stoppage3_time: true,
        stoppage4_time: true
      }
    });

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

    const data = await prisma.breaker_drawing_stoppage_entry.update({
      where: { id },
      data: {
        ...updates,
        ...mergedStoppages,
        total_stoppage_time: total
      }
    });

    // Also update the total_stoppage_mins, work_time, and uti_percent in production_detail
    const detail = await prisma.breaker_drawing_production_detail.findUnique({
      where: { id: data.production_detail_id },
      select: { run_time: true, header_id: true }
    });
    const header = detail?.header_id
      ? await prisma.breaker_drawing_production_header.findUnique({
          where: { id: detail.header_id },
          select: { total_time: true, shift: true }
        })
      : null
    const totalTime = detail?.run_time || header?.total_time || resolveBreakerDrawingShiftFallbackTime(header?.shift)
    const workTime = totalTime - total
    const utiPercent = Math.round((workTime / totalTime) * 100 * 100) / 100

    await prisma.breaker_drawing_production_detail.update({
      where: { id: data.production_detail_id },
      data: {
        total_stoppage_mins: total,
        work_time: workTime,
        uti_percent: utiPercent
      }
    });

    return data;
  } catch (error) {
    console.error('Error updating stoppage entry:', error);
    throw new Error(`Failed to update stoppage entry: ${error.message}`);
  }
}

// Apply full stoppage to all machines and recalculate production
export async function applyBreakerDrawingFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  // Get all stoppage entries for this header
  const stoppages = await getBreakerDrawingStoppageEntries(headerId);
  const header = await prisma.breaker_drawing_production_header.findUnique({
    where: { id: headerId },
    select: { total_time: true, shift: true }
  });
  const fallbackRunTime = header?.total_time || resolveBreakerDrawingShiftFallbackTime(header?.shift);
  
  // Get machine setups for recalculation (speed already merged from machine table)
  const setups = await getBreakerDrawingMachineSetups();
  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });

  const stoppageIdField = `stoppage${slot}_id`;
  const stoppageTimeField = `stoppage${slot}_time`;

  // Update stoppage entries
  const updates = stoppages.map(s => ({
    id: s.id,
    [stoppageIdField]: stoppageId,
    [stoppageTimeField]: stoppageTime,
    is_full_stoppage: slot === 1
  }));

  const stoppagePromises = updates.map(({ id, ...data }) =>
    updateBreakerDrawingStoppageEntry(id, data)
  );

  const updatedStoppages = await Promise.all(stoppagePromises);
  
  // Recalculate production for each machine
  const prodPromises = stoppages.map(async (s) => {
    if (!s.production_detail) return null;
    
    const prodDetail = s.production_detail;
    const machineId = prodDetail.machine_id;
    const setup = setupMap[machineId];
    // Speed from machine table (setup has merged machine speed)
    const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed;
    
    // Calculate new total stoppage
    const currentStoppage = s;
    const newTotalStoppage = 
      (slot === 1 ? stoppageTime : currentStoppage.stoppage1_time || 0) +
      (slot === 2 ? stoppageTime : currentStoppage.stoppage2_time || 0) +
      (slot === 3 ? stoppageTime : currentStoppage.stoppage3_time || 0) +
      (slot === 4 ? stoppageTime : currentStoppage.stoppage4_time || 0);
    
    // Recalculate with machine speed from machine table
    const calculated = calculateBreakerDrawingValues(
      prodDetail.act_hank || 0,
      prodDetail.act_prodn || 0,
      prodDetail.run_time || fallbackRunTime,
      newTotalStoppage,
      setup,
      machineSpeed,  // Pass machine speed explicitly
      prodDetail.waste
    );
    
    return updateBreakerDrawingDetail(prodDetail.id, calculated);
  });
  
  await Promise.all(prodPromises.filter(Boolean));

  // Return updated stoppage entries for merging with drafts
  return updatedStoppages;
}

// Apply partial stoppage to machine range and recalculate production (with auto-slot allocation)
export async function applyBreakerDrawingPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const parsedTime = Number.parseInt(stoppageTime, 10);
    if (!stoppageId) {
      throw new Error('Stoppage reason is required');
    }
    if (Number.isNaN(parsedTime) || parsedTime <= 0) {
      throw new Error('Stoppage time must be greater than 0');
    }

    // Get machine setups for recalculation (speed already merged from machine table)
    const setups = await getBreakerDrawingMachineSetups();
    const header = await prisma.breaker_drawing_production_header.findUnique({
      where: { id: headerId },
      select: { total_time: true, shift: true }
    });
    const fallbackRunTime = header?.total_time || resolveBreakerDrawingShiftFallbackTime(header?.shift);
    const setupMap = {};
    setups?.forEach(s => {
      setupMap[s.machine_id] = s;
    });
    
    const details = await prisma.breaker_drawing_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true, act_hank: true, act_prodn: true, waste: true, run_time: true }
    });

    const machineIds = [...new Set((details || []).map(d => d.machine_id).filter(Boolean))];
    const machines = machineIds.length > 0
      ? await prisma.drawing_breaker_machines.findMany({
          where: { id: { in: machineIds } },
          select: { id: true, machine_no: true, mc_id: true, speed: true }
        })
      : [];

    const machineMap = {};
    machines.forEach(m => { machineMap[m.id] = m; });
    const detailsWithMachine = (details || []).map(d => ({ ...d, machine: machineMap[d.machine_id] || null }));

    // Filter by machine range
    const parsedFrom = parseInt(String(fromMachineNo || '').replace(/\D/g, '') || '0');
    const parsedTo = parseInt(String(toMachineNo || '').replace(/\D/g, '') || '0');
    if (!parsedFrom || !parsedTo) {
      throw new Error('From machine and To machine are required');
    }
    const fromNum = Math.min(parsedFrom, parsedTo);
    const toNum = Math.max(parsedFrom, parsedTo);

    const filteredDetails = detailsWithMachine?.filter(d => {
      if (!d.machine?.machine_no) return false;
      const mcNum = parseInt(d.machine.machine_no.replace(/\D/g, ''));
      return mcNum >= fromNum && mcNum <= toNum;
    }) || [];

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id);

    const stoppages = await prisma.breaker_drawing_stoppage_entry.findMany({
      where: { production_detail_id: { in: detailIds } }
    });

    // Helper: pick first available slot for a single entry
    const pickFirstAvailableSlot = (entry) => {
      for (let i = 1; i <= 4; i++) {
        const slotValue = entry?.[`stoppage${i}_id`];
        if (slotValue === null || slotValue === undefined || slotValue === '') {
          return i;
        }
      }
      return null;
    };

    // Helper: pick common available slot for all entries
    const pickCommonAvailableSlot = (entries) => {
      for (let i = 1; i <= 4; i++) {
        const allAvailable = entries.every(entry => {
          const slotValue = entry?.[`stoppage${i}_id`];
          return slotValue === null || slotValue === undefined || slotValue === '';
        });
        if (allAvailable) {
          return i;
        }
      }
      return null;
    };

    const commonSlot = stoppages.length > 0 ? pickCommonAvailableSlot(stoppages) : null;

    let updatedCount = 0;
    let overflowCount = 0;
    const appliedRows = [];

    for (const stoppage of stoppages) {
      const resolvedSlot = commonSlot || pickFirstAvailableSlot(stoppage);
      if (!resolvedSlot) {
        overflowCount++;
        continue;
      }

      const updated = await updateBreakerDrawingStoppageEntry(stoppage.id, {
        [`stoppage${resolvedSlot}_id`]: stoppageId,
        [`stoppage${resolvedSlot}_time`]: parsedTime
      });

      appliedRows.push({
        id: updated.id,
        [`stoppage${resolvedSlot}_id`]: updated[`stoppage${resolvedSlot}_id`],
        [`stoppage${resolvedSlot}_time`]: updated[`stoppage${resolvedSlot}_time`],
        total_stoppage_time: updated.total_stoppage_time
      });

      updatedCount++;
    }

    // Recalculate production for affected machines
    const prodPromises = appliedRows.map(async (appliedRow) => {
      const stoppageEntry = stoppages.find(s => s.id === appliedRow.id);
      if (!stoppageEntry) return null;

      const prodDetail = filteredDetails.find(d => d.id === stoppageEntry.production_detail_id);
      if (!prodDetail) return null;

      const setup = setupMap[prodDetail.machine_id];
      // Speed from machine table (source of truth)
      const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed;

      // Use updated row total returned from update call (avoid stale pre-update stoppage values).
      const newTotalStoppage = Number(appliedRow.total_stoppage_time) || 0;

      // Recalculate with machine speed
      const calculated = calculateBreakerDrawingValues(
        prodDetail.act_hank || 0,
        prodDetail.act_prodn || 0,
        prodDetail.run_time || fallbackRunTime,
        newTotalStoppage,
        setup,
        machineSpeed,  // Pass machine speed explicitly
        prodDetail.waste
      );

      return updateBreakerDrawingDetail(prodDetail.id, calculated);
    });

    await Promise.all(prodPromises.filter(Boolean));

    return {
      totalTargeted: stoppages.length,
      updatedCount,
      overflowCount,
      skippedCount: stoppages.length - updatedCount,
      appliedRows
    };
  } catch (error) {
    throw error;
  }
}

// ============================================
// BREAKER DRAWING MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info
export async function getBreakerDrawingMachineSetups() {
  const setups = await prisma.breaker_drawing_machine_setup.findMany({
    orderBy: { machine_id: 'asc' }
  });

  const machineIds = [...new Set((setups || []).map(s => s.machine_id).filter(Boolean))];
  const machines = machineIds.length > 0
    ? await prisma.drawing_breaker_machines.findMany({
        where: { id: { in: machineIds }, is_active: true },
        select: { id: true, machine_no: true, description: true, make_name: true, prodn_mixing: true, speed: true, is_active: true }
      })
    : [];

  const machineMap = {};
  machines.forEach(m => { machineMap[m.id] = m; });

  return (setups || [])
    .map(setup => ({
      ...setup,
      machine: machineMap[setup.machine_id] || null,
      speed: machineMap[setup.machine_id]?.speed ?? setup.speed
    }))
    .filter(setup => setup.machine);
}

// Update machine setup
// NOTE: Speed is stored in drawing_breaker_machines table (source of truth)
// The trigger sync_bd_speed_on_machine_update auto-syncs to setup table
export async function updateBreakerDrawingMachineSetup(id, updates) {
  // Get current setup to find machine_id
  const currentSetup = await prisma.breaker_drawing_machine_setup.findUnique({
    where: { id },
    select: {
      machine_id: true,
      hank_constant: true,
      std_efficiency_factor: true,
      shift_time: true,
      divisor_constant: true,
      delivery: true
    }
  });

  // If speed is being updated, update it in the machine table (triggers will sync to setup)
  if (updates.speed && currentSetup?.machine_id) {
    await updateBreakerDrawingMachineSpeed(currentSetup.machine_id, updates.speed);
    delete updates.speed;  // Remove from setup updates (handled by trigger)
  }

  // Recalculate std_prodn if other params change (speed handled by trigger)
  if (updates.hank_constant || updates.std_efficiency_factor || updates.shift_time || updates.delivery) {
    // Get current speed from machine table
    const machine = await prisma.drawing_breaker_machines.findUnique({
      where: { id: currentSetup?.machine_id },
      select: { speed: true }
    });

    const mergedSetup = {
      ...currentSetup,
      ...updates,
      speed: machine?.speed
    }
    const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveBreakerDrawingFormulaInputs(mergedSetup, machine?.speed)
    const shiftTime = Number(updates.shift_time || currentSetup?.shift_time || 0);

    updates.std_prodn = Math.round((speed / divisorConstant / hankConstant) * shiftTime * stdEfficiencyFactor * delivery * 100) / 100;
  }

  // Only update setup if there are non-speed fields to update
  if (Object.keys(updates).length === 0) {
    // Return refreshed data after speed update
    const data = await prisma.breaker_drawing_machine_setup.findUnique({
      where: { id }
    });
    const machine = data?.machine_id
      ? await prisma.drawing_breaker_machines.findUnique({
          where: { id: data.machine_id },
          select: { id: true, machine_no: true, speed: true }
        })
      : null;
    return { ...data, machine, speed: machine?.speed ?? data?.speed };
  }

  const data = await prisma.breaker_drawing_machine_setup.update({
    where: { id },
    data: updates
  });
  const machine = data?.machine_id
    ? await prisma.drawing_breaker_machines.findUnique({
        where: { id: data.machine_id },
        select: { id: true, machine_no: true, speed: true }
      })
    : null;

  return { ...data, machine, speed: machine?.speed ?? data?.speed };
}

// Update machine speed (source of truth in drawing_breaker_machines)
// Trigger will auto-sync to breaker_drawing_machine_setup
export async function updateBreakerDrawingMachineSpeed(machineId, newSpeed) {
  const data = await prisma.drawing_breaker_machines.update({
    where: { id: machineId },
    data: { speed: newSpeed }
  });
  return data;
}

// Bulk update machine speeds
export async function bulkUpdateBreakerDrawingMachineSpeeds(updates) {
  // updates: [{ machineId, speed }, ...]
  const promises = updates.map(({ machineId, speed }) =>
    prisma.drawing_breaker_machines.update({
      where: { id: machineId },
      data: { speed }
    })
  );

  const results = await Promise.all(promises);
  return results;
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get breaker drawing stoppage reasons (filtered by BREAKER DRAWING department)
export async function getBreakerDrawingStoppageReasons() {
  // First get the BREAKER DRAWING department ID
  const breakerDept = await prisma.departments.findFirst({
    where: { dept_name: 'BREAKER DRAWING' }
  });
  if (!breakerDept?.id) return [];

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
      AND sd.department_id = ${breakerDept.id}
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
// CALCULATION HELPERS - BREAKER DRAWING FORMULAS
// ============================================
// From breaker-drawing-formula.md:
// Constst = (1 / 2.20456 / Hank) × Delivery
// Act Prodn = Act Hank × Constst
// Std Prodn = Speed / Divisor Constant / Hank × Total Time × Std Effi × Delivery
// Exp Prodn = Std Prodn × (Work Time / Total Time)
// Act Effi % = Actual Prodn / Exp Prodn × 100
// UTI % = Work Time / Total Time × 100
// Waste % = Waste / Actual Prodn × 100
// Work Time = ENTERED SEPARATELY (or Total Time − Total Stoppage)
//
// NOTE: Speed is sourced from drawing_breaker_machines table (NOT hardcoded)
// The setup.speed should be pre-merged from machine.speed before calling this function

export function calculateBreakerDrawingValues(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed = null, currentWaste = null) {
  const toNumber = (value, fallback = 0) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'object' && typeof value.toString === 'function') {
      const n = Number(value.toString());
      return Number.isFinite(n) ? n : fallback;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveBreakerDrawingFormulaInputs(setup, machineSpeed);
  const wasteValue = toNumber(currentWaste ?? setup?.default_waste, 0);
  const safeTotalTime = toNumber(totalTime, 0);
  const safeStoppageTime = toNumber(stoppageTime, 0);
  const safeActHank = toNumber(actHank, 0);

  // Constst = (1 / 2.20456 / Hank) × Delivery
  const constst = hankConstant > 0 ? (1 / 2.20456 / hankConstant) * delivery : 0;
  // Act Prodn = manually entered value (if provided), else Act Hank × Constst
  const hasManualActProdn = actProdn !== null && actProdn !== undefined && !Number.isNaN(Number(actProdn));
  const calculatedActProdn = hasManualActProdn ? toNumber(actProdn, 0) : (safeActHank * constst);

  // Work Time = Total Time - Stoppage Time (this is actual running time)
  const workTime = safeTotalTime - safeStoppageTime;
  
  // Std Prodn = (Speed / Divisor Constant / Hank) × Total Time × Std Effi × Delivery
  const stdProdn = (speed / divisorConstant / hankConstant) * safeTotalTime * stdEfficiencyFactor * delivery;

  // Exp Prodn = Std Prodn × (Work Time / Total Time)
  const expProdn = safeTotalTime > 0 ? stdProdn * (workTime / safeTotalTime) : 0;

  // Effi% = Act Prodn / Exp Prodn × 100
  const effiPercent = expProdn > 0 ? (calculatedActProdn / expProdn) * 100 : 0;

  // UTI% = Work Time / Total Time × 100
  const utiPercent = safeTotalTime > 0 ? (workTime / safeTotalTime) * 100 : 0;

  // Waste% = Waste / Act Prodn × 100
  const wastePercent = calculatedActProdn > 0 ? (wasteValue / calculatedActProdn) * 100 : 0;

  return {
    act_prodn: Math.round(calculatedActProdn * 100) / 100,
    std_prodn: Math.round(stdProdn * 100) / 100,
    exp_prodn: Math.round(expProdn * 100) / 100,
    effi_percent: Math.round(effiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    waste: currentWaste ?? setup?.default_waste ?? null,
    waste_percent: Math.round(wastePercent * 100) / 100,
    run_time: safeTotalTime,
    work_time: workTime,  // Work Time = Total Time - Stoppage
    speed                 // Return speed used for reference
  };
}

// Calculate production values with speed from machine table
export async function calculateBreakerDrawingValuesFromMachine(machineId, actHank, actProdn, totalTime, stoppageTime) {
  // Get speed from machine table (source of truth)
  const machine = await getBreakerDrawingMachineWithSpeed(machineId);
  
  // Get setup for other params
  const setup = await prisma.breaker_drawing_machine_setup.findUnique({
    where: { machine_id: machineId }
  });
  
  return calculateBreakerDrawingValues(actHank, actProdn, totalTime, stoppageTime, setup, machine?.speed);
}

// Get all breaker drawing machines (includes speed - source of truth)
export async function getBreakerDrawingMachines() {
  const data = await prisma.drawing_breaker_machines.findMany({
    where: { is_active: true },
    select: { id: true, machine_no: true, description: true, make_name: true, prodn_mixing: true, speed: true, mc_id: true, is_active: true },
    orderBy: { mc_id: 'asc' }
  });
  return data;
}

// Get machine with speed for calculations
export async function getBreakerDrawingMachineWithSpeed(machineId) {
  const data = await prisma.drawing_breaker_machines.findUnique({
    where: { id: machineId },
    select: { id: true, machine_no: true, speed: true, prodn_mixing: true }
  });
  return data;
}

// ============================================
// MACHINE MANAGEMENT QUERIES
// ============================================

// Add new breaker drawing machine
export async function addBreakerDrawingMachine(machineData) {
  // Check if machine_no already exists (might be inactive)
  if (machineData.machine_no) {
    const existingMachine = await prisma.drawing_breaker_machines.findFirst({
      where: { machine_no: machineData.machine_no },
      select: { id: true, is_active: true, machine_no: true }
    });

    if (existingMachine && !existingMachine.is_active) {
      // Reactivate the existing machine — clear deactivated_at, set new activated_at
      const reactivated = await prisma.drawing_breaker_machines.update({
        where: { id: existingMachine.id },
        data: {
          is_active: true,
          description: machineData.description || existingMachine.machine_no,
          make_name: machineData.make_name || 'LMW',
          model: machineData.model || null,
          prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
          speed: machineData.speed || BREAKER_DRAWING_FORMULA_FALLBACK.speed,
          installed_date: machineData.installed_date ? new Date(machineData.installed_date) : null,
          activated_at: new Date(),
          deactivated_at: null,
        }
      });

      // Update or create the setup if needed
      let existingSetup = await prisma.breaker_drawing_machine_setup.findUnique({
        where: { machine_id: existingMachine.id }
      });

      const shiftTime = machineData.shift_time || resolveBreakerDrawingShiftFallbackTime(1);
      const formulaInputs = resolveBreakerDrawingFormulaInputs(machineData);
      const speed = formulaInputs.speed;
      const hankConstant = formulaInputs.hankConstant;
      const stdEffi = formulaInputs.stdEfficiencyFactor;
      const divisor = formulaInputs.divisorConstant;
      const delivery = formulaInputs.delivery;
      const stdProdn = (speed / divisor / hankConstant) * shiftTime * stdEffi * delivery;

      let setup = existingSetup;
      if (existingSetup) {
        await prisma.breaker_drawing_machine_setup.update({
          where: { id: existingSetup.id },
          data: {
            speed: speed,
            hank_constant: hankConstant,
            std_efficiency_factor: stdEffi,
            shift_time: shiftTime,
            delivery: delivery,
            std_prodn: stdProdn
          }
        });
      } else {
        // Create setup if it doesn't exist
        setup = await prisma.breaker_drawing_machine_setup.create({
          data: {
            machine_id: existingMachine.id,
            speed: speed,
            hank_constant: hankConstant,
            std_efficiency_factor: stdEffi,
            shift_time: shiftTime,
            delivery: delivery,
            std_prodn: stdProdn
          }
        });
      }
      
      // Do NOT proactively sync past headers — the sync runs on each entry page load.
      // Syncing all past headers would add the reactivated machine to entries before its activated_at.
      return { machine: reactivated, setup: setup, reactivated: true, syncedHeaders: 0 };
    }

    if (existingMachine && existingMachine.is_active) {
      // Check if setup already exists
      const existingSetup = await prisma.breaker_drawing_machine_setup.findUnique({
        where: { machine_id: existingMachine.id }
      });
      if (existingSetup) {
        throw new Error(`Machine ${machineData.machine_no} already exists and is active`);
      }
      // Machine is active but was created via master form (no setup yet) — create the setup
      const shiftTime = machineData.shift_time || resolveBreakerDrawingShiftFallbackTime(1);
      const formulaInputs = resolveBreakerDrawingFormulaInputs(machineData);
      const speed = formulaInputs.speed;
      const hankConstant = formulaInputs.hankConstant;
      const stdEffi = formulaInputs.stdEfficiencyFactor;
      const divisor = formulaInputs.divisorConstant;
      const delivery = formulaInputs.delivery;
      const newSetup = await prisma.breaker_drawing_machine_setup.create({
        data: {
          machine_id: existingMachine.id,
          speed,
          hank_constant: hankConstant,
          std_efficiency_factor: stdEffi,
          shift_time: shiftTime,
          divisor_constant: divisor,
          default_waste: null,
          default_stoppage: null,
          delivery,
          std_prodn: (speed / divisor / hankConstant) * shiftTime * stdEffi * delivery
        }
      });
      return { machine: existingMachine, setup: newSetup, reactivated: false, syncedHeaders: 0 };
    }
  }

  // Get the max mc_id to generate next one
  const maxMachine = await prisma.drawing_breaker_machines.findFirst({
    select: { mc_id: true, machine_no: true },
    orderBy: { mc_id: 'desc' }
  });

  const nextMcId = (maxMachine?.mc_id || 0) + 1;
  const nextMachineNo = machineData.machine_no || `BD${nextMcId}`;

  // Insert new machine
  const newMachine = await prisma.drawing_breaker_machines.create({
    data: {
      machine_no: nextMachineNo,
      mc_id: nextMcId,
      description: machineData.description || nextMachineNo,
      make_name: machineData.make_name || 'LMW',
      model: machineData.model || null,
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      speed: machineData.speed || BREAKER_DRAWING_FORMULA_FALLBACK.speed,
      installed_date: machineData.installed_date ? new Date(machineData.installed_date) : null,
      is_active: true
    }
  });

  // Create machine setup for the new machine
  const shiftTime = machineData.shift_time || resolveBreakerDrawingShiftFallbackTime(1);
  const formulaInputs = resolveBreakerDrawingFormulaInputs(machineData);
  const speed = formulaInputs.speed;
  const hankConstant = formulaInputs.hankConstant;
  const stdEffi = formulaInputs.stdEfficiencyFactor;
  const divisor = formulaInputs.divisorConstant;
  const delivery = formulaInputs.delivery;

  const newSetup = await prisma.breaker_drawing_machine_setup.create({
    data: {
      machine_id: newMachine.id,
      speed: speed,
      hank_constant: hankConstant,
      std_efficiency_factor: stdEffi,
      shift_time: shiftTime,
      divisor_constant: divisor,
      default_waste: null,
      default_stoppage: null,
      delivery: delivery,
      std_prodn: (speed / divisor / hankConstant) * shiftTime * stdEffi * delivery
    }
  });

  // Do NOT proactively sync past headers — the sync runs on each entry page load.
  // New machines will appear automatically the next time any entry is opened.
  return { machine: newMachine, setup: newSetup, reactivated: false, syncedHeaders: 0 };
}

// Remove (deactivate) breaker drawing machine
export async function removeBreakerDrawingMachine(machineId) {
  // Soft delete - set is_active to false and record the deactivation date
  const data = await prisma.drawing_breaker_machines.update({
    where: { id: machineId },
    data: { is_active: false, deactivated_at: new Date() }
  });
  return data;
}

// Update machine mixing - updates both machine master and all production details
export async function updateBreakerDrawingMachineMixing(machineId, newMixing) {
  // Update machine master table
  const data = await prisma.drawing_breaker_machines.update({
    where: { id: machineId },
    data: { prodn_mixing: newMixing }
  });
  
  // Also update all production details for this machine to sync mixing
  await prisma.breaker_drawing_production_detail.updateMany({
    where: { machine_id: machineId },
    data: { prodn_mixing: newMixing }
  });
  
  return data;
}

// Bulk update machine mixing - updates both machine master and all production details
export async function bulkUpdateBreakerDrawingMachineMixing(machineIds, newMixing) {
  const promises = machineIds.map(id => 
    prisma.drawing_breaker_machines.update({
      where: { id },
      data: { prodn_mixing: newMixing }
    })
  );

  const results = await Promise.all(promises);
  
  // Also update all production details for these machines to sync mixing
  await prisma.breaker_drawing_production_detail.updateMany({
    where: { machine_id: { in: machineIds } },
    data: { prodn_mixing: newMixing }
  });
  
  return results;
}

// Get all mixing options from spinning_counts master table
export async function getMixingOptions() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: { 
        id: true,
        count_name: true, 
        act_count: true 
      },
      orderBy: { count_name: 'asc' }
    })
    return data.map(item => item.count_name) || []
  } catch (error) {
    throw error
  }
}

// Upsert machine setup (create or update)
export async function upsertBreakerDrawingMachineSetup(machineId, setupData) {
  try {
    const data = await prisma.breaker_drawing_machine_setup.upsert({
      where: { machine_id: machineId },
      update: setupData,
      create: {
        machine_id: machineId,
        ...setupData
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Get count options from spinning_counts table
export async function getBreakerDrawingCountOptions() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: { 
        id: true,
        count_name: true, 
        act_count: true 
      },
      orderBy: { count_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// ============================================
// COPY YESTERDAY DATA FUNCTIONALITY
// ============================================

// Copy production data from previous day to current day
// Get available previous dates that have production data
export async function getBreakerDrawingAvailableDates(beforeDate, shift, limit = 30) {
  const data = await prisma.breaker_drawing_production_header.findMany({
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

// Copy data from a previous date (replaces copyBreakerDrawingFromYesterday)
export async function copyBreakerDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  // If no sourceDate provided, calculate yesterday's date (for backward compatibility)
  let previousDate = sourceDate;
  if (!previousDate) {
    const targetDateObj = new Date(targetDate);
    const yesterdayDateObj = new Date(targetDateObj);
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
    previousDate = yesterdayDateObj.toISOString().split('T')[0];
  }
  
  // Get source header
  const sourceHeader = await getBreakerDrawingProductionByDateShift(previousDate, targetShift);
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`);
  }
  
  // Get source production details
  const sourceDetails = await prisma.breaker_drawing_production_detail.findMany({
    where: { header_id: sourceHeader.id }
  });
  
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`);
  }
  
  // Get source stoppage entries
  const sourceStoppages = await prisma.breaker_drawing_stoppage_entry.findMany({
    where: {
      production_detail_id: { in: sourceDetails.map(d => d.id) }
    }
  });
  
  // Get target's existing production details
  const targetDetails = await prisma.breaker_drawing_production_detail.findMany({
    where: { header_id: targetHeaderId },
    include: {
      machine: { select: { machine_no: true } }
    }
  });
  
  // Create a map of machine_id to source data
  const sourceDataMap = {};
  sourceDetails.forEach(d => {
    sourceDataMap[d.machine_id] = d;
  });
  
  const sourceStoppageMap = {};
  sourceStoppages?.forEach(s => {
    // Find which machine this stoppage belongs to
    const detail = sourceDetails.find(d => d.id === s.production_detail_id);
    if (detail) {
      sourceStoppageMap[detail.machine_id] = s;
    }
  });
  
  // Update target details with source data
  const updatePromises = targetDetails.map(async (targetDetail) => {
    const sourceData = sourceDataMap[targetDetail.machine_id];
    if (!sourceData) return null;
    
    // Copy production values
    const data = await prisma.breaker_drawing_production_detail.update({
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
  // First get target stoppage entries
  const targetStoppages = await prisma.breaker_drawing_stoppage_entry.findMany({
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
    
    const data = await prisma.breaker_drawing_stoppage_entry.update({
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
export async function copyBreakerDrawingFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copyBreakerDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, null);
}

// ============================================
// ALIAS EXPORTS FOR COMPATIBILITY
// ============================================
// These aliases allow the server actions to use shorter function names

export const updateStoppageEntry = updateBreakerDrawingStoppageEntry;
export const updateMachineSetup = updateBreakerDrawingMachineSetup;
export const upsertMachineSetup = upsertBreakerDrawingMachineSetup;
export const getCountOptions = getBreakerDrawingCountOptions;
export const updateMachineCount = updateBreakerDrawingMachineMixing;
export const bulkUpdateMachineCount = bulkUpdateBreakerDrawingMachineMixing;
