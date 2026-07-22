/**
 * Autoconer Abstract Report Queries
 *
 * Generates the Autoconer Abstract Report for a selected date.
 *
 * Section 1 — Shift-wise (As on Date + Upto Date):
 *   Columns : SHIFT | PROD(KGS) | EFFI | RED Light | UTTI (repeated for upto date)
 *
 * Section 2 — Count-wise (As on Date + Upto Date):
 *   ON DATE  : CountName | Prodnkgs | Effi
 *   UP TO DATE: CountName | UProdnkgs | UEffi
 *
 * Formulas (from autoconer-formula.md):
 *   EFFI      = AVG( (run_time / work_time) × ((no_of_drums − idle_drum) / no_of_drums) × 100 )
 *               → "Adjusted UTI %" = Production Efficiency
 *   UTTI      = AVG( (run_time / work_time) × 100 )
 *               → Basic utilisation
 *   RED Light = AVG( red_light )  [red_light % already stored per machine]
 *   PROD(KGS) = SUM( act_prodn )
 *
 * "Upto Date" = cumulative from 1st of the month to the selected date.
 */

import { prisma } from '@/lib/prisma'

function normalizeDateString(dateString) {
  const d = new Date(dateString)
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** First calendar day of the month containing `dateStr` ("YYYY-MM-DD") */
function monthStartOf(dateStr) {
  const [year, month] = dateStr.split('-')
  return `${year}-${month}-01`
}

/**
 * getAutoconerAbstractReport
 *
 * @param {string|Date} date - The selected date ("as on" / "upto")
 * @returns {{ shiftData, total, uptoShiftData, uptoTotal, countOnDate, countUptoDate, displayDate }}
 */
async function getAutoconerAbstractReport(date) {
  try {
    const dateStr      = normalizeDateString(date)
    const monthStart   = monthStartOf(dateStr)

    // ─────────────────────────────────────────────────────────────────────
    // 1. Shift-wise — AS ON DATE
    // ─────────────────────────────────────────────────────────────────────
    const rawShift = await prisma.$queryRaw`
      SELECT
        h.shift,
        ROUND(SUM(d.act_prodn), 2)                                                   AS prod_kgs,
        ROUND(
          AVG(
            (d.run_time / d.work_time)
            * ((m.no_of_drums - d.idle_drum) / m.no_of_drums)
            * 100
          ), 2
        )                                                                             AS effi,
        ROUND(AVG(d.red_light), 2)                                                   AS red_light,
        ROUND(AVG((d.run_time / d.work_time) * 100), 2)                              AS utti
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      JOIN autoconer_machines          m ON m.id         = d.machine_id
      WHERE h.entry_date = ${dateStr}
        AND m.no_of_drums > 0
      GROUP BY h.shift
      ORDER BY h.shift
    `

    // ─────────────────────────────────────────────────────────────────────
    // 2. Shift-wise — UPTO DATE (month cumulative)
    // ─────────────────────────────────────────────────────────────────────
    const rawUpto = await prisma.$queryRaw`
      SELECT
        h.shift,
        ROUND(SUM(d.act_prodn), 2)                                                   AS prod_kgs,
        ROUND(
          AVG(
            (d.run_time / d.work_time)
            * ((m.no_of_drums - d.idle_drum) / m.no_of_drums)
            * 100
          ), 2
        )                                                                             AS effi,
        ROUND(AVG(d.red_light), 2)                                                   AS red_light,
        ROUND(AVG((d.run_time / d.work_time) * 100), 2)                              AS utti
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      JOIN autoconer_machines          m ON m.id         = d.machine_id
      WHERE h.entry_date BETWEEN ${monthStart} AND ${dateStr}
        AND m.no_of_drums > 0
      GROUP BY h.shift
      ORDER BY h.shift
    `

    // ─────────────────────────────────────────────────────────────────────
    // 3. Count-wise — AS ON DATE
    // ─────────────────────────────────────────────────────────────────────
    const rawCountOnDate = await prisma.$queryRaw`
      SELECT
        COALESCE(d.count_name, 'UNKNOWN')                                            AS count_name,
        ROUND(SUM(d.act_prodn), 2)                                                   AS prod_kgs,
        ROUND(
          (SUM(d.act_prodn) /
            NULLIF(
              SUM((m.no_of_drums - d.idle_drum) * d.run_time
                  / m.no_of_drums / d.work_time
                  * d.act_prodn / NULLIF(d.act_prodn, 0)),
              0
            )
          ) * 100, 2
        )                                                                             AS effi_raw,
        ROUND(
          AVG(
            (d.run_time / d.work_time)
            * ((m.no_of_drums - d.idle_drum) / m.no_of_drums)
            * 100
          ), 2
        )                                                                             AS effi
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      JOIN autoconer_machines          m ON m.id         = d.machine_id
      WHERE h.entry_date = ${dateStr}
        AND d.count_name IS NOT NULL
        AND d.count_name != ''
        AND m.no_of_drums > 0
      GROUP BY d.count_name
      ORDER BY d.count_name
    `

    // ─────────────────────────────────────────────────────────────────────
    // 4. Count-wise — UPTO DATE
    // ─────────────────────────────────────────────────────────────────────
    const rawCountUpto = await prisma.$queryRaw`
      SELECT
        COALESCE(d.count_name, 'UNKNOWN')                                            AS count_name,
        ROUND(SUM(d.act_prodn), 2)                                                   AS prod_kgs,
        ROUND(
          AVG(
            (d.run_time / d.work_time)
            * ((m.no_of_drums - d.idle_drum) / m.no_of_drums)
            * 100
          ), 2
        )                                                                             AS effi
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      JOIN autoconer_machines          m ON m.id         = d.machine_id
      WHERE h.entry_date BETWEEN ${monthStart} AND ${dateStr}
        AND d.count_name IS NOT NULL
        AND d.count_name != ''
        AND m.no_of_drums > 0
      GROUP BY d.count_name
      ORDER BY d.count_name
    `

    // ─────────────────────────────────────────────────────────────────────
    // 5. Build shift rows (1, 2, 3) — fill missing shifts with 0
    // ─────────────────────────────────────────────────────────────────────
    const buildShiftData = (raw) => {
      const rows = [1, 2, 3].map((shiftNo) => {
        const r = raw.find(x => Number(x.shift) === shiftNo)
        return {
          shift:     `${shiftNo}.00`,
          prod_kgs:  r ? parseFloat(r.prod_kgs)  : 0,
          effi:      r ? parseFloat(r.effi)       : 0,
          red_light: r ? parseFloat(r.red_light)  : 0,
          utti:      r ? parseFloat(r.utti)       : 0,
        }
      })
      return rows
    }

    const shiftData     = buildShiftData(rawShift)
    const uptoShiftData = buildShiftData(rawUpto)

    // ─────────────────────────────────────────────────────────────────────
    // 6. Compute TOTAL rows
    // ─────────────────────────────────────────────────────────────────────
    const computeTotal = (rows) => {
      const activeRows = rows.filter(r => r.prod_kgs > 0)
      const totalProd  = rows.reduce((s, r) => s + r.prod_kgs, 0)
      const avg        = (key) =>
        activeRows.length > 0
          ? activeRows.reduce((s, r) => s + r[key], 0) / activeRows.length
          : 0
      return {
        prod_kgs:  parseFloat(totalProd.toFixed(2)),
        effi:      parseFloat(avg('effi').toFixed(2)),
        red_light: parseFloat(avg('red_light').toFixed(2)),
        utti:      parseFloat(avg('utti').toFixed(2)),
      }
    }

    const total      = computeTotal(shiftData)
    const uptoTotal  = computeTotal(uptoShiftData)

    // ─────────────────────────────────────────────────────────────────────
    // 7. Count tables with TOTAL row
    // ─────────────────────────────────────────────────────────────────────
    const buildCountRows = (raw) =>
      raw.map(r => ({
        count_name: r.count_name,
        prod_kgs:   parseFloat(r.prod_kgs),
        effi:       parseFloat(r.effi),
      }))

    const addCountTotal = (rows) => {
      const totalProd = rows.reduce((s, r) => s + r.prod_kgs, 0)
      const avgEffi   = rows.length > 0
        ? rows.reduce((s, r) => s + r.effi, 0) / rows.length
        : 0
      return {
        count_name: 'Total',
        prod_kgs:   parseFloat(totalProd.toFixed(2)),
        effi:       parseFloat(avgEffi.toFixed(2)),
      }
    }

    const countOnDateRows   = buildCountRows(rawCountOnDate)
    const countUptoDateRows = buildCountRows(rawCountUpto)

    // ─────────────────────────────────────────────────────────────────────
    // 8. Format display date
    // ─────────────────────────────────────────────────────────────────────
    const displayDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).replace(/\//g, '-')

    return {
      success:        true,
      shiftData,
      total,
      uptoShiftData,
      uptoTotal,
      countOnDate:  { rows: countOnDateRows, total: addCountTotal(countOnDateRows) },
      countUptoDate: { rows: countUptoDateRows, total: addCountTotal(countUptoDateRows) },
      displayDate,
    }

  } catch (error) {
    console.error('Error fetching autoconer abstract report:', error)
    return { success: false, message: error.message }
  }
}

module.exports = { getAutoconerAbstractReport }
