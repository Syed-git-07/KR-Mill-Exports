import { supabase } from '../supabase'

// ============================================
// BREAKER DRAWING PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers with supervisor info
export async function getBreakerDrawingProductionHeaders() {
  const { data, error } = await supabase
    .from('breaker_drawing_production_header')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, supervisor_name),
      maisitry:supervisors!maisitry_id(id, supervisor_name)
    `)
    .order('entry_date', { ascending: false })

  if (error) throw error
  return data
}

// Get production header by date and shift
export async function getBreakerDrawingProductionByDateShift(date, shift) {
  const { data, error } = await supabase
    .from('breaker_drawing_production_header')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, supervisor_name),
      maisitry:supervisors!maisitry_id(id, supervisor_name)
    `)
    .eq('entry_date', date)
    .eq('shift', shift)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// Create or get production header
export async function getOrCreateBreakerDrawingHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getBreakerDrawingProductionByDateShift(date, shift)
  if (existing) return existing

  // Create new header
  const { data, error } = await supabase
    .from('breaker_drawing_production_header')
    .insert([{
      entry_date: date,
      shift: shift,
      supervisor_id: supervisorId || null,
      maisitry_id: maisitryId || null,
      total_time: 510
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Update production header
export async function updateBreakerDrawingHeader(id, updates) {
  const { data, error } = await supabase
    .from('breaker_drawing_production_header')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// BREAKER DRAWING PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getBreakerDrawingProductionDetails(headerId) {
  const { data, error } = await supabase
    .from('breaker_drawing_production_detail')
    .select(`
      *,
      machine:drawing_breaker_machines(id, machine_no, description, prodn_mixing)
    `)
    .eq('header_id', headerId)
    .order('machine_id')

  if (error) throw error
  return data
}

// Get production details with machine setup for a header (for display)
// Speed is fetched from machine table (source of truth)
export async function getBreakerDrawingProductionWithSetup(headerId) {
  const { data, error } = await supabase
    .from('breaker_drawing_production_detail')
    .select(`
      *,
      machine:drawing_breaker_machines!inner(id, machine_no, description, prodn_mixing, mc_id, speed, is_active),
      stoppage:breaker_drawing_stoppage_entry(*)
    `)
    .eq('header_id', headerId)
    .eq('machine.is_active', true)

  if (error) throw error
  
  // Sort by natural machine number order (BD1, BD2, BD3, BD4)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
    const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
    return aNum - bNum
  }) || []
}

// Initialize production details for all breaker drawing machines
// Speed is fetched from machine table (source of truth)
export async function initializeBreakerDrawingDetails(headerId) {
  // Get all active breaker drawing machines WITH SPEED (no hardcoded list)
  const { data: machines, error: machineError } = await supabase
    .from('drawing_breaker_machines')
    .select('id, machine_no, prodn_mixing, speed')
    .eq('is_active', true)
    .order('mc_id')

  if (machineError) throw machineError

  // Get machine setup for default values (except speed which comes from machine)
  const { data: setups, error: setupError } = await supabase
    .from('breaker_drawing_machine_setup')
    .select('*')

  if (setupError) throw setupError

  // Create a map of machine_id to setup
  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })

  // Create detail records for each machine
  // Default stoppage: 80 mins, Work Time: 510-80=430
  const defaultStoppage = 80
  const totalTime = 510
  const defaultWorkTime = totalTime - defaultStoppage

  const details = machines.map(machine => {
    const setup = setupMap[machine.id] || {}
    // Use speed from machine table (source of truth)
    const speed = machine.speed || setup.speed || 750
    const hankConstant = setup.hank_constant || 0.14
    const stdEffiFactor = setup.std_efficiency_factor || 0.85
    const delivery = setup.delivery || 1
    
    // Calculate Std Prodn from machine speed: (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
    const stdProdn = (speed / 1693 / hankConstant) * totalTime * stdEffiFactor * delivery
    // Exp.Prodn = Std.Prodn × (WorkTime / TotalTime)
    const expProdn = stdProdn * (defaultWorkTime / totalTime)
    
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
      waste: setup.default_waste || 0.85,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      session_no: 1
    }
  })

  const { data, error } = await supabase
    .from('breaker_drawing_production_detail')
    .insert(details)
    .select()

  if (error) throw error

  // Initialize stoppage entries for each detail
  // Default: BSS (60) + AIR CLEANING (20) = 80 mins
  const { data: stoppageReasons } = await supabase
    .from('stoppage_details')
    .select('id, code')
    .in('code', [1511, 1512])

  const bssId = stoppageReasons?.find(r => r.code === 1511)?.id
  const airCleaningId = stoppageReasons?.find(r => r.code === 1512)?.id

  const stoppageEntries = data.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_id: bssId || null,
    stoppage1_time: 60,
    stoppage2_id: airCleaningId || null,
    stoppage2_time: 20,
    total_stoppage_time: 80
  }))

  await supabase
    .from('breaker_drawing_stoppage_entry')
    .insert(stoppageEntries)

  return data
}

// Sync newly added machines to an existing header
// This adds production details and stoppage entries for any active machines
// that don't already have records in this header
export async function syncNewMachinesToBreakerDrawingHeader(headerId) {
  // Get all active machines
  const { data: allMachines, error: machineError } = await supabase
    .from('drawing_breaker_machines')
    .select('id, machine_no, prodn_mixing, speed')
    .eq('is_active', true)
    .order('mc_id')

  if (machineError) throw machineError

  // Get existing production details for this header
  const { data: existingDetails, error: existingError } = await supabase
    .from('breaker_drawing_production_detail')
    .select('machine_id')
    .eq('header_id', headerId)

  if (existingError) throw existingError

  // Find machines that don't have details yet
  const existingMachineIds = new Set(existingDetails?.map(d => d.machine_id) || [])
  const newMachines = allMachines?.filter(m => !existingMachineIds.has(m.id)) || []

  if (newMachines.length === 0) {
    return [] // No new machines to add
  }

  // Get machine setups
  const { data: setups } = await supabase
    .from('breaker_drawing_machine_setup')
    .select('*')

  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })

  // Default values
  const defaultStoppage = 80
  const totalTime = 510
  const defaultWorkTime = totalTime - defaultStoppage

  // Create detail records for new machines
  const details = newMachines.map(machine => {
    const setup = setupMap[machine.id] || {}
    const speed = machine.speed || setup.speed || 750
    const hankConstant = setup.hank_constant || 0.14
    const stdEffiFactor = setup.std_efficiency_factor || 0.85
    const delivery = setup.delivery || 1
    
    const stdProdn = (speed / 1693 / hankConstant) * totalTime * stdEffiFactor * delivery
    const expProdn = stdProdn * (defaultWorkTime / totalTime)
    
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
      waste: setup.default_waste || 0.85,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      total_stoppage_mins: defaultStoppage,
      session_no: 1
    }
  })

  const { data, error } = await supabase
    .from('breaker_drawing_production_detail')
    .insert(details)
    .select()

  if (error) throw error

  // Create stoppage entries for new details
  const { data: stoppageReasons } = await supabase
    .from('stoppage_details')
    .select('id, code')
    .in('code', [1511, 1512])

  const bssId = stoppageReasons?.find(r => r.code === 1511)?.id
  const airCleaningId = stoppageReasons?.find(r => r.code === 1512)?.id

  const stoppageEntries = data.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_id: bssId || null,
    stoppage1_time: 60,
    stoppage2_id: airCleaningId || null,
    stoppage2_time: 20,
    total_stoppage_time: 80
  }))

  await supabase
    .from('breaker_drawing_stoppage_entry')
    .insert(stoppageEntries)

  return data
}

// Update production detail
export async function updateBreakerDrawingDetail(id, updates) {
  // Remove any fields that shouldn't be updated (like speed from calculations)
  const { speed, machine, stoppage, ...cleanUpdates } = updates
  
  const { data, error } = await supabase
    .from('breaker_drawing_production_detail')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateBreakerDrawingDetail error:', error)
    throw new Error(`Failed to update production detail: ${error.message}`)
  }
  return data
}

// Bulk update production details
export async function bulkUpdateBreakerDrawingDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    supabase
      .from('breaker_drawing_production_detail')
      .update(data)
      .eq('id', id)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data)
}

// ============================================
// BREAKER DRAWING STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
// Speed is fetched from machine table (source of truth)
export async function getBreakerDrawingStoppageEntries(headerId) {
  const { data, error } = await supabase
    .from('breaker_drawing_stoppage_entry')
    .select(`
      *,
      production_detail:breaker_drawing_production_detail(
        id,
        machine_id,
        effi_percent,
        act_hank,
        act_prodn,
        session_no,
        machine:drawing_breaker_machines!inner(id, machine_no, speed, is_active)
      ),
      stoppage1:stoppage_details!stoppage1_id(id, stoppage_name, short_code),
      stoppage2:stoppage_details!stoppage2_id(id, stoppage_name, short_code),
      stoppage3:stoppage_details!stoppage3_id(id, stoppage_name, short_code),
      stoppage4:stoppage_details!stoppage4_id(id, stoppage_name, short_code)
    `)
    .order('production_detail_id')

  if (error) throw error

  // Filter to only include entries for this header AND active machines
  const { data: details } = await supabase
    .from('breaker_drawing_production_detail')
    .select('id, machine:drawing_breaker_machines!inner(is_active)')
    .eq('header_id', headerId)
    .eq('machine.is_active', true)

  const detailIds = details?.map(d => d.id) || []
  return data?.filter(s => detailIds.includes(s.production_detail_id)) || []
}

// Update stoppage entry
export async function updateBreakerDrawingStoppageEntry(id, updates) {
  // First, fetch the existing record to get current stoppage values
  const { data: existing, error: fetchError } = await supabase
    .from('breaker_drawing_stoppage_entry')
    .select('stoppage1_time, stoppage2_time, stoppage3_time, stoppage4_time')
    .eq('id', id)
    .single()

  if (fetchError) {
    console.error('Error fetching existing stoppage entry:', fetchError)
    throw new Error(`Failed to fetch stoppage entry: ${fetchError.message}`)
  }

  // Merge existing values with updates - use updated value if provided, else keep existing
  const mergedStoppages = {
    stoppage1_time: updates.stoppage1_time ?? existing?.stoppage1_time ?? 0,
    stoppage2_time: updates.stoppage2_time ?? existing?.stoppage2_time ?? 0,
    stoppage3_time: updates.stoppage3_time ?? existing?.stoppage3_time ?? 0,
    stoppage4_time: updates.stoppage4_time ?? existing?.stoppage4_time ?? 0
  }

  // Calculate total stoppage time from merged values
  const total = mergedStoppages.stoppage1_time + 
                mergedStoppages.stoppage2_time + 
                mergedStoppages.stoppage3_time + 
                mergedStoppages.stoppage4_time

  const { data, error } = await supabase
    .from('breaker_drawing_stoppage_entry')
    .update({
      ...updates,
      ...mergedStoppages,
      total_stoppage_time: total
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Apply full stoppage to all machines and recalculate production
export async function applyBreakerDrawingFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  // Get all stoppage entries for this header
  const stoppages = await getBreakerDrawingStoppageEntries(headerId)
  
  // Get machine setups for recalculation (speed already merged from machine table)
  const setups = await getBreakerDrawingMachineSetups()
  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  // Update stoppage entries
  const updates = stoppages.map(s => ({
    id: s.id,
    [stoppageIdField]: stoppageId,
    [stoppageTimeField]: stoppageTime,
    is_full_stoppage: slot === 1
  }))

  const stoppagePromises = updates.map(({ id, ...data }) =>
    updateBreakerDrawingStoppageEntry(id, data)
  )

  await Promise.all(stoppagePromises)
  
  // Recalculate production for each machine
  const prodPromises = stoppages.map(async (s) => {
    if (!s.production_detail) return null
    
    const prodDetail = s.production_detail
    const machineId = prodDetail.machine_id
    const setup = setupMap[machineId]
    // Speed from machine table (setup has merged machine speed)
    const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? 750
    
    // Calculate new total stoppage
    const currentStoppage = s
    const newTotalStoppage = 
      (slot === 1 ? stoppageTime : currentStoppage.stoppage1_time || 0) +
      (slot === 2 ? stoppageTime : currentStoppage.stoppage2_time || 0) +
      (slot === 3 ? stoppageTime : currentStoppage.stoppage3_time || 0) +
      (slot === 4 ? stoppageTime : currentStoppage.stoppage4_time || 0)
    
    // Recalculate with machine speed from machine table
    const calculated = calculateBreakerDrawingValues(
      prodDetail.act_hank || 0,
      prodDetail.act_prodn || 0,
      510,
      newTotalStoppage,
      setup,
      machineSpeed  // Pass machine speed explicitly
    )
    
    return updateBreakerDrawingDetail(prodDetail.id, calculated)
  })
  
  return Promise.all(prodPromises.filter(Boolean))
}

// Apply partial stoppage to machine range and recalculate production
export async function applyBreakerDrawingPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime, slot = 1) {
  // Get machine setups for recalculation (speed already merged from machine table)
  const setups = await getBreakerDrawingMachineSetups()
  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })
  
  // Get all production details with machine info INCLUDING SPEED
  const { data: details } = await supabase
    .from('breaker_drawing_production_detail')
    .select(`
      id,
      machine_id,
      act_hank,
      act_prodn,
      machine:drawing_breaker_machines(machine_no, mc_id, speed)
    `)
    .eq('header_id', headerId)

  // Filter by machine range
  const fromNum = parseInt(fromMachineNo.replace(/\D/g, ''))
  const toNum = parseInt(toMachineNo.replace(/\D/g, ''))

  const filteredDetails = details?.filter(d => {
    const mcNum = parseInt(d.machine.machine_no.replace(/\D/g, ''))
    return mcNum >= fromNum && mcNum <= toNum
  }) || []

  // Get stoppage entries for these details
  const detailIds = filteredDetails.map(d => d.id)

  const { data: stoppages } = await supabase
    .from('breaker_drawing_stoppage_entry')
    .select('*')
    .in('production_detail_id', detailIds)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  // Update stoppages
  const stoppagePromises = stoppages.map(s =>
    updateBreakerDrawingStoppageEntry(s.id, {
      [stoppageIdField]: stoppageId,
      [stoppageTimeField]: stoppageTime
    })
  )

  await Promise.all(stoppagePromises)
  
  // Recalculate production for affected machines
  const prodPromises = filteredDetails.map(async (prodDetail) => {
    const stoppageEntry = stoppages.find(s => s.production_detail_id === prodDetail.id)
    if (!stoppageEntry) return null
    
    const setup = setupMap[prodDetail.machine_id]
    // Speed from machine table (source of truth)
    const machineSpeed = prodDetail.machine?.speed ?? setup?.speed ?? 750
    
    // Calculate new total stoppage
    const newTotalStoppage = 
      (slot === 1 ? stoppageTime : stoppageEntry.stoppage1_time || 0) +
      (slot === 2 ? stoppageTime : stoppageEntry.stoppage2_time || 0) +
      (slot === 3 ? stoppageTime : stoppageEntry.stoppage3_time || 0) +
      (slot === 4 ? stoppageTime : stoppageEntry.stoppage4_time || 0)
    
    // Recalculate with machine speed
    const calculated = calculateBreakerDrawingValues(
      prodDetail.act_hank || 0,
      prodDetail.act_prodn || 0,
      510,
      newTotalStoppage,
      setup,
      machineSpeed  // Pass machine speed explicitly
    )
    
    return updateBreakerDrawingDetail(prodDetail.id, calculated)
  })
  
  return Promise.all(prodPromises.filter(Boolean))
}

// ============================================
// BREAKER DRAWING MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info (speed comes from machine table)
export async function getBreakerDrawingMachineSetups() {
  const { data, error } = await supabase
    .from('breaker_drawing_machine_setup')
    .select(`
      *,
      machine:drawing_breaker_machines!inner(id, machine_no, description, make_name, prodn_mixing, speed, is_active)
    `)
    .eq('machine.is_active', true)
    .order('machine_id')

  if (error) throw error
  
  // Override setup speed with machine's speed (source of truth)
  return data?.map(setup => ({
    ...setup,
    speed: setup.machine?.speed ?? setup.speed
  })) || []
}

// Update machine setup
// NOTE: Speed is stored in drawing_breaker_machines table (source of truth)
// The trigger sync_bd_speed_on_machine_update auto-syncs to setup table
export async function updateBreakerDrawingMachineSetup(id, updates) {
  // Get current setup to find machine_id
  const { data: currentSetup } = await supabase
    .from('breaker_drawing_machine_setup')
    .select('machine_id, hank_constant, std_efficiency_factor, shift_time, divisor_constant, delivery')
    .eq('id', id)
    .single()

  // If speed is being updated, update it in the machine table (triggers will sync to setup)
  if (updates.speed && currentSetup?.machine_id) {
    await updateBreakerDrawingMachineSpeed(currentSetup.machine_id, updates.speed)
    delete updates.speed  // Remove from setup updates (handled by trigger)
  }

  // Recalculate std_prodn if other params change (speed handled by trigger)
  if (updates.hank_constant || updates.std_efficiency_factor || updates.shift_time || updates.delivery) {
    // Get current speed from machine table
    const { data: machine } = await supabase
      .from('drawing_breaker_machines')
      .select('speed')
      .eq('id', currentSetup?.machine_id)
      .single()

    const speed = machine?.speed || 750
    const hankConstant = updates.hank_constant || currentSetup?.hank_constant || 0.14
    const stdEffi = updates.std_efficiency_factor || currentSetup?.std_efficiency_factor || 0.85
    const shiftTime = updates.shift_time || currentSetup?.shift_time || 510
    const divisor = updates.divisor_constant || currentSetup?.divisor_constant || 1693
    const delivery = updates.delivery || currentSetup?.delivery || 1

    updates.std_prodn = Math.round((speed / divisor / hankConstant) * shiftTime * stdEffi * delivery * 100) / 100
  }

  // Only update setup if there are non-speed fields to update
  if (Object.keys(updates).length === 0) {
    // Return refreshed data after speed update
    const { data, error } = await supabase
      .from('breaker_drawing_machine_setup')
      .select('*, machine:drawing_breaker_machines(id, machine_no, speed)')
      .eq('id', id)
      .single()
    if (error) throw error
    return { ...data, speed: data.machine?.speed }
  }

  const { data, error } = await supabase
    .from('breaker_drawing_machine_setup')
    .update(updates)
    .eq('id', id)
    .select('*, machine:drawing_breaker_machines(id, machine_no, speed)')
    .single()

  if (error) throw error
  return { ...data, speed: data.machine?.speed }
}

// Update machine speed (source of truth in drawing_breaker_machines)
// Trigger will auto-sync to breaker_drawing_machine_setup
export async function updateBreakerDrawingMachineSpeed(machineId, newSpeed) {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .update({ speed: newSpeed })
    .eq('id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk update machine speeds
export async function bulkUpdateBreakerDrawingMachineSpeeds(updates) {
  // updates: [{ machineId, speed }, ...]
  const promises = updates.map(({ machineId, speed }) =>
    supabase
      .from('drawing_breaker_machines')
      .update({ speed })
      .eq('id', machineId)
      .select()
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data).flat()
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get breaker drawing stoppage reasons (codes 1510-1516)
export async function getBreakerDrawingStoppageReasons() {
  const { data, error } = await supabase
    .from('stoppage_details')
    .select(`
      *,
      department:departments(id, dept_name),
      head:stoppage_heads(id, stoppage_head_name)
    `)
    .gte('code', 1510)
    .lte('code', 1520)
    .order('stoppage_name')

  if (error) throw error
  return data
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
    .order('supervisor_name')

  if (error) throw error
  return data
}

// ============================================
// CALCULATION HELPERS - BREAKER DRAWING FORMULAS
// ============================================
// From breaker-drawing-formula.md:
// Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery
// Exp Prodn = Std Prodn × (Work Time / Total Time)
// Act Effi % = Actual Prodn / Exp Prodn × 100
// UTI % = Work Time / Total Time × 100
// Waste % = Waste / Actual Prodn × 100
// Work Time = ENTERED SEPARATELY (or Total Time − Total Stoppage)
//
// NOTE: Speed is sourced from drawing_breaker_machines table (NOT hardcoded)
// The setup.speed should be pre-merged from machine.speed before calling this function

export function calculateBreakerDrawingValues(actHank, actProdn, totalTime, stoppageTime, setup, machineSpeed = null) {
  // Speed priority: machineSpeed param > setup.speed > default 750
  // machineSpeed should be passed from drawing_breaker_machines.speed (source of truth)
  const speed = machineSpeed ?? setup?.speed ?? 750
  const hankConstant = setup?.hank_constant || 0.14
  const stdEffiFactor = setup?.std_efficiency_factor || 0.85
  const divisor = setup?.divisor_constant || 1693
  const delivery = setup?.delivery || 1
  const waste = setup?.default_waste || 0.85

  // Work Time = Total Time - Stoppage Time (this is actual running time)
  const workTime = totalTime - stoppageTime
  
  // Std Prodn = (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
  const stdProdn = (speed / divisor / hankConstant) * totalTime * stdEffiFactor * delivery

  // Exp Prodn = Std Prodn × (Work Time / Total Time)
  const expProdn = stdProdn * (workTime / totalTime)

  // Effi% = Act Prodn / Exp Prodn × 100
  const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0

  // UTI% = Work Time / Total Time × 100
  const utiPercent = (workTime / totalTime) * 100

  // Waste% = Waste / Act Prodn × 100
  const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

  return {
    std_prodn: Math.round(stdProdn * 100) / 100,
    exp_prodn: Math.round(expProdn * 100) / 100,
    effi_percent: Math.round(effiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    waste,
    waste_percent: Math.round(wastePercent * 100) / 100,
    run_time: totalTime,  // Run Time is displayed as Total Time (510)
    work_time: workTime,  // Work Time = Total Time - Stoppage
    speed                 // Return speed used for reference
  }
}

// Calculate production values with speed from machine table
export async function calculateBreakerDrawingValuesFromMachine(machineId, actHank, actProdn, totalTime, stoppageTime) {
  // Get speed from machine table (source of truth)
  const machine = await getBreakerDrawingMachineWithSpeed(machineId)
  
  // Get setup for other params
  const { data: setup } = await supabase
    .from('breaker_drawing_machine_setup')
    .select('*')
    .eq('machine_id', machineId)
    .single()
  
  return calculateBreakerDrawingValues(actHank, actProdn, totalTime, stoppageTime, setup, machine?.speed)
}

// Get all breaker drawing machines (includes speed - source of truth)
export async function getBreakerDrawingMachines() {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .select('id, machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active')
    .eq('is_active', true)
    .order('mc_id')

  if (error) throw error
  return data
}

// Get machine with speed for calculations
export async function getBreakerDrawingMachineWithSpeed(machineId) {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .select('id, machine_no, speed, prodn_mixing')
    .eq('id', machineId)
    .single()

  if (error) throw error
  return data
}

// ============================================
// MACHINE MANAGEMENT QUERIES
// ============================================

// Add new breaker drawing machine
export async function addBreakerDrawingMachine(machineData) {
  // Check if machine_no already exists (might be inactive)
  if (machineData.machine_no) {
    const { data: existingMachine } = await supabase
      .from('drawing_breaker_machines')
      .select('id, is_active, machine_no')
      .eq('machine_no', machineData.machine_no)
      .single()

    if (existingMachine && !existingMachine.is_active) {
      // Reactivate the existing machine
      const { data: reactivated, error: reactivateError } = await supabase
        .from('drawing_breaker_machines')
        .update({ 
          is_active: true,
          description: machineData.description || existingMachine.machine_no,
          make_name: machineData.make_name || 'LMW',
          prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
          speed: machineData.speed || 750
        })
        .eq('id', existingMachine.id)
        .select()
        .single()

      if (reactivateError) throw new Error(`Failed to reactivate machine: ${reactivateError.message}`)
      
      // Update the existing setup if needed
      const { data: existingSetup } = await supabase
        .from('breaker_drawing_machine_setup')
        .select('id')
        .eq('machine_id', existingMachine.id)
        .single()

      if (existingSetup) {
        const speed = machineData.speed || 750
        const hankConstant = machineData.hank_constant || 0.14
        const stdEffi = machineData.std_efficiency_factor || 0.85
        const shiftTime = machineData.shift_time || 510
        const delivery = machineData.delivery || 1

        await supabase
          .from('breaker_drawing_machine_setup')
          .update({
            speed: speed,
            hank_constant: hankConstant,
            std_efficiency_factor: stdEffi,
            shift_time: shiftTime,
            delivery: delivery,
            std_prodn: (speed / 1693 / hankConstant) * shiftTime * stdEffi * delivery
          })
          .eq('id', existingSetup.id)
      }
      
      return { machine: reactivated, setup: existingSetup, reactivated: true }
    }

    if (existingMachine && existingMachine.is_active) {
      throw new Error(`Machine ${machineData.machine_no} already exists and is active`)
    }
  }

  // Get the max mc_id to generate next one
  const { data: maxMachine } = await supabase
    .from('drawing_breaker_machines')
    .select('mc_id, machine_no')
    .order('mc_id', { ascending: false })
    .limit(1)
    .single()

  const nextMcId = (maxMachine?.mc_id || 0) + 1
  const nextMachineNo = machineData.machine_no || `BD${nextMcId}`

  // Insert new machine
  const { data: newMachine, error: machineError } = await supabase
    .from('drawing_breaker_machines')
    .insert([{
      machine_no: nextMachineNo,
      mc_id: nextMcId,
      description: machineData.description || nextMachineNo,
      make_name: machineData.make_name || 'LMW',
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      speed: machineData.speed || 750,
      is_active: true
    }])
    .select()
    .single()

  if (machineError) throw new Error(`Failed to add machine: ${machineError.message}`)

  // Create machine setup for the new machine
  const speed = machineData.speed || 750
  const hankConstant = machineData.hank_constant || 0.14
  const stdEffi = machineData.std_efficiency_factor || 0.85
  const shiftTime = machineData.shift_time || 510
  const delivery = machineData.delivery || 1

  const { data: newSetup, error: setupError } = await supabase
    .from('breaker_drawing_machine_setup')
    .insert([{
      machine_id: newMachine.id,
      speed: speed,
      hank_constant: hankConstant,
      std_efficiency_factor: stdEffi,
      shift_time: shiftTime,
      divisor_constant: 1693,
      default_waste: 0.85,
      default_stoppage: 0,
      delivery: delivery,
      std_prodn: (speed / 1693 / hankConstant) * shiftTime * stdEffi * delivery
    }])
    .select()
    .single()

  if (setupError) throw new Error(`Failed to create machine setup: ${setupError.message}`)

  return { machine: newMachine, setup: newSetup, reactivated: false }
}

// Remove (deactivate) breaker drawing machine
export async function removeBreakerDrawingMachine(machineId) {
  // Soft delete - set is_active to false
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .update({ is_active: false })
    .eq('id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update machine mixing
export async function updateBreakerDrawingMachineMixing(machineId, newMixing) {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .update({ prodn_mixing: newMixing })
    .eq('id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk update machine mixing
export async function bulkUpdateBreakerDrawingMachineMixing(machineIds, newMixing) {
  const promises = machineIds.map(id => 
    supabase
      .from('drawing_breaker_machines')
      .update({ prodn_mixing: newMixing })
      .eq('id', id)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data)
}

// Get all mixing options (distinct prodn_mixing values)
export async function getMixingOptions() {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .select('prodn_mixing')
    .neq('prodn_mixing', null)

  if (error) throw error
  
  // Get unique values
  const uniqueMixings = [...new Set(data?.map(d => d.prodn_mixing) || [])]
  return uniqueMixings.sort()
}

// ============================================
// COPY YESTERDAY DATA FUNCTIONALITY
// ============================================

// Copy production data from previous day to current day
// Get available previous dates that have production data
export async function getBreakerDrawingAvailableDates(beforeDate, shift, limit = 30) {
  const { data, error } = await supabase
    .from('breaker_drawing_production_header')
    .select('entry_date, shift')
    .eq('shift', shift)
    .lt('entry_date', beforeDate)
    .order('entry_date', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

// Copy data from a previous date (replaces copyBreakerDrawingFromYesterday)
export async function copyBreakerDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  // If no sourceDate provided, calculate yesterday's date (for backward compatibility)
  let previousDate = sourceDate
  if (!previousDate) {
    const targetDateObj = new Date(targetDate)
    const yesterdayDateObj = new Date(targetDateObj)
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1)
    previousDate = yesterdayDateObj.toISOString().split('T')[0]
  }
  
  // Get source header
  const sourceHeader = await getBreakerDrawingProductionByDateShift(previousDate, targetShift)
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`)
  }
  
  // Get source production details
  const { data: sourceDetails, error: detailsError } = await supabase
    .from('breaker_drawing_production_detail')
    .select('*')
    .eq('header_id', sourceHeader.id)
  
  if (detailsError) throw detailsError
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`)
  }
  
  // Get source stoppage entries
  const { data: sourceStoppages, error: stoppagesError } = await supabase
    .from('breaker_drawing_stoppage_entry')
    .select('*')
    .in('production_detail_id', sourceDetails.map(d => d.id))
  
  if (stoppagesError) throw stoppagesError
  
  // Get target's existing production details
  const { data: targetDetails, error: targetError } = await supabase
    .from('breaker_drawing_production_detail')
    .select('*, machine:drawing_breaker_machines(machine_no)')
    .eq('header_id', targetHeaderId)
  
  if (targetError) throw targetError
  
  // Create a map of machine_id to source data
  const sourceDataMap = {}
  sourceDetails.forEach(d => {
    sourceDataMap[d.machine_id] = d
  })
  
  const sourceStoppageMap = {}
  sourceStoppages?.forEach(s => {
    // Find which machine this stoppage belongs to
    const detail = sourceDetails.find(d => d.id === s.production_detail_id)
    if (detail) {
      sourceStoppageMap[detail.machine_id] = s
    }
  })
  
  // Update target details with source data
  const updatePromises = targetDetails.map(async (targetDetail) => {
    const sourceData = sourceDataMap[targetDetail.machine_id]
    if (!sourceData) return null
    
    // Copy production values
    const { data, error } = await supabase
      .from('breaker_drawing_production_detail')
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
      .single()
    
    if (error) throw error
    return data
  })
  
  await Promise.all(updatePromises.filter(Boolean))
  
  // Update target stoppage entries
  // First get target stoppage entries
  const { data: targetStoppages, error: targetStoppagesError } = await supabase
    .from('breaker_drawing_stoppage_entry')
    .select('*, production_detail:breaker_drawing_production_detail(machine_id)')
    .in('production_detail_id', targetDetails.map(d => d.id))
  
  if (targetStoppagesError) throw targetStoppagesError
  
  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetStoppage.production_detail?.machine_id
    const sourceStoppage = sourceStoppageMap[machineId]
    if (!sourceStoppage) return null
    
    const { data, error } = await supabase
      .from('breaker_drawing_stoppage_entry')
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
      .single()
    
    if (error) throw error
    return data
  }) || []
  
  await Promise.all(stoppageUpdatePromises.filter(Boolean))
  
  return {
    success: true,
    copiedFrom: previousDate,
    machinesUpdated: targetDetails.length
  }
}

// Backward compatibility wrapper
export async function copyBreakerDrawingFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copyBreakerDrawingFromPreviousDate(targetDate, targetShift, targetHeaderId, null)
}
