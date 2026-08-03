import { prisma } from '../prisma';
import { copyPreviousSpeeds, getAvailablePreviousSpeedDates } from './copyPreviousSpeed';
import { resolveBreakerDrawingShiftFallbackTime } from '../breakerDrawingShiftFallback';
import { calculateBreakerDrawingStdProdn, getBreakerDrawingActProdnConstant, resolveBreakerDrawingFormulaInputs, BREAKER_DRAWING_FORMULA_FALLBACK } from '../breakerDrawingFormulaFallback';
import { calculateTimeAdjustedProductionMetrics } from '../productionFormulaMath';
import { getOrCreateDateScopedSetups } from './dateScopedMachineSetup';
import { buildStoppageUpdate, findFirstFreeStoppageSlot, getStoppageTotal } from '../stoppageSlotUtils';
import { assertActiveStoppageReasons } from './stoppageValidation';
import { sanitizeProductionDetailUpdate } from './productionDetailUpdate';

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
  try {
    return await prisma.breaker_drawing_production_header.create({
      data: {
        entry_date: new Date(date),
        shift: shift,
        supervisor_id: supervisorId || null,
        maisitry_id: maisitryId || null,
        total_time: shiftConfig.totalTime
      }
    });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const concurrentHeader = await getBreakerDrawingProductionByDateShift(date, shift);
    if (!concurrentHeader) throw error;
    return concurrentHeader;
  }
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
    data: details,
    skipDuplicates: true
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
    data: stoppageEntries,
    skipDuplicates: true
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
    data: details,
    skipDuplicates: true
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
    data: stoppageEntries,
    skipDuplicates: true
  });

  return createdData;
}

// Update production detail
export async function updateBreakerDrawingDetail(id, updates) {
  // Remove any fields that shouldn't be updated (like speed from calculations)
  const { speed, machine, stoppage, ...cleanUpdates } = sanitizeProductionDetailUpdate(updates);
  
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
  return prisma.$transaction(
    updates.map(({ id, ...data }) =>
      prisma.breaker_drawing_production_detail.update({ where: { id }, data: sanitizeProductionDetailUpdate(data) })
    )
  );
}

// ============================================
// BREAKER DRAWING STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
// Speed is fetched from machine table (source of truth)
export async function getBreakerDrawingStoppageEntries(headerId) {
  const details = await prisma.breaker_drawing_production_detail.findMany({
    where: {
      header_id: headerId
    },
    select: { id: true }
  });

  const detailIds = details?.map(d => d.id) || [];
  if (detailIds.length === 0) return [];

  const filtered = await prisma.breaker_drawing_stoppage_entry.findMany({
    where: { production_detail_id: { in: detailIds } },
    orderBy: { production_detail_id: 'asc' }
  });

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
  return prisma.$transaction(async tx => {
    try {
    // First, fetch the existing record to get current stoppage values
    const existing = await tx.breaker_drawing_stoppage_entry.findUnique({
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

    if (!existing) throw new Error(`Stoppage entry ${id} not found`);
    const stoppageUpdate = buildStoppageUpdate(existing, updates);
    await assertActiveStoppageReasons(tx, stoppageUpdate, ['BREAKER DRAWING']);
    const total = stoppageUpdate.total_stoppage_time;

    const data = await tx.breaker_drawing_stoppage_entry.update({
      where: { id },
      data: stoppageUpdate
    });

    // Recalculate every field that depends on stoppage time in the same transaction.
    const detail = await tx.breaker_drawing_production_detail.findUnique({
      where: { id: existing.production_detail_id },
      select: {
        id: true,
        header_id: true,
        machine_id: true,
        act_hank: true,
        act_prodn: true,
        waste: true,
        run_time: true
      }
    });
    if (!detail) throw new Error('The production row for this stoppage no longer exists');

    const header = detail?.header_id
      ? await tx.breaker_drawing_production_header.findUnique({
          where: { id: detail.header_id },
          select: { total_time: true, shift: true, entry_date: true }
        })
      : null
    if (!header) throw new Error('The production header for this stoppage no longer exists');

    const totalTime = detail?.run_time || header?.total_time || resolveBreakerDrawingShiftFallbackTime(header?.shift)
    if (total > totalTime) {
      const error = new Error('Stoppage time cannot exceed the shift time');
      error.code = 'INVALID_STOPPAGE';
      throw error;
    }
    const [setup, machine] = await Promise.all([
      tx.breaker_drawing_machine_setup.findFirst({
        where: {
          machine_id: detail.machine_id,
          entry_date: header.entry_date,
          shift: header.shift
        }
      }),
      tx.drawing_breaker_machines.findUnique({
        where: { id: detail.machine_id },
        select: { speed: true }
      })
    ])
    const calculated = calculateBreakerDrawingValues(
      detail.act_hank,
      detail.act_prodn,
      totalTime,
      total,
      setup,
      machine?.speed,
      detail.waste
    )
    delete calculated.speed

    await tx.breaker_drawing_production_detail.update({
      where: { id: detail.id },
      data: {
        total_stoppage_mins: total,
        ...calculated
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
export async function applyBreakerDrawingFullStoppage(headerId, stoppageId, stoppageTime) {
  // Get all stoppage entries for this header
  const stoppages = await getBreakerDrawingStoppageEntries(headerId);
  const header = await prisma.breaker_drawing_production_header.findUnique({
    where: { id: headerId },
    select: { total_time: true, shift: true }
  });
  const fallbackRunTime = header?.total_time || resolveBreakerDrawingShiftFallbackTime(header?.shift);
  
  // Get machine setups for recalculation (speed already merged from machine table)
  const setups = await getBreakerDrawingMachineSetups(headerId);
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
    updateBreakerDrawingStoppageEntry(id, data)
  );

  const updatedStoppages = await Promise.all(stoppagePromises);
  
  // Recalculate production for each machine
  const prodPromises = updates.map(async ({ id, slot }) => {
    const s = stoppages.find(entry => entry.id === id);
    if (!s.production_detail) return null;
    
    const prodDetail = s.production_detail;
    const machineId = prodDetail.machine_id;
    const setup = setupMap[machineId];
    // Speed from machine table (setup has merged machine speed)
    const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed;
    
    // Calculate new total stoppage
    const currentStoppage = s;
    const newTotalStoppage = getStoppageTotal({
      ...currentStoppage,
      [`stoppage${slot}_time`]: stoppageTime
    });
    
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
    const setups = await getBreakerDrawingMachineSetups(headerId);
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

    let updatedCount = 0;
    let overflowCount = 0;
    const appliedRows = [];

    for (const stoppage of stoppages) {
      const resolvedSlot = pickFirstAvailableSlot(stoppage);
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

// Get all machine setups with machine info (optionally scoped to a specific headerId)
export async function getBreakerDrawingMachineSetups(headerId = null) {
  const validHeaderId = typeof headerId === 'string' && headerId.trim() ? headerId.trim() : null;
  const machines = await prisma.drawing_breaker_machines.findMany({
    where: { is_active: true },
    select: { id: true, machine_no: true, description: true, make_name: true, prodn_mixing: true, speed: true, is_active: true }
  });
  const machineSpeedMap = {};
  const machineSetupOverridesMap = {};
  machines.forEach(m => {
    machineSpeedMap[m.id] = m.speed;
    const rawEfficiency = m.prodn_efficiency == null ? null : Number(m.prodn_efficiency);
    machineSetupOverridesMap[m.id] = {
      ...(m.speed != null && { speed: m.speed }),
      ...(m.delivery != null && { delivery: m.delivery }),
      ...(m.sliver_hank != null && { hank_constant: m.sliver_hank }),
      ...(Number.isFinite(rawEfficiency) && {
        std_efficiency_factor: rawEfficiency > 1 ? rawEfficiency / 100 : rawEfficiency
      })
    };
  });
  const setups = await getOrCreateDateScopedSetups({
    setupModel: prisma.breaker_drawing_machine_setup,
    headerModel: prisma.breaker_drawing_production_header,
    headerId: validHeaderId,
    machineIds: machines.map(machine => machine.id),
    machineSpeedMap,
    machineSetupOverridesMap
  });
  const headerDetails = validHeaderId
    ? await prisma.breaker_drawing_production_detail.findMany({
        where: { header_id: validHeaderId },
        select: { machine_id: true, prodn_mixing: true }
      })
    : [];

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

  return (setups || [])
    .map(setup => {
      const machine = machineMap[setup.machine_id] || null;
      const dateMixing = mixingMap[setup.machine_id] ?? setup.prodn_mixing ?? machine?.prodn_mixing;
      return {
        ...setup,
        machine: machine ? { ...machine, prodn_mixing: dateMixing } : null,
        prodn_mixing: dateMixing,
        speed: setup.speed ?? machine?.speed
      };
    })
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
      speed: true,
      hank_constant: true,
      std_efficiency_factor: true,
      shift_time: true,
      divisor_constant: true,
      delivery: true
    }
  });

  const speedToUse = updates.speed !== undefined ? Number(updates.speed) : (currentSetup?.speed ?? 750);

  // Recalculate std_prodn if parameters change
  if (
    updates.speed !== undefined ||
    updates.hank_constant !== undefined ||
    updates.std_efficiency_factor !== undefined ||
    updates.shift_time !== undefined ||
    updates.delivery !== undefined ||
    updates.divisor_constant !== undefined
  ) {
    const mergedSetup = {
      ...currentSetup,
      ...updates,
      speed: speedToUse
    }
    const shiftTime = Number(updates.shift_time ?? currentSetup?.shift_time ?? 0);
    updates.std_prodn = Math.round(
      calculateBreakerDrawingStdProdn(mergedSetup, shiftTime, speedToUse) * 100
    ) / 100;
  }

  const data = await prisma.breaker_drawing_machine_setup.update({
    where: { id },
    data: updates
  });
  const machine = data?.machine_id
    ? await prisma.drawing_breaker_machines.findUnique({
        where: { id: data.machine_id },
        select: { id: true, machine_no: true }
      })
    : null;

  return { ...data, machine, speed: data?.speed ?? machine?.speed };
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
// Constant = 1 / 2.20456 / Hank
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

  // Constant = 1 / 2.20456 / Hank
  const constst = getBreakerDrawingActProdnConstant({ hank_constant: hankConstant });
  // Act Prodn = manually entered value (if provided), else Act Hank × Constst
  const hasManualActProdn = actProdn !== null && actProdn !== undefined && !Number.isNaN(Number(actProdn));
  const calculatedActProdn = hasManualActProdn ? toNumber(actProdn, 0) : (safeActHank * constst);

  // Work Time = Total Time - Stoppage Time (this is actual running time)
  
  // Std Prodn = (Speed / Divisor Constant / Hank) × Total Time × Std Effi × Delivery
  const stdProdn = (speed / divisorConstant / hankConstant) * safeTotalTime * stdEfficiencyFactor * delivery;

  // Exp Prodn = Std Prodn × (Work Time / Total Time)

  // Effi% = Act Prodn / Exp Prodn × 100

  // UTI% = Work Time / Total Time × 100

  // Waste% = Waste / Act Prodn × 100
  const metrics = calculateTimeAdjustedProductionMetrics({
    actualProduction: calculatedActProdn,
    standardProduction: stdProdn,
    waste: wasteValue,
    totalTime: safeTotalTime,
    stoppageTime: safeStoppageTime,
  });

  return {
    act_prodn: metrics.actualProduction,
    std_prodn: metrics.standardProduction,
    exp_prodn: metrics.expectedProduction,
    effi_percent: metrics.efficiencyPercent,
    uti_percent: metrics.utilizationPercent,
    waste: currentWaste ?? setup?.default_waste ?? null,
    waste_percent: metrics.wastePercent,
    run_time: metrics.totalTime,
    work_time: metrics.workTime,
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
          speed: resolveBreakerDrawingFormulaInputs(machineData).speed,
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
      const stdProdn = calculateBreakerDrawingStdProdn(machineData, shiftTime, speed);

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
          std_prodn: calculateBreakerDrawingStdProdn(machineData, shiftTime, speed)
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
      speed: resolveBreakerDrawingFormulaInputs(machineData).speed,
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

// Update machine mixing on header production details and setup table
export async function updateBreakerDrawingMachineMixing(machineId, newMixing, headerId = null) {
  if (headerId) {
    await prisma.breaker_drawing_production_detail.updateMany({
      where: { header_id: headerId, machine_id: machineId },
      data: { prodn_mixing: newMixing }
    });
  }
  const data = await prisma.breaker_drawing_machine_setup.updateMany({
    where: { machine_id: machineId },
    data: { prodn_mixing: newMixing }
  });
  return data;
}

// Bulk update machine mixing on header production details and setup table
export async function bulkUpdateBreakerDrawingMachineMixing(machineIds, newMixing, headerId = null) {
  if (headerId && machineIds?.length > 0) {
    await prisma.breaker_drawing_production_detail.updateMany({
      where: { header_id: headerId, machine_id: { in: machineIds } },
      data: { prodn_mixing: newMixing }
    });
  }
  const data = await prisma.breaker_drawing_machine_setup.updateMany({
    where: { machine_id: { in: machineIds } },
    data: { prodn_mixing: newMixing }
  });
  return data;
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
// COPY PREVIOUS SPEED FUNCTIONALITY
// ============================================

export async function getBreakerDrawingAvailableDates(beforeDate, shift, limit = 30) {
  return getAvailablePreviousSpeedDates(
    prisma.breaker_drawing_machine_setup,
    beforeDate,
    shift,
    limit
  );
}

// Copies only speed between matching machine setup rows in the same shift.
export async function copyBreakerDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  return copyPreviousSpeeds({
    setupModel: prisma.breaker_drawing_machine_setup,
    headerModel: prisma.breaker_drawing_production_header,
    targetHeaderId,
    targetDate,
    targetShift,
    sourceDate,
    buildUpdateData: (setup, speed) => {
      const shiftTime = Number(setup.shift_time || 0)
      return {
        speed,
        ...(shiftTime > 0
          ? { std_prodn: Math.round(calculateBreakerDrawingStdProdn({ ...setup, speed }, shiftTime, speed) * 100) / 100 }
          : {})
      }
    }
  });
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
