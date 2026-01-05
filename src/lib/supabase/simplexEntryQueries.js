import { supabase } from '../supabase'

// ============================================
// SIMPLEX PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers with supervisor info
export async function getSimplexProductionHeaders() {
  const { data, error } = await supabase
    .from('simplex_production_header')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, supervisor_name),
      maisitry:supervisors!maisitry_id(id, supervisor_name)
    `)
    .order('entry_date', { ascending: false })

  if (error) throw new Error(`Failed to load production headers: ${error.message}`)
  return data
}

// Get production header by date and shift
export async function getSimplexProductionByDateShift(date, shift) {
  const { data, error } = await supabase
    .from('simplex_production_header')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, supervisor_name),
      maisitry:supervisors!maisitry_id(id, supervisor_name)
    `)
    .eq('entry_date', date)
    .eq('shift', shift)
    .single()

  // PGRST116 = no rows returned, which is fine
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get production header: ${error.message}`)
  }
  return data
}

// Create or get production header
export async function getOrCreateSimplexProductionHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getSimplexProductionByDateShift(date, shift)
  if (existing) return existing

  // Create new header
  const { data, error } = await supabase
    .from('simplex_production_header')
    .insert([{
      entry_date: date,
      shift: shift,
      supervisor_id: supervisorId || null,
      maisitry_id: maisitryId || null,
      total_time: 510
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create production header: ${error.message}`)
  return data
}

// Update production header
export async function updateSimplexProductionHeader(id, updates) {
  const { data, error } = await supabase
    .from('simplex_production_header')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update production header: ${error.message}`)
  return data
}

// ============================================
// SIMPLEX PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getSimplexProductionDetails(headerId) {
  const { data, error } = await supabase
    .from('simplex_production_detail')
    .select(`
      *,
      machine:simplex_machines(id, machine_no, description, prodn_mixing, speed, mc_effi, tpi, no_of_spindles)
    `)
    .eq('header_id', headerId)
    .order('machine_id')

  if (error) throw error
  return data
}

// Get production details with machine setup for a header (for display)
export async function getSimplexProductionWithSetup(headerId) {
  const { data, error } = await supabase
    .from('simplex_production_detail')
    .select(`
      *,
      machine:simplex_machines!inner(id, machine_no, description, prodn_mixing, speed, mc_effi, tpi, no_of_spindles, is_active),
      stoppage:simplex_stoppage_entry(*)
    `)
    .eq('header_id', headerId)
    .eq('machine.is_active', true)

  if (error) throw error
  
  // Sort by natural machine number order (1, 2, 3... 10)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine?.machine_no || '0')
    const bNum = parseInt(b.machine?.machine_no || '0')
    return aNum - bNum
  }) || []
}

// Initialize production details for all simplex machines
export async function initializeSimplexProductionDetails(headerId) {
  // Get all active simplex machines
  const { data: machines, error: machineError } = await supabase
    .from('simplex_machines')
    .select('id, machine_no, prodn_mixing, speed, mc_effi, tpi, no_of_spindles')
    .eq('is_active', true)
    .order('machine_no')

  if (machineError) throw machineError

  // Get machine setup for default values
  const { data: setups, error: setupError } = await supabase
    .from('simplex_machine_setup')
    .select('*')

  if (setupError && setupError.code !== 'PGRST116') throw setupError

  // Create a map of machine_id to setup
  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })

  // Create detail records for each machine
  const details = machines.map(machine => {
    const setup = setupMap[machine.id] || {}
    return {
      header_id: headerId,
      machine_id: machine.id,
      prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
      run_hrs: 0,
      run_min: 0,
      idle_spindles: 0,
      waste: setup.default_waste || 0.9,
      act_prodn: 0,
      waste_percent: 0,
      act_effi_percent: 0,
      uti_percent: 0,
      std_hrs: 0,
      work_time: 510,
      session_no: 1
    }
  })

  const { data, error } = await supabase
    .from('simplex_production_detail')
    .insert(details)
    .select()

  if (error) throw error

  // Initialize stoppage entries for each detail
  const stoppageEntries = data.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_time: 0,
    stoppage2_time: 0,
    stoppage3_time: 0,
    stoppage4_time: 0,
    total_stoppage_time: 0
  }))

  await supabase
    .from('simplex_stoppage_entry')
    .insert(stoppageEntries)

  return data
}

// Update production detail
export async function updateSimplexProductionDetail(id, updates) {
  const { data, error } = await supabase
    .from('simplex_production_detail')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk update production details
export async function bulkUpdateSimplexProductionDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    supabase
      .from('simplex_production_detail')
      .update(data)
      .eq('id', id)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data)
}

// ============================================
// SIMPLEX STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getSimplexStoppageEntries(headerId) {
  const { data, error } = await supabase
    .from('simplex_stoppage_entry')
    .select(`
      *,
      production_detail:simplex_production_detail(
        id,
        machine_id,
        act_effi_percent,
        session_no,
        machine:simplex_machines!inner(id, machine_no, is_active)
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
    .from('simplex_production_detail')
    .select('id, machine:simplex_machines!inner(is_active)')
    .eq('header_id', headerId)
    .eq('machine.is_active', true)

  const detailIds = details?.map(d => d.id) || []
  return data?.filter(s => detailIds.includes(s.production_detail_id)) || []
}

// Update stoppage entry
export async function updateSimplexStoppageEntry(id, updates) {
  // First, fetch the existing record to get current stoppage values
  const { data: existing, error: fetchError } = await supabase
    .from('simplex_stoppage_entry')
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
    .from('simplex_stoppage_entry')
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

// Apply full stoppage to all machines
export async function applySimplexFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  // Get all stoppage entries for this header
  const stoppages = await getSimplexStoppageEntries(headerId)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const updates = stoppages.map(s => ({
    id: s.id,
    [stoppageIdField]: stoppageId,
    [stoppageTimeField]: stoppageTime
  }))

  const promises = updates.map(({ id, ...data }) =>
    updateSimplexStoppageEntry(id, data)
  )

  return Promise.all(promises)
}

// Apply partial stoppage to machine range
export async function applySimplexPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime, slot = 1) {
  // Get all production details with machine info
  const { data: details } = await supabase
    .from('simplex_production_detail')
    .select(`
      id,
      machine:simplex_machines(machine_no)
    `)
    .eq('header_id', headerId)

  // Filter by machine range
  const fromNum = parseInt(fromMachineNo)
  const toNum = parseInt(toMachineNo)

  const filteredDetails = details?.filter(d => {
    const mcNum = parseInt(d.machine.machine_no)
    return mcNum >= fromNum && mcNum <= toNum
  }) || []

  // Get stoppage entries for these details
  const detailIds = filteredDetails.map(d => d.id)

  const { data: stoppages } = await supabase
    .from('simplex_stoppage_entry')
    .select('*')
    .in('production_detail_id', detailIds)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const promises = stoppages.map(s =>
    updateSimplexStoppageEntry(s.id, {
      [stoppageIdField]: stoppageId,
      [stoppageTimeField]: stoppageTime
    })
  )

  return Promise.all(promises)
}

// ============================================
// SIMPLEX MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info (only active machines)
export async function getSimplexMachineSetups() {
  // First get all setups with machine info
  const { data, error } = await supabase
    .from('simplex_machine_setup')
    .select(`
      *,
      machine:simplex_machines(id, machine_no, description, make_name, prodn_mixing, speed, mc_effi, tpi, no_of_spindles, is_active)
    `)
    .order('machine_id')

  if (error) throw error
  
  // Filter to only include active machines
  return (data || []).filter(setup => setup.machine?.is_active === true)
}

// Get machine setup by machine_id
export async function getSimplexMachineSetupByMachineId(machineId) {
  const { data, error } = await supabase
    .from('simplex_machine_setup')
    .select('*')
    .eq('machine_id', machineId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// Update machine setup
export async function updateSimplexMachineSetup(id, updates) {
  const { data, error } = await supabase
    .from('simplex_machine_setup')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Create or update machine setup
export async function upsertSimplexMachineSetup(machineId, setupData) {
  const existing = await getSimplexMachineSetupByMachineId(machineId)
  
  if (existing) {
    return updateSimplexMachineSetup(existing.id, setupData)
  }

  const { data, error } = await supabase
    .from('simplex_machine_setup')
    .insert([{ machine_id: machineId, ...setupData }])
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get simplex stoppage reasons
export async function getSimplexStoppageReasons() {
  const { data, error } = await supabase
    .from('stoppage_details')
    .select(`
      *,
      department:departments(id, dept_name),
      head:stoppage_heads(id, stoppage_head_name)
    `)
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
// SIMPLEX MACHINES QUERIES
// ============================================

// Get all simplex machines
export async function getSimplexMachines() {
  const { data, error } = await supabase
    .from('simplex_machines')
    .select('*')
    .eq('is_active', true)
    .order('machine_no')

  if (error) throw error
  
  // Sort by natural number order (1, 2, 3... 10)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine_no || '0')
    const bNum = parseInt(b.machine_no || '0')
    return aNum - bNum
  }) || []
}

// ============================================
// CALCULATION HELPERS - SIMPLEX FORMULAS
// ============================================

/**
 * Parse Run Hours in HH.MM format to total minutes
 * Example: 7.12 = 7 hours 12 minutes = 432 minutes
 * @param {number} runHrs - Run hours in HH.MM format
 * @returns {number} - Total minutes
 */
export function parseRunHoursToMinutes(runHrs) {
  if (!runHrs || runHrs === 0) return 0
  
  const hours = Math.floor(runHrs)
  const minutes = Math.round((runHrs - hours) * 100)
  
  return (hours * 60) + minutes
}

/**
 * Convert minutes to HH.MM format
 * Example: 432 minutes = 7.12 (7 hours 12 minutes)
 * @param {number} totalMinutes - Total minutes
 * @returns {number} - Run hours in HH.MM format
 */
export function minutesToRunHours(totalMinutes) {
  if (!totalMinutes || totalMinutes === 0) return 0
  
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  return parseFloat(`${hours}.${minutes.toString().padStart(2, '0')}`)
}

/**
 * Calculate Simplex Production Values
 * 
 * Formulas from simplex-machine-formula.md:
 * - RunMin = (Hours × 60) + Minutes (from HH.MM format)
 * - WorkTime = TotalTime - TotalStoppage
 * - Std Hrs = WorkTime × (MCEffi / 100)
 * - Active Spindles = Total Spindles - Idle Spindles
 * - Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
 * - Act.Effi % = (RunMin / Std.Hrs) × 100
 * - Waste % = (Waste / Act.Prodn) × 100
 * - UTI % = (WorkTime / TotalTime) × 100
 */
export function calculateSimplexProductionValues(params) {
  const {
    runHrs = 0,           // HH.MM format (e.g., 7.12)
    speed = 960,          // Machine speed
    tpi = 1.73,           // TPI value
    hank = 1.4,           // Sliver Hank
    mcEffi = 92,          // Machine efficiency %
    totalSpindles = 140,  // Total spindles from setup
    idleSpindles = 0,     // Idle spindles input
    waste = 0.9,          // Waste in Kg
    totalTime = 510,      // Total shift time
    stoppageTime = 0      // Total stoppage time
  } = params

  // Step 1: Convert Run Hours (HH.MM) to Run Minutes
  const runMin = parseRunHoursToMinutes(runHrs)

  // Step 2: Calculate Work Time
  const workTime = totalTime - stoppageTime

  // Step 3: Calculate Standard Hours
  const stdHrs = workTime * (mcEffi / 100)

  // Step 4: Calculate Active Spindles (UNIQUE to Simplex)
  const activeSpindles = totalSpindles - idleSpindles

  // Step 5: Calculate Actual Production using Simplex formula
  // Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
  let actProdn = 0
  if (speed > 0 && tpi > 0 && hank > 0 && runMin > 0 && activeSpindles > 0) {
    const baseRate = speed / tpi / 39.3 / 1693 / hank
    actProdn = baseRate * runMin * activeSpindles
  }

  // Step 6: Calculate Actual Efficiency
  // Act.Effi % = (RunMin / Std.Hrs) × 100
  const actEffiPercent = stdHrs > 0 ? (runMin / stdHrs) * 100 : 0

  // Step 7: Calculate Waste Percentage
  // Waste % = (Waste / Act.Prodn) × 100
  const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

  // Step 8: Calculate Utilization
  // UTI % = (WorkTime / TotalTime) × 100
  const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0

  return {
    run_min: runMin,
    work_time: workTime,
    std_hrs: Math.round(stdHrs * 10) / 10,
    act_prodn: Math.round(actProdn * 100) / 100,
    act_effi_percent: Math.round(actEffiPercent * 100) / 100,
    waste_percent: Math.round(wastePercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100
  }
}

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getSimplexAvailablePreviousDates(beforeDate, shift, limit = 30) {
  const { data, error } = await supabase
    .from('simplex_production_header')
    .select('entry_date, shift')
    .eq('shift', shift)
    .lt('entry_date', beforeDate)
    .order('entry_date', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

// Copy data from a previous date
export async function copySimplexFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  let previousDate = sourceDate
  if (!previousDate) {
    const targetDateObj = new Date(targetDate)
    const yesterdayDateObj = new Date(targetDateObj)
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1)
    previousDate = yesterdayDateObj.toISOString().split('T')[0]
  }

  // Get source header
  const sourceHeader = await getSimplexProductionByDateShift(previousDate, targetShift)
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`)
  }

  // Get source production details
  const { data: sourceDetails, error: detailsError } = await supabase
    .from('simplex_production_detail')
    .select('*')
    .eq('header_id', sourceHeader.id)

  if (detailsError) throw detailsError
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`)
  }

  // Get source stoppage entries
  const { data: sourceStoppages, error: stoppagesError } = await supabase
    .from('simplex_stoppage_entry')
    .select('*')
    .in('production_detail_id', sourceDetails.map(d => d.id))

  if (stoppagesError) throw stoppagesError

  // Get target's existing production details
  const { data: targetDetails, error: targetError } = await supabase
    .from('simplex_production_detail')
    .select('*, machine:simplex_machines(machine_no)')
    .eq('header_id', targetHeaderId)

  if (targetError) throw targetError

  // Create a map of machine_id to source data
  const sourceDataMap = {}
  sourceDetails.forEach(d => {
    sourceDataMap[d.machine_id] = d
  })

  const sourceStoppageMap = {}
  sourceStoppages?.forEach(s => {
    const detail = sourceDetails.find(d => d.id === s.production_detail_id)
    if (detail) {
      sourceStoppageMap[detail.machine_id] = s
    }
  })

  // Update target details with source data
  const updatePromises = targetDetails.map(async (targetDetail) => {
    const sourceData = sourceDataMap[targetDetail.machine_id]
    if (!sourceData) return null

    const { data, error } = await supabase
      .from('simplex_production_detail')
      .update({
        employee_name: sourceData.employee_name,
        prodn_mixing: sourceData.prodn_mixing,
        run_hrs: sourceData.run_hrs,
        run_min: sourceData.run_min,
        idle_spindles: sourceData.idle_spindles,
        waste: sourceData.waste,
        act_prodn: sourceData.act_prodn,
        waste_percent: sourceData.waste_percent,
        act_effi_percent: sourceData.act_effi_percent,
        uti_percent: sourceData.uti_percent,
        std_hrs: sourceData.std_hrs,
        work_time: sourceData.work_time
      })
      .eq('id', targetDetail.id)
      .select()
      .single()

    if (error) throw error
    return data
  })

  await Promise.all(updatePromises.filter(Boolean))

  // Update target stoppage entries
  const { data: targetStoppages, error: targetStoppagesError } = await supabase
    .from('simplex_stoppage_entry')
    .select('*, production_detail:simplex_production_detail(machine_id)')
    .in('production_detail_id', targetDetails.map(d => d.id))

  if (targetStoppagesError) throw targetStoppagesError

  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetStoppage.production_detail?.machine_id
    const sourceStoppage = sourceStoppageMap[machineId]
    if (!sourceStoppage) return null

    const { data, error } = await supabase
      .from('simplex_stoppage_entry')
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

// ============================================
// MACHINE MANAGEMENT QUERIES
// ============================================

// Add new simplex machine (creates both machine and setup - like Comber)
export async function addSimplexMachine(machineData) {
  // Determine machine_no to use
  let nextMachineNo = machineData.machine_no

  if (!nextMachineNo) {
    // Auto-generate next machine_no if not provided
    const { data: maxMachine, error: maxError } = await supabase
      .from('simplex_machines')
      .select('machine_no')
      .order('machine_no', { ascending: false })
      .limit(1)
      .single()

    // Ignore "no rows" error for empty table
    if (maxError && maxError.code !== 'PGRST116') {
      console.error('Error getting max machine_no:', maxError)
    }

    const currentMaxNo = parseInt(maxMachine?.machine_no || '0')
    nextMachineNo = String(currentMaxNo + 1)
  }

  console.log('Adding new simplex machine:', nextMachineNo, machineData)

  // Check if machine_no already exists
  const { data: existingMachine, error: checkError } = await supabase
    .from('simplex_machines')
    .select('id, machine_no, is_active')
    .eq('machine_no', nextMachineNo)
    .maybeSingle()

  if (checkError) {
    console.error('Error checking existing machine:', checkError)
  }

  // If machine exists and is inactive, reactivate it
  if (existingMachine) {
    if (existingMachine.is_active === false) {
      console.log('Reactivating existing inactive machine:', existingMachine.id)
      
      // Reactivate the machine with updated data
      const { data: reactivatedMachine, error: reactivateError } = await supabase
        .from('simplex_machines')
        .update({
          description: machineData.description || `SIMPLEX${nextMachineNo}`,
          make_name: machineData.make_name || 'LMW',
          prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
          speed: parseInt(machineData.speed) || 1000,
          mc_effi: parseInt(machineData.mc_effi) || 92,
          tpi: parseFloat(machineData.tpi) || 1.73,
          no_of_spindles: parseInt(machineData.spindles) || 140,
          is_active: true
        })
        .eq('id', existingMachine.id)
        .select()
        .single()

      if (reactivateError) {
        console.error('Error reactivating machine:', reactivateError)
        throw new Error(reactivateError.message || 'Failed to reactivate machine')
      }

      // Check if setup exists
      const { data: existingSetup } = await supabase
        .from('simplex_machine_setup')
        .select('id')
        .eq('machine_id', existingMachine.id)
        .maybeSingle()

      if (existingSetup) {
        // Update existing setup
        const { data: updatedSetup, error: updateSetupError } = await supabase
          .from('simplex_machine_setup')
          .update({
            prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
            session_no: machineData.session_no || 1,
            cc_time: machineData.cc_time || 0,
            sl_hank: machineData.sl_hank || 1.4,
            mc_effi: machineData.mc_effi || 92,
            tpi: machineData.tpi || 1.73,
            spindles: machineData.spindles || 140,
            shift_time: machineData.shift_time || 510,
            default_waste: machineData.default_waste || 0.9
          })
          .eq('id', existingSetup.id)
          .select()
          .single()

        if (updateSetupError) {
          console.error('Error updating setup:', updateSetupError)
        }

        // Add production details and stoppage entries for all existing headers
        await addMachineToExistingHeaders(existingMachine.id, machineData)

        return { machine: reactivatedMachine, setup: updatedSetup, reactivated: true }
      } else {
        // Create new setup
        const { data: newSetup, error: setupError } = await supabase
          .from('simplex_machine_setup')
          .insert([{
            machine_id: existingMachine.id,
            prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
            session_no: machineData.session_no || 1,
            cc_time: machineData.cc_time || 0,
            sl_hank: machineData.sl_hank || 1.4,
            mc_effi: machineData.mc_effi || 92,
            tpi: machineData.tpi || 1.73,
            spindles: machineData.spindles || 140,
            shift_time: machineData.shift_time || 510,
            default_waste: machineData.default_waste || 0.9
          }])
          .select()
          .single()

        if (setupError) {
          console.error('Error creating setup:', setupError)
        }

        // Add production details and stoppage entries for all existing headers
        await addMachineToExistingHeaders(existingMachine.id, machineData)

        return { machine: reactivatedMachine, setup: newSetup, reactivated: true }
      }
    } else {
      // Machine exists and is active - throw error
      throw new Error(`Machine ${nextMachineNo} already exists and is active`)
    }
  }

  // Insert new machine into simplex_machines
  // simplex_machines table has: machine_no, description, make_name, prodn_mixing, speed, mc_effi, tpi, no_of_spindles, is_active
  const { data: newMachine, error: machineError } = await supabase
    .from('simplex_machines')
    .insert([{
      machine_no: nextMachineNo,
      description: machineData.description || `SIMPLEX${nextMachineNo}`,
      make_name: machineData.make_name || 'LMW',
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      speed: parseInt(machineData.speed) || 1000,
      mc_effi: parseInt(machineData.mc_effi) || 92,
      tpi: parseFloat(machineData.tpi) || 1.73,
      no_of_spindles: parseInt(machineData.spindles) || 140,
      is_active: true
    }])
    .select()
    .single()

  if (machineError) {
    console.error('Error inserting simplex_machines:', machineError)
    throw new Error(machineError.message || 'Failed to create machine')
  }

  console.log('Machine created:', newMachine)

  // Create machine setup for the new machine (all parameters stored here)
  const { data: newSetup, error: setupError } = await supabase
    .from('simplex_machine_setup')
    .insert([{
      machine_id: newMachine.id,
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      session_no: machineData.session_no || 1,
      cc_time: machineData.cc_time || 0,
      sl_hank: machineData.sl_hank || 1.4,
      mc_effi: machineData.mc_effi || 92,
      tpi: machineData.tpi || 1.73,
      spindles: machineData.spindles || 140,
      shift_time: machineData.shift_time || 510,
      default_waste: machineData.default_waste || 0.9
    }])
    .select()
    .single()

  if (setupError) {
    console.error('Error inserting simplex_machine_setup:', setupError)
    throw new Error(setupError.message || 'Failed to create machine setup')
  }

  console.log('Setup created:', newSetup)

  // Add production details and stoppage entries for all existing headers
  await addMachineToExistingHeaders(newMachine.id, machineData)

  return { machine: newMachine, setup: newSetup }
}

// Add existing simplex machine to setup (legacy function)
export async function addSimplexMachineToSetup(machineId, setupData) {
  const { data, error } = await supabase
    .from('simplex_machine_setup')
    .insert([{
      machine_id: machineId,
      prodn_mixing: setupData.prodn_mixing || '64COMBED GOLD',
      session_no: setupData.session_no || 1,
      cc_time: setupData.cc_time || 0,
      sl_hank: setupData.sl_hank || 1.4,
      mc_effi: setupData.mc_effi || 92,
      tpi: setupData.tpi || 1.73,
      spindles: setupData.spindles || 140,
      shift_time: 510,
      default_waste: setupData.default_waste || 0.9
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Remove machine from setup (deletes setup entry)
export async function removeSimplexMachineFromSetup(machineId) {
  const { data, error } = await supabase
    .from('simplex_machine_setup')
    .delete()
    .eq('machine_id', machineId)

  if (error) throw error
  return data
}

// Remove (deactivate) simplex machine - soft delete like Comber
export async function removeSimplexMachine(machineId) {
  // Soft delete - set is_active to false
  const { data, error } = await supabase
    .from('simplex_machines')
    .update({ is_active: false })
    .eq('id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Add production detail and stoppage entry for a new machine to existing headers
export async function addMachineToExistingHeaders(machineId, machineData = {}) {
  // Get all existing production headers
  const { data: headers, error: headerError } = await supabase
    .from('simplex_production_header')
    .select('id')

  if (headerError) {
    console.error('Error fetching headers:', headerError)
    return
  }

  if (!headers || headers.length === 0) return

  // For each header, create production detail and stoppage entry if not exists
  for (const header of headers) {
    // Check if production detail already exists for this machine and header
    const { data: existingDetail } = await supabase
      .from('simplex_production_detail')
      .select('id')
      .eq('header_id', header.id)
      .eq('machine_id', machineId)
      .maybeSingle()

    if (!existingDetail) {
      // Create production detail
      const { data: newDetail, error: detailError } = await supabase
        .from('simplex_production_detail')
        .insert([{
          header_id: header.id,
          machine_id: machineId,
          prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
          run_hrs: 0,
          run_min: 0,
          idle_spindles: 0,
          waste: machineData.default_waste || 0.9,
          act_prodn: 0,
          waste_percent: 0,
          act_effi_percent: 0,
          uti_percent: 0,
          std_hrs: 0,
          work_time: 510,
          session_no: 1
        }])
        .select()
        .single()

      if (detailError) {
        console.error('Error creating production detail:', detailError)
        continue
      }

      // Create stoppage entry for the new production detail
      await supabase
        .from('simplex_stoppage_entry')
        .insert([{
          production_detail_id: newDetail.id,
          stoppage1_time: 0,
          stoppage2_time: 0,
          stoppage3_time: 0,
          stoppage4_time: 0,
          total_stoppage_time: 0
        }])
    }
  }
}

// Remove production details and stoppage entries for a machine from all headers
export async function removeMachineFromAllHeaders(machineId) {
  // Get all production details for this machine
  const { data: details, error: detailError } = await supabase
    .from('simplex_production_detail')
    .select('id')
    .eq('machine_id', machineId)

  if (detailError) {
    console.error('Error fetching production details:', detailError)
    return
  }

  if (!details || details.length === 0) return

  const detailIds = details.map(d => d.id)

  // Delete stoppage entries first (due to foreign key)
  await supabase
    .from('simplex_stoppage_entry')
    .delete()
    .in('production_detail_id', detailIds)

  // Delete production details
  await supabase
    .from('simplex_production_detail')
    .delete()
    .in('id', detailIds)
}
// Bulk update machine count/mixing
export async function bulkUpdateSimplexMachineCount(machineIds, newCount) {
  const promises = machineIds.map(id =>
    supabase
      .from('simplex_machine_setup')
      .update({ prodn_mixing: newCount })
      .eq('machine_id', id)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data)
}

// Get count options
export async function getSimplexCountOptions() {
  const { data, error } = await supabase
    .from('simplex_machine_setup')
    .select('prodn_mixing')
    .neq('prodn_mixing', null)

  if (error) throw error
  
  // Get unique values
  const uniqueCounts = [...new Set(data?.map(d => d.prodn_mixing) || [])]
  return uniqueCounts.sort()
}
