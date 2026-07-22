/**
 * Spinning Machine-wise Production Report Query
 *
 * Generates a report showing GPS (Grams Per Spindle) per machine, per shift:
 *   - Columns  : McName | SHIFT-1 (Exp/Ach) | SHIFT-2 (Exp/Ach) | SHIFT-3 (Exp/Ach) | Total
 *   - Rows     : one per active spinning machine (49 machines) + TOTAL row
 *   - Total col: (AchGPS_S1 + AchGPS_S2 + AchGPS_S3) / 3
 *   - TOTAL row: average across all machines per column
 *
 * Source tables:
 *   spinning_production_header  →  entry_date, shift
 *   spinning_production_detail  →  exp_gps (Expected G.P.S), gps (Achieved G.P.S)
 *   spinning_machines           →  machine_no, sort_order, is_active
 */

import { prisma } from '@/lib/prisma'

/**
 * Normalise a date string to local YYYY-MM-DD (avoids UTC-offset issues).
 */
function normalizeDateString(dateString) {
  const d = new Date(dateString)
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get Spinning Machine-wise Production Report
 *
 * @param {Date|string} fromDate  - Start date
 * @param {Date|string} toDate    - End date (defaults to fromDate)
 * @returns {Object}  { machines, totals, dateRange }
 */
async function getSpinningMachineWiseProductionReport(fromDate, toDate = null) {
  try {
    const endDate      = toDate || fromDate
    const startDateStr = normalizeDateString(fromDate)
    const endDateStr   = normalizeDateString(endDate)

    // ── Step 1: All machines active during the requested date range ──────────
    const allMachines = await prisma.$queryRaw`
      SELECT machine_no, sort_order
      FROM   spinning_machines
      WHERE  COALESCE(activated_at, '2000-01-01') <= ${endDateStr}
        AND  (deactivated_at IS NULL OR deactivated_at > ${startDateStr})
      ORDER  BY sort_order ASC, machine_no ASC
    `

    // ── Step 2: GPS data grouped by machine + shift ────────────────────────
    // For multi-day range, AVG() averages across all days in range per machine×shift
    const rawData = await prisma.$queryRaw`
      SELECT
        m.machine_no,
        m.sort_order,
        h.shift,
        ROUND(AVG(d.exp_gps), 2) AS expected_gps,   -- Exp. G.P.S (Std.)
        ROUND(AVG(d.gps),     2) AS achieved_gps    -- Ach. G.P.S (Act.)
      FROM spinning_production_header h
      JOIN spinning_production_detail d ON d.header_id = h.id
      JOIN spinning_machines m           ON d.machine_id = m.id
      WHERE h.entry_date BETWEEN ${startDateStr} AND ${endDateStr}
      GROUP BY m.machine_no, m.sort_order, h.shift
      ORDER BY m.sort_order ASC, m.machine_no ASC, h.shift ASC
    `

    // ── Step 3: Build machines array (one per active machine) ──────────────
    const getShiftData = (machineName, shift) => {
      const row = rawData.find(
        r => r.machine_no === machineName && Number(r.shift) === shift
      )
      return {
        std: row && row.expected_gps  !== null ? parseFloat(row.expected_gps)  : 0,
        act: row && row.achieved_gps  !== null ? parseFloat(row.achieved_gps) : 0,
      }
    }

    const machines = allMachines.map(machine => {
      const s1 = getShiftData(machine.machine_no, 1)
      const s2 = getShiftData(machine.machine_no, 2)
      const s3 = getShiftData(machine.machine_no, 3)

      // Total = (Ach S1 + Ach S2 + Ach S3) / 3
      const total = parseFloat(((s1.act + s2.act + s3.act) / 3).toFixed(2))

      return {
        machineNo:  machine.machine_no,
        sortOrder:  Number(machine.sort_order) || 0,
        shift1: s1,
        shift2: s2,
        shift3: s3,
        total,
      }
    })

    // ── Step 4: Calculate TOTAL row (column averages across all machines) ──
    // Uses simple average over all machines including idle ones (which show 0.00)
    const colAvg = (vals) => {
      if (vals.length === 0) return 0
      return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
    }

    const totals = {
      shift1: {
        std: colAvg(machines.map(m => m.shift1.std)),
        act: colAvg(machines.map(m => m.shift1.act)),
      },
      shift2: {
        std: colAvg(machines.map(m => m.shift2.std)),
        act: colAvg(machines.map(m => m.shift2.act)),
      },
      shift3: {
        std: colAvg(machines.map(m => m.shift3.std)),
        act: colAvg(machines.map(m => m.shift3.act)),
      },
      total: parseFloat(
        (
          (
            colAvg(machines.map(m => m.shift1.act)) +
            colAvg(machines.map(m => m.shift2.act)) +
            colAvg(machines.map(m => m.shift3.act))
          ) / 3
        ).toFixed(2)
      ),
    }

    // ── Step 5: Return ─────────────────────────────────────────────────────
    return {
      machines,
      totals,
      dateRange: {
        from: new Date(startDateStr + 'T00:00:00').toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
        to: new Date(endDateStr + 'T00:00:00').toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
      },
    }
  } catch (error) {
    console.error('Error fetching spinning machine-wise production report:', error)
    throw error
  }
}

module.exports = { getSpinningMachineWiseProductionReport }
