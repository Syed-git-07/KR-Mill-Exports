/**
 * Autoconer Count-wise Production Report Query
 *
 * Generates a report showing total production grouped by:
 *   - Date (all shifts summed together)
 *   - Count Name (e.g., "68 CS")
 *
 * Columns  : one per distinct count_name  +  Total
 * Rows     : one per date  +  Grand Total
 *
 * Source tables:
 *   autoconer_production_header   →  entry_date, shift
 *   autoconer_production_detail   →  count_name, act_prodn
 */

const { prisma } = require('../../../../../lib/prisma')

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
 * Get Autoconer Count-wise Production Report
 *
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate   - End date (defaults to fromDate)
 * @returns {Object}  { reportData, uniqueCounts, grandTotal, dateRange }
 */
async function getAutoconerCountWiseProductionReport(fromDate, toDate = null) {
  try {
    const endDate      = toDate || fromDate
    const startDateStr = normalizeDateString(fromDate)
    const endDateStr   = normalizeDateString(endDate)

    // ── Phase 1: Raw query ─────────────────────────────────────────────────
    // Sum act_prodn across ALL shifts for each (date, count_name) combination.
    const rawData = await prisma.$queryRaw`
      SELECT
        DATE_FORMAT(h.entry_date, '%d-%b-%y') AS date_display,
        h.entry_date                           AS raw_date,
        d.count_name,
        ROUND(SUM(d.act_prodn), 2)             AS production
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      WHERE h.entry_date BETWEEN ${startDateStr} AND ${endDateStr}
        AND d.count_name IS NOT NULL
        AND d.count_name != ''
      GROUP BY h.entry_date, d.count_name
      ORDER BY h.entry_date ASC, d.count_name ASC
    `

    // ── Phase 2: Unique counts (dynamic columns) ───────────────────────────
    const uniqueCounts = [...new Set(rawData.map(r => r.count_name))].sort()

    // ── Phase 3: Build report rows (one per date) ──────────────────────────
    const uniqueDateDisplays = [...new Set(rawData.map(r => r.date_display))]
    const reportData = []

    uniqueDateDisplays.forEach(dateDisplay => {
      const dateRows = rawData.filter(r => r.date_display === dateDisplay)

      const row = {
        dateDisplay,
        rawDate: dateRows[0].raw_date,
        counts: {},
        rowTotal: 0,
      }

      uniqueCounts.forEach(countName => {
        const match      = dateRows.find(r => r.count_name === countName)
        const production = match && match.production !== null
          ? parseFloat(match.production)
          : 0
        row.counts[countName] = production
        row.rowTotal          += production
      })

      reportData.push(row)
    })

    // ── Phase 4: Grand total ───────────────────────────────────────────────
    const grandTotal = { counts: {}, rowTotal: 0 }

    uniqueCounts.forEach(countName => {
      const total = rawData
        .filter(r => r.count_name === countName)
        .reduce((sum, r) => sum + (r.production !== null ? parseFloat(r.production) : 0), 0)
      grandTotal.counts[countName]  = parseFloat(total.toFixed(2))
      grandTotal.rowTotal           += parseFloat(total.toFixed(2))
    })
    grandTotal.rowTotal = parseFloat(grandTotal.rowTotal.toFixed(2))

    // ── Phase 5: Return ────────────────────────────────────────────────────
    return {
      reportData,
      uniqueCounts,
      grandTotal,
      dateRange: {
        from: new Date(startDateStr + 'T00:00:00').toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        }),
        to: new Date(endDateStr + 'T00:00:00').toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        }),
      },
    }
  } catch (error) {
    console.error('Error fetching autoconer count-wise production report:', error)
    throw error
  }
}

module.exports = { getAutoconerCountWiseProductionReport }
