import { prisma } from '@/lib/prisma'

export async function fetchSpinningAbstractSummary(reportDate) {
  const dateStr = formatDateForQuery(reportDate)

  // Fetch raw data grouped by count and shift
  const rawData = await prisma.$queryRaw`
    SELECT 
      d.count_name,
      h.shift,
      m.allocated_spindles,
      sc.conv_40s_value,
      COUNT(DISTINCT d.machine_id) as machine_count,
      SUM(d.act_prodn) as production_kg,
      SUM(d.waste) as waste_kg,
      AVG(d.exp_gps) as exp_gps,
      AVG(d.gps) as achieved_gps,
      SUM(d.worked_spindles) as worked_spindles,
      SUM(COALESCE(se.total_stoppage_time, d.total_stoppage_mins, 0)) as total_stoppage_mins,
      d.run_time
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_machines m ON d.machine_id = m.id
    LEFT JOIN spinning_stoppage_entry se ON se.production_detail_id = d.id
    LEFT JOIN spinning_counts sc ON sc.count_name = d.count_name AND sc.is_active = 1
    WHERE h.entry_date = ${dateStr}
    GROUP BY d.count_name, h.shift, sc.conv_40s_value, m.allocated_spindles, d.run_time
    ORDER BY d.count_name, h.shift
  `

  // Process data to calculate summary metrics per count
  const countSummary = {}

  rawData.forEach(row => {
    const countName = row.count_name
    
    if (!countSummary[countName]) {
      countSummary[countName] = {
        countName,
        conv40sValue: Number(row.conv_40s_value) || 0,
        allocatedSpindles: Number(row.allocated_spindles) || 1104,
        machines: new Set(),
        shifts: {
          1: { productionKg: 0, wasteKg: 0, expGps: null, achievedGps: null, stoppageMins: 0, runTime: 510 },
          2: { productionKg: 0, wasteKg: 0, expGps: null, achievedGps: null, stoppageMins: 0, runTime: 510 },
          3: { productionKg: 0, wasteKg: 0, expGps: null, achievedGps: null, stoppageMins: 0, runTime: 420 }
        }
      }
    }

    const shift = row.shift
    const summary = countSummary[countName]
    
    // Track unique machines (using machine_count from query which gives distinct count per shift)
    // We need to get the max machine count across shifts as the same machines may run in multiple shifts
    const machineCount = Number(row.machine_count) || 0
    
    // Store shift-specific data
    summary.shifts[shift].productionKg = Number(row.production_kg) || 0
    summary.shifts[shift].wasteKg = Number(row.waste_kg) || 0
    summary.shifts[shift].expGps = row.exp_gps ? Number(row.exp_gps) : null
    summary.shifts[shift].achievedGps = row.achieved_gps ? Number(row.achieved_gps) : null
    summary.shifts[shift].stoppageMins = Number(row.total_stoppage_mins) || 0
    summary.shifts[shift].runTime = Number(row.run_time) || (shift === 3 ? 420 : 510)
    
    // Store machine count per shift to calculate max later
    if (!summary.machineCountByShift) {
      summary.machineCountByShift = {}
    }
    summary.machineCountByShift[shift] = machineCount
  })

  // Calculate final metrics for each count
  const summaryData = Object.values(countSummary).map(summary => {
    // Get maximum machine count across all shifts (same machines may run in multiple shifts)
    const machineCount = Math.max(...Object.values(summary.machineCountByShift || { 1: 0 }))
    const totalSpindles = summary.allocatedSpindles * machineCount

    // Total Production KG (sum of all 3 shifts)
    const totalProductionKg = 
      summary.shifts[1].productionKg + 
      summary.shifts[2].productionKg + 
      summary.shifts[3].productionKg

    // Production 40's = Production KG * conv_40s_value
    const production40s = totalProductionKg * summary.conv40sValue

    // GPS Std - average of exp_gps for shifts that have data (not null)
    const expGpsValues = [1, 2, 3]
      .map(shift => summary.shifts[shift].expGps)
      .filter(val => val !== null)
    const gpsStd = expGpsValues.length > 0 
      ? expGpsValues.reduce((sum, val) => sum + val, 0) / expGpsValues.length 
      : 0

    // GPS Achieved - average of achieved_gps for shifts that have data (not null)
    const achievedGpsValues = [1, 2, 3]
      .map(shift => summary.shifts[shift].achievedGps)
      .filter(val => val !== null)
    const gpsAchieved = achievedGpsValues.length > 0 
      ? achievedGpsValues.reduce((sum, val) => sum + val, 0) / achievedGpsValues.length 
      : 0

    // 40's GPS = conv_40s_value * GPS Achieved
    const gps40s = summary.conv40sValue * gpsAchieved

    // Total Waste KGs (sum of all 3 shifts)
    const totalWasteKg = 
      summary.shifts[1].wasteKg + 
      summary.shifts[2].wasteKg + 
      summary.shifts[3].wasteKg

    // Waste % = (Total Waste KG / Total Production KG) * 100
    const wastePercent = totalProductionKg > 0 
      ? (totalWasteKg / totalProductionKg) * 100 
      : 0

    // Utilization % Calculation
    // Total possible time = Shift1 (510) + Shift2 (510) + Shift3 (420) = 1440 mins
    // Actual run time per shift = run_time - stoppage_mins
    const actualRunTime1 = Math.max(0, summary.shifts[1].runTime - summary.shifts[1].stoppageMins)
    const actualRunTime2 = Math.max(0, summary.shifts[2].runTime - summary.shifts[2].stoppageMins)
    const actualRunTime3 = Math.max(0, summary.shifts[3].runTime - summary.shifts[3].stoppageMins)
    
    const totalActualRunTime = actualRunTime1 + actualRunTime2 + actualRunTime3
    const totalPossibleTime = summary.shifts[1].runTime + summary.shifts[2].runTime + summary.shifts[3].runTime // 1440
    
    const utilizationPercent = totalPossibleTime > 0 
      ? (totalActualRunTime / totalPossibleTime) * 100 
      : 0

    // Gain/Loss calculation: Expected GPS - Achieved GPS
    // Positive value = Loss (achieved is less than expected)
    // Negative value = Gain (achieved is more than expected)
    const gainLoss = gpsStd - gpsAchieved

    return {
      countName: summary.countName,
      machineCount,
      totalSpindles,
      productionKg: totalProductionKg,
      production40s,
      gpsStd,
      gpsAchieved,
      gps40s,
      wasteKg: totalWasteKg,
      wastePercent,
      utilizationPercent,
      gainLoss
    }
  })

  // Calculate grand totals
  const grandTotal = {
    machineCount: summaryData.reduce((sum, row) => sum + row.machineCount, 0),
    totalSpindles: summaryData.reduce((sum, row) => sum + row.totalSpindles, 0),
    productionKg: summaryData.reduce((sum, row) => sum + row.productionKg, 0),
    wasteKg: summaryData.reduce((sum, row) => sum + row.wasteKg, 0)
  }

  return {
    date: dateStr,
    summaryData,
    grandTotal
  }
}

function formatDateForQuery(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function fetchSpinningAbstractTableData(reportDate) {
  const dateStr = formatDateForQuery(reportDate)
  const selectedDate = new Date(reportDate)
  const selectedDay = selectedDate.getDate()
  const selectedMonth = selectedDate.getMonth() + 1
  const selectedYear = selectedDate.getFullYear()

  // Calculate last month's year and month
  const lastMonthDate = new Date(selectedYear, selectedMonth - 2, selectedDay) // -2 because month is 1-indexed
  const lastMonthYear = lastMonthDate.getFullYear()
  const lastMonthMonth = lastMonthDate.getMonth() + 1
  const lastMonthDateStr = formatDateForQuery(lastMonthDate)

  // 1. Current Month Today - Shift-wise production for selected date
  const currentDayShifts = await prisma.$queryRaw`
    SELECT 
      h.shift,
      SUM(d.act_prodn) as total_production,
      AVG(d.run_time) as avg_run_time,
      AVG(COALESCE(se.total_stoppage_time, d.total_stoppage_mins, 0)) as avg_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    LEFT JOIN spinning_stoppage_entry se ON se.production_detail_id = d.id
    WHERE h.entry_date = ${dateStr}
    GROUP BY h.shift
    ORDER BY h.shift
  `

  // Format shift data - ensure all 3 shifts are present
  const shiftProduction = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }

  const shiftUtilization = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }

  currentDayShifts.forEach(row => {
    const production = Number(row.total_production) || 0
    const avgRunTime = Number(row.avg_run_time) || (row.shift === 3 ? 420 : 510)
    const avgStoppage = Number(row.avg_stoppage) || 0
    const actualRunTime = Math.max(0, avgRunTime - avgStoppage)
    const utilPercent = avgRunTime > 0 ? (actualRunTime / avgRunTime) * 100 : 0
    
    if (row.shift === 1) {
      shiftProduction.shift1 = production
      shiftUtilization.shift1 = utilPercent
    } else if (row.shift === 2) {
      shiftProduction.shift2 = production
      shiftUtilization.shift2 = utilPercent
    } else if (row.shift === 3) {
      shiftProduction.shift3 = production
      shiftUtilization.shift3 = utilPercent
    }
  })

  const currentDayTotal = shiftProduction.shift1 + shiftProduction.shift2 + shiftProduction.shift3
  
  // Calculate average utilization for current day (only for shifts with data)
  const currentDayUtilValues = currentDayShifts.map(row => {
    const avgRunTime = Number(row.avg_run_time) || (row.shift === 3 ? 420 : 510)
    const avgStoppage = Number(row.avg_stoppage) || 0
    const actualRunTime = Math.max(0, avgRunTime - avgStoppage)
    return avgRunTime > 0 ? (actualRunTime / avgRunTime) * 100 : 0
  })
  const currentDayAvgUtil = currentDayUtilValues.length > 0 
    ? currentDayUtilValues.reduce((sum, val) => sum + val, 0) / currentDayUtilValues.length 
    : 0

  // 2. Last Month Same Date - Total production and utilization
  const lastMonthSameDateData = await prisma.$queryRaw`
    SELECT 
      SUM(d.act_prodn) as total_production,
      AVG(d.run_time) as avg_run_time,
      AVG(COALESCE(se.total_stoppage_time, d.total_stoppage_mins, 0)) as avg_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    LEFT JOIN spinning_stoppage_entry se ON se.production_detail_id = d.id
    WHERE h.entry_date = ${lastMonthDateStr}
  `

  const lastMonthSameDateTotal = Number(lastMonthSameDateData[0]?.total_production) || 0
  
  // Calculate utilization for last month same date
  let lastMonthSameDateUtil = 0
  if (lastMonthSameDateData.length > 0 && lastMonthSameDateData[0]?.avg_run_time) {
    const avgRunTime = Number(lastMonthSameDateData[0].avg_run_time) || 510
    const avgStoppage = Number(lastMonthSameDateData[0].avg_stoppage) || 0
    const actualRunTime = Math.max(0, avgRunTime - avgStoppage)
    lastMonthSameDateUtil = avgRunTime > 0 ? (actualRunTime / avgRunTime) * 100 : 0
  }

  // 3. Current Month Upto Date - From day 1 to selected date
  const firstDayCurrentMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
  
  const currentMonthUptoDateData = await prisma.$queryRaw`
    SELECT 
      SUM(d.act_prodn) as total_production,
      AVG(d.run_time) as avg_run_time,
      AVG(COALESCE(se.total_stoppage_time, d.total_stoppage_mins, 0)) as avg_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    LEFT JOIN spinning_stoppage_entry se ON se.production_detail_id = d.id
    WHERE h.entry_date >= ${firstDayCurrentMonth} 
      AND h.entry_date <= ${dateStr}
  `

  const currentMonthUptoDateTotal = Number(currentMonthUptoDateData[0]?.total_production) || 0
  
  // Calculate average utilization for current month upto date
  let currentMonthUptoDateUtil = 0
  if (currentMonthUptoDateData.length > 0 && currentMonthUptoDateData[0]?.avg_run_time) {
    const avgRunTime = Number(currentMonthUptoDateData[0].avg_run_time) || 510
    const avgStoppage = Number(currentMonthUptoDateData[0].avg_stoppage) || 0
    const actualRunTime = Math.max(0, avgRunTime - avgStoppage)
    currentMonthUptoDateUtil = avgRunTime > 0 ? (actualRunTime / avgRunTime) * 100 : 0
  }

  // 4. Last Month Upto Date - From day 1 to same day in previous month
  const firstDayLastMonth = `${lastMonthYear}-${String(lastMonthMonth).padStart(2, '0')}-01`
  
  const lastMonthUptoDateData = await prisma.$queryRaw`
    SELECT 
      SUM(d.act_prodn) as total_production,
      AVG(d.run_time) as avg_run_time,
      AVG(COALESCE(se.total_stoppage_time, d.total_stoppage_mins, 0)) as avg_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    LEFT JOIN spinning_stoppage_entry se ON se.production_detail_id = d.id
    WHERE h.entry_date >= ${firstDayLastMonth} 
      AND h.entry_date <= ${lastMonthDateStr}
  `

  const lastMonthUptoDateTotal = Number(lastMonthUptoDateData[0]?.total_production) || 0
  
  // Calculate average utilization for last month upto date
  let lastMonthUptoDateUtil = 0
  if (lastMonthUptoDateData.length > 0 && lastMonthUptoDateData[0]?.avg_run_time) {
    const avgRunTime = Number(lastMonthUptoDateData[0].avg_run_time) || 510
    const avgStoppage = Number(lastMonthUptoDateData[0].avg_stoppage) || 0
    const actualRunTime = Math.max(0, avgRunTime - avgStoppage)
    lastMonthUptoDateUtil = avgRunTime > 0 ? (actualRunTime / avgRunTime) * 100 : 0
  }

  // ============= WORKED SPINDLES CALCULATIONS =============
  
  // 1. Current Day Shifts - Worked spindles per shift
  const currentDaySpindlesShifts = await prisma.$queryRaw`
    SELECT 
      h.shift,
      SUM(sm.allocated_spindles) as worked_spindles
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_machines sm ON d.machine_id = sm.id
    WHERE h.entry_date = ${dateStr}
    GROUP BY h.shift
    ORDER BY h.shift
  `

  const shiftSpindles = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }

  currentDaySpindlesShifts.forEach(row => {
    const spindles = Number(row.worked_spindles) || 0
    if (row.shift === 1) {
      shiftSpindles.shift1 = spindles
    } else if (row.shift === 2) {
      shiftSpindles.shift2 = spindles
    } else if (row.shift === 3) {
      shiftSpindles.shift3 = spindles
    }
  })

  const currentDayTotalSpindles = shiftSpindles.shift1 + shiftSpindles.shift2 + shiftSpindles.shift3

  // 2. Last Month Same Date - Worked spindles
  const lastMonthSpindlesData = await prisma.$queryRaw`
    SELECT 
      SUM(sm.allocated_spindles) as worked_spindles
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_machines sm ON d.machine_id = sm.id
    WHERE h.entry_date = ${lastMonthDateStr}
  `

  const lastMonthSpindlesTotal = Number(lastMonthSpindlesData[0]?.worked_spindles) || 0

  // 3. Current Month Upto Date - Worked spindles
  const currentMonthUptoDateSpindlesData = await prisma.$queryRaw`
    SELECT 
      SUM(sm.allocated_spindles) as worked_spindles
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_machines sm ON d.machine_id = sm.id
    WHERE h.entry_date >= ${firstDayCurrentMonth} 
      AND h.entry_date <= ${dateStr}
  `

  const currentMonthUptoDateSpindlesTotal = Number(currentMonthUptoDateSpindlesData[0]?.worked_spindles) || 0

  // 4. Last Month Upto Date - Worked spindles
  const lastMonthUptoDateSpindlesData = await prisma.$queryRaw`
    SELECT 
      SUM(sm.allocated_spindles) as worked_spindles
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_machines sm ON d.machine_id = sm.id
    WHERE h.entry_date >= ${firstDayLastMonth} 
      AND h.entry_date <= ${lastMonthDateStr}
  `

  const lastMonthUptoDateSpindlesTotal = Number(lastMonthUptoDateSpindlesData[0]?.worked_spindles) || 0

  // ============= AVERAGE COUNT CALCULATIONS =============
  
  // 1. Current Day Shifts - Average count per shift
  const currentDayAvgCountShifts = await prisma.$queryRaw`
    SELECT 
      h.shift,
      AVG(sc.act_count) as avg_count
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_counts sc ON d.count_name = sc.count_name
    WHERE h.entry_date = ${dateStr}
    GROUP BY h.shift
    ORDER BY h.shift
  `

  const shiftAvgCount = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }

  currentDayAvgCountShifts.forEach(row => {
    const avgCount = Number(row.avg_count) || 0
    if (row.shift === 1) {
      shiftAvgCount.shift1 = avgCount
    } else if (row.shift === 2) {
      shiftAvgCount.shift2 = avgCount
    } else if (row.shift === 3) {
      shiftAvgCount.shift3 = avgCount
    }
  })

  // Average count for the day (average of shift averages that have data)
  const dayAvgCountValues = currentDayAvgCountShifts.map(row => Number(row.avg_count) || 0)
  const currentDayAvgCountTotal = dayAvgCountValues.length > 0
    ? dayAvgCountValues.reduce((sum, val) => sum + val, 0) / dayAvgCountValues.length
    : 0

  // 2. Last Month Same Date - Average count
  const lastMonthAvgCountData = await prisma.$queryRaw`
    SELECT 
      AVG(sc.act_count) as avg_count
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_counts sc ON d.count_name = sc.count_name
    WHERE h.entry_date = ${lastMonthDateStr}
  `

  const lastMonthAvgCountTotal = Number(lastMonthAvgCountData[0]?.avg_count) || 0

  // 3. Current Month Upto Date - Average count
  const currentMonthUptoDateAvgCountData = await prisma.$queryRaw`
    SELECT 
      AVG(sc.act_count) as avg_count
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_counts sc ON d.count_name = sc.count_name
    WHERE h.entry_date >= ${firstDayCurrentMonth} 
      AND h.entry_date <= ${dateStr}
  `

  const currentMonthUptoDateAvgCountTotal = Number(currentMonthUptoDateAvgCountData[0]?.avg_count) || 0

  // 4. Last Month Upto Date - Average count
  const lastMonthUptoDateAvgCountData = await prisma.$queryRaw`
    SELECT 
      AVG(sc.act_count) as avg_count
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_counts sc ON d.count_name = sc.count_name
    WHERE h.entry_date >= ${firstDayLastMonth} 
      AND h.entry_date <= ${lastMonthDateStr}
  `

  const lastMonthUptoDateAvgCountTotal = Number(lastMonthUptoDateAvgCountData[0]?.avg_count) || 0

  // ============= TOTAL WASTAGE (KG) CALCULATIONS =============
  
  // 1. Current Day Shifts - Total wastage per shift
  const currentDayWastageShifts = await prisma.$queryRaw`
    SELECT 
      h.shift,
      SUM(d.waste) as total_wastage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    WHERE h.entry_date = ${dateStr}
    GROUP BY h.shift
    ORDER BY h.shift
  `

  const shiftWastage = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }

  currentDayWastageShifts.forEach(row => {
    const wastage = Number(row.total_wastage) || 0
    if (row.shift === 1) {
      shiftWastage.shift1 = wastage
    } else if (row.shift === 2) {
      shiftWastage.shift2 = wastage
    } else if (row.shift === 3) {
      shiftWastage.shift3 = wastage
    }
  })

  const currentDayTotalWastage = shiftWastage.shift1 + shiftWastage.shift2 + shiftWastage.shift3

  // 2. Last Month Same Date - Total wastage
  const lastMonthWastageData = await prisma.$queryRaw`
    SELECT 
      SUM(d.waste) as total_wastage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    WHERE h.entry_date = ${lastMonthDateStr}
  `

  const lastMonthWastageTotal = Number(lastMonthWastageData[0]?.total_wastage) || 0

  // 3. Current Month Upto Date - Total wastage
  const currentMonthUptoDateWastageData = await prisma.$queryRaw`
    SELECT 
      SUM(d.waste) as total_wastage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    WHERE h.entry_date >= ${firstDayCurrentMonth} 
      AND h.entry_date <= ${dateStr}
  `

  const currentMonthUptoDateWastageTotal = Number(currentMonthUptoDateWastageData[0]?.total_wastage) || 0

  // 4. Last Month Upto Date - Total wastage
  const lastMonthUptoDateWastageData = await prisma.$queryRaw`
    SELECT 
      SUM(d.waste) as total_wastage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    WHERE h.entry_date >= ${firstDayLastMonth} 
      AND h.entry_date <= ${lastMonthDateStr}
  `

  const lastMonthUptoDateWastageTotal = Number(lastMonthUptoDateWastageData[0]?.total_wastage) || 0

  // ============= AVG WASTAGE % CALCULATIONS =============
  // Formula: (Total Waste / Total Production) × 100
  
  // Shift-wise waste percentage
  const wastePercent = {
    shift1: shiftProduction.shift1 > 0 ? (shiftWastage.shift1 / shiftProduction.shift1) * 100 : 0,
    shift2: shiftProduction.shift2 > 0 ? (shiftWastage.shift2 / shiftProduction.shift2) * 100 : 0,
    shift3: shiftProduction.shift3 > 0 ? (shiftWastage.shift3 / shiftProduction.shift3) * 100 : 0
  }

  // Day average waste percentage
  const currentDayWastePercent = currentDayTotal > 0 ? (currentDayTotalWastage / currentDayTotal) * 100 : 0

  // Last month same date waste percentage
  const lastMonthWastePercent = lastMonthSameDateTotal > 0 ? (lastMonthWastageTotal / lastMonthSameDateTotal) * 100 : 0

  // Current month upto date waste percentage
  const currentMonthUptoDateWastePercent = currentMonthUptoDateTotal > 0 ? (currentMonthUptoDateWastageTotal / currentMonthUptoDateTotal) * 100 : 0

  // Last month upto date waste percentage
  const lastMonthUptoDateWastePercent = lastMonthUptoDateTotal > 0 ? (lastMonthUptoDateWastageTotal / lastMonthUptoDateTotal) * 100 : 0

  // ============= TOTAL STOPPAGE MINS CALCULATIONS =============
  
  // 1. Current Month Today - Shift-wise stoppage for selected date
  const currentDayStoppageShifts = await prisma.$queryRaw`
    SELECT 
      h.shift,
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date = ${dateStr}
    GROUP BY h.shift
    ORDER BY h.shift
  `

  // Process shift stoppage data
  const shiftStoppage = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }

  currentDayStoppageShifts.forEach(row => {
    const shift = Number(row.shift)
    const stoppage = Number(row.total_stoppage) || 0
    
    if (shift === 1) shiftStoppage.shift1 = stoppage
    else if (shift === 2) shiftStoppage.shift2 = stoppage
    else if (shift === 3) shiftStoppage.shift3 = stoppage
  })

  // Calculate day total stoppage
  const currentDayTotalStoppage = shiftStoppage.shift1 + shiftStoppage.shift2 + shiftStoppage.shift3

  // 2. Last Month Same Date - Total stoppage for same date in last month
  const lastMonthStoppageData = await prisma.$queryRaw`
    SELECT 
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date = ${lastMonthDateStr}
  `

  const lastMonthStoppageTotal = Number(lastMonthStoppageData[0]?.total_stoppage) || 0

  // 3. Current Month Upto Date - Cumulative from 1st to selected date
  const currentMonthUptoDateStoppageData = await prisma.$queryRaw`
    SELECT 
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date >= ${firstDayCurrentMonth} 
      AND h.entry_date <= ${dateStr}
  `

  const currentMonthUptoDateStoppageTotal = Number(currentMonthUptoDateStoppageData[0]?.total_stoppage) || 0

  // 4. Last Month Upto Date - Cumulative from 1st to same day in last month
  const lastMonthUptoDateStoppageData = await prisma.$queryRaw`
    SELECT 
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date >= ${firstDayLastMonth} 
      AND h.entry_date <= ${lastMonthDateStr}
  `

  const lastMonthUptoDateStoppageTotal = Number(lastMonthUptoDateStoppageData[0]?.total_stoppage) || 0

  return {
    totalProduction: {
      currentMonthToday: {
        shift1: shiftProduction.shift1,
        shift2: shiftProduction.shift2,
        shift3: shiftProduction.shift3,
        total: currentDayTotal
      },
      lastMonthSameDate: lastMonthSameDateTotal,
      currentMonthUptoDate: currentMonthUptoDateTotal,
      lastMonthUptoDate: lastMonthUptoDateTotal
    },
    avgUtilization: {
      currentMonthToday: {
        shift1: shiftUtilization.shift1,
        shift2: shiftUtilization.shift2,
        shift3: shiftUtilization.shift3,
        average: currentDayAvgUtil
      },
      lastMonthSameDate: lastMonthSameDateUtil,
      currentMonthUptoDate: currentMonthUptoDateUtil,
      lastMonthUptoDate: lastMonthUptoDateUtil
    },
    workedSpindles: {
      currentMonthToday: {
        shift1: shiftSpindles.shift1,
        shift2: shiftSpindles.shift2,
        shift3: shiftSpindles.shift3,
        total: currentDayTotalSpindles
      },
      lastMonthSameDate: lastMonthSpindlesTotal,
      currentMonthUptoDate: currentMonthUptoDateSpindlesTotal,
      lastMonthUptoDate: lastMonthUptoDateSpindlesTotal
    },
    averageCount: {
      currentMonthToday: {
        shift1: shiftAvgCount.shift1,
        shift2: shiftAvgCount.shift2,
        shift3: shiftAvgCount.shift3,
        average: currentDayAvgCountTotal
      },
      lastMonthSameDate: lastMonthAvgCountTotal,
      currentMonthUptoDate: currentMonthUptoDateAvgCountTotal,
      lastMonthUptoDate: lastMonthUptoDateAvgCountTotal
    },
    totalWastage: {
      currentMonthToday: {
        shift1: shiftWastage.shift1,
        shift2: shiftWastage.shift2,
        shift3: shiftWastage.shift3,
        total: currentDayTotalWastage
      },
      lastMonthSameDate: lastMonthWastageTotal,
      currentMonthUptoDate: currentMonthUptoDateWastageTotal,
      lastMonthUptoDate: lastMonthUptoDateWastageTotal
    },
    avgWastagePercent: {
      currentMonthToday: {
        shift1: wastePercent.shift1,
        shift2: wastePercent.shift2,
        shift3: wastePercent.shift3,
        average: currentDayWastePercent
      },
      lastMonthSameDate: lastMonthWastePercent,
      currentMonthUptoDate: currentMonthUptoDateWastePercent,
      lastMonthUptoDate: lastMonthUptoDateWastePercent
    },
    totalStoppageMins: {
      currentMonthToday: {
        shift1: shiftStoppage.shift1,
        shift2: shiftStoppage.shift2,
        shift3: shiftStoppage.shift3,
        total: currentDayTotalStoppage
      },
      lastMonthSameDate: lastMonthStoppageTotal,
      currentMonthUptoDate: currentMonthUptoDateStoppageTotal,
      lastMonthUptoDate: lastMonthUptoDateStoppageTotal
    }
  }
}

// Helper function kept for potential future use
export async function getTotalStoppageMins(reportDate) {
  const dateStr = formatDateForQuery(reportDate)
  
  const selectedDate = new Date(reportDate)
  const selectedDay = selectedDate.getDate()
  const selectedMonth = selectedDate.getMonth() + 1
  const selectedYear = selectedDate.getFullYear()

  // Calculate first day of current month
  const firstDayCurrentMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`

  // Calculate last month's year and month
  const lastMonthDate = new Date(selectedYear, selectedMonth - 2, selectedDay)
  const lastMonthYear = lastMonthDate.getFullYear()
  const lastMonthMonth = lastMonthDate.getMonth() + 1
  const lastMonthDateStr = formatDateForQuery(lastMonthDate)

  // Calculate first day of last month
  const firstDayLastMonth = `${lastMonthYear}-${String(lastMonthMonth).padStart(2, '0')}-01`

  // 1. Current Month Today - Shift-wise stoppage for selected date
  const currentDayShifts = await prisma.$queryRaw`
    SELECT 
      h.shift,
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date = ${dateStr}
    GROUP BY h.shift
    ORDER BY h.shift
  `

  // Process shift data
  const shiftStoppage = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }

  currentDayShifts.forEach(row => {
    const shift = Number(row.shift)
    const stoppage = Number(row.total_stoppage) || 0
    
    if (shift === 1) shiftStoppage.shift1 = stoppage
    else if (shift === 2) shiftStoppage.shift2 = stoppage
    else if (shift === 3) shiftStoppage.shift3 = stoppage
  })

  // Calculate day total
  const currentDayTotal = shiftStoppage.shift1 + shiftStoppage.shift2 + shiftStoppage.shift3

  // 2. Last Month Same Date - Total stoppage for same date in last month
  const lastMonthSameDateData = await prisma.$queryRaw`
    SELECT 
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date = ${lastMonthDateStr}
  `

  const lastMonthSameDateTotal = Number(lastMonthSameDateData[0]?.total_stoppage) || 0

  // 3. Current Month Upto Date - Cumulative from 1st to selected date
  const currentMonthUptoDateData = await prisma.$queryRaw`
    SELECT 
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date >= ${firstDayCurrentMonth} 
      AND h.entry_date <= ${dateStr}
  `

  const currentMonthUptoDateTotal = Number(currentMonthUptoDateData[0]?.total_stoppage) || 0

  // 4. Last Month Upto Date - Cumulative from 1st to same day in last month
  const lastMonthUptoDateData = await prisma.$queryRaw`
    SELECT 
      SUM(se.total_stoppage_time) as total_stoppage
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_stoppage_entry se ON d.id = se.production_detail_id
    WHERE h.entry_date >= ${firstDayLastMonth} 
      AND h.entry_date <= ${lastMonthDateStr}
  `

  const lastMonthUptoDateTotal = Number(lastMonthUptoDateData[0]?.total_stoppage) || 0

  return {
    currentMonthToday: {
      shift1: shiftStoppage.shift1,
      shift2: shiftStoppage.shift2,
      shift3: shiftStoppage.shift3,
      total: currentDayTotal
    },
    lastMonthSameDate: lastMonthSameDateTotal,
    currentMonthUptoDate: currentMonthUptoDateTotal,
    lastMonthUptoDate: lastMonthUptoDateTotal
  }
}

// Count-wise Summary Table - Cumulative from month start to selected date
export async function fetchCountwiseSummary(reportDate) {
  const dateStr = formatDateForQuery(reportDate)
  
  const selectedDate = new Date(reportDate)
  const selectedMonth = selectedDate.getMonth() + 1
  const selectedYear = selectedDate.getFullYear()

  // Calculate first day of current month
  const firstDayCurrentMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`

  // Fetch count-wise data for the period (1st to selected date)
  const countData = await prisma.$queryRaw`
    SELECT 
      d.count_name,
      COUNT(DISTINCT d.machine_id) as machine_count,
      SUM(sm.allocated_spindles) as total_spindles,
      SUM(d.act_prodn) as production_kg,
      AVG(d.exp_gps) as avg_exp_gps,
      AVG(d.gps) as avg_achieved_gps,
      SUM(d.waste) as waste_kgs,
      sc.conv_40s_value
    FROM spinning_production_header h
    JOIN spinning_production_detail d ON h.id = d.header_id
    JOIN spinning_machines sm ON d.machine_id = sm.id
    LEFT JOIN spinning_counts sc ON sc.count_name = d.count_name AND sc.is_active = 1
    WHERE h.entry_date >= ${firstDayCurrentMonth} 
      AND h.entry_date <= ${dateStr}
    GROUP BY d.count_name, sc.conv_40s_value
    ORDER BY d.count_name
  `

  // Process count data and calculate metrics
  const countSummary = countData.map(row => {
    const productionKg = Number(row.production_kg) || 0
    const wasteKgs = Number(row.waste_kgs) || 0
    const conv40sValue = Number(row.conv_40s_value) || 1
    const avgExpGps = Number(row.avg_exp_gps) || 0
    const avgAchievedGps = Number(row.avg_achieved_gps) || 0
    const workedSpindles = Number(row.total_spindles) || 0

    return {
      countName: row.count_name,
      machineCount: Number(row.machine_count) || 0,
      production: productionKg,
      workedSpindles: workedSpindles,
      production40s: productionKg * conv40sValue,
      standardGps: avgExpGps,
      achievedGps: avgAchievedGps,
      conv40sGps: avgAchievedGps * conv40sValue,
      wasteKgs: wasteKgs,
      wastePercent: productionKg > 0 ? (wasteKgs / productionKg) * 100 : 0
    }
  })

  // Calculate totals
  const totals = countSummary.reduce((acc, row) => {
    acc.production += row.production
    acc.workedSpindles += row.workedSpindles
    acc.production40s += row.production40s
    acc.wasteKgs += row.wasteKgs
    return acc
  }, {
    production: 0,
    workedSpindles: 0,
    production40s: 0,
    wasteKgs: 0
  })

  // Calculate total waste percentage
  totals.wastePercent = totals.production > 0 ? (totals.wasteKgs / totals.production) * 100 : 0

  return {
    counts: countSummary,
    totals
  }
}
