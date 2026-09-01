import { prisma } from '@/lib/prisma'

function formatDateForQuery(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('A valid report date is required')
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function previousMonthComparableDate(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const previousMonthLastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(date.getDate(), previousMonthLastDay))
}

function monthStart(dateString) {
  return `${dateString.slice(0, 7)}-01`
}

const number = value => Number(value) || 0

async function fetchPeriodRows(fromDate, toDate) {
  return prisma.$queryRaw`
    SELECT
      h.shift,
      SUM(COALESCE(d.act_prodn, 0)) AS production,
      SUM(COALESCE(d.waste, 0)) AS waste,
      SUM(COALESCE(d.work_time, 0)) AS work_time,
      SUM(COALESCE(d.run_time, 0)) AS run_time,
      SUM(COALESCE(d.worked_spindles, 0)) AS worked_spindles,
      SUM(COALESCE(se.total_stoppage_time, d.total_stoppage_mins, 0)) AS stoppage,
      SUM(COALESCE(d.act_prodn, 0) * COALESCE(sms.conv_40s_value, 0)) AS converted_production,
      SUM(COALESCE(sms.act_count, 0) * COALESCE(d.worked_spindles, 0)) AS count_weighted,
      SUM(COALESCE(sms.act_count, 0)) AS count_sum,
      COUNT(*) AS detail_count
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON d.header_id = h.id
    LEFT JOIN spinning_machine_setup sms
      ON sms.machine_id = d.machine_id
      AND sms.entry_date = h.entry_date
      AND sms.shift = h.shift
      AND sms.run_sequence = d.run_sequence
    LEFT JOIN spinning_stoppage_entry se ON se.production_detail_id = d.id
    WHERE h.entry_date BETWEEN ${fromDate} AND ${toDate}
    GROUP BY h.shift
    ORDER BY h.shift
  `
}

function normalizePeriodRow(row) {
  return {
    shift: number(row.shift),
    production: number(row.production),
    waste: number(row.waste),
    workTime: number(row.work_time),
    runTime: number(row.run_time),
    workedSpindles: number(row.worked_spindles),
    stoppage: number(row.stoppage),
    convertedProduction: number(row.converted_production),
    countWeighted: number(row.count_weighted),
    countSum: number(row.count_sum),
    detailCount: number(row.detail_count)
  }
}

function aggregatePeriod(rows) {
  const normalized = rows.map(normalizePeriodRow)
  const totals = normalized.reduce((result, row) => {
    result.production += row.production
    result.waste += row.waste
    result.workTime += row.workTime
    result.runTime += row.runTime
    result.workedSpindles += row.workedSpindles
    result.stoppage += row.stoppage
    result.convertedProduction += row.convertedProduction
    result.countWeighted += row.countWeighted
    result.countSum += row.countSum
    result.detailCount += row.detailCount
    return result
  }, {
    production: 0,
    waste: 0,
    workTime: 0,
    runTime: 0,
    workedSpindles: 0,
    stoppage: 0,
    convertedProduction: 0,
    countWeighted: 0,
    countSum: 0,
    detailCount: 0
  })

  return {
    ...totals,
    utilization: totals.runTime > 0 ? totals.workTime / totals.runTime * 100 : 0,
    wastePercent: totals.production > 0 ? totals.waste / totals.production * 100 : 0,
    convertedGps: totals.workedSpindles > 0
      ? totals.convertedProduction / totals.workedSpindles * 1000
      : 0,
    averageCount: totals.workedSpindles > 0
      ? totals.countWeighted / totals.workedSpindles
      : totals.detailCount > 0 ? totals.countSum / totals.detailCount : 0
  }
}

function shiftValue(rows, shift, field) {
  return normalizePeriodRow(rows.find(row => number(row.shift) === shift) || {})[field]
}

function shiftRatio(rows, shift, numerator, denominator, multiplier = 1) {
  const row = normalizePeriodRow(rows.find(item => number(item.shift) === shift) || {})
  return row[denominator] > 0 ? row[numerator] / row[denominator] * multiplier : 0
}

function currentDayMetric(rows, field, totalField = field) {
  const total = aggregatePeriod(rows)
  return {
    shift1: shiftValue(rows, 1, field),
    shift2: shiftValue(rows, 2, field),
    shift3: shiftValue(rows, 3, field),
    total: total[totalField]
  }
}

function currentDayRatio(rows, numerator, denominator, totalKey, multiplier = 1) {
  const total = aggregatePeriod(rows)
  return {
    shift1: shiftRatio(rows, 1, numerator, denominator, multiplier),
    shift2: shiftRatio(rows, 2, numerator, denominator, multiplier),
    shift3: shiftRatio(rows, 3, numerator, denominator, multiplier),
    [totalKey]: total[denominator] > 0 ? total[numerator] / total[denominator] * multiplier : 0
  }
}

export async function fetchSpinningAbstractSummary(reportDate) {
  const dateStr = formatDateForQuery(reportDate)
  const rawData = await prisma.$queryRaw`
    SELECT
      COALESCE(d.count_name, 'UNSPECIFIED') AS count_name,
      h.shift,
      COUNT(DISTINCT d.machine_id) AS machine_count,
      SUM(
        COALESCE(sms.allocated_spindles, 0)
        * LEAST(
            COALESCE(d.run_time, CASE WHEN h.shift = 3 THEN 420 ELSE 510 END),
            CASE WHEN h.shift = 3 THEN 420 ELSE 510 END
          )
        / (CASE WHEN h.shift = 3 THEN 420 ELSE 510 END)
      ) AS equivalent_spindles,
      SUM(COALESCE(d.act_prodn, 0)) AS production,
      SUM(COALESCE(d.waste, 0)) AS waste,
      SUM(COALESCE(d.work_time, 0)) AS work_time,
      SUM(COALESCE(d.run_time, 0)) AS run_time,
      SUM(COALESCE(d.worked_spindles, 0)) AS worked_spindles,
      SUM(COALESCE(d.exp_gps, 0) * COALESCE(d.worked_spindles, 0)) AS expected_gps_weighted,
      SUM(COALESCE(d.act_prodn, 0) * COALESCE(sms.conv_40s_value, 0)) AS converted_production
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON d.header_id = h.id
    LEFT JOIN spinning_machine_setup sms
      ON sms.machine_id = d.machine_id
      AND sms.entry_date = h.entry_date
      AND sms.shift = h.shift
      AND sms.run_sequence = d.run_sequence
    WHERE h.entry_date = ${dateStr}
    GROUP BY COALESCE(d.count_name, 'UNSPECIFIED'), h.shift
    ORDER BY COALESCE(d.count_name, 'UNSPECIFIED'), h.shift
  `

  const groups = new Map()
  for (const raw of rawData) {
    const countName = raw.count_name
    if (!groups.has(countName)) groups.set(countName, [])
    groups.get(countName).push({
      shift: number(raw.shift),
      machineCount: number(raw.machine_count),
      equivalentSpindles: number(raw.equivalent_spindles),
      production: number(raw.production),
      waste: number(raw.waste),
      workTime: number(raw.work_time),
      runTime: number(raw.run_time),
      workedSpindles: number(raw.worked_spindles),
      expectedGpsWeighted: number(raw.expected_gps_weighted),
      convertedProduction: number(raw.converted_production)
    })
  }

  const summaryData = [...groups.entries()].map(([countName, shifts]) => {
    const productionKg = shifts.reduce((sum, row) => sum + row.production, 0)
    const production40s = shifts.reduce((sum, row) => sum + row.convertedProduction, 0)
    const wasteKg = shifts.reduce((sum, row) => sum + row.waste, 0)
    const workTime = shifts.reduce((sum, row) => sum + row.workTime, 0)
    const runTime = shifts.reduce((sum, row) => sum + row.runTime, 0)
    const workedSpindles = shifts.reduce((sum, row) => sum + row.workedSpindles, 0)
    const shiftGps = shifts.filter(row => row.workedSpindles > 0).map(row => ({
      expected: row.expectedGpsWeighted / row.workedSpindles,
      achieved: row.production / row.workedSpindles * 1000
    }))
    const gpsStd = shiftGps.length
      ? shiftGps.reduce((sum, row) => sum + row.expected, 0) / shiftGps.length
      : 0
    const gpsAchieved = shiftGps.length
      ? shiftGps.reduce((sum, row) => sum + row.achieved, 0) / shiftGps.length
      : 0

    return {
      countName,
      machineCount: Math.max(0, ...shifts.map(row => row.machineCount)),
      totalSpindles: Math.max(0, ...shifts.map(row => row.equivalentSpindles)),
      productionKg,
      production40s,
      gpsStd,
      gpsAchieved,
      gps40s: workedSpindles > 0 ? production40s / workedSpindles * 1000 : 0,
      wasteKg,
      wastePercent: productionKg > 0 ? wasteKg / productionKg * 100 : 0,
      utilizationPercent: runTime > 0 ? workTime / runTime * 100 : 0,
      gainLoss: gpsAchieved > 0 ? (productionKg * (gpsAchieved - gpsStd)) / gpsAchieved : 0
    }
  })

  const grandTotal = summaryData.reduce((total, row) => {
    total.machineCount += row.machineCount
    total.totalSpindles += row.totalSpindles
    total.productionKg += row.productionKg
    total.wasteKg += row.wasteKg
    return total
  }, { machineCount: 0, totalSpindles: 0, productionKg: 0, wasteKg: 0 })

  return { date: dateStr, summaryData, grandTotal }
}

export async function fetchSpinningAbstractTableData(reportDate) {
  const dateStr = formatDateForQuery(reportDate)
  const selectedDate = new Date(`${dateStr}T00:00:00`)
  const lastMonthDateStr = formatDateForQuery(previousMonthComparableDate(selectedDate))

  const [currentDayRows, lastMonthDayRows, currentMonthRows, lastMonthRows] = await Promise.all([
    fetchPeriodRows(dateStr, dateStr),
    fetchPeriodRows(lastMonthDateStr, lastMonthDateStr),
    fetchPeriodRows(monthStart(dateStr), dateStr),
    fetchPeriodRows(monthStart(lastMonthDateStr), lastMonthDateStr)
  ])

  const current = aggregatePeriod(currentDayRows)
  const lastDay = aggregatePeriod(lastMonthDayRows)
  const currentMonth = aggregatePeriod(currentMonthRows)
  const lastMonth = aggregatePeriod(lastMonthRows)
  const unavailableMetric = {
    currentMonthToday: { shift1: null, shift2: null, shift3: null, total: null },
    lastMonthSameDate: null,
    currentMonthUptoDate: null,
    lastMonthUptoDate: null
  }

  return {
    totalProduction: {
      currentMonthToday: currentDayMetric(currentDayRows, 'production'),
      lastMonthSameDate: lastDay.production,
      currentMonthUptoDate: currentMonth.production,
      lastMonthUptoDate: lastMonth.production
    },
    avgUtilization: {
      currentMonthToday: currentDayRatio(currentDayRows, 'workTime', 'runTime', 'average', 100),
      lastMonthSameDate: lastDay.utilization,
      currentMonthUptoDate: currentMonth.utilization,
      lastMonthUptoDate: lastMonth.utilization
    },
    workedSpindles: {
      currentMonthToday: currentDayMetric(currentDayRows, 'workedSpindles'),
      lastMonthSameDate: lastDay.workedSpindles,
      currentMonthUptoDate: currentMonth.workedSpindles,
      lastMonthUptoDate: lastMonth.workedSpindles
    },
    convertedProduction40s: {
      currentMonthToday: currentDayMetric(currentDayRows, 'convertedProduction'),
      lastMonthSameDate: lastDay.convertedProduction,
      currentMonthUptoDate: currentMonth.convertedProduction,
      lastMonthUptoDate: lastMonth.convertedProduction
    },
    convertedGps40s: {
      currentMonthToday: currentDayRatio(currentDayRows, 'convertedProduction', 'workedSpindles', 'average', 1000),
      lastMonthSameDate: lastDay.convertedGps,
      currentMonthUptoDate: currentMonth.convertedGps,
      lastMonthUptoDate: lastMonth.convertedGps
    },
    averageCount: {
      currentMonthToday: {
        shift1: shiftRatio(currentDayRows, 1, 'countWeighted', 'workedSpindles'),
        shift2: shiftRatio(currentDayRows, 2, 'countWeighted', 'workedSpindles'),
        shift3: shiftRatio(currentDayRows, 3, 'countWeighted', 'workedSpindles'),
        average: current.averageCount
      },
      lastMonthSameDate: lastDay.averageCount,
      currentMonthUptoDate: currentMonth.averageCount,
      lastMonthUptoDate: lastMonth.averageCount
    },
    totalWastage: {
      currentMonthToday: currentDayMetric(currentDayRows, 'waste'),
      lastMonthSameDate: lastDay.waste,
      currentMonthUptoDate: currentMonth.waste,
      lastMonthUptoDate: lastMonth.waste
    },
    avgWastagePercent: {
      currentMonthToday: currentDayRatio(currentDayRows, 'waste', 'production', 'average', 100),
      lastMonthSameDate: lastDay.wastePercent,
      currentMonthUptoDate: currentMonth.wastePercent,
      lastMonthUptoDate: lastMonth.wastePercent
    },
    totalStoppageMins: {
      currentMonthToday: currentDayMetric(currentDayRows, 'stoppage'),
      lastMonthSameDate: lastDay.stoppage,
      currentMonthUptoDate: currentMonth.stoppage,
      lastMonthUptoDate: lastMonth.stoppage
    },
    ebUnits: unavailableMetric,
    solarUnits: unavailableMetric,
    generatorUnits: unavailableMetric,
    totalUnits: unavailableMetric,
    actualUnitPerKg: unavailableMetric,
    convertedUnitPerKg: unavailableMetric,
    unitPerThousandSpindles: unavailableMetric,
    powerFailureOff: unavailableMetric,
    powerFailureOn: unavailableMetric
  }
}

export async function getTotalStoppageMins(reportDate) {
  const abstract = await fetchSpinningAbstractTableData(reportDate)
  return abstract.totalStoppageMins
}

export async function fetchCountwiseSummary(reportDate) {
  const dateStr = formatDateForQuery(reportDate)
  const countData = await prisma.$queryRaw`
    SELECT
      COALESCE(d.count_name, 'UNSPECIFIED') AS count_name,
      COUNT(DISTINCT d.machine_id) AS machine_count,
      SUM(COALESCE(d.worked_spindles, 0)) AS worked_spindles,
      SUM(COALESCE(d.act_prodn, 0)) AS production,
      SUM(COALESCE(d.act_prodn, 0) * COALESCE(sms.conv_40s_value, 0)) AS production_40s,
      SUM(COALESCE(d.exp_gps, 0) * COALESCE(d.worked_spindles, 0)) AS expected_gps_weighted,
      SUM(COALESCE(d.waste, 0)) AS waste
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON d.header_id = h.id
    LEFT JOIN spinning_machine_setup sms
      ON sms.machine_id = d.machine_id
      AND sms.entry_date = h.entry_date
      AND sms.shift = h.shift
      AND sms.run_sequence = d.run_sequence
    WHERE h.entry_date BETWEEN ${monthStart(dateStr)} AND ${dateStr}
    GROUP BY COALESCE(d.count_name, 'UNSPECIFIED')
    ORDER BY COALESCE(d.count_name, 'UNSPECIFIED')
  `

  const counts = countData.map(row => {
    const production = number(row.production)
    const workedSpindles = number(row.worked_spindles)
    const production40s = number(row.production_40s)
    const wasteKgs = number(row.waste)
    return {
      countName: row.count_name,
      machineCount: number(row.machine_count),
      production,
      workedSpindles,
      production40s,
      standardGps: workedSpindles > 0 ? number(row.expected_gps_weighted) / workedSpindles : 0,
      achievedGps: workedSpindles > 0 ? production / workedSpindles * 1000 : 0,
      conv40sGps: workedSpindles > 0 ? production40s / workedSpindles * 1000 : 0,
      wasteKgs,
      wastePercent: production > 0 ? wasteKgs / production * 100 : 0
    }
  })

  const totals = counts.reduce((total, row) => {
    total.production += row.production
    total.workedSpindles += row.workedSpindles
    total.production40s += row.production40s
    total.wasteKgs += row.wasteKgs
    return total
  }, { production: 0, workedSpindles: 0, production40s: 0, wasteKgs: 0 })
  totals.wastePercent = totals.production > 0 ? totals.wasteKgs / totals.production * 100 : 0

  return { counts, totals }
}
