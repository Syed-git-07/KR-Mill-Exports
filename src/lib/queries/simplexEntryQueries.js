import { prisma } from '../prisma'
import { calculateSimplexProductionValues as calculateSimplexProductionValuesFromUtils } from '../utils/simplexCalculations'
import { resolveSimplexShiftFallbackTime } from '../simplexFormulaFallback'

function parseCountTpi(tpiValue) {
  if (tpiValue == null) return null
  const match = String(tpiValue).match(/\d+(\.\d+)?/)
  if (!match) return null
  const parsed = parseFloat(match[0])
  return Number.isNaN(parsed) ? null : parsed
}

function isSimplexMachineVisibleOnDate(machine, entryDate) {
  if (!machine) return false
  if (machine.activated_at && new Date(machine.activated_at) > entryDate) return false
  if (machine.deactivated_at && new Date(machine.deactivated_at) <= entryDate) return false
  return true
}

// ============================================
// SIMPLEX SHIFT CONFIG QUERIES
// ============================================

// Get shift configuration for SIMPLEX department
export async function getSimplexShiftConfig(shift) {
  try {
    const data = await prisma.shift_config.findFirst({
      where: {
        department_code: 'SIMPLEX',
        shift: parseInt(shift),
        is_active: true
      }
    })
    return data
  } catch (error) {
    console.error('Error fetching simplex shift config:', error)
    return null
  }
}

// Get shift time for SIMPLEX
export async function getSimplexShiftTime(shift) {
  const config = await getSimplexShiftConfig(shift)
  return config?.shift_time || resolveSimplexShiftFallbackTime(shift)
}

// No default stoppage for SIMPLEX - always 0
export async function getSimplexDefaultStoppage(shift) {
  return 0
}

// Get full shift configuration (time + stoppage) for SIMPLEX
export async function getSimplexShiftConfiguration(shift) {
  const config = await getSimplexShiftConfig(shift)
  const shiftTime = config?.shift_time || resolveSimplexShiftFallbackTime(shift)
  
  return {
    totalTime: shiftTime,
    defaultStoppage: 0,
    workTime: shiftTime,
    config: config
  }
}

// ============================================
// SIMPLEX PRODUCTION HEADER QUERIES
// ============================================

// Get all production headers
export async function getSimplexProductionHeaders() {
  try {
    const data = await prisma.simplex_production_header.findMany({
      orderBy: {
        entry_date: 'desc'
      }
    })
    return data
  } catch (error) {
    throw new Error(`Failed to load production headers: ${error.message}`)
  }
}

// Get production header by date and shift
export async function getSimplexProductionByDateShift(date, shift) {
  try {
    const data = await prisma.simplex_production_header.findFirst({
      where: {
        entry_date: new Date(date),
        shift: parseInt(shift)
      }
    })
    return data
  } catch (error) {
    throw new Error(`Failed to get production header: ${error.message}`)
  }
}

// Create or get production header
export async function getOrCreateSimplexProductionHeader(date, shift, supervisorId, maisitryId) {
  // First try to get existing
  const existing = await getSimplexProductionByDateShift(date, shift)
  if (existing) return existing

  // Create new header
  try {
    const shiftTime = await getSimplexShiftTime(shift)
    const data = await prisma.simplex_production_header.create({
      data: {
        entry_date: new Date(date),
        shift: parseInt(shift),
        supervisor_id: supervisorId || null,
        maisitry_id: maisitryId || null,
        total_time: shiftTime
      }
    })
    return data
  } catch (error) {
    throw new Error(`Failed to create production header: ${error.message}`)
  }
}

// Update production header
export async function updateSimplexProductionHeader(id, updates) {
  try {
    const data = await prisma.simplex_production_header.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw new Error(`Failed to update production header: ${error.message}`)
  }
}

// ============================================
// SIMPLEX PRODUCTION DETAIL QUERIES
// ============================================

// Get production details for a header
export async function getSimplexProductionDetails(headerId) {
  try {
    const data = await prisma.simplex_production_detail.findMany({
      where: { header_id: headerId }
    })

    if (!data || data.length === 0) return []

    const validDetails = data.filter(d => !!d.machine_id)
    if (validDetails.length === 0) return []

    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const machineIds = validDetails.map(d => d.machine_id)
    const machines = await prisma.simplex_machines.findMany({
      where: { id: { in: machineIds } },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        machine_no: true,
        description: true,
        prodn_mixing: true,
        speed: true,
        mc_effi: true,
        tpi: true,
        no_of_spindles: true,
        is_active: true,
        activated_at: true,
        deactivated_at: true,
        sort_order: true
      }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    return validDetails
      .map(detail => ({
        ...detail,
        machine: machineMap[detail.machine_id] || null
      }))
      .filter(detail => isSimplexMachineVisibleOnDate(detail.machine, entryDate))
      .sort((a, b) => (a.machine?.sort_order || 9999) - (b.machine?.sort_order || 9999))
  } catch (error) {
    throw error
  }
}

// Get production details with machine setup for a header (for display)
export async function getSimplexProductionWithSetup(headerId) {
  try {
    const data = await prisma.simplex_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    if (!data || data.length === 0) return []

    const validDetails = data.filter(d => !!d.machine_id)
    if (validDetails.length === 0) return []

    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const detailIds = validDetails.map(d => d.id)
    const machineIds = validDetails.map(d => d.machine_id)

    const [machines, stoppages] = await Promise.all([
      prisma.simplex_machines.findMany({
        where: { id: { in: machineIds } },
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          machine_no: true,
          description: true,
          prodn_mixing: true,
          speed: true,
          mc_effi: true,
          tpi: true,
          no_of_spindles: true,
          is_active: true,
          activated_at: true,
          deactivated_at: true,
          sort_order: true
        }
      }),
      prisma.simplex_stoppage_entry.findMany({
        where: { production_detail_id: { in: detailIds } }
      })
    ])

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const stoppageMap = {}
    stoppages?.forEach(s => { stoppageMap[s.production_detail_id] = s })

    // Sort by natural machine number order (1, 2, 3... 10)
    return validDetails
      .map(detail => ({
        ...detail,
        machine: machineMap[detail.machine_id] || null,
        stoppage: stoppageMap[detail.id] ? [stoppageMap[detail.id]] : []
      }))
      .filter(detail => isSimplexMachineVisibleOnDate(detail.machine, entryDate))
      .sort((a, b) => (a.machine?.sort_order || 9999) - (b.machine?.sort_order || 9999)) || []
  } catch (error) {
    throw error
  }
}

// Initialize production details for all simplex machines
export async function initializeSimplexProductionDetails(headerId) {
  try {
    // Get header entry_date for date-based machine visibility
    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true, total_time: true, shift: true }
    })
    const entryDate = header?.entry_date || new Date()

    // Only include machines that exist in setup
    const machineIdsWithSetup = (await prisma.simplex_machine_setup.findMany({
      select: { machine_id: true }
    })).map(s => s.machine_id)

    // Get all machines visible on this entry date
    const machines = await prisma.simplex_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        activated_at: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: { sort_order: 'asc' }
    })

    if (!machines || machines.length === 0) return []

    // Get machine setup for default values
    const setups = await prisma.simplex_machine_setup.findMany()

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    const headerTotalTime = header?.total_time || await getSimplexShiftTime(header?.shift)

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
        waste: setup.default_waste ?? null,
        act_prodn: 0,
        waste_percent: 0,
        act_effi_percent: 0,
        uti_percent: 0,
        std_hrs: 0,
        run_time: headerTotalTime,
        work_time: headerTotalTime,
        session_no: 1
      }
    })

    await prisma.simplex_production_detail.createMany({
      data: details
    })

    // Get the created details
    const createdDetails = await prisma.simplex_production_detail.findMany({
      where: { header_id: headerId }
    })

    // Initialize stoppage entries for each detail
    const stoppageEntries = createdDetails.map(detail => ({
      production_detail_id: detail.id,
      stoppage1_time: 0,
      stoppage2_time: 0,
      stoppage3_time: 0,
      stoppage4_time: 0,
      total_stoppage_time: 0
    }))

    await prisma.simplex_stoppage_entry.createMany({
      data: stoppageEntries
    })

    return createdDetails
  } catch (error) {
    throw error
  }
}

// Add missing production details for newly added machines in an existing header
export async function addMissingSimplexProductionDetails(headerId) {
  try {
    // Get header entry_date for date-based machine visibility
    const headerForDate = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = headerForDate?.entry_date || new Date()

    // Only include machines that exist in setup
    const machineIdsWithSetup = (await prisma.simplex_machine_setup.findMany({
      select: { machine_id: true }
    })).map(s => s.machine_id)

    // Get machines visible on this entry date
    const machines = await prisma.simplex_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        activated_at: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: { sort_order: 'asc' }
    })

    // Get existing detail records for this header
    const existingDetails = await prisma.simplex_production_detail.findMany({
      where: { header_id: headerId },
      select: { id: true, machine_id: true }
    })

    // Cleanup orphan detail rows with null machine_id
    const invalidDetailIds = existingDetails
      .filter(d => !d.machine_id)
      .map(d => d.id)

    if (invalidDetailIds.length > 0) {
      await prisma.simplex_stoppage_entry.deleteMany({
        where: { production_detail_id: { in: invalidDetailIds } }
      })
      await prisma.simplex_production_detail.deleteMany({
        where: { id: { in: invalidDetailIds } }
      })
    }

    const validExistingDetails = existingDetails.filter(d => !!d.machine_id)

    const existingMachineIds = validExistingDetails.map(d => d.machine_id)

    // Remove detail rows for machines that are deactivated for this entry date
    // or that have no setup row
    const allExistingMachines = existingMachineIds.length > 0
      ? await prisma.simplex_machines.findMany({
          where: { id: { in: existingMachineIds } }
        })
      : []

    const existingMachineMap = {}
    allExistingMachines.forEach(m => { existingMachineMap[m.id] = m })

    const deactivatedDetailIds = validExistingDetails
      .filter(d => {
        const m = existingMachineMap[d.machine_id]
        if (!m) return false
        if (m.deactivated_at && new Date(m.deactivated_at) <= entryDate) return true
        if (!machineIdsWithSetup.includes(m.id)) return true
        return false
      })
      .map(d => d.id)

    if (deactivatedDetailIds.length > 0) {
      await prisma.simplex_stoppage_entry.deleteMany({
        where: { production_detail_id: { in: deactivatedDetailIds } }
      })
      await prisma.simplex_production_detail.deleteMany({
        where: { id: { in: deactivatedDetailIds } }
      })
    }

    const remainingMachineIds = validExistingDetails
      .filter(d => !deactivatedDetailIds.includes(d.id))
      .map(d => d.machine_id)

    // Find machines that don't have production details yet
    const missingMachines = machines.filter(m => !remainingMachineIds.includes(m.id))

    if (missingMachines.length === 0) {
      return [] // No new machines to add
    }

    // Get machine setup for default values
    const setups = await prisma.simplex_machine_setup.findMany()
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { total_time: true, shift: true }
    })
    const headerTotalTime = header?.total_time || await getSimplexShiftTime(header?.shift)

    // Create detail records for each missing machine
    const details = missingMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      return {
        header_id: headerId,
        machine_id: machine.id,
        prodn_mixing: machine.prodn_mixing || '64COMBED GOLD',
        run_hrs: 0,
        run_min: 0,
        idle_spindles: 0,
        waste: setup.default_waste ?? null,
        act_prodn: 0,
        waste_percent: 0,
        act_effi_percent: 0,
        uti_percent: 0,
        std_hrs: 0,
        run_time: headerTotalTime,
        work_time: headerTotalTime,
        session_no: 1
      }
    })

    await prisma.simplex_production_detail.createMany({
      data: details
    })

    // Get the created details
    const createdDetails = await prisma.simplex_production_detail.findMany({
      where: { 
        header_id: headerId,
        machine_id: { in: missingMachines.map(m => m.id) }
      }
    })

    // Initialize stoppage entries for each new detail
    const stoppageEntries = createdDetails.map(detail => ({
      production_detail_id: detail.id,
      stoppage1_time: 0,
      stoppage2_time: 0,
      stoppage3_time: 0,
      stoppage4_time: 0,
      total_stoppage_time: 0
    }))

    await prisma.simplex_stoppage_entry.createMany({
      data: stoppageEntries
    })

    return createdDetails
  } catch (error) {
    throw error
  }
}

// Update production detail
export async function updateSimplexProductionDetail(id, updates) {
  try {
    const data = await prisma.simplex_production_detail.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Bulk update production details
export async function bulkUpdateSimplexProductionDetails(updates) {
  const promises = updates.map(({ id, ...data }) =>
    prisma.simplex_production_detail.update({
      where: { id },
      data
    })
  )

  const results = await Promise.all(promises)
  return results
}

// ============================================
// SIMPLEX STOPPAGE ENTRY QUERIES
// ============================================

// Get stoppage entries for a header
export async function getSimplexStoppageEntries(headerId) {
  try {
    const details = await prisma.simplex_production_detail.findMany({
      where: {
        header_id: headerId
      }
    })

    if (!details || details.length === 0) return []

    const validDetails = details.filter(d => !!d.machine_id)
    if (validDetails.length === 0) return []

    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    const detailIds = validDetails.map(d => d.id)
    const machineIds = validDetails.map(d => d.machine_id)

    const stoppages = await prisma.simplex_stoppage_entry.findMany({
      where: { production_detail_id: { in: detailIds } }
    })

    const reasonIds = []
    stoppages?.forEach(s => {
      if (s.stoppage1_id) reasonIds.push(s.stoppage1_id)
      if (s.stoppage2_id) reasonIds.push(s.stoppage2_id)
      if (s.stoppage3_id) reasonIds.push(s.stoppage3_id)
      if (s.stoppage4_id) reasonIds.push(s.stoppage4_id)
    })

    const [machines, reasons] = await Promise.all([
      prisma.simplex_machines.findMany({
        where: { id: { in: machineIds } },
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          machine_no: true,
          speed: true,
          tpi: true,
          mc_effi: true,
          no_of_spindles: true,
          is_active: true,
          activated_at: true,
          deactivated_at: true,
          sort_order: true
        }
      }),
      reasonIds.length > 0
        ? prisma.stoppage_details.findMany({
            where: { id: { in: [...new Set(reasonIds)] } },
            select: { id: true, stoppage_name: true, short_code: true }
          })
        : Promise.resolve([])
    ])

    const detailMap = {}
    validDetails?.forEach(d => { detailMap[d.id] = d })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const reasonMap = {}
    reasons?.forEach(r => { reasonMap[r.id] = r })

    return (stoppages || [])
      .map(s => {
        const detail = detailMap[s.production_detail_id]
        const machine = detail ? (machineMap[detail.machine_id] || null) : null
        return {
          ...s,
          production_detail: detail ? { ...detail, machine } : null,
          stoppage1: reasonMap[s.stoppage1_id] || null,
          stoppage2: reasonMap[s.stoppage2_id] || null,
          stoppage3: reasonMap[s.stoppage3_id] || null,
          stoppage4: reasonMap[s.stoppage4_id] || null,
        }
      })
      .filter(row => isSimplexMachineVisibleOnDate(row.production_detail?.machine, entryDate))
      .sort((a, b) => {
        const sortA = a.production_detail?.machine?.sort_order || 9999
        const sortB = b.production_detail?.machine?.sort_order || 9999
        return sortA - sortB
      })
  } catch (error) {
    throw error
  }
}

// Update stoppage entry
export async function updateSimplexStoppageEntry(id, updates) {
  try {
    // First, fetch the existing record to get current stoppage values and production_detail_id
    const existing = await prisma.simplex_stoppage_entry.findUnique({
      where: { id },
      select: {
        production_detail_id: true,
        stoppage1_time: true,
        stoppage2_time: true,
        stoppage3_time: true,
        stoppage4_time: true
      }
    })

    if (!existing) {
      throw new Error(`Stoppage entry ${id} not found`)
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

    const data = await prisma.simplex_stoppage_entry.update({
      where: { id },
      data: {
        ...updates,
        ...mergedStoppages,
        total_stoppage_time: total
      }
    })

    // Recalculate production values with the latest stoppage total.
    // Relations are not available in Prisma schema for this model, so fetch related rows manually.
    const productionDetail = await prisma.simplex_production_detail.findUnique({
      where: { id: existing.production_detail_id }
    })

    if (!productionDetail) {
      return data
    }

    const setup = await prisma.simplex_machine_setup.findFirst({
      where: { machine_id: productionDetail.machine_id }
    })

    const [header, machine] = await Promise.all([
      prisma.simplex_production_header.findUnique({
        where: { id: productionDetail.header_id },
        select: {
          total_time: true,
          shift: true
        }
      }),
      prisma.simplex_machines.findUnique({
        where: { id: productionDetail.machine_id },
        select: {
          speed: true,
          tpi: true,
          mc_effi: true,
          no_of_spindles: true
        }
      })
    ])

    const shift = header?.shift
    const totalTime = header?.total_time || resolveSimplexShiftFallbackTime(shift)

    const calculated = calculateSimplexProductionValues({
      runHrs: productionDetail.run_hrs || 0,
      speed: setup?.speed || machine?.speed || 960,
      tpi: setup?.tpi || machine?.tpi || 1.73,
      hank: setup?.sl_hank || 1.4,
      mcEffi: setup?.mc_effi || machine?.mc_effi || 92,
      totalSpindles: setup?.spindles || machine?.no_of_spindles || 140,
      idleSpindles: productionDetail.idle_spindles || 0,
      waste: productionDetail.waste ?? 0,
      totalTime,
      stoppageTime: total
    })

    await prisma.simplex_production_detail.update({
      where: { id: existing.production_detail_id },
      data: {
        run_time: totalTime,
        run_min: calculated.run_min,
        work_time: calculated.work_time,
        std_hrs: calculated.std_hrs,
        act_prodn: calculated.act_prodn,
        act_effi_percent: calculated.act_effi_percent,
        waste_percent: calculated.waste_percent,
        uti_percent: calculated.uti_percent
      }
    })

    return data
  } catch (error) {
    throw error
  }
}

// Apply full stoppage to all machines and recalculate production
export async function applySimplexFullStoppage(headerId, stoppageId, stoppageTime, slot = 1) {
  // Get all stoppage entries for this header with production details
  const stoppages = await getSimplexStoppageEntries(headerId)
  
  const header = await prisma.simplex_production_header.findUnique({
    where: { id: headerId },
    select: { total_time: true, shift: true }
  })
  const headerTotalTime = header?.total_time || resolveSimplexShiftFallbackTime(header?.shift)

  // Get machine setups for recalculation
  const setups = await getSimplexMachineSetups()
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
    [stoppageTimeField]: stoppageTime
  }))

  const stoppagePromises = updates.map(({ id, ...data }) =>
    updateSimplexStoppageEntry(id, data)
  )

  await Promise.all(stoppagePromises)
  
  // Recalculate production for each machine
  const prodPromises = stoppages.map(async (s) => {
    if (!s.production_detail) return null
    
    const prodDetail = s.production_detail
    const machineId = prodDetail.machine_id
    const setup = setupMap[machineId]
    const machine = prodDetail.machine || {}
    
    // Calculate new total stoppage (all 4 stoppages)
    const newTotalStoppage = 
      (slot === 1 ? stoppageTime : s.stoppage1_time || 0) +
      (slot === 2 ? stoppageTime : s.stoppage2_time || 0) +
      (slot === 3 ? stoppageTime : s.stoppage3_time || 0) +
      (slot === 4 ? stoppageTime : s.stoppage4_time || 0)
    
    // Recalculate with Simplex formula
    const calculated = calculateSimplexProductionValues({
      runHrs: prodDetail.run_hrs || 0,
      speed: machine.speed || setup?.speed || 960,
      tpi: setup?.tpi || machine.tpi || 1.73,
      hank: setup?.sl_hank || 1.4,
      mcEffi: machine.mc_effi || setup?.mc_effi || 92,
      totalSpindles: setup?.spindles || machine.no_of_spindles || 140,
      idleSpindles: prodDetail.idle_spindles || 0,
      waste: prodDetail.waste ?? 0,
      totalTime: headerTotalTime,
      stoppageTime: newTotalStoppage
    })
    
    // Update production detail with recalculated values
    return updateSimplexProductionDetail(prodDetail.id, calculated)
  })
  
  return Promise.all(prodPromises.filter(Boolean))
}

// Helper: Pick first available slot (1-4) for a stoppage entry
function pickFirstAvailableSlot(stoppageEntry) {
  if (!stoppageEntry) return null
  for (let slot = 1; slot <= 4; slot += 1) {
    const idField = `stoppage${slot}_id`
    if (!stoppageEntry[idField]) return slot
  }
  return null // All slots full
}

// Apply partial stoppage to machine range and recalculate production
export async function applySimplexPartialStoppage(headerId, fromMachineNo, toMachineNo, stoppageId, stoppageTime) {
  try {
    const header = await prisma.simplex_production_header.findUnique({
      where: { id: headerId },
      select: { total_time: true, shift: true }
    })
    const headerTotalTime = header?.total_time || resolveSimplexShiftFallbackTime(header?.shift)

    // Get machine setups for recalculation
    const setups = await getSimplexMachineSetups()
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })
    
    // Get all production details and machine info (manual join)
    const details = await prisma.simplex_production_detail.findMany({
      where: { 
        header_id: headerId
      }
    })

    const machineIds = details.map(d => d.machine_id)
    const machines = await prisma.simplex_machines.findMany({
      where: { id: { in: machineIds }, is_active: true },
      select: {
        id: true,
        machine_no: true,
        speed: true,
        tpi: true,
        mc_effi: true,
        no_of_spindles: true
      }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    const enrichedDetails = details
      .map(d => ({ ...d, machine: machineMap[d.machine_id] || null }))

    // Filter by machine range (handle reversed from/to)
    const fromNum = parseInt(fromMachineNo)
    const toNum = parseInt(toMachineNo)
    const minNum = Math.min(fromNum, toNum)
    const maxNum = Math.max(fromNum, toNum)

    const filteredDetails = enrichedDetails?.filter(d => {
      if (!d.machine?.machine_no) return false
      const mcNum = parseInt(d.machine.machine_no)
      return mcNum >= minNum && mcNum <= maxNum
    }) || []

    if (filteredDetails.length === 0) {
      throw new Error(`No machines found in range ${fromMachineNo} to ${toMachineNo}`)
    }

    // Get stoppage entries for these details
    const detailIds = filteredDetails.map(d => d.id)

    const stoppages = await prisma.simplex_stoppage_entry.findMany({
      where: {
        production_detail_id: { in: detailIds }
      }
    })

    const stoppageByDetailId = {}
    stoppages.forEach(s => { stoppageByDetailId[s.production_detail_id] = s })

    // Auto-slot allocation for each machine
    let updatedCount = 0
    let skippedCount = 0
    let overflowCount = 0
    const updatedDetails = []

    for (const detail of filteredDetails) {
      const stoppageEntry = stoppageByDetailId[detail.id]
      if (!stoppageEntry) {
        skippedCount += 1
        continue
      }

      const resolvedSlot = pickFirstAvailableSlot(stoppageEntry)
      if (!resolvedSlot) {
        overflowCount += 1
        continue
      }

      const updateData = {}
      updateData[`stoppage${resolvedSlot}_id`] = stoppageId
      updateData[`stoppage${resolvedSlot}_time`] = stoppageTime
      
      await updateSimplexStoppageEntry(stoppageEntry.id, updateData)
      updatedCount += 1
      updatedDetails.push(detail)
    }
    
    // Recalculate production for affected machines
    const prodPromises = updatedDetails.map(async (prodDetail) => {
      const stoppageEntry = stoppageByDetailId[prodDetail.id]
      if (!stoppageEntry) return null
      
      const machineId = prodDetail.machine_id
      const setup = setupMap[machineId]
      const machine = prodDetail.machine || {}
      
      // Calculate new total stoppage (sum of all 4 slots)
      const newTotalStoppage = 
        (stoppageEntry.stoppage1_time || 0) +
        (stoppageEntry.stoppage2_time || 0) +
        (stoppageEntry.stoppage3_time || 0) +
        (stoppageEntry.stoppage4_time || 0)
      
      // Recalculate with Simplex formula
      const calculated = calculateSimplexProductionValues({
        runHrs: prodDetail.run_hrs || 0,
        speed: machine.speed || setup?.speed || 960,
        tpi: setup?.tpi || machine.tpi || 1.73,
        hank: setup?.sl_hank || 1.4,
        mcEffi: machine.mc_effi || setup?.mc_effi || 92,
        totalSpindles: setup?.spindles || machine.no_of_spindles || 140,
        idleSpindles: prodDetail.idle_spindles || 0,
        waste: prodDetail.waste ?? 0,
        totalTime: headerTotalTime,
        stoppageTime: newTotalStoppage
      })
      
      // Update production detail with recalculated values
      return updateSimplexProductionDetail(prodDetail.id, calculated)
    })
    
    await Promise.all(prodPromises.filter(Boolean))
    
    return { updatedCount, skippedCount, overflowCount }
  } catch (error) {
    throw error
  }
}

// ============================================
// SIMPLEX MACHINE SETUP QUERIES
// ============================================

// Get all machine setups with machine info (only active machines)
export async function getSimplexMachineSetups() {
  try {
    const setups = await prisma.simplex_machine_setup.findMany({
      orderBy: { machine_id: 'asc' }
    })

    if (!setups || setups.length === 0) return []

    const machineIds = setups.map(s => s.machine_id)
    const machines = await prisma.simplex_machines.findMany({
      where: {
        id: { in: machineIds },
        is_active: true
      },
      select: {
        id: true,
        machine_no: true,
        description: true,
        make_name: true,
        prodn_mixing: true,
        speed: true,
        mc_effi: true,
        tpi: true,
        no_of_spindles: true,
        is_active: true
      }
    })

    const machineMap = {}
    machines?.forEach(m => { machineMap[m.id] = m })

    return setups
      .filter(s => !!machineMap[s.machine_id])
      .map(s => ({ ...s, machine: machineMap[s.machine_id] }))
  } catch (error) {
    throw error
  }
}

// Get machine setup by machine_id
export async function getSimplexMachineSetupByMachineId(machineId) {
  try {
    const data = await prisma.simplex_machine_setup.findFirst({
      where: { machine_id: machineId }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update machine setup
export async function updateSimplexMachineSetup(id, updates) {
  try {
    const currentSetup = await prisma.simplex_machine_setup.findUnique({
      where: { id },
      select: { id: true, machine_id: true }
    })

    if (!currentSetup) {
      throw new Error(`Simplex machine setup ${id} not found`)
    }

    const machineUpdates = {}

    if (Object.prototype.hasOwnProperty.call(updates, 'speed')) {
      const speed = parseInt(updates.speed, 10)
      if (!Number.isNaN(speed)) machineUpdates.speed = speed
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'tpi')) {
      const tpi = parseFloat(updates.tpi)
      if (!Number.isNaN(tpi)) machineUpdates.tpi = tpi
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'spindles')) {
      const spindles = parseInt(updates.spindles, 10)
      if (!Number.isNaN(spindles)) machineUpdates.no_of_spindles = spindles
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'mc_effi')) {
      const mcEffi = parseFloat(updates.mc_effi)
      if (!Number.isNaN(mcEffi)) machineUpdates.mc_effi = mcEffi
    }

    const { speed: _speed, ...setupUpdates } = updates || {}

    const [data] = await prisma.$transaction([
      prisma.simplex_machine_setup.update({
        where: { id },
        data: setupUpdates
      }),
      ...(Object.keys(machineUpdates).length > 0
        ? [
            prisma.simplex_machines.update({
              where: { id: currentSetup.machine_id },
              data: machineUpdates
            })
          ]
        : [])
    ])

    return data
  } catch (error) {
    throw error
  }
}

// Create or update machine setup
export async function upsertSimplexMachineSetup(machineId, setupData) {
  try {
    const existing = await getSimplexMachineSetupByMachineId(machineId)
    
    if (existing) {
      return updateSimplexMachineSetup(existing.id, setupData)
    }

    const data = await prisma.simplex_machine_setup.create({
      data: {
        machine_id: machineId,
        ...setupData
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// STOPPAGE REASONS QUERIES
// ============================================

// Get simplex stoppage reasons (filtered by SIMPLEX department)
export async function getSimplexStoppageReasons() {
  try {
    // First get the SIMPLEX department ID
    const simplexDept = await prisma.departments.findFirst({
      where: { dept_name: 'SIMPLEX' }
    })
    
    if (!simplexDept?.id) return []

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
        AND sd.department_id = ${simplexDept.id}
      ORDER BY sd.stoppage_name ASC
    `

    return (rows || []).map(item => ({
      ...item,
      category: item.stoppage_head_name || 'General'
    }))
  } catch (error) {
    throw error
  }
}

// ============================================
// SUPERVISORS QUERIES
// ============================================

// Get all supervisors
export async function getSupervisors() {
  try {
    const data = await prisma.supervisors.findMany({
      where: { is_active: true },
      orderBy: {
        supervisor_name: 'asc'
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// SIMPLEX MACHINES QUERIES
// ============================================

// Get all simplex machines
export async function getSimplexMachines() {
  try {
    const data = await prisma.simplex_machines.findMany({
      where: { is_active: true },
      orderBy: {
        machine_no: 'asc'
      }
    })
    
    // Sort by natural number order (1, 2, 3... 10)
    return data?.sort((a, b) => {
      const aNum = parseInt(a.machine_no || '0')
      const bNum = parseInt(b.machine_no || '0')
      return aNum - bNum
    }) || []
  } catch (error) {
    throw error
  }
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
 * @param {number} minutes - Total minutes
 * @returns {number} - Hours in HH.MM format
 */
export function minutesToRunHours(minutes) {
  if (!minutes || minutes === 0) return 0
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  return parseFloat(`${hours}.${mins.toString().padStart(2, '0')}`)
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get stoppage details for dropdown
export async function getStoppageDetails() {
  try {
    const data = await prisma.stoppage_details.findMany({
      where: { is_active: true },
      select: {
        id: true,
        stoppage_name: true
      },
      orderBy: {
        stoppage_name: 'asc'
      }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Get all employees for dropdown/search
export async function getSimplexEmployees() {
  try {
    const data = await prisma.employee_master.findMany({
      where: { is_active: true },
      select: {
        id: true,
        emp_name: true,
        emp_code: true
      },
      orderBy: {
        emp_name: 'asc'
      }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Search employees by name
export async function searchSimplexEmployees(searchTerm) {
  try {
    const data = await prisma.employee_master.findMany({
      where: {
        is_active: true,
        emp_name: {
          contains: searchTerm
        }
      },
      select: {
        id: true,
        emp_name: true,
        emp_code: true
      },
      orderBy: {
        emp_name: 'asc'
      },
      take: 20
    })
    return data || []
  } catch (error) {
    throw error
  }
}
// ============================================
// SIMPLEX PRODUCTION CALCULATION
// ============================================

/**
 * Calculate Simplex Production Values
 * 
 * Simplex Formula:
 * - RunMin = Convert RunHrs (HH.MM format) to minutes
 * - WorkTime = TotalTime - StoppageTime
 * - Std Hrs = WorkTime × (MCEffi / 100)
 * - Active Spindles = Total Spindles - Idle Spindles
 * - Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
 * - Act.Effi % = (RunMin / Std.Hrs) × 100
 * - Waste % = (Waste / Act.Prodn) × 100
 * - UTI % = (WorkTime / TotalTime) × 100
 */
export function calculateSimplexProductionValues(params) {
  return calculateSimplexProductionValuesFromUtils(params)
}

// ============================================
// MACHINE SETUP UPDATE FUNCTIONS
// ============================================

// Bulk update machine count (updates both machines and setup tables)
export async function bulkUpdateSimplexMachineCount(machineIds, countValue) {
  try {
    // Update simplex_machines table
    const machinePromises = machineIds.map(id => 
      prisma.simplex_machines.update({
        where: { id },
        data: { prodn_mixing: countValue }
      })
    )
    
    // Also update simplex_machine_setup table (this is where the displayed value comes from)
    const setupPromises = machineIds.map(id => 
      prisma.simplex_machine_setup.updateMany({
        where: { machine_id: id },
        data: { prodn_mixing: countValue }
      })
    )
    
    // Also update existing production_detail records for consistency
    const detailPromises = machineIds.map(id => 
      prisma.simplex_production_detail.updateMany({
        where: { machine_id: id },
        data: { prodn_mixing: countValue }
      })
    )
    
    // Execute all updates
    const [machines, setups, details] = await Promise.all([
      Promise.all(machinePromises),
      Promise.all(setupPromises),
      Promise.all(detailPromises)
    ])
    
    return machines
  } catch (error) {
    throw error
  }
}

// Get count options for simplex (using spinning_counts table)
export async function getSimplexCountOptions() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      orderBy: { count_name: 'asc' }
    })
    return data || []
  } catch (error) {
    throw error
  }
}

// Lookup simplex machine by machine number for setup autofill
export async function lookupSimplexMachineByNo(machineNo) {
  const raw = String(machineNo || '').trim().toUpperCase()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  const variants = Array.from(new Set([
    raw,
    digits || raw,
    digits ? `SF${digits}` : null,
    digits ? `SIMPLEX${digits}` : null,
    digits ? `${digits}` : null,
  ].filter(Boolean)))

  const orClauses = variants.map(v => ({ machine_no: { equals: v } }))

  const activeMachine = await prisma.simplex_machines.findFirst({
    where: { OR: orClauses, is_active: true }
  })

  const machine = activeMachine || await prisma.simplex_machines.findFirst({
    where: { OR: orClauses },
    orderBy: { is_active: 'desc' }
  })

  if (!machine) return null

  let setup = activeMachine
    ? await prisma.simplex_machine_setup.findFirst({ where: { machine_id: activeMachine.id } })
    : null

  if (!setup) {
    const allIds = (await prisma.simplex_machines.findMany({
      where: { OR: orClauses },
      select: { id: true }
    })).map(m => m.id)

    setup = await prisma.simplex_machine_setup.findFirst({
      where: { machine_id: { in: allIds } }
    })
  }

  return {
    ...machine,
    prodn_mixing: machine.prodn_mixing ?? setup?.prodn_mixing ?? null,
    tpi: setup?.tpi ?? machine.tpi ?? null,
    no_of_spindles: machine.no_of_spindles ?? setup?.spindles ?? null,
    has_setup: !!setup
  }
}

// Add simplex machine with setup record
export async function addSimplexMachine(machineData) {
  try {
    const parsedCountTpi = parseCountTpi(machineData.count_tpi)
    const effectiveTpi = machineData.tpi != null ? parseFloat(machineData.tpi) : parsedCountTpi
    const defaultSetupShiftTime = parseInt(machineData.shift_time) || await getSimplexShiftTime(1)

    // Check if machine already exists (might be inactive)
    if (machineData.machine_no) {
      const existingMachine = await prisma.simplex_machines.findFirst({
        where: { machine_no: machineData.machine_no }
      })

      if (existingMachine) {
        const existingSetup = await prisma.simplex_machine_setup.findFirst({
          where: { machine_id: existingMachine.id }
        })

        if (!existingMachine.is_active) {
          // Reactivate the existing machine
          const reactivated = await prisma.simplex_machines.update({
            where: { id: existingMachine.id },
            data: {
              is_active: true,
              activated_at: new Date(),
              deactivated_at: null,
              description: machineData.description || existingMachine.description,
              make_name: machineData.make_name || 'LMW',
              model: machineData.model || existingMachine.model || null,
              prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
              installed_date: machineData.installed_date ? new Date(machineData.installed_date) : existingMachine.installed_date,
              speed: parseInt(machineData.speed) || existingMachine.speed,
              prodn_efficiency: machineData.prodn_effi != null ? parseFloat(machineData.prodn_effi) : existingMachine.prodn_efficiency,
              tpi: effectiveTpi ?? existingMachine.tpi,
              no_of_spindles: parseInt(machineData.no_of_spindles ?? machineData.spindles) || existingMachine.no_of_spindles
            }
          })

          // Check if setup exists, create if not
          let setup = existingSetup
          if (!existingSetup) {
            // Create setup for reactivated machine
            setup = await prisma.simplex_machine_setup.create({
              data: {
                machine_id: existingMachine.id,
                prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
                session_no: parseInt(machineData.session_no) || 1,
                cc_time: parseInt(machineData.cc_time) || 0,
                sl_hank: parseFloat(machineData.sl_hank) || 1.4,
                mc_effi: parseInt(machineData.mc_effi) || existingMachine.mc_effi || 92,
                tpi: effectiveTpi ?? existingMachine.tpi ?? 1.73,
                spindles: parseInt(machineData.no_of_spindles ?? machineData.spindles) || existingMachine.no_of_spindles || 140,
                shift_time: defaultSetupShiftTime,
                default_waste: machineData.default_waste != null && machineData.default_waste !== ''
                  ? parseFloat(machineData.default_waste)
                  : null
              }
            })
          }

          return { machine: reactivated, setup, reactivated: true }
        }

        if (existingSetup) {
          throw new Error(`Machine ${machineData.machine_no} already exists and is active`)
        }

        const setup = await prisma.simplex_machine_setup.create({
          data: {
            machine_id: existingMachine.id,
            prodn_mixing: machineData.prodn_mixing || existingMachine.prodn_mixing || '64COMBED GOLD',
            session_no: parseInt(machineData.session_no) || 1,
            cc_time: parseInt(machineData.cc_time) || 0,
            sl_hank: parseFloat(machineData.sl_hank) || 1.4,
            mc_effi: parseInt(machineData.mc_effi) || existingMachine.mc_effi || 92,
            tpi: effectiveTpi ?? existingMachine.tpi ?? 1.73,
            spindles: parseInt(machineData.no_of_spindles ?? machineData.spindles) || existingMachine.no_of_spindles || 140,
            shift_time: defaultSetupShiftTime,
            default_waste: machineData.default_waste != null && machineData.default_waste !== ''
              ? parseFloat(machineData.default_waste)
              : null
          }
        })

        return { machine: existingMachine, setup, reactivated: false }
      }
    }

    const maxSortResult = await prisma.simplex_machines.aggregate({ _max: { sort_order: true } })
    const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1

    // Create machine record
    const machine = await prisma.simplex_machines.create({
      data: {
        machine_no: machineData.machine_no,
        description: machineData.description || `Simplex Machine ${machineData.machine_no}`,
        make_name: machineData.make_name || 'LMW',
        model: machineData.model || null,
        prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
        installed_date: machineData.installed_date ? new Date(machineData.installed_date) : null,
        speed: parseInt(machineData.speed) || 1000,
        prodn_efficiency: machineData.prodn_effi != null ? parseFloat(machineData.prodn_effi) : null,
        mc_effi: parseInt(machineData.mc_effi) || 92,
        tpi: effectiveTpi ?? 1.73,
        no_of_spindles: parseInt(machineData.no_of_spindles ?? machineData.spindles) || 140,
        is_active: true,
        activated_at: new Date(),
        sort_order: nextSortOrder
      }
    })
    
    // Create corresponding setup record
    await prisma.simplex_machine_setup.create({
      data: {
        machine_id: machine.id,
        prodn_mixing: machineData.prodn_mixing || '64COMBED GOLD',
        session_no: parseInt(machineData.session_no) || 1,
        cc_time: parseInt(machineData.cc_time) || 0,
        sl_hank: parseFloat(machineData.sl_hank) || 1.4,
        mc_effi: parseInt(machineData.mc_effi) || 92,
        tpi: effectiveTpi ?? 1.73,
        spindles: parseInt(machineData.no_of_spindles ?? machineData.spindles) || 140,
        shift_time: defaultSetupShiftTime,
        default_waste: machineData.default_waste != null && machineData.default_waste !== ''
          ? parseFloat(machineData.default_waste)
          : null
      }
    })

    return { machine, reactivated: false }
  } catch (error) {
    throw error
  }
}

// Remove simplex machine (soft delete)
export async function removeSimplexMachine(machineId) {
  try {
    const data = await prisma.simplex_machines.update({
      where: { id: machineId },
      data: { is_active: false, deactivated_at: new Date(), updated_at: new Date() }
    })
    return data
  } catch (error) {
    throw error
  }
}

// ============================================
// COPY PREVIOUS DATA FUNCTIONALITY
// ============================================

// Get available previous dates that have production data
export async function getSimplexAvailableDates(beforeDate, shift, limit = 30) {
  const data = await prisma.simplex_production_header.findMany({
    where: {
      shift: parseInt(shift),
      entry_date: { lt: new Date(beforeDate) }
    },
    select: { entry_date: true, shift: true },
    orderBy: { entry_date: 'desc' },
    take: limit
  });
  
  return data || [];
}

// Copy data from a previous date
export async function copySimplexFromPreviousDate(targetDate, targetShift, targetHeaderId, sourceDate) {
  // If no sourceDate provided, calculate yesterday's date
  let previousDate = sourceDate;
  if (!previousDate) {
    const targetDateObj = new Date(targetDate);
    const yesterdayDateObj = new Date(targetDateObj);
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
    previousDate = yesterdayDateObj.toISOString().split('T')[0];
  }
  
  // Get source header
  const sourceHeader = await getSimplexProductionByDateShift(previousDate, targetShift);
  if (!sourceHeader) {
    throw new Error(`No production data found for ${previousDate} shift ${targetShift}`);
  }
  
  // Get source production details
  const sourceDetails = await prisma.simplex_production_detail.findMany({
    where: { header_id: sourceHeader.id }
  });
  
  if (!sourceDetails || sourceDetails.length === 0) {
    throw new Error(`No production details found for ${previousDate}`);
  }
  
  // Get source stoppage entries
  const sourceStoppages = await prisma.simplex_stoppage_entry.findMany({
    where: {
      production_detail_id: { in: sourceDetails.map(d => d.id) }
    }
  });
  
  // Get target's existing production details
  const targetDetails = await prisma.simplex_production_detail.findMany({
    where: { header_id: targetHeaderId }
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
    const data = await prisma.simplex_production_detail.update({
      where: { id: targetDetail.id },
      data: {
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
        work_time: sourceData.work_time,
        session_no: sourceData.session_no
      }
    });
    return data;
  });
  
  await Promise.all(updatePromises.filter(Boolean));
  
  // Update target stoppage entries
  // First get target stoppage entries
  const targetStoppages = await prisma.simplex_stoppage_entry.findMany({
    where: {
      production_detail_id: { in: targetDetails.map(d => d.id) }
    }
  });

  const targetDetailById = {}
  targetDetails.forEach(d => { targetDetailById[d.id] = d })
  
  const stoppageUpdatePromises = targetStoppages?.map(async (targetStoppage) => {
    const machineId = targetDetailById[targetStoppage.production_detail_id]?.machine_id;
    const sourceStoppage = sourceStoppageMap[machineId];
    if (!sourceStoppage) return null;
    
    const data = await prisma.simplex_stoppage_entry.update({
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
export async function copySimplexFromYesterday(targetDate, targetShift, targetHeaderId) {
  return copySimplexFromPreviousDate(targetDate, targetShift, targetHeaderId, null);
}