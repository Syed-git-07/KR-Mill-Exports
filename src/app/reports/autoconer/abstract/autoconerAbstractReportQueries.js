/**
 * Autoconer Abstract Report Queries
 *
 * Production efficiency is the manual value stored on each production entry.
 * It is production-weighted when several rows are combined. Utilization is
 * aggregate work time / aggregate run time, red light is averaged per detail,
 * and production is summed. "Upto Date" is month-to-date.
 */

import { prisma } from '@/lib/prisma'

function normalizeDateString(dateValue) {
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) throw new Error('A valid report date is required')
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function monthStartOf(dateStr) {
  const [year, month] = dateStr.split('-')
  return `${year}-${month}-01`
}

async function getAutoconerAbstractReport(date) {
  try {
    const dateStr = normalizeDateString(date)
    const monthStart = monthStartOf(dateStr)

    const rawShift = await prisma.$queryRaw`
      SELECT
        h.shift,
        ROUND(SUM(COALESCE(d.act_prodn, 0)), 2) AS prod_kgs,
        ROUND(
          CASE
            WHEN SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) > 0
              THEN SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0))
                / SUM(GREATEST(COALESCE(d.act_prodn, 0), 0))
            ELSE AVG(COALESCE(d.prodn_effi, 0))
          END,
          2
        ) AS effi,
        ROUND(AVG(COALESCE(d.red_light, 0)), 2) AS red_light,
        ROUND(
          SUM(COALESCE(d.work_time, 0))
            / NULLIF(SUM(COALESCE(d.run_time, 0)), 0) * 100,
          2
        ) AS utti,
        SUM(COALESCE(d.work_time, 0)) AS work_time,
        SUM(COALESCE(d.run_time, 0)) AS run_time,
        SUM(COALESCE(d.red_light, 0)) AS red_sum,
        SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weighted,
        SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weight,
        SUM(COALESCE(d.prodn_effi, 0)) AS effi_sum,
        COUNT(*) AS detail_count
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      WHERE h.entry_date = ${dateStr}
      GROUP BY h.shift
      ORDER BY h.shift
    `

    const rawUpto = await prisma.$queryRaw`
      SELECT
        h.shift,
        ROUND(SUM(COALESCE(d.act_prodn, 0)), 2) AS prod_kgs,
        ROUND(
          CASE
            WHEN SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) > 0
              THEN SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0))
                / SUM(GREATEST(COALESCE(d.act_prodn, 0), 0))
            ELSE AVG(COALESCE(d.prodn_effi, 0))
          END,
          2
        ) AS effi,
        ROUND(AVG(COALESCE(d.red_light, 0)), 2) AS red_light,
        ROUND(
          SUM(COALESCE(d.work_time, 0))
            / NULLIF(SUM(COALESCE(d.run_time, 0)), 0) * 100,
          2
        ) AS utti,
        SUM(COALESCE(d.work_time, 0)) AS work_time,
        SUM(COALESCE(d.run_time, 0)) AS run_time,
        SUM(COALESCE(d.red_light, 0)) AS red_sum,
        SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weighted,
        SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weight,
        SUM(COALESCE(d.prodn_effi, 0)) AS effi_sum,
        COUNT(*) AS detail_count
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      WHERE h.entry_date BETWEEN ${monthStart} AND ${dateStr}
      GROUP BY h.shift
      ORDER BY h.shift
    `

    const rawCountOnDate = await prisma.$queryRaw`
      SELECT
        d.count_name,
        ROUND(SUM(COALESCE(d.act_prodn, 0)), 2) AS prod_kgs,
        ROUND(
          CASE
            WHEN SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) > 0
              THEN SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0))
                / SUM(GREATEST(COALESCE(d.act_prodn, 0), 0))
            ELSE AVG(COALESCE(d.prodn_effi, 0))
          END,
          2
        ) AS effi,
        SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weighted,
        SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weight,
        SUM(COALESCE(d.prodn_effi, 0)) AS effi_sum,
        COUNT(*) AS detail_count
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      WHERE h.entry_date = ${dateStr}
        AND d.count_name IS NOT NULL
        AND d.count_name != ''
      GROUP BY d.count_name
      ORDER BY d.count_name
    `

    const rawCountUpto = await prisma.$queryRaw`
      SELECT
        d.count_name,
        ROUND(SUM(COALESCE(d.act_prodn, 0)), 2) AS prod_kgs,
        ROUND(
          CASE
            WHEN SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) > 0
              THEN SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0))
                / SUM(GREATEST(COALESCE(d.act_prodn, 0), 0))
            ELSE AVG(COALESCE(d.prodn_effi, 0))
          END,
          2
        ) AS effi,
        SUM(COALESCE(d.prodn_effi, 0) * GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weighted,
        SUM(GREATEST(COALESCE(d.act_prodn, 0), 0)) AS effi_weight,
        SUM(COALESCE(d.prodn_effi, 0)) AS effi_sum,
        COUNT(*) AS detail_count
      FROM autoconer_production_header h
      JOIN autoconer_production_detail d ON d.header_id = h.id
      WHERE h.entry_date BETWEEN ${monthStart} AND ${dateStr}
        AND d.count_name IS NOT NULL
        AND d.count_name != ''
      GROUP BY d.count_name
      ORDER BY d.count_name
    `

    const buildShiftData = raw => [1, 2, 3].map(shiftNo => {
      const row = raw.find(item => Number(item.shift) === shiftNo)
      return {
        shift: `${shiftNo}.00`,
        prod_kgs: Number(row?.prod_kgs) || 0,
        effi: Number(row?.effi) || 0,
        red_light: Number(row?.red_light) || 0,
        utti: Number(row?.utti) || 0,
        work_time: Number(row?.work_time) || 0,
        run_time: Number(row?.run_time) || 0,
        red_sum: Number(row?.red_sum) || 0,
        effi_weighted: Number(row?.effi_weighted) || 0,
        effi_weight: Number(row?.effi_weight) || 0,
        effi_sum: Number(row?.effi_sum) || 0,
        detail_count: Number(row?.detail_count) || 0
      }
    })

    const computeTotal = rows => {
      const production = rows.reduce((sum, row) => sum + row.prod_kgs, 0)
      const efficiencyWeight = rows.reduce((sum, row) => sum + row.effi_weight, 0)
      const detailCount = rows.reduce((sum, row) => sum + row.detail_count, 0)
      const workTime = rows.reduce((sum, row) => sum + row.work_time, 0)
      const runTime = rows.reduce((sum, row) => sum + row.run_time, 0)
      const efficiency = efficiencyWeight > 0
        ? rows.reduce((sum, row) => sum + row.effi_weighted, 0) / efficiencyWeight
        : detailCount > 0 ? rows.reduce((sum, row) => sum + row.effi_sum, 0) / detailCount : 0

      return {
        prod_kgs: Number(production.toFixed(2)),
        effi: Number(efficiency.toFixed(2)),
        red_light: Number((detailCount > 0
          ? rows.reduce((sum, row) => sum + row.red_sum, 0) / detailCount
          : 0).toFixed(2)),
        utti: Number((runTime > 0 ? workTime / runTime * 100 : 0).toFixed(2))
      }
    }

    const buildCountRows = raw => raw.map(row => ({
      count_name: row.count_name,
      prod_kgs: Number(row.prod_kgs) || 0,
      effi: Number(row.effi) || 0,
      effi_weighted: Number(row.effi_weighted) || 0,
      effi_weight: Number(row.effi_weight) || 0,
      effi_sum: Number(row.effi_sum) || 0,
      detail_count: Number(row.detail_count) || 0
    }))

    const addCountTotal = rows => {
      const production = rows.reduce((sum, row) => sum + row.prod_kgs, 0)
      const efficiencyWeight = rows.reduce((sum, row) => sum + row.effi_weight, 0)
      const detailCount = rows.reduce((sum, row) => sum + row.detail_count, 0)
      const efficiency = efficiencyWeight > 0
        ? rows.reduce((sum, row) => sum + row.effi_weighted, 0) / efficiencyWeight
        : detailCount > 0 ? rows.reduce((sum, row) => sum + row.effi_sum, 0) / detailCount : 0
      return {
        count_name: 'Total',
        prod_kgs: Number(production.toFixed(2)),
        effi: Number(efficiency.toFixed(2))
      }
    }

    const shiftData = buildShiftData(rawShift)
    const uptoShiftData = buildShiftData(rawUpto)
    const countOnDateRows = buildCountRows(rawCountOnDate)
    const countUptoDateRows = buildCountRows(rawCountUpto)
    const displayDate = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '-')

    return {
      success: true,
      shiftData,
      total: computeTotal(shiftData),
      uptoShiftData,
      uptoTotal: computeTotal(uptoShiftData),
      countOnDate: { rows: countOnDateRows, total: addCountTotal(countOnDateRows) },
      countUptoDate: { rows: countUptoDateRows, total: addCountTotal(countUptoDateRows) },
      displayDate
    }
  } catch (error) {
    console.error('Error fetching autoconer abstract report:', error)
    return { success: false, message: 'The report could not be generated. Please try again.' }
  }
}

module.exports = { getAutoconerAbstractReport }
