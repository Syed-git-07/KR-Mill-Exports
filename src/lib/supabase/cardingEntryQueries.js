import { supabase } from '../supabase'

// ============================================
// CARDING PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers with supervisor info
export async function getCardingProductionHeaders() {
  const { data, error } = await supabase
    .from('carding_production_header')
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
export async function getCardingProductionByDateShift(date, shift) {
  const { data, error } = await supabase
    .from('carding_production_header')
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
export async function getOrCreateProductionHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getCardingProductionByDateShift(date, shift)
  if (existing) return existing

  // Create new header
  const { data, error } = await supabase
    .from('carding_production_header')
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
export async function updateProductionHeader(id, updates) {
  const { data, error } = await supabase
    .from('carding_production_header')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// CARDING PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getCardingProductionDetails(headerId) {
  const { data, error } = await supabase
    .from('carding_production_detail')
    .select(`
      *,
      machine:carding_machines(id, machine_no, description, prodn_mixing)
    `)
    .eq('header_id', headerId)
    .order('machine_id')

  if (error) throw error
  return data
}

// Get production details with machine setup for a header (for display)
export async function getCardingProductionWithSetup(headerId) {
  const { data, error } = await supabase
    .from('carding_production_detail')
    .select(`
      *,
      machine:carding_machines!inner(id, machine_no, description, prodn_mixing, mc_id, is_active),
      stoppage:carding_stoppage_entry(id, total_stoppage_time, stoppage1_time, stoppage2_time, stoppage3_time, stoppage4_time)
    `)
    .eq('header_id', headerId)
    .eq('machine.is_active', true)  // Only show active machines

  if (error) throw error
  
  // Sort by natural machine number order (CA1, CA2, ... CA10, CA11)
  return data?.sort((a, b) => {
    const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
    const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
    return aNum - bNum
  }) || []
}

// Initialize production details for all carding machines
export async function initializeProductionDetails(headerId) {
  // Get all active carding machines
  const { data: machines, error: machineError } = await supabase
    .from('carding_machines')
    .select('id, machine_no, prodn_mixing')
    .eq('is_active', true)
    .order('mc_id')

  if (machineError) throw machineError

  // Get machine setup for default values
  const { data: setups, error: setupError } = await supabase
    .from('carding_machine_setup')
    .select('*')

  if (setupError) throw setupError

  // Create a map of machine_id to setup
  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })

  // Create detail records for each machine
  // According to formula: RunTime = 510 (default), WorkTime = 510 - StoppageTime
  const defaultStoppage = 135 // Default stoppage time
  const totalTime = 510
  const defaultWorkTime = totalTime - defaultStoppage // 510 - 135 = 375
  const defaultUti = Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100 // 73.53%
  
  const details = machines.map(machine => {
    const setup = setupMap[machine.id] || {}
    return {
      header_id: headerId,
      machine_id: machine.id,
      count_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: setup.std_prodn || 295.22,
      exp_prodn: 0,
      effi_percent: 0,
      uti_percent: defaultUti,
      waste: setup.default_waste || 0.34,
      waste_percent: 0,
      run_time: totalTime, // Default 510 mins
      work_time: defaultWorkTime, // 510 - stoppage (375 by default)
      total_stoppage_mins: defaultStoppage, // Store total stoppage mins
      session_no: 1
    }
  })

  const { data, error } = await supabase
    .from('carding_production_detail')
    .insert(details)
    .select()

  if (error) throw error

  // Initialize stoppage entries for each detail
  const stoppageEntries = data.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_time: 135,  // Default stoppage
    total_stoppage_time: 135
  }))

  await supabase
    .from('carding_stoppage_entry')
    .insert(stoppageEntries)

  return data
}

// Sync newly added machines to an existing production header
// This function adds production details for machines that don't have entries yet
export async function syncNewMachinesToHeader(headerId) {
  // Get all active carding machines
  const { data: machines, error: machineError } = await supabase
    .from('carding_machines')
    .select('id, machine_no, prodn_mixing')
    .eq('is_active', true)
    .order('mc_id')

  if (machineError) throw machineError

  // Get existing production details for this header
  const { data: existingDetails, error: detailError } = await supabase
    .from('carding_production_detail')
    .select('machine_id')
    .eq('header_id', headerId)

  if (detailError) throw detailError

  const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

  // Find machines that don't have entries
  const newMachines = machines?.filter(m => !existingMachineIds.includes(m.id)) || []

  if (newMachines.length === 0) {
    return { added: 0, machines: [] }
  }

  // Get machine setup for default values
  const { data: setups, error: setupError } = await supabase
    .from('carding_machine_setup')
    .select('*')

  if (setupError) throw setupError

  const setupMap = {}
  setups?.forEach(s => {
    setupMap[s.machine_id] = s
  })

  // Default values
  const defaultStoppage = 135
  const totalTime = 510
  const defaultWorkTime = totalTime - defaultStoppage
  const defaultUti = Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100

  // Create detail records for new machines
  const details = newMachines.map(machine => {
    const setup = setupMap[machine.id] || {}
    return {
      header_id: headerId,
      machine_id: machine.id,
      count_mixing: machine.prodn_mixing || '64COMBED GOLD',
      act_hank: 0,
      act_prodn: 0,
      std_prodn: setup.std_prodn || 295.22,
      exp_prodn: 0,
      effi_percent: 0,
      uti_percent: defaultUti,
      waste: setup.default_waste || 0.34,
      waste_percent: 0,
      run_time: totalTime,
      work_time: defaultWorkTime,
      total_stoppage_mins: defaultStoppage,
      session_no: 1
    }
  })

  const { data, error } = await supabase
    .from('carding_production_detail')
    .insert(details)
    .select()

  if (error) throw error

  // Initialize stoppage entries for each new detail
  const stoppageEntries = data.map(detail => ({
    production_detail_id: detail.id,
    stoppage1_time: 135,
    total_stoppage_time: 135
  }))

  await supabase
    .from('carding_stoppage_entry')
    .insert(stoppageEntries)

  return { added: data.length, machines: newMachines.map(m => m.machine_no) }
}

// Update production detail
export async function updateProductionDetail(id, updates) {
  const { data, error } = await supabase
    .from('carding_production_detail')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk update production details
export async function bulkUpdateProductionDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    supabase
      .from('carding_production_detail')
      .update(data)
      .eq('id', id)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data)
}

// ============================================
// CARDING STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header (only active machines)
export async function getCardingStoppageEntries(headerId) {
  // First get all production details for this header with active machines
  const { data: details, error: detailError } = await supabase
    .from('carding_production_detail')
    .select(`
      id,
      machine:carding_machines!inner(id, machine_no, is_active)
    `)
    .eq('header_id', headerId)
    .eq('machine.is_active', true)

  if (detailError) throw detailError

  const detailIds = details?.map(d => d.id) || []
  
  if (detailIds.length === 0) return []

  // Get stoppage entries for active machines only
  const { data, error } = await supabase
    .from('carding_stoppage_entry')
    .select(`
      *,
      production_detail:carding_production_detail(
        id,
        machine_id,
        effi_percent,
        session_no,
        machine:carding_machines(id, machine_no, is_active)
      ),
      stoppage1:stoppage_details!stoppage1_id(id, stoppage_name, short_code),
      stoppage2:stoppage_details!stoppage2_id(id, stoppage_name, short_code),
      stoppage3:stoppage_details!stoppage3_id(id, stoppage_name, short_code),
      stoppage4:stoppage_details!stoppage4_id(id, stoppage_name, short_code)
    `)
    .in('production_detail_id', detailIds)
    .order('production_detail_id')

  if (error) throw error
  
  // Sort by natural machine number order
  return data?.sort((a, b) => {
    const aNum = parseInt(a.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
    const bNum = parseInt(b.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
    return aNum - bNum
  }) || []
}

// Update stoppage entry
export async function updateStoppageEntry(id, updates) {
  // First, fetch the existing record to get current stoppage values
  const { data: existing, error: fetchError } = await supabase
    .from('carding_stoppage_entry')
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
    .from('carding_stoppage_entry')
    .update({
      ...updates,
      ...mergedStoppages,
      total_stoppage_time: total
    })
    .eq('id', id)
    .select('*, production_detail_id')
    .single()

  if (error) throw error

  // Also update the total_stoppage_mins and work_time in carding_production_detail
  const totalTime = 510
  const workTime = totalTime - total
  const utiPercent = Math.round((workTime / totalTime) * 100 * 100) / 100

  await supabase
    .from('carding_production_detail')
    .update({
      total_stoppage_mins: total,
      work_time: workTime,
      uti_percent: utiPercent
    })
    .eq('id', data.production_detail_id)

  return data
}

// Apply full stoppage to all machines
export async function applyFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  // Get all stoppage entries for this header
  const stoppages = await getCardingStoppageEntries(headerId)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const updates = stoppages.map(s => ({
    id: s.id,
    [stoppageIdField]: stoppageId,
    [stoppageTimeField]: stoppageTime,
    is_full_stoppage: slot === 1
  }))

  const promises = updates.map(({ id, ...data }) =>
    updateStoppageEntry(id, data)
  )

  return Promise.all(promises)
}

// Apply partial stoppage to machine range
export async function applyPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime, slot = 1) {
  // Get all production details with machine info
  const { data: details } = await supabase
    .from('carding_production_detail')
    .select(`
      id,
      machine:carding_machines(machine_no, mc_id)
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
    .from('carding_stoppage_entry')
    .select('*')
    .in('production_detail_id', detailIds)

  const stoppageIdField = `stoppage${slot}_id`
  const stoppageTimeField = `stoppage${slot}_time`

  const promises = stoppages.map(s =>
    updateStoppageEntry(s.id, {
      [stoppageIdField]: stoppageId,
      [stoppageTimeField]: stoppageTime
    })
  )

  return Promise.all(promises)
}

// ============================================
// CARDING MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info (only active machines)
export async function getCardingMachineSetups() {
  const { data, error } = await supabase
    .from('carding_machine_setup')
    .select(`
      *,
      machine:carding_machines!inner(id, machine_no, description, make_name, prodn_mixing, is_active)
    `)
    .eq('machine.is_active', true)
    .order('machine_id')

  if (error) throw error
  return data
}

// Update machine setup
export async function updateMachineSetup(id, updates) {
  // Recalculate std_prodn if speed or other params change
  if (updates.speed || updates.hank_constant || updates.std_efficiency_factor || updates.shift_time) {
    const speed = updates.speed || 130
    const hankConstant = updates.hank_constant || 0.13
    const stdEffi = updates.std_efficiency_factor || 0.98
    const shiftTime = updates.shift_time || 510
    const divisor = updates.divisor_constant || 1693

    updates.std_prodn = (speed / divisor / hankConstant) * shiftTime * stdEffi
  }

  const { data, error } = await supabase
    .from('carding_machine_setup')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get carding stoppage reasons
export async function getCardingStoppageReasons() {
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

// Calculate production values based on formula from carding-formula.md
// STEP-1: WorkTime = TotalTime(510) - StoppageTime
// STEP-2: Std Prodn = (Speed / 1693 / Hank) × TotalTime × StdEffi
// STEP-3: Exp Prodn = Std Prodn × WorkTime / TotalTime
// STEP-4: Effi% = ActProdn / ExpProdn × 100
// STEP-5: UTI% = WorkTime / TotalTime × 100
export function calculateProductionValues(actHank, actProdn, totalTime, stoppageTime, setup) {
  const speed = setup?.speed || 130
  const hankConstant = setup?.hank_constant || 0.13
  const stdEffiFactor = setup?.std_efficiency_factor || 0.98
  const divisor = setup?.divisor_constant || 1693
  const waste = setup?.default_waste || 0.34

  // WorkTime = TotalTime - StoppageTime (this is the actual run time)
  const workTime = totalTime - stoppageTime
  
  // RunTime defaults to TotalTime (510), represents available shift time
  const runTime = totalTime

  // Std Prodn = (Speed / 1693 / Hank) × TotalTime × StdEffi
  const stdProdn = (speed / divisor / hankConstant) * totalTime * stdEffiFactor

  // Exp Prodn = Std Prodn × WorkTime / TotalTime (time-adjusted target)
  const expProdn = stdProdn * workTime / totalTime

  // Effi% = ActProdn / ExpProdn × 100 (Performance %)
  const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0

  // UTI% = WorkTime / TotalTime × 100 (Utilization based on actual working time)
  const utiPercent = (workTime / totalTime) * 100

  // Waste% = Waste / ActProdn × 100
  const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

  return {
    std_prodn: Math.round(stdProdn * 100) / 100,
    exp_prodn: Math.round(expProdn * 100) / 100,
    effi_percent: Math.round(effiPercent * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    waste,
    waste_percent: Math.round(wastePercent * 100) / 100,
    run_time: runTime, // TotalTime (510)
    work_time: workTime, // TotalTime - StoppageTime
    total_stoppage_mins: stoppageTime // Store total stoppage for reference
  }
}

// Get all carding machines
export async function getCardingMachines() {
  const { data, error } = await supabase
    .from('carding_machines')
    .select('*')
    .eq('is_active', true)
    .order('mc_id')

  if (error) throw error
  return data
}

// ============================================
// MACHINE MANAGEMENT QUERIES
// ============================================

// Add new carding machine
export async function addCardingMachine(machineData) {
  // Check if machine_no already exists (might be inactive)
  if (machineData.machine_no) {
    const { data: existingMachine } = await supabase
      .from('carding_machines')
      .select('id, is_active')
      .eq('machine_no', machineData.machine_no)
      .single()
    
    if (existingMachine) {
      if (!existingMachine.is_active) {
        // Reactivate the existing machine
        const { data: reactivated, error: reactivateError } = await supabase
          .from('carding_machines')
          .update({
            is_active: true,
            description: machineData.description || machineData.machine_no,
            make_name: machineData.make_name || 'LMW',
            prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD'
          })
          .eq('id', existingMachine.id)
          .select()
          .single()
        
        if (reactivateError) throw new Error(`Failed to reactivate machine: ${reactivateError.message}`)
        return { machine: reactivated, setup: null, reactivated: true }
      } else {
        throw new Error(`Machine ${machineData.machine_no} already exists and is active`)
      }
    }
  }

  // Get the max mc_id to generate next one (include inactive machines)
  const { data: maxMachine } = await supabase
    .from('carding_machines')
    .select('mc_id, machine_no')
    .order('mc_id', { ascending: false })
    .limit(1)
    .single()

  const nextMcId = (maxMachine?.mc_id || 0) + 1
  const nextMachineNo = machineData.machine_no || `CA${nextMcId}`

  // Insert new machine
  const { data: newMachine, error: machineError } = await supabase
    .from('carding_machines')
    .insert([{
      machine_no: nextMachineNo,
      mc_id: nextMcId,
      description: machineData.description || `Carding Machine ${nextMcId}`,
      make_name: machineData.make_name || 'LMW',
      prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
      is_active: true
    }])
    .select()
    .single()

  if (machineError) throw new Error(`Failed to add machine: ${machineError.message}`)

  // Create machine setup for the new machine
  const { data: newSetup, error: setupError } = await supabase
    .from('carding_machine_setup')
    .insert([{
      machine_id: newMachine.id,
      speed: machineData.speed || 130,
      hank_constant: machineData.hank_constant || 0.13,
      std_efficiency_factor: machineData.std_efficiency_factor || 0.98,
      shift_time: machineData.shift_time || 510,
      divisor_constant: 1693,
      default_waste: 0.34,
      default_stoppage: 135,
      std_prodn: ((machineData.speed || 130) / 1693 / (machineData.hank_constant || 0.13)) * (machineData.shift_time || 510) * (machineData.std_efficiency_factor || 0.98)
    }])
    .select()
    .single()

  if (setupError) throw new Error(`Failed to create machine setup: ${setupError.message}`)

  return { machine: newMachine, setup: newSetup }
}

// Remove (deactivate) carding machine
export async function removeCardingMachine(machineId) {
  // Soft delete - set is_active to false
  const { data, error } = await supabase
    .from('carding_machines')
    .update({ is_active: false })
    .eq('id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update machine count/mixing
export async function updateMachineCount(machineId, newCount) {
  const { data, error } = await supabase
    .from('carding_machines')
    .update({ prodn_mixing: newCount })
    .eq('id', machineId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk update machine counts
export async function bulkUpdateMachineCount(machineIds, newCount) {
  const promises = machineIds.map(id => 
    supabase
      .from('carding_machines')
      .update({ prodn_mixing: newCount })
      .eq('id', id)
  )

  const results = await Promise.all(promises)
  const errors = results.filter(r => r.error)
  if (errors.length > 0) throw errors[0].error

  return results.map(r => r.data)
}

// Get all count options (distinct prodn_mixing values)
export async function getCountOptions() {
  const { data, error } = await supabase
    .from('carding_machines')
    .select('prodn_mixing')
    .neq('prodn_mixing', null)

  if (error) throw error
  
  // Get unique values
  const uniqueCounts = [...new Set(data?.map(d => d.prodn_mixing) || [])]
  return uniqueCounts.sort()
}

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getCardingAvailablePreviousDates(beforeDate, shift, limit = 30) {
  const { data, error } = await supabase
    .from('carding_production_header')
    .select('entry_date, shift')
    .eq('shift', shift)
    .lt('entry_date', beforeDate)
    .order('entry_date', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

// Copy data from a previous date
export async function copyCardingFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  let previousDate = sourceDate
  if (!previousDate) {
    const targetDateObj = new Date(targetDate)
    const yesterdayDateObj = new Date(targetDateObj)
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1)
    previousDate = yesterdayDateObj.toISOString().split('T')[0]
  }

  // Get source header
  const sourceHeader = await getCardingProductionByDateShift(previousDate, targetShift)
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`)
  }

  // Get source production details
  const { data: sourceDetails, error: detailsError } = await supabase
    .from('carding_production_detail')
    .select('*')
    .eq('header_id', sourceHeader.id)

  if (detailsError) throw detailsError
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`)
  }

  // Get source stoppage entries
  const { data: sourceStoppages, error: stoppagesError } = await supabase
    .from('carding_stoppage_entry')
    .select('*')
    .in('production_detail_id', sourceDetails.map(d => d.id))

  if (stoppagesError) throw stoppagesError

  // Get target's existing production details
  const { data: targetDetails, error: targetError } = await supabase
    .from('carding_production_detail')
    .select('*, machine:carding_machines(machine_no)')
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
      .from('carding_production_detail')
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
  const { data: targetStoppages, error: targetStoppagesError } = await supabase
    .from('carding_stoppage_entry')
    .select('*, production_detail:carding_production_detail(machine_id)')
    .in('production_detail_id', targetDetails.map(d => d.id))
  if (targetStoppagesError) throw targetStoppagesError
  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetStoppage.production_detail?.machine_id
    const sourceStoppage = sourceStoppageMap[machineId]
    if (!sourceStoppage) return null
    const { data, error } = await supabase
      .from('carding_stoppage_entry')
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
export async function copyCardingFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copyCardingFromPreviousDate(targetDate, targetShift, targetHeaderId, null)
}
