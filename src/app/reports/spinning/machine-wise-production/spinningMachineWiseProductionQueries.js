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
        ROUND(
          CASE WHEN SUM(COALESCE(d.worked_spindles, 0)) > 0
            THEN SUM(COALESCE(d.exp_gps, 0) * COALESCE(d.worked_spindles, 0))
              / SUM(COALESCE(d.worked_spindles, 0))
            ELSE AVG(COALESCE(d.exp_gps, 0))
          END,
          2
        ) AS expected_gps,
        ROUND(
          CASE WHEN SUM(COALESCE(d.worked_spindles, 0)) > 0
            THEN SUM(COALESCE(d.act_prodn, 0))
              / SUM(COALESCE(d.worked_spindles, 0)) * 1000
            ELSE 0
          END,
          2
        ) AS achieved_gps,
        SUM(COALESCE(d.act_prodn, 0)) AS production,
        SUM(COALESCE(d.worked_spindles, 0)) AS worked_spindles
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
        production: Number(row?.production) || 0,
        workedSpindles: Number(row?.worked_spindles) || 0,
      }
    }

    const combineGps = values => {
      const workedSpindles = values.reduce((sum, value) => sum + value.workedSpindles, 0)
      const production = values.reduce((sum, value) => sum + value.production, 0)
      return {
        std: workedSpindles > 0
          ? values.reduce((sum, value) => sum + value.std * value.workedSpindles, 0) / workedSpindles
          : 0,
        act: workedSpindles > 0 ? production / workedSpindles * 1000 : 0,
        production,
        workedSpindles
      }
    }

    const machines = allMachines.map(machine => {
      const s1 = getShiftData(machine.machine_no, 1)
      const s2 = getShiftData(machine.machine_no, 2)
      const s3 = getShiftData(machine.machine_no, 3)

      const total = Number(combineGps([s1, s2, s3]).act.toFixed(2))

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
    const totalShift1 = combineGps(machines.map(machine => machine.shift1))
    const totalShift2 = combineGps(machines.map(machine => machine.shift2))
    const totalShift3 = combineGps(machines.map(machine => machine.shift3))
    const allShifts = combineGps([totalShift1, totalShift2, totalShift3])

    const totals = {
      shift1: {
        std: Number(totalShift1.std.toFixed(2)),
        act: Number(totalShift1.act.toFixed(2)),
      },
      shift2: {
        std: Number(totalShift2.std.toFixed(2)),
        act: Number(totalShift2.act.toFixed(2)),
      },
      shift3: {
        std: Number(totalShift3.std.toFixed(2)),
        act: Number(totalShift3.act.toFixed(2)),
      },
      total: Number(allShifts.act.toFixed(2)),
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
