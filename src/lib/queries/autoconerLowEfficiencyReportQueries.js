import { prisma } from '../prisma'

/**
 * Autoconer Low Efficiency Report Queries
 * Shows machines where actual efficiency is below target efficiency
 */

/**
 * Generate Autoconer Low Efficiency Report for a specific date
 * @param {Date} selectedDate - The date to generate report for
 * @returns {Promise<Object>} Report data grouped by shift
 */
export async function generateAutoconerLowEfficiencyReport(selectedDate) {
  console.log('Generating Autoconer Low Efficiency Report for:', selectedDate)

  // Get production headers for the selected date
  const headers = await prisma.autoconer_production_header.findMany({
    where: {
      entry_date: selectedDate
    },
    orderBy: {
      shift: 'asc'
    }
  })

  if (headers.length === 0) {
    console.log('No data found for the selected date')
    return {
      date: selectedDate,
      shifts: []
    }
  }

  // Get header IDs
  const headerIds = headers.map(h => h.id)

  // Get all production details for these headers
  const details = await prisma.autoconer_production_detail.findMany({
    where: {
      header_id: {
        in: headerIds
      }
    }
  })

  if (details.length === 0) {
    console.log('No production details found')
    return {
      date: selectedDate,
      shifts: []
    }
  }

  // Get all unique count names to fetch spinning counts
  const countNames = [...new Set(details.map(d => d.count_name).filter(c => c !== null))]

  // Get spinning counts data for act_count (actual efficiency target)
  const spinningCounts = await prisma.spinning_counts.findMany({
    where: {
      count_name: {
        in: countNames
      },
      is_active: true
    }
  })

  // Create spinning count lookup map
  const spinningCountMap = {}
  spinningCounts.forEach(sc => {
    spinningCountMap[sc.count_name] = parseFloat(sc.act_count) || 0
  })

  // Get all machine IDs
  const machineIds = [...new Set(details.map(d => d.machine_id))]

  // Get machine information (machine_no, no_of_drums for efficiency calculation)
  const machines = await prisma.autoconer_machines.findMany({
    where: {
      id: {
        in: machineIds
      }
    }
  })

  // Create machine lookup map
  const machineMap = {}
  machines.forEach(m => {
    machineMap[m.id] = {
      machine_no: m.machine_no,
      no_of_drums: m.no_of_drums || 0
    }
  })

  // Get supervisor IDs
  const supervisorIds = headers
    .map(h => h.supervisor_id)
    .filter(id => id !== null)

  // Get supervisor information
  let supervisors = []
  if (supervisorIds.length > 0) {
    supervisors = await prisma.supervisors.findMany({
      where: {
        id: {
          in: supervisorIds
        }
      }
    })
  }

  // Create supervisor lookup map
  const supervisorMap = {}
  supervisors.forEach(s => {
    supervisorMap[s.id] = s.supervisor_name
  })

  // Process data by shift
  const shiftData = []

  headers.forEach(header => {
    const shiftDetails = details.filter(d => d.header_id === header.id)

    // Get all machines with efficiency data (both above and below target)
    // Color coding: Red if below target, Green if above target
    const allMachines = shiftDetails
      .map(detail => {
        const machine = machineMap[detail.machine_id]
        if (!machine) return null

        // Get act_count from spinning_counts based on count_name
        const actCount = spinningCountMap[detail.count_name] || 0
        
        // Calculate prodn_effi on the fly if it's 0.00 or not set (backward compatibility)
        let shiftEffi = parseFloat(detail.prodn_effi) || 0
        
        // If prodn_effi is 0, calculate it from work_time, run_time, and idle_drum
        if (shiftEffi === 0 && detail.work_time && detail.run_time) {
          const totalDrums = machine.no_of_drums || 0
          const idleDrum = detail.idle_drum || 0
          const workTime = detail.work_time || 0
          const runTime = detail.run_time || 510
          
          // Calculate drum efficiency
          const idleDrumPercent = totalDrums > 0 ? (idleDrum / totalDrums) * 100 : 0
          const drumEfficiency = 100 - idleDrumPercent
          
          // Calculate production efficiency: (work_time / run_time) × drum_efficiency
          shiftEffi = runTime > 0 ? (workTime / runTime) * drumEfficiency : 0
          shiftEffi = parseFloat(shiftEffi.toFixed(2))
        }

        // Only include if target count is set
        if (actCount > 0) {
          return {
            machine_no: machine.machine_no,
            sider_name: detail.emp_name || 'NIL',
            count: detail.count_name || '',
            act_effi: actCount,  // Act Effi (target count from spinning_counts)
            shift_effi: shiftEffi,  // Shift Effi % (actual efficiency percentage)
            red_light: parseFloat(detail.red_light) || 0,
            is_low_efficiency: shiftEffi < actCount  // Flag for color coding (red if below, green if above)
          }
        }
        return null
      })
      .filter(item => item !== null)
      .sort((a, b) => {
        // Sort by machine number (natural sort to handle AC1-1, AC1-2, AC10-1 correctly)
        return a.machine_no.localeCompare(b.machine_no, undefined, { numeric: true })
      })

    if (allMachines.length > 0) {
      shiftData.push({
        shift: header.shift,
        supervisor_name: supervisorMap[header.supervisor_id] || 'Not Assigned',
        machines: allMachines
      })
    }
  })

  console.log(`Found ${shiftData.length} shifts with low efficiency machines`)

  return {
    date: selectedDate,
    shifts: shiftData
  }
}

/**
 * Get available date range for autoconer production data
 * @returns {Promise<Object>} { minDate, maxDate }
 */
export async function getAutoconerDateRange() {
  try {
    const result = await prisma.autoconer_production_header.aggregate({
      _min: { entry_date: true },
      _max: { entry_date: true }
    })

    return {
      minDate: result._min.entry_date,
      maxDate: result._max.entry_date
    }
  } catch (error) {
    console.error('Error getting autoconer date range:', error)
    return { minDate: null, maxDate: null }
  }
}
