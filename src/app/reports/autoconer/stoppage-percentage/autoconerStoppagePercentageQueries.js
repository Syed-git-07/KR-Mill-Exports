/**
 * Autoconer Stoppage Percentage Report Query
 *
 * Shows stoppage % grouped by category (stoppage head) and reason (stoppage detail),
 * broken down by shift (I, II, III) + average Total %.
 *
 * Formula:
 *   % per reason per shift =
 *     SUM(stoppage_time for that reason across all machines in shift)
 *     ──────────────────────────────────────────────────────────────── × 100
 *     SUM(run_time for all autoconer detail records in that shift)
 *
 *   Total % (per reason) = (S1% + S2% + S3%) / 3
 *   Category Total per shift = SUM of reason %s in category for that shift
 *   Net Total per shift      = SUM of all category totals for that shift
 *   Net Total %              = (Net S1% + Net S2% + Net S3%) / 3
 *
 * Supports a date range (From / To).
 *
 * Source tables:
 *   autoconer_production_header  →  entry_date, shift
 *   autoconer_production_detail  →  run_time (denominator)
 *   autoconer_stoppage_entry     →  stoppage1..4 _id / _time
 *   stoppage_details             →  short_code, stoppage_name, stoppage_head_id
 *   stoppage_heads               →  stoppage_head_name, code
 */

const { prisma } = require('../../../../../lib/prisma')

function normalizeDateString(dateString) {
  const d = new Date(dateString)
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get Autoconer Stoppage Percentage Report
 *
 * @param {string} fromDate  YYYY-MM-DD
 * @param {string} toDate    YYYY-MM-DD (optional, defaults to fromDate)
 * @returns {Object}  { reportData, netTotal, dateRange }
 */
async function getAutoconerStoppagePercentageReport(fromDate, toDate = null) {
  try {
    const endDate      = toDate || fromDate
    const startDateStr = normalizeDateString(fromDate)
    const endDateStr   = normalizeDateString(endDate)

    const startDateObj = new Date(startDateStr + 'T00:00:00.000Z')
    const endDateObj   = new Date(endDateStr   + 'T23:59:59.999Z')

    // ── Step 1: Headers for the date range ────────────────────────────────
    const headers = await prisma.autoconer_production_header.findMany({
      where: {
        entry_date: { gte: startDateObj, lte: endDateObj },
      },
    })

    if (!headers || headers.length === 0) {
      return {
        success: false,
        message: 'No autoconer production data found for the selected date range',
      }
    }

    // ── Step 2: Details for those headers ─────────────────────────────────
    const headerIds = headers.map(h => h.id)
    const details   = await prisma.autoconer_production_detail.findMany({
      where: { header_id: { in: headerIds } },
    })

    if (details.length === 0) {
      return {
        success: false,
        message: 'No production details found for the selected date range',
      }
    }

    // ── Step 3: Stoppage entries for those details ─────────────────────────
    const detailIds      = details.map(d => d.id)
    const stoppageEntries = await prisma.autoconer_stoppage_entry.findMany({
      where: { production_detail_id: { in: detailIds } },
    })

    // ── Step 4: Build lookup maps ──────────────────────────────────────────
    const headerMap = {}
    headers.forEach(h => { headerMap[h.id] = h })

    // ── Step 5: Total run_time per shift (denominator) ─────────────────────
    const totalRunTimePerShift = { 1: 0, 2: 0, 3: 0 }
    details.forEach(d => {
      const header = headerMap[d.header_id]
      if (!header) return
      const shift = header.shift
      if (shift >= 1 && shift <= 3) {
        totalRunTimePerShift[shift] += (d.run_time || 510)
      }
    })

    // ── Step 6: Stoppage time per (reason_id, shift) ──────────────────────
    // Maps reason_id → { 1: totalMins, 2: totalMins, 3: totalMins }
    const stoppageTimeMap = {}

    stoppageEntries.forEach(entry => {
      const detail = details.find(d => d.id === entry.production_detail_id)
      if (!detail) return
      const header = headerMap[detail.header_id]
      if (!header) return
      const shift = header.shift
      if (shift < 1 || shift > 3) return

      const slots = [
        { id: entry.stoppage1_id, time: entry.stoppage1_time },
        { id: entry.stoppage2_id, time: entry.stoppage2_time },
        { id: entry.stoppage3_id, time: entry.stoppage3_time },
        { id: entry.stoppage4_id, time: entry.stoppage4_time },
      ]

      slots.forEach(slot => {
        if (!slot.id || !slot.time || slot.time <= 0) return
        if (!stoppageTimeMap[slot.id]) stoppageTimeMap[slot.id] = { 1: 0, 2: 0, 3: 0 }
        stoppageTimeMap[slot.id][shift] += slot.time
      })
    })

    // ── Step 7: Stoppage heads and details (master lists) ─────────────────
    const stoppageHeads = await prisma.stoppage_heads.findMany({
      where:   { is_active: true },
      orderBy: { code: 'asc' },
    })

    const allStoppageDetails = await prisma.stoppage_details.findMany({
      where:   { is_active: true },
      orderBy: { code: 'asc' },
    })

    // ── Step 8: Build report data ──────────────────────────────────────────
    const reportData = []
    let   slNo        = 1

    stoppageHeads.forEach(head => {
      const headDetails = allStoppageDetails.filter(d => d.stoppage_head_id === head.id)

      // Only include details that actually have stoppage data in this date range
      const detailsWithData = headDetails.filter(d => {
        const t = stoppageTimeMap[d.id]
        return t && (t[1] > 0 || t[2] > 0 || t[3] > 0)
      })

      if (detailsWithData.length === 0) return

      // ── Helper: compute % for a reason in one shift ──────────────────
      const getPct = (reasonId, shift) => {
        const stopTime = stoppageTimeMap[reasonId]?.[shift] || 0
        const runTime  = totalRunTimePerShift[shift]
        if (runTime <= 0) return 0
        return (stopTime / runTime) * 100
      }

      // ── Build detail rows ─────────────────────────────────────────────
      const detailRows = detailsWithData.map(detail => {
        const s1 = getPct(detail.id, 1)
        const s2 = getPct(detail.id, 2)
        const s3 = getPct(detail.id, 3)
        const total = (s1 + s2 + s3) / 3

        return {
          slNo:       slNo++,
          code:       detail.short_code || '',
          reasonName: detail.stoppage_name,
          shifts: {
            1:     { percentage: parseFloat(s1.toFixed(2)) },
            2:     { percentage: parseFloat(s2.toFixed(2)) },
            3:     { percentage: parseFloat(s3.toFixed(2)) },
            total: { percentage: parseFloat(total.toFixed(2)) },
          },
        }
      })

      // ── Category subtotals (sum of reason %s per shift) ───────────────
      const catS1    = detailRows.reduce((acc, r) => acc + r.shifts[1].percentage, 0)
      const catS2    = detailRows.reduce((acc, r) => acc + r.shifts[2].percentage, 0)
      const catS3    = detailRows.reduce((acc, r) => acc + r.shifts[3].percentage, 0)
      const catTotal = (catS1 + catS2 + catS3) / 3

      reportData.push({
        headName: head.stoppage_head_name,
        code:     head.code,
        shifts: {
          1:     { percentage: parseFloat(catS1.toFixed(2)) },
          2:     { percentage: parseFloat(catS2.toFixed(2)) },
          3:     { percentage: parseFloat(catS3.toFixed(2)) },
          total: { percentage: parseFloat(catTotal.toFixed(2)) },
        },
        details: detailRows,
      })
    })

    if (reportData.length === 0) {
      return {
        success: false,
        message: 'No stoppage data found for the selected date range',
      }
    }

    // ── Step 9: Net Total row (sum of category subtotals per shift) ────────
    const netS1    = reportData.reduce((acc, h) => acc + h.shifts[1].percentage, 0)
    const netS2    = reportData.reduce((acc, h) => acc + h.shifts[2].percentage, 0)
    const netS3    = reportData.reduce((acc, h) => acc + h.shifts[3].percentage, 0)
    const netTotal = {
      1:     { percentage: parseFloat(netS1.toFixed(2)) },
      2:     { percentage: parseFloat(netS2.toFixed(2)) },
      3:     { percentage: parseFloat(netS3.toFixed(2)) },
      total: { percentage: parseFloat(((netS1 + netS2 + netS3) / 3).toFixed(2)) },
    }

    // ── Step 10: Return ────────────────────────────────────────────────────
    return {
      success: true,
      reportData,
      netTotal,
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
    console.error('Error fetching autoconer stoppage percentage report:', error)
    throw error
  }
}

module.exports = { getAutoconerStoppagePercentageReport }
