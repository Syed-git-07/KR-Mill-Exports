import { supabase } from '../supabase';

/**
 * Finisher Drawing Entry Module - CRUD Operations
 * Following the pattern from Lap Former queries
 * Tables: finisher_drawing_production_header, finisher_drawing_production_detail,
 *         finisher_drawing_stoppage_entry, finisher_drawing_machine_setup
 * 
 * KEY DIFFERENCES FROM LAP FORMER:
 * - Hank Constant: 0.14 (vs 0.0082 for Lap Former)
 * - Std Efficiency: 90% (vs 85% for Lap Former)
 * - Speed: 350 m/min (uniform for all FD machines)
 * - Std Prodn: 677.79 kg
 * - Default Waste: 0.41 kg (vs 0.85 for Lap Former)
 * - Machines: FD4-FD10 (7 machines)
 */

// ============================================
// FINISHER DRAWING MACHINE QUERIES
// ============================================

// Get all finisher drawing machines (FD4-FD10 only as per VB6)
export async function getFinisherDrawingMachines() {
  const { data, error } = await supabase
    .from('drawing_finisher_machines')
    .select('*')
    .eq('is_active', true)
    .in('machine_no', ['FD4', 'FD5', 'FD6', 'FD7', 'FD8', 'FD9', 'FD10'])
    .order('mc_id', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get active finisher drawing machines
export async function getActiveFinisherDrawingMachines() {
  const { data, error } = await supabase
    .from('drawing_finisher_machines')
    .select('*')
    .eq('is_active', true)
    .in('machine_no', ['FD4', 'FD5', 'FD6', 'FD7', 'FD8', 'FD9', 'FD10'])
    .order('mc_id', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ============================================
// FINISHER DRAWING PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers with supervisor info
export async function getFinisherDrawingProductionHeaders() {
  const { data, error } = await supabase
    .from('finisher_drawing_production_header')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, supervisor_name),
      maisitry:supervisors!maisitry_id(id, supervisor_name)
    `)
    .order('entry_date', { ascending: false });

  if (error) throw error;
  return data;
}

// Get production header by date and shift
export async function getFinisherDrawingProductionByDateShift(date, shift) {
  const { data, error } = await supabase
    .from('finisher_drawing_production_header')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, supervisor_name),
      maisitry:supervisors!maisitry_id(id, supervisor_name)
    `)
    .eq('entry_date', date)
    .eq('shift', shift)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Create or get production header
export async function getOrCreateFinisherDrawingHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getFinisherDrawingProductionByDateShift(date, shift);
  if (existing) return existing;

  // Create new header
  const { data, error } = await supabase
    .from('finisher_drawing_production_header')
    .insert([{
      entry_date: date,
      shift: shift,
      supervisor_id: supervisorId || null,
      maisitry_id: maisitryId || null,
      total_time: 510
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update production header
export async function updateFinisherDrawingHeader(id, updates) {
  const { data, error } = await supabase
    .from('finisher_drawing_production_header')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// FINISHER DRAWING PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getFinisherDrawingProductionDetails(headerId) {
  const { data, error } = await supabase
    .from('finisher_drawing_production_detail')
    .select(`
      *,
      machine:drawing_finisher_machines(id, machine_no, description, prodn_mixing)
    `)
    .eq('header_id', headerId)
    .order('machine_id');

  if (error) throw error;
  return data;
}

// Get production details with machine setup for a header (for display)
export async function getFinisherDrawingProductionWithSetup(headerId) {
  const { data, error } = await supabase
    .from('finisher_drawing_production_detail')
    .select(`
      *,
      machine:drawing_finisher_machines(id, machine_no, description, prodn_mixing, mc_id, speed),
      stoppage:finisher_drawing_stoppage_entry!production_detail_id(
        id,
        stoppage1_id,
        stoppage1_time,
        stoppage2_id,
        stoppage2_time,
        stoppage3_id,
        stoppage3_time,
        stoppage4_id,
        stoppage4_time,
        total_stoppage_time,
        stoppage1:stoppage_details!stoppage1_id(id, stoppage_name, short_code),
        stoppage2:stoppage_details!stoppage2_id(id, stoppage_name, short_code),
        stoppage3:stoppage_details!stoppage3_id(id, stoppage_name, short_code),
        stoppage4:stoppage_details!stoppage4_id(id, stoppage_name, short_code)
      )
    `)
    .eq('header_id', headerId);

  if (error) throw error;
  
  // Sort by natural machine number order (FD4, FD5, FD6, etc.)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0');
    const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0');
    return aNum - bNum;
  }) || [];
}

// Initialize production details for all finisher drawing machines
export async function initializeFinisherDrawingDetails(headerId) {
  // Get all active finisher drawing machines WITH SPEED
  const { data: machines, error: machineError } = await supabase
    .from('drawing_finisher_machines')
    .select('id, machine_no, prodn_mixing, speed')
    .eq('is_active', true)
    .in('machine_no', ['FD4', 'FD5', 'FD6', 'FD7', 'FD8', 'FD9', 'FD10'])
    .order('mc_id');

  if (machineError) throw machineError;

  // Get machine setup for default values
  const { data: setups, error: setupError } = await supabase
    .from('finisher_drawing_machine_setup')
    .select('*');

  if (setupError) throw setupError;

  // Create a map of machine_id to setup
  const setupMap = {};
  setups?.forEach(s => {
    setupMap[s.machine_id] = s;
  });

  // Create detail records for each machine
  // Default stoppage: 0 mins for Finisher Drawing
  const defaultStoppage = 0;
  const totalTime = 510;
  // VB6 Convention: run_time = Total Time, work_time = Total Time - Stoppage
  const defaultRunTime = totalTime;
  const defaultWorkTime = totalTime - defaultStoppage;

  const details = machines.map(machine => {
    const setup = setupMap[machine.id] || {};
    // Use speed from machine table (source of truth) or default 350
    const speed = machine.speed || setup.speed || 350;
    // FINISHER DRAWING uses Hank constant 0.14 (same as Breaker Drawing)
    const hankConstant = setup.hank_constant || 0.14;
    const stdEffiFactor = setup.std_efficiency_factor || 0.90;
    const delivery = setup.delivery || 1;
    const divisor = setup.divisor_constant || 1693;
    
    // Calculate Std Prodn: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
    // = 350 / 1693 / 0.14 × 510 × 0.90 × 1 = 677.79
    const stdProdn = (speed / divisor / hankConstant) * totalTime * stdEffiFactor * delivery;
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
      waste: setup.default_waste || 0.41,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      session_no: 1
    };
  });

  const { data, error } = await supabase
    .from('finisher_drawing_production_detail')
    .insert(details)
    .select();

  if (error) throw error;

  // Initialize stoppage entries for each detail (no default stoppage for Finisher Drawing)
  const stoppageEntries = data.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_id: null,
    stoppage1_time: 0,
    stoppage2_id: null,
    stoppage2_time: 0,
    stoppage3_id: null,
    stoppage3_time: 0,
    total_stoppage_time: 0
  }));

  await supabase
    .from('finisher_drawing_stoppage_entry')
    .insert(stoppageEntries);

  return data;
}

// Update production detail
export async function updateFinisherDrawingDetail(id, updates) {
  // Remove any fields that shouldn't be updated
  const { speed, machine, stoppage, ...cleanUpdates } = updates;
  
  const { data, error } = await supabase
    .from('finisher_drawing_production_detail')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateFinisherDrawingDetail error:', error);
    throw new Error(`Failed to update production detail: ${error.message}`);
  }
  return data;
}

// Bulk update production details
export async function bulkUpdateFinisherDrawingDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    supabase
      .from('finisher_drawing_production_detail')
      .update(data)
      .eq('id', id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) throw errors[0].error;

  return results.map(r => r.data);
}

// ============================================
// FINISHER DRAWING STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getFinisherDrawingStoppageEntries(headerId) {
  const { data, error } = await supabase
    .from('finisher_drawing_stoppage_entry')
    .select(`
      *,
      production_detail:finisher_drawing_production_detail(
        id,
        machine_id,
        effi_percent,
        act_hank,
        act_prodn,
        session_no,
        machine:drawing_finisher_machines(id, machine_no, speed)
      ),
      stoppage1:stoppage_details!stoppage1_id(id, stoppage_name, short_code),
      stoppage2:stoppage_details!stoppage2_id(id, stoppage_name, short_code),
      stoppage3:stoppage_details!stoppage3_id(id, stoppage_name, short_code),
      stoppage4:stoppage_details!stoppage4_id(id, stoppage_name, short_code)
    `)
    .order('production_detail_id');

  if (error) throw error;

  // Filter to only include entries for this header
  const { data: details } = await supabase
    .from('finisher_drawing_production_detail')
    .select('id')
    .eq('header_id', headerId);

  const detailIds = details?.map(d => d.id) || [];
  return data?.filter(s => detailIds.includes(s.production_detail_id)) || [];
}

// Update stoppage entry
export async function updateFinisherDrawingStoppageEntry(id, updates) {
  // First, fetch the existing record to get current stoppage values
  const { data: existing, error: fetchError } = await supabase
    .from('finisher_drawing_stoppage_entry')
    .select('stoppage1_time, stoppage2_time, stoppage3_time, stoppage4_time')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching existing stoppage entry:', fetchError);
    throw new Error(`Failed to fetch stoppage entry: ${fetchError.message}`);
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

  const { data, error } = await supabase
    .from('finisher_drawing_stoppage_entry')
    .update({
      ...updates,
      ...mergedStoppages,
      total_stoppage_time: total
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateFinisherDrawingStoppageEntry error:', error);
    throw new Error(`Failed to update stoppage entry: ${error.message || JSON.stringify(error)}`);
  }
  return data;
}

// Apply full stoppage to all machines and recalculate production
export async function applyFinisherDrawingFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  try {
    // Get all stoppage entries for this header
    const stoppages = await getFinisherDrawingStoppageEntries(headerId);
    
    if (!stoppages || stoppages.length === 0) {
      throw new Error('No stoppage entries found for this header');
    }
    
    // Get machine setups for recalculation
    const setups = await getFinisherDrawingMachineSetups();
    const setupMap = {};
    setups?.forEach(s => {
      setupMap[s.machine_id] = s;
    });

    const stoppageIdField = `stoppage${slot}_id`;
    const stoppageTimeField = `stoppage${slot}_time`;

    // Update stoppage entries - preserve existing values
    const updates = stoppages.map(s => ({
      id: s.id,
      stoppage1_id: slot === 1 ? stoppageId : s.stoppage1_id,
      stoppage1_time: slot === 1 ? stoppageTime : (s.stoppage1_time || 0),
      stoppage2_id: slot === 2 ? stoppageId : s.stoppage2_id,
      stoppage2_time: slot === 2 ? stoppageTime : (s.stoppage2_time || 0),
      stoppage3_id: slot === 3 ? stoppageId : s.stoppage3_id,
      stoppage3_time: slot === 3 ? stoppageTime : (s.stoppage3_time || 0),
      stoppage4_id: slot === 4 ? stoppageId : s.stoppage4_id,
      stoppage4_time: slot === 4 ? stoppageTime : (s.stoppage4_time || 0)
      // Note: is_full_stoppage column must be added via finisher-drawing-entry-fixes.sql
    }));

    const stoppagePromises = updates.map(({ id, ...data }) =>
      updateFinisherDrawingStoppageEntry(id, data)
    );

    await Promise.all(stoppagePromises);
    
    // Recalculate production for each machine
    const prodPromises = stoppages.map(async (s) => {
      if (!s.production_detail) return null;
      
      const prodDetail = s.production_detail;
      const machineId = prodDetail.machine_id;
      const setup = setupMap[machineId];
      const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? 350;
      
      // Calculate new total stoppage
      const newTotalStoppage = 
        (slot === 1 ? stoppageTime : (s.stoppage1_time || 0)) +
        (slot === 2 ? stoppageTime : (s.stoppage2_time || 0)) +
        (slot === 3 ? stoppageTime : (s.stoppage3_time || 0)) +
        (slot === 4 ? stoppageTime : (s.stoppage4_time || 0));
      
      // Recalculate with machine speed from machine table
      const calculated = calculateFinisherDrawingValues(
        prodDetail.act_hank || 0,
        prodDetail.act_prodn || 0,
        510,
        newTotalStoppage,
        setup,
        machineSpeed
      );
      
      return updateFinisherDrawingDetail(prodDetail.id, calculated);
    });
    
    return Promise.all(prodPromises.filter(Boolean));
  } catch (error) {
    console.error('applyFinisherDrawingFullStoppage error:', error);
    throw error;
  }
}

// Apply partial stoppage to selected machines and recalculate production
export async function applyFinisherDrawingPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime, slot = 1) {
  try {
    // Get machine setups for recalculation (speed already merged from machine table)
    const setups = await getFinisherDrawingMachineSetups();
    const setupMap = {};
    setups?.forEach(s => {
      setupMap[s.machine_id] = s;
    });
    
    // Get all production details with machine info INCLUDING SPEED
    const { data: details } = await supabase
      .from('finisher_drawing_production_detail')
      .select(`
        id,
        machine_id,
        act_hank,
        act_prodn,
        machine:drawing_finisher_machines(machine_no, mc_id, speed)
      `)
      .eq('header_id', headerId);

    // Filter by machine range
    const fromNum = parseInt(fromMachineNo.replace(/\D/g, ''));
    const toNum = parseInt(toMachineNo.replace(/\D/g, ''));

    const filteredDetails = details?.filter(d => {
      const mcNum = parseInt(d.machine.machine_no.replace(/\D/g, ''));
      return mcNum >= fromNum && mcNum <= toNum;
    }) || [];

    if (filteredDetails.length === 0) {
      throw new Error(`No machines found in range ${fromMachineNo} to ${toMachineNo}`);
    }

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id);

    const { data: stoppages } = await supabase
      .from('finisher_drawing_stoppage_entry')
      .select('*')
      .in('production_detail_id', detailIds);

    // Update stoppages - preserve existing values
    const stoppagePromises = stoppages.map(s =>
      updateFinisherDrawingStoppageEntry(s.id, {
        stoppage1_id: slot === 1 ? stoppageId : s.stoppage1_id,
        stoppage1_time: slot === 1 ? stoppageTime : (s.stoppage1_time || 0),
        stoppage2_id: slot === 2 ? stoppageId : s.stoppage2_id,
        stoppage2_time: slot === 2 ? stoppageTime : (s.stoppage2_time || 0),
        stoppage3_id: slot === 3 ? stoppageId : s.stoppage3_id,
        stoppage3_time: slot === 3 ? stoppageTime : (s.stoppage3_time || 0),
        stoppage4_id: slot === 4 ? stoppageId : s.stoppage4_id,
        stoppage4_time: slot === 4 ? stoppageTime : (s.stoppage4_time || 0)
      })
    );

    await Promise.all(stoppagePromises);
    
    // Recalculate production for affected machines
    const prodPromises = filteredDetails.map(async (prodDetail) => {
      const stoppageEntry = stoppages.find(s => s.production_detail_id === prodDetail.id);
      if (!stoppageEntry) return null;
      
      const setup = setupMap[prodDetail.machine_id];
      // Speed from machine table (source of truth)
      const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? 350;
      
      // Calculate new total stoppage (Finisher Drawing has 4 stoppage slots)
      const newTotalStoppage = 
        (slot === 1 ? stoppageTime : (stoppageEntry.stoppage1_time || 0)) +
        (slot === 2 ? stoppageTime : (stoppageEntry.stoppage2_time || 0)) +
        (slot === 3 ? stoppageTime : (stoppageEntry.stoppage3_time || 0)) +
        (slot === 4 ? stoppageTime : (stoppageEntry.stoppage4_time || 0));
      
      // Recalculate with machine speed
      const calculated = calculateFinisherDrawingValues(
        prodDetail.act_hank || 0,
        prodDetail.act_prodn || 0,
        510,
        newTotalStoppage,
        setup,
        machineSpeed
      );
      
      return updateFinisherDrawingDetail(prodDetail.id, calculated);
    });
    
    return Promise.all(prodPromises.filter(Boolean));
  } catch (error) {
    console.error('applyFinisherDrawingPartialStoppage error:', error);
    throw error;
  }
}

// ============================================
// FINISHER DRAWING MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info (FD4-FD10 only)
export async function getFinisherDrawingMachineSetups() {
  // First get the machine IDs for FD4-FD10
  const { data: machines, error: machineError } = await supabase
    .from('drawing_finisher_machines')
    .select('id')
    .eq('is_active', true)
    .in('machine_no', ['FD4', 'FD5', 'FD6', 'FD7', 'FD8', 'FD9', 'FD10']);

  if (machineError) throw machineError;
  
  const machineIds = machines?.map(m => m.id) || [];
  
  const { data, error } = await supabase
    .from('finisher_drawing_machine_setup')
    .select(`
      *,
      machine:drawing_finisher_machines(id, machine_no, description, make_name, prodn_mixing, speed)
    `)
    .in('machine_id', machineIds)
    .order('machine_id');

  if (error) throw error;
  
  // Override setup speed with machine's speed (source of truth)
  return data?.map(setup => ({
    ...setup,
    speed: setup.machine?.speed ?? setup.speed
  })) || [];
}

// Update machine setup - accepts machine_id
export async function updateFinisherDrawingMachineSetup(machineId, updates) {
  // First check if setup exists for this machine
  const { data: existingSetup } = await supabase
    .from('finisher_drawing_machine_setup')
    .select('id, hank_constant, std_efficiency_factor, shift_time, divisor_constant, delivery')
    .eq('machine_id', machineId)
    .single();

  // If speed is being updated, update it in the machine table
  if (updates.speed) {
    await updateFinisherDrawingMachineSpeed(machineId, updates.speed);
    delete updates.speed;
  }

  // Recalculate std_prodn if other params change
  if (updates.hank_constant || updates.std_efficiency_factor || updates.shift_time || updates.delivery) {
    // Get current speed from machine table
    const { data: machine } = await supabase
      .from('drawing_finisher_machines')
      .select('speed')
      .eq('id', machineId)
      .single();

    const speed = machine?.speed || 350;
    const hankConstant = updates.hank_constant || existingSetup?.hank_constant || 0.14;
    const stdEffi = updates.std_efficiency_factor || existingSetup?.std_efficiency_factor || 0.90;
    const shiftTime = updates.shift_time || existingSetup?.shift_time || 510;
    const divisor = updates.divisor_constant || existingSetup?.divisor_constant || 1693;
    const delivery = updates.delivery || existingSetup?.delivery || 1;

    updates.std_prodn = Math.round((speed / divisor / hankConstant) * shiftTime * stdEffi * delivery * 100) / 100;
  }

  if (!existingSetup) {
    // Create new setup
    const { data, error } = await supabase
      .from('finisher_drawing_machine_setup')
      .insert([{ machine_id: machineId, ...updates }])
      .select('*, machine:drawing_finisher_machines(id, machine_no, speed)')
      .single();
    if (error) {
      console.error('Error inserting machine setup:', error);
      throw new Error(`Failed to create machine setup: ${error.message || JSON.stringify(error)}`);
    }
    return { ...data, speed: data.machine?.speed };
  }

  if (Object.keys(updates).length === 0) {
    const { data, error } = await supabase
      .from('finisher_drawing_machine_setup')
      .select('*, machine:drawing_finisher_machines(id, machine_no, speed)')
      .eq('machine_id', machineId)
      .single();
    if (error) {
      console.error('Error fetching machine setup:', error);
      throw new Error(`Failed to fetch machine setup: ${error.message || JSON.stringify(error)}`);
    }
    return { ...data, speed: data.machine?.speed };
  }

  const { data, error } = await supabase
    .from('finisher_drawing_machine_setup')
    .update(updates)
    .eq('machine_id', machineId)
    .select('*, machine:drawing_finisher_machines(id, machine_no, speed)')
    .single();

  if (error) {
    console.error('Error updating machine setup:', error);
    throw new Error(`Failed to update machine setup: ${error.message || JSON.stringify(error)}`);
  }
  return { ...data, speed: data.machine?.speed };
}

// Update machine speed
export async function updateFinisherDrawingMachineSpeed(machineId, newSpeed) {
  const { data, error } = await supabase
    .from('drawing_finisher_machines')
    .update({ speed: newSpeed })
    .eq('id', machineId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get finisher drawing stoppage reasons (all active stoppages)
export async function getFinisherDrawingStoppageReasons() {
  const { data, error } = await supabase
    .from('stoppage_details')
    .select(`
      *,
      department:departments(id, dept_name),
      head:stoppage_heads(id, stoppage_head_name)
    `)
    .eq('is_active', true)
    .order('stoppage_name');

  if (error) throw error;
  return data;
}

// ============================================
// SUPERVISORS QUERIES
// ============================================

// Get all supervisors
export async function getSupervisors() {
  const { data, error } = await supabase
    .from('supervisors')
    .select('*')
    .eq('is_active', true)
    .order('supervisor_name');

  if (error) throw error;
  return data;
}

// ============================================
// CALCULATION HELPERS - FINISHER DRAWING FORMULAS
// ============================================
// From finisher_drawing-formula.md:
// Constant = 1 / 2.20456 / 0.14 ≈ 3.240
// Act Prodn = Prod Hank × Constant
// Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery
// Exp Prodn = Std Prodn × (Work Time / Total Time)
// Act Effi % = Actual Prodn / Exp Prodn × 100
// UTI % = Work Time / Total Time × 100
// Waste % = Waste / Actual Prodn × 100
// Work Time = Total Time − Total Stoppage
//
// KEY: Finisher Drawing uses Hank = 0.14, Std Effi = 90%, Speed = 350

export function calculateFinisherDrawingValues(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed = null) {
  const speed = machineSpeed ?? setup?.speed ?? 350;
  // FINISHER DRAWING HANK CONSTANT = 0.14
  const hankConstant = setup?.hank_constant || 0.14;
  const stdEffiFactor = setup?.std_efficiency_factor || 0.90;
  const divisor = setup?.divisor_constant || 1693;
  const delivery = setup?.delivery || 1;
  const waste = setup?.default_waste || 0.41;

  // VB6 Convention:
  // run_time = Total Time (always 510 for a shift) - displayed as "RunTime" in Production Entry
  // work_time = Total Time - Stoppage Time (actual working time) - displayed as "WorkTime" in Production Entry
  const runTime = totalTime; // Always = Total Time (510)
  const workTime = totalTime - stoppageTime; // Actual working time
  
  // Std Prodn = (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  // = 350 / 1693 / 0.14 × 510 × 0.90 × 1 = 677.79
  const stdProdn = (speed / divisor / hankConstant) * totalTime * stdEffiFactor * delivery;

  // Exp Prodn = Std Prodn × (Work Time / Total Time) - based on actual working time
  const expProdn = stdProdn * (workTime / totalTime);

  // Effi% = Act Prodn / Exp Prodn × 100
  const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0;

  // UTI% = Work Time / Total Time × 100 (how much of shift was actually worked)
  const utiPercent = (workTime / totalTime) * 100;

  // Waste% = Waste / Act Prodn × 100
  const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0;

  return {
    std_prodn: Math.round(stdProdn * 100) / 100,
    exp_prodn: Math.round(expProdn * 100) / 100,
    effi_percent: Math.round(effiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    waste,
    waste_percent: Math.round(wastePercent * 100) / 100,
    run_time: runTime,  // Total Time (510)
    work_time: workTime, // Total Time - Stoppage
    speed
  };
}

// Get mixing options
export async function getFinisherDrawingMixingOptions() {
  const { data, error } = await supabase
    .from('drawing_finisher_machines')
    .select('prodn_mixing')
    .neq('prodn_mixing', null);

  if (error) throw error;
  
  const uniqueMixings = [...new Set(data?.map(d => d.prodn_mixing) || [])];
  return uniqueMixings.sort();
}

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getFinisherDrawingAvailableDates(beforeDate, shift, limit = 30) {
  const { data, error } = await supabase
    .from('finisher_drawing_production_header')
    .select('entry_date, shift')
    .eq('shift', shift)
    .lt('entry_date', beforeDate)
    .order('entry_date', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

// Copy data from a previous date
export async function copyFinisherDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  // If no sourceDate provided, calculate yesterday's date
  let previousDate = sourceDate;
  if (!previousDate) {
    const targetDateObj = new Date(targetDate);
    const yesterdayDateObj = new Date(targetDateObj);
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
    previousDate = yesterdayDateObj.toISOString().split('T')[0];
  }
  
  // Get source header
  const sourceHeader = await getFinisherDrawingProductionByDateShift(previousDate, targetShift);
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`);
  }
  
  // Get source production details
  const { data: sourceDetails, error: detailsError } = await supabase
    .from('finisher_drawing_production_detail')
    .select('*')
    .eq('header_id', sourceHeader.id);
  
  if (detailsError) throw detailsError;
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`);
  }
  
  // Get source stoppage entries
  const { data: sourceStoppages, error: stoppagesError } = await supabase
    .from('finisher_drawing_stoppage_entry')
    .select('*')
    .in('production_detail_id', sourceDetails.map(d => d.id));
  
  if (stoppagesError) throw stoppagesError;
  
  // Get target's existing production details
  const { data: targetDetails, error: targetError } = await supabase
    .from('finisher_drawing_production_detail')
    .select('*, machine:drawing_finisher_machines(machine_no)')
    .eq('header_id', targetHeaderId);
  
  if (targetError) throw targetError;
  
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
    
    const { data, error } = await supabase
      .from('finisher_drawing_production_detail')
      .update({
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
      })
      .eq('id', targetDetail.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  });
  
  await Promise.all(updatePromises.filter(Boolean));
  
  // Update target stoppage entries
  const { data: targetStoppages, error: targetStoppagesError } = await supabase
    .from('finisher_drawing_stoppage_entry')
    .select('*, production_detail:finisher_drawing_production_detail(machine_id)')
    .in('production_detail_id', targetDetails.map(d => d.id));
  
  if (targetStoppagesError) throw targetStoppagesError;
  
  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetStoppage.production_detail?.machine_id;
    const sourceStoppage = sourceStoppageMap[machineId];
    if (!sourceStoppage) return null;
    
    const { data, error } = await supabase
      .from('finisher_drawing_stoppage_entry')
      .update({
        stoppage1_id: sourceStoppage.stoppage1_id,
        stoppage1_time: sourceStoppage.stoppage1_time,
        stoppage2_id: sourceStoppage.stoppage2_id,
        stoppage2_time: sourceStoppage.stoppage2_time,
        stoppage3_id: sourceStoppage.stoppage3_id,
        stoppage3_time: sourceStoppage.stoppage3_time,
        stoppage4_id: sourceStoppage.stoppage4_id,
        stoppage4_time: sourceStoppage.stoppage4_time,
        total_stoppage_time: sourceStoppage.total_stoppage_time
      })
      .eq('id', targetStoppage.id)
      .select()
      .single();
    
    if (error) throw error;
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
export async function copyFinisherDrawingFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copyFinisherDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, null);
}

// ============================================
// MACHINE MANAGEMENT QUERIES
// ============================================

// Add new finisher drawing machine
export async function addFinisherDrawingMachine(machineData) {
  // Get the max mc_id to generate next one
  const { data: maxMachine } = await supabase
    .from('drawing_finisher_machines')
    .select('mc_id, machine_no')
    .order('mc_id', { ascending: false })
    .limit(1)
    .single();

  const nextMcId = (maxMachine?.mc_id || 0) + 1;
  const nextMachineNo = machineData.machine_no || `FD${nextMcId}`;

  // Insert new machine
  const { data: newMachine, error: machineError } = await supabase
    .from('drawing_finisher_machines')
    .insert([{
      machine_no: nextMachineNo,
      mc_id: nextMcId,
      description: machineData.description || `Finisher Drawing Machine ${nextMcId}`,
      make_name: machineData.make_name || 'LMW',
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      speed: machineData.speed || 350,
      is_active: true
    }])
    .select()
    .single();

  if (machineError) throw machineError;

  // Create machine setup for the new machine
  // FINISHER DRAWING Defaults: Hank=0.14, Std Effi=0.90, Delivery=1, Speed=350
  const speed = machineData.speed || 350;
  const hankConstant = machineData.hank_constant || 0.14;
  const stdEffi = machineData.std_efficiency_factor || 0.90;
  const shiftTime = machineData.shift_time || 510;
  const delivery = machineData.delivery || 1;
  const divisor = 1693;

  // FINISHER DRAWING Std Prodn = Speed / 1693 / Hank × Time × Std Effi × Delivery
  // = 350 / 1693 / 0.14 × 510 × 0.90 × 1 = 677.79
  const stdProdn = (speed / divisor / hankConstant) * shiftTime * stdEffi * delivery;

  const { data: newSetup, error: setupError } = await supabase
    .from('finisher_drawing_machine_setup')
    .insert([{
      machine_id: newMachine.id,
      speed: speed,
      hank_constant: hankConstant,
      std_efficiency_factor: stdEffi,
      shift_time: shiftTime,
      divisor_constant: divisor,
      default_waste: 0.41,
      delivery: delivery,
      std_prodn: Math.round(stdProdn * 100) / 100
    }])
    .select()
    .single();

  if (setupError) throw setupError;

  return { machine: newMachine, setup: newSetup };
}

// Remove (deactivate) finisher drawing machine
export async function removeFinisherDrawingMachine(machineId) {
  // Soft delete - set is_active to false
  const { data, error } = await supabase
    .from('drawing_finisher_machines')
    .update({ is_active: false })
    .eq('id', machineId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update machine mixing/count
export async function updateFinisherDrawingMachineMixing(machineId, newMixing) {
  const { data, error } = await supabase
    .from('drawing_finisher_machines')
    .update({ prodn_mixing: newMixing })
    .eq('id', machineId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Bulk update machine mixing/count
export async function bulkUpdateFinisherDrawingMachineMixing(machineIds, newMixing) {
  const promises = machineIds.map(id => 
    supabase
      .from('drawing_finisher_machines')
      .update({ prodn_mixing: newMixing })
      .eq('id', id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) throw errors[0].error;

  return results.map(r => r.data);
}
