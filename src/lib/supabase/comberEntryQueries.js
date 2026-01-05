import { supabase } from '../supabase'

// ============================================
// COMBER CONSTANTS
// ============================================

// Stoppage reasons for Comber machines
export const COMBER_STOPPAGE_REASONS = [
  'Power Cut',
  'Breakdown',
  'No Material',
  'Quality Issue',
  'Cleaning',
  'Doffing',
  'Can Change',
  'Lap Change',
  'Piecing',
  'Maintenance',
  'Tea Break',
  'Lunch Break',
  'Meeting',
  'Other'
]

// ============================================
// COMBER PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers with supervisor info
export async function getComberProductionHeaders() {
  const { data, error } = await supabase
    .from('comber_production_header')
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
export async function getComberProductionByDateShift(date, shift) {
  const { data, error } = await supabase
    .from('comber_production_header')
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
export async function getOrCreateComberProductionHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getComberProductionByDateShift(date, shift)
  if (existing) return existing

  // Create new header
  const { data, error } = await supabase
    .from('comber_production_header')
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
export async function updateComberProductionHeader(id, updates) {
  const { data, error } = await supabase
    .from('comber_production_header')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// COMBER PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getComberProductionDetails(headerId) {
  const { data, error } = await supabase
    .from('comber_production_detail')
    .select(`
      *,
      machine:comber_machines(id, machine_no, description, mc_id)
    `)
    .eq('header_id', headerId)
    .order('machine_id')

  if (error) throw error
  return data
}

// Get production details with machine setup for a header (for display)
export async function getComberProductionWithSetup(headerId) {
  const { data, error } = await supabase
    .from('comber_production_detail')
    .select(`
      *,
      machine:comber_machines!inner(id, machine_no, description, mc_id, is_active),
      stoppage:comber_stoppage_entry(*)
    `)
    .eq('header_id', headerId)
    .eq('machine.is_active', true)

  if (error) throw error
  
  // Sort by natural machine number order (CO1, CO2, ... CO10, CO11)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
    const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
    return aNum - bNum
  }) || []
}

// Initialize production details for all comber machines
export async function initializeComberProductionDetails(headerId) {
  // Get all active comber machines
  const { data: machines, error: machineError } = await supabase
    .from('comber_machines')
    .select('id, machine_no')
    .eq('is_active', true)
    .order('mc_id')

  if (machineError) throw machineError

  // Get machine setup for default values
  const { data: setups, error: setupError } = await supabase
    .from('comber_machine_setup')
    .select('*')

  if (setupError) throw setupError

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
      prodn_mixing: setup.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      run_hrs: 0,
      run_min: 0,
      waste: setup.default_waste || 0.96,
      act_prodn: 0,
      waste_percent: 0,
      act_effi_percent: 0,
      uti_percent: 0,
      std_hrs: 0,
      work_time: setup.shift_time || 510,
      session_no: setup.session_no || 1
    }
  })

  const { data, error } = await supabase
    .from('comber_production_detail')
    .insert(details)
    .select()

  if (error) throw error

  // Initialize stoppage entries for each detail (default NIPPER+COTS = 30 mins)
  const stoppageEntries = data.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_time: 15,  // NIPPER CLEANING
    stoppage2_time: 15,  // COTS CLEANING
    total_stoppage_time: 30
  }))

  await supabase
    .from('comber_stoppage_entry')
    .insert(stoppageEntries)

  return data
}

// Update production detail
export async function updateComberProductionDetail(id, updates) {
  const { data, error } = await supabase
    .from('comber_production_detail')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk update production details
export async function bulkUpdateComberProductionDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    supabase
      .from('comber_production_detail')
      .update(data)
      .eq('id', id)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data)
}

// ============================================
// COMBER STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getComberStoppageEntries(headerId) {
  const { data, error } = await supabase
    .from('comber_stoppage_entry')
    .select(`
      *,
      production_detail:comber_production_detail(
        id,
        machine_id,
        act_effi_percent,
        session_no,
        machine:comber_machines!inner(id, machine_no, is_active)
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
    .from('comber_production_detail')
    .select('id, machine:comber_machines!inner(is_active)')
    .eq('header_id', headerId)
    .eq('machine.is_active', true)

  const detailIds = details?.map(d => d.id) || []
  return data?.filter(s => detailIds.includes(s.production_detail_id)) || []
}

// Update stoppage entry
export async function updateComberStoppageEntry(id, updates) {
  // First, fetch the existing record to get current stoppage values
  const { data: existing, error: fetchError } = await supabase
    .from('comber_stoppage_entry')
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
    .from('comber_stoppage_entry')
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
export async function applyComberFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  // Get all stoppage entries for this header
  const stoppages = await getComberStoppageEntries(headerId)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const updates = stoppages.map(s => ({
    id: s.id,
    [stoppageIdField]: stoppageId,
    [stoppageTimeField]: stoppageTime,
    is_full_stoppage: slot === 1
  }))

  const promises = updates.map(({ id, ...data }) =>
    updateComberStoppageEntry(id, data)
  )

  return Promise.all(promises)
}

// Apply partial stoppage to machine range
export async function applyComberPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime, slot = 1) {
  // Get all production details with machine info
  const { data: details } = await supabase
    .from('comber_production_detail')
    .select(`
      id,
      machine:comber_machines(machine_no, mc_id)
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
    .from('comber_stoppage_entry')
    .select('*')
    .in('production_detail_id', detailIds)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const promises = stoppages.map(s =>
    updateComberStoppageEntry(s.id, {
      [stoppageIdField]: stoppageId,
      [stoppageTimeField]: stoppageTime
    })
  )

  return Promise.all(promises)
}

// ============================================
// COMBER MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info
export async function getComberMachineSetups() {
  const { data, error } = await supabase
    .from('comber_machine_setup')
    .select(`
      *,
      machine:comber_machines!inner(id, machine_no, description, mc_id, make_name, speed, mc_effi, is_active)
    `)
    .eq('machine.is_active', true)
    .order('machine_id')

  if (error) throw error
  return data
}

// Update machine setup
export async function updateComberMachineSetup(machineId, updates) {
  // Recalculate constant if sl_hank changes
  if (updates.sl_hank) {
    updates.constant = 1 / 2.20456 / updates.sl_hank
  }

  const { data, error } = await supabase
    .from('comber_machine_setup')
    .update(updates)
    .eq('machine_id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Create new machine setup
export async function createComberMachineSetup(setupData) {
  // Calculate constant from sl_hank
  if (setupData.sl_hank) {
    setupData.constant = 1 / 2.20456 / setupData.sl_hank
  }

  const { data, error } = await supabase
    .from('comber_machine_setup')
    .insert([setupData])
    .select()
    .single()

  if (error) throw error
  return data
}

// Add new comber machine (creates both machine and setup)
export async function addComberMachine(machineData) {
  // Check if machine_no already exists (might be inactive)
  if (machineData.machine_no) {
    const { data: existingMachine } = await supabase
      .from('comber_machines')
      .select('id, is_active, machine_no')
      .eq('machine_no', machineData.machine_no)
      .single()

    if (existingMachine && !existingMachine.is_active) {
      // Reactivate the existing machine
      const { data: reactivated, error: reactivateError } = await supabase
        .from('comber_machines')
        .update({ 
          is_active: true,
          description: machineData.description || existingMachine.machine_no,
          make_name: machineData.make_name || 'LMW',
          prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
          speed: machineData.speed || 350,
          mc_effi: machineData.mc_effi || 93
        })
        .eq('id', existingMachine.id)
        .select()
        .single()

      if (reactivateError) throw new Error(`Failed to reactivate machine: ${reactivateError.message}`)
      
      // Update the existing setup
      const slHank = machineData.sl_hank || 0.14
      await supabase
        .from('comber_machine_setup')
        .update({
          prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
          session_no: machineData.session_no || machineData.session || 1,
          cc_time: machineData.cc_time || 0,
          sl_hank: slHank,
          mc_effi: machineData.mc_effi || 93,
          constant: 1 / 2.20456 / slHank
        })
        .eq('machine_id', existingMachine.id)
      
      return { machine: reactivated, setup: null, reactivated: true }
    }

    if (existingMachine && existingMachine.is_active) {
      throw new Error(`Machine ${machineData.machine_no} already exists and is active`)
    }
  }

  // Get the max mc_id to generate next one
  const { data: maxMachine } = await supabase
    .from('comber_machines')
    .select('mc_id, machine_no')
    .order('mc_id', { ascending: false })
    .limit(1)
    .single()

  const nextMcId = (maxMachine?.mc_id || 0) + 1
  const nextMachineNo = machineData.machine_no || `CO${nextMcId}`

  // Insert new machine
  const { data: newMachine, error: machineError } = await supabase
    .from('comber_machines')
    .insert([{
      machine_no: nextMachineNo,
      mc_id: nextMcId,
      description: machineData.description || `COMBER ${nextMcId}`,
      make_name: machineData.make_name || 'LMW',
      prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
      speed: machineData.speed || 350,
      mc_effi: machineData.mc_effi || 93,
      is_active: true
    }])
    .select()
    .single()

  if (machineError) throw new Error(`Failed to add machine: ${machineError.message}`)

  // Create machine setup for the new machine
  const slHank = machineData.sl_hank || 0.14
  const { data: newSetup, error: setupError } = await supabase
    .from('comber_machine_setup')
    .insert([{
      machine_id: newMachine.id,
      prodn_mixing: machineData.prodn_mixing || machineData.prodn_count || '64COMBED GOLD',
      session_no: machineData.session_no || machineData.session || 1,
      cc_time: machineData.cc_time || 0,
      sl_hank: slHank,
      mc_effi: machineData.mc_effi || 93,
      shift_time: machineData.shift_time || 510,
      default_waste: machineData.default_waste || 0.96,
      constant: 1 / 2.20456 / slHank
    }])
    .select()
    .single()

  if (setupError) throw new Error(`Failed to create machine setup: ${setupError.message}`)

  return { machine: newMachine, setup: newSetup, reactivated: false }
}

// Remove (deactivate) comber machine
export async function removeComberMachine(machineId) {
  // Soft delete - set is_active to false
  const { data, error } = await supabase
    .from('comber_machines')
    .update({ is_active: false })
    .eq('id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete machine setup
export async function deleteComberMachineSetup(machineId) {
  const { error } = await supabase
    .from('comber_machine_setup')
    .delete()
    .eq('machine_id', machineId)

  if (error) throw error
  return true
}

// Get all comber machines
export async function getComberMachines() {
  const { data, error } = await supabase
    .from('comber_machines')
    .select('*')
    .order('mc_id')

  if (error) throw error
  return data
}

// Get count options for comber
export async function getComberCountOptions() {
  // Return standard comber count options
  return [
    '64COMBED GOLD',
    '40COMBED GOLD',
    '80COMBED',
    '60COMBED',
    '30COMBED',
    '80S COMPACT',
    '60S COMPACT',
    '40S COMPACT'
  ]
}

// Bulk update machine count
export async function bulkUpdateComberMachineCount(machineIds, newCount) {
  const promises = machineIds.map(machineId => 
    supabase
      .from('comber_machine_setup')
      .update({ prodn_mixing: newCount })
      .eq('machine_id', machineId)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    throw new Error(`Failed to update ${errors.length} machines`)
  }
  return true
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get comber stoppage reasons
export async function getComberStoppageReasons() {
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
// CALCULATION HELPERS
// ============================================

// Convert RunHrs (HH.MM format) to RunMin
// Example: 5.58 -> (5 * 60) + 58 = 358
export function calculateRunMin(runHrs) {
  if (!runHrs || runHrs <= 0) return 0
  const hours = Math.floor(runHrs)
  const minutes = Math.round((runHrs - hours) * 100)
  return (hours * 60) + minutes
}

// Calculate all production values based on formula
// COMBER FORMULAS:
// - RunMin = Hours×60 + (Decimal×100)
// - WorkTime = TotalTime - TotalStoppage
// - Std.hrs = WorkTime × (MCEffi/100)
// - Act.Prodn = Act.Hank × Constant
// - Waste% = (Waste / Act.Prodn) × 100
// - Act.Effi% = (RunMin / Std.hrs) × 100
// - Uti% = (WorkTime / TotalTime) × 100
export function calculateComberProductionValues(actHank, runHrs, waste, totalTime, stoppageTime, setup) {
  const mcEffi = setup?.mc_effi || 93
  const constant = setup?.constant || 3.240  // 1 / 2.20456 / 0.14
  const defaultWaste = setup?.default_waste || 0.96

  // Run Min = Hours×60 + (Decimal×100)
  const runMin = calculateRunMin(runHrs)

  // Work Time = Total Time - Stoppage Time
  const workTime = totalTime - stoppageTime

  // Std.hrs = WorkTime × (MCEffi/100)
  const stdHrs = workTime * (mcEffi / 100)

  // Act.Prodn = Act.Hank × Constant
  const actProdn = actHank * constant

  // Waste% = (Waste / Act.Prodn) × 100
  const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

  // Act.Effi% = (RunMin / Std.hrs) × 100
  const actEffiPercent = stdHrs > 0 ? (runMin / stdHrs) * 100 : 0

  // UTI% = (WorkTime / TotalTime) × 100
  const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0

  return {
    run_min: runMin,
    work_time: workTime,
    std_hrs: Math.round(stdHrs * 10) / 10,
    act_prodn: Math.round(actProdn * 100) / 100,
    waste: waste || defaultWaste,
    waste_percent: Math.round(wastePercent * 100) / 100,
    act_effi_percent: Math.round(actEffiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100
  }
}

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getComberAvailablePreviousDates(beforeDate, shift, limit = 30) {
  const { data, error } = await supabase
    .from('comber_production_header')
    .select('entry_date, shift')
    .eq('shift', shift)
    .lt('entry_date', beforeDate)
    .order('entry_date', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

// Copy data from a previous date
export async function copyComberFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  let previousDate = sourceDate
  if (!previousDate) {
    const targetDateObj = new Date(targetDate)
    const yesterdayDateObj = new Date(targetDateObj)
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1)
    previousDate = yesterdayDateObj.toISOString().split('T')[0]
  }

  // Get source header
  const sourceHeader = await getComberProductionByDateShift(previousDate, targetShift)
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`)
  }

  // Get source production details
  const { data: sourceDetails, error: detailsError } = await supabase
    .from('comber_production_detail')
    .select('*')
    .eq('header_id', sourceHeader.id)

  if (detailsError) throw detailsError
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`)
  }

  // Get source stoppage entries
  const { data: sourceStoppages, error: stoppagesError } = await supabase
    .from('comber_stoppage_entry')
    .select('*')
    .in('production_detail_id', sourceDetails.map(d => d.id))

  if (stoppagesError) throw stoppagesError

  // Get target's existing production details
  const { data: targetDetails, error: targetError } = await supabase
    .from('comber_production_detail')
    .select('*, machine:comber_machines(machine_no)')
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
      .from('comber_production_detail')
      .update({
        employee_name: sourceData.employee_name,
        prodn_mixing: sourceData.prodn_mixing,
        act_hank: sourceData.act_hank,
        run_hrs: sourceData.run_hrs,
        run_min: sourceData.run_min,
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
    .from('comber_stoppage_entry')
    .select('*, production_detail:comber_production_detail(machine_id)')
    .in('production_detail_id', targetDetails.map(d => d.id))
  if (targetStoppagesError) throw targetStoppagesError
  
  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetStoppage.production_detail?.machine_id
    const sourceStoppage = sourceStoppageMap[machineId]
    if (!sourceStoppage) return null
    const { data, error } = await supabase
      .from('comber_stoppage_entry')
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
export async function copyComberFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copyComberFromPreviousDate(targetDate, targetShift, targetHeaderId, null)
}
