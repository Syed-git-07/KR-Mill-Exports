import { prisma } from '@/lib/prisma'

/**
 * Format date to DD-MMM-YY format for display
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatDisplayDate(dateString) {
  const date = new Date(dateString + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(date.getDate()).padStart(2, '0')
  const month = months[date.getMonth()]
  const year = String(date.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

/**
 * Normalize date string to YYYY-MM-DD format (local timezone)
 * @param {string} dateString - Input date string
 * @returns {string} Normalized date string
 */
function normalizeDateString(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Fetch Spinning Daily Production Report for a specific date
 * Groups data by machine showing GPS for each shift (I/II/III)
 * @param {string} reportDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Report data with machine-wise production
 */
export async function fetchSpinningDailyProductionReport(reportDate) {
  try {
    const dateStr = normalizeDateString(reportDate)

    // Fetch all production data for the given date across all shifts
    const rawData = await prisma.$queryRaw`
      SELECT 
        h.entry_date,
        h.shift,
        m.machine_no,
        m.sort_order,
        d.exp_gps,
        d.gps as achieved_gps,
        d.act_prodn,
        d.waste_percent,
        COALESCE(se.total_stoppage_time, d.total_stoppage_mins, 0) as total_stoppage_mins
      FROM spinning_production_header h
      JOIN spinning_production_detail d ON h.id = d.header_id
      JOIN spinning_machines m ON d.machine_id = m.id
      LEFT JOIN spinning_stoppage_entry se ON se.production_detail_id = d.id
      WHERE h.entry_date = ${dateStr}
      ORDER BY m.sort_order, m.machine_no, h.shift
    `

    // Group data by machine
    const machineMap = new Map()
    
    rawData.forEach(row => {
      const machineNo = row.machine_no
      
      if (!machineMap.has(machineNo)) {
        machineMap.set(machineNo, {
          machineNo: machineNo,
          sortOrder: row.sort_order || 0,
          shifts: {
            1: { expGps: 0, achievedGps: 0, production: 0, waste: 0, stoppage: 0 },
            2: { expGps: 0, achievedGps: 0, production: 0, waste: 0, stoppage: 0 },
            3: { expGps: 0, achievedGps: 0, production: 0, waste: 0, stoppage: 0 }
          }
        })
      }
      
      const machine = machineMap.get(machineNo)
      const shift = row.shift
      
      if (shift >= 1 && shift <= 3) {
        machine.shifts[shift] = {
          expGps: row.exp_gps !== null ? parseFloat(row.exp_gps) : 0,
          achievedGps: row.achieved_gps !== null ? parseFloat(row.achieved_gps) : 0,
          production: row.act_prodn !== null ? parseFloat(row.act_prodn) : 0,
          waste: row.waste_percent !== null ? parseFloat(row.waste_percent) : 0,
          stoppage: row.total_stoppage_mins !== null ? parseInt(row.total_stoppage_mins) : 0
        }
      }
    })

    // Convert map to array and calculate totals
    const machineData = []
    let shiftTotals = {
      1: 0,
      2: 0,
      3: 0
    }

    machineMap.forEach((machine) => {
      const shift1 = machine.shifts[1]
      const shift2 = machine.shifts[2]
      const shift3 = machine.shifts[3]

      // Calculate totals for this machine
      const totalProduction = shift1.production + shift2.production + shift3.production
      
      // Calculate average waste (average of all 3 shifts, treating 0 as 0)
      const avgWaste = (shift1.waste + shift2.waste + shift3.waste) / 3

      // Total stoppage minutes
      const totalStoppage = shift1.stoppage + shift2.stoppage + shift3.stoppage

      // Calculate average achieved GPS (average of all 3 shifts)
      const avgAchievedGps = (shift1.achievedGps + shift2.achievedGps + shift3.achievedGps) / 3

      machineData.push({
        machineNo: machine.machineNo,
        sortOrder: machine.sortOrder,
        // Expected GPS
        expGpsShift1: shift1.expGps,
        expGpsShift2: shift2.expGps,
        expGpsShift3: shift3.expGps,
        // Achieved GPS
        achievedGpsShift1: shift1.achievedGps,
        achievedGpsShift2: shift2.achievedGps,
        achievedGpsShift3: shift3.achievedGps,
        // Production
        productionShift1: shift1.production,
        productionShift2: shift2.production,
        productionShift3: shift3.production,
        totalProduction: totalProduction,
        // Waste
        wasteShift1: shift1.waste,
        wasteShift2: shift2.waste,
        wasteShift3: shift3.waste,
        avgWaste: avgWaste,
        // Stoppage
        stoppageShift1: shift1.stoppage,
        stoppageShift2: shift2.stoppage,
        stoppageShift3: shift3.stoppage,
        totalStoppage: totalStoppage,
        // Final GPS (average of achieved GPS)
        finalGps: avgAchievedGps
      })

      // Add to shift totals
      shiftTotals[1] += shift1.production
      shiftTotals[2] += shift2.production
      shiftTotals[3] += shift3.production
    })

    // Sort by sort_order and machine_no
    machineData.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }
      // Natural sort for machine numbers (handles RF1, RF2, RF10, etc.)
      return a.machineNo.localeCompare(b.machineNo, undefined, { numeric: true })
    })

    const grandTotal = shiftTotals[1] + shiftTotals[2] + shiftTotals[3]

    return {
      success: true,
      data: {
        reportDate: dateStr,
        displayDate: formatDisplayDate(dateStr),
        machines: machineData,
        shiftTotals: {
          shift1: shiftTotals[1],
          shift2: shiftTotals[2],
          shift3: shiftTotals[3],
          grandTotal: grandTotal
        }
      }
    }
  } catch (error) {
    console.error('Error fetching spinning daily production report:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
