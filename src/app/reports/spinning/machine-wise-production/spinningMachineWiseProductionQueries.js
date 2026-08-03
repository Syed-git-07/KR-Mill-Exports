/**
 * Spinning Machine-wise Production Report Query
 *
 * Generates a report showing GPS (Grams Per Spindle) per machine, per shift:
 *   - Columns  : McName | SHIFT-1 (Exp/Ach) | SHIFT-2 (Exp/Ach) | SHIFT-3 (Exp/Ach) | Total
 *   - Rows     : one per active spinning machine (49 machines) + TOTAL row
 *   - Total col: average achieved GPS across shifts that have production rows
 *   - TOTAL row: average across machines that have data in each column
 *
 * Source tables:
 *   spinning_production_header  →  entry_date, shift
 *   spinning_production_detail  →  exp_gps (Expected G.P.S), gps (Achieved G.P.S)
 *   spinning_machines           →  machine_no, sort_order, is_active
 */

import { prisma } from '@/lib/prisma'
import { averagePresent } from '@/lib/reportMath'

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
      SELECT id, machine_no, sort_order
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
        m.id AS machine_id,
        m.sort_order,
        h.shift,
        ROUND(AVG(d.exp_gps), 2) AS expected_gps,   -- Exp. G.P.S (Std.)
        ROUND(AVG(d.gps),     2) AS achieved_gps    -- Ach. G.P.S (Act.)
      FROM spinning_production_header h
      JOIN spinning_production_detail d ON d.header_id = h.id
      JOIN spinning_machines m           ON d.machine_id = m.id
      WHERE h.entry_date BETWEEN ${startDateStr} AND ${endDateStr}
      GROUP BY m.id, m.machine_no, m.sort_order, h.shift
      ORDER BY m.sort_order ASC, m.machine_no ASC, h.shift ASC
    `

    // ── Step 3: Build machines array (one per active machine) ──────────────
    const getShiftData = (machineId, shift) => {
      const row = rawData.find(
        r => r.machine_id === machineId && Number(r.shift) === shift
      )
      return {
        present: Boolean(row),
        std: row && row.expected_gps  !== null ? parseFloat(row.expected_gps)  : 0,
        act: row && row.achieved_gps  !== null ? parseFloat(row.achieved_gps) : 0,
      }
    }

    const machines = allMachines.map(machine => {
      const s1 = getShiftData(machine.id, 1)
      const s2 = getShiftData(machine.id, 2)
      const s3 = getShiftData(machine.id, 3)

      const total = parseFloat(averagePresent([
        s1.present ? s1.act : null,
        s2.present ? s2.act : null,
        s3.present ? s3.act : null,
      ]).toFixed(2))

      return {
        machineId:  machine.id,
        machineNo:  machine.machine_no,
        sortOrder:  Number(machine.sort_order) || 0,
        shift1: s1,
        shift2: s2,
        shift3: s3,
        total,
      }
    })

    // ── Step 4: Calculate TOTAL row (column averages across all machines) ──
    // Missing lifecycle/shift rows are excluded; an explicit 0.00 remains a
    // real observation and is included.
    const colAvg = (vals) => {
      return parseFloat(averagePresent(vals).toFixed(2))
    }

    const shiftTotals = {
      shift1: {
        std: colAvg(machines.map(m => m.shift1.present ? m.shift1.std : null)),
        act: colAvg(machines.map(m => m.shift1.present ? m.shift1.act : null)),
      },
      shift2: {
        std: colAvg(machines.map(m => m.shift2.present ? m.shift2.std : null)),
        act: colAvg(machines.map(m => m.shift2.present ? m.shift2.act : null)),
      },
      shift3: {
        std: colAvg(machines.map(m => m.shift3.present ? m.shift3.std : null)),
        act: colAvg(machines.map(m => m.shift3.present ? m.shift3.act : null)),
      },
    }

    const totals = {
      ...shiftTotals,
      total: parseFloat(averagePresent([
        machines.some(m => m.shift1.present) ? shiftTotals.shift1.act : null,
        machines.some(m => m.shift2.present) ? shiftTotals.shift2.act : null,
        machines.some(m => m.shift3.present) ? shiftTotals.shift3.act : null,
      ]).toFixed(2)),
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
