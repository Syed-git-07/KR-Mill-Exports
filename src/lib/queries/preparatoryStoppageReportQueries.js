import { prisma } from '../prisma'

/**
 * Preparatory Stoppage Percentage Report Queries
 * Generates stoppage analysis by department, category, and shift
 */

// Department configuration
const DEPARTMENTS = {
  CARDING: { code: 'CARDING', name: 'CARDING', table: 'carding' },
  BREAKER: { code: 'BREAKER', name: 'BREAKER DRAWING', table: 'breaker_drawing' },
  LAPFORMER: { code: 'LAPFORMER', name: 'LAP FORMER', table: 'lap_former' },
  COMBER: { code: 'COMBER', name: 'COMBER', table: 'comber' },
  FINISHER: { code: 'FINISHER', name: 'FINISHER DRAWING', table: 'finisher_drawing' },
  SIMPLEX: { code: 'SIMPLEX', name: 'SIMPLEX', table: 'simplex' }
}

// Stoppage category prefix mapping (matches database values exactly)
const CATEGORY_PREFIX = {
  'CLEANING WORK': 'CL',
  'ELECT. BREAKDOWN': 'EB',
  'MAINTEN. BREAKDOWN': 'MB',
  'MAINTEN. ROUTINE': 'MR',
  'OTHERS': 'OT'
}

// Display names for categories (for UI presentation)
const CATEGORY_DISPLAY_NAMES = {
  'CLEANING WORK': 'Cleaning Work',
  'ELECT. BREAKDOWN': 'Electrical Breakdown',
  'MAINTEN. BREAKDOWN': 'Maintenance Breakdown',
  'MAINTEN. ROUTINE': 'Maintenance Routine',
  'OTHERS': 'Others'
}

/**
 * Get stoppage data for a specific department
 * @param {string} departmentCode - Department code (CARDING, BREAKER, etc.)
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Array>} Stoppage entries with details
 */
async function getDepartmentStoppageData(departmentCode, fromDate, toDate) {
  const dept = Object.values(DEPARTMENTS).find(d => d.code === departmentCode)
  if (!dept) throw new Error(`Invalid department: ${departmentCode}`)

  const tablePrefix = dept.table
  
  console.log(`[${departmentCode}] Querying dates:`, fromDate.toISOString(), 'to', toDate.toISOString())
  
  // Query the department's production headers within date range
  // Prisma will handle DATE comparison correctly with the normalized UTC dates
  const headers = await prisma[`${tablePrefix}_production_header`].findMany({
    where: {
      entry_date: {
        gte: fromDate,
        lte: toDate
      }
    }
  })

  console.log(`[${departmentCode}] Headers found: ${headers.length}`)

  if (headers.length === 0) {
    // Return empty result structure
    return { 
      records: [], 
      shiftTimeTracker: {} 
    }
  }

  // Get all production details for these headers
  const headerIds = headers.map(h => h.id)
  const details = await prisma[`${tablePrefix}_production_detail`].findMany({
    where: {
      header_id: {
        in: headerIds
      }
    }
  })

  if (details.length === 0) {
    return { 
      records: [], 
      shiftTimeTracker: {} 
    }
  }

  // Get all stoppage entries for these details
  const detailIds = details.map(d => d.id)
  const stoppages = await prisma[`${tablePrefix}_stoppage_entry`].findMany({
    where: {
      production_detail_id: {
        in: detailIds
      }
    }
  })

  // Get shift config for this department  
  const shiftConfigs = await prisma.shift_config.findMany({
    where: {
      department_code: departmentCode,
      is_active: true
    }
  })

  console.log(`[${departmentCode}] Shift configs found: ${shiftConfigs.length}`)

  const shiftTimeMap = {}
  shiftConfigs.forEach(sc => {
    shiftTimeMap[sc.shift] = sc.shift_time
  })

  // Get all stoppage details and heads
  const stoppageDetails = await prisma.stoppage_details.findMany({
    where: { is_active: true }
  })

  const stoppageHeads = await prisma.stoppage_heads.findMany({
    where: { is_active: true }
  })

  // Create lookups
  const stoppageDetailMap = {}
  stoppageDetails.forEach(sd => {
    stoppageDetailMap[sd.id] = sd
  })

  const stoppageHeadMap = {}
  stoppageHeads.forEach(sh => {
    stoppageHeadMap[sh.id] = sh
  })

  const headerMap = {}
  headers.forEach(h => {
    headerMap[h.id] = h
  })

  const detailMap = {}
  details.forEach(d => {
    detailMap[d.id] = d
  })

  // Process stoppage entries
  const stoppageRecords = []
  
  // Track unique shift times (to avoid counting same machine multiple times)
  const shiftTimeTracker = {}

  stoppages.forEach(stoppage => {
    const detail = detailMap[stoppage.production_detail_id]
    if (!detail) return

    const header = headerMap[detail.header_id]
    if (!header) return

    const shift = header.shift
    const shiftTime = shiftTimeMap[shift] || 510
    
    // Track shift time only once per production detail
    const shiftKey = `shift_${shift}`
    if (!shiftTimeTracker[shiftKey]) {
      shiftTimeTracker[shiftKey] = { count: 0, timePerMachine: shiftTime }
    }
    if (!shiftTimeTracker[shiftKey][detail.id]) {
      shiftTimeTracker[shiftKey][detail.id] = true
      shiftTimeTracker[shiftKey].count++
    }

    // Process each of the 4 stoppage slots
    for (let i = 1; i <= 4; i++) {
      const stoppageId = stoppage[`stoppage${i}_id`]
      const stoppageTime = stoppage[`stoppage${i}_time`] || 0

      if (!stoppageId || stoppageTime === 0) continue

      const stoppageDetail = stoppageDetailMap[stoppageId]
      if (!stoppageDetail) continue

      const stoppageHead = stoppageHeadMap[stoppageDetail.stoppage_head_id]
      if (!stoppageHead) continue

      // Category name from database (already uppercase with periods)
      const categoryName = stoppageHead.stoppage_head_name
      if (!categoryName || !CATEGORY_PREFIX[categoryName]) continue

      const displayCategory = CATEGORY_DISPLAY_NAMES[categoryName] || categoryName

      stoppageRecords.push({
        date: header.entry_date,
        shift,
        category: displayCategory,
        reason: stoppageDetail.stoppage_name,
        shortCode: stoppageDetail.short_code,
        stoppageTime
      })
    }
  })

  console.log(`[${departmentCode}] Stoppage records created: ${stoppageRecords.length}`)
  console.log(`[${departmentCode}] Shift time summary:`, Object.keys(shiftTimeTracker).map(k => `${k}: ${shiftTimeTracker[k].count} machines x ${shiftTimeTracker[k].timePerMachine}min`).join(', '))

  // Add shift time info to records for aggregation
  return { records: stoppageRecords, shiftTimeTracker }
}

/**
 * Aggregate stoppage data by category and reason
 * @param {Array} records - Raw stoppage records
 * @param {Object} shiftTimeTracker - Shift time tracking info
 * @returns {Object} Aggregated data
 */
function aggregateStoppageData(records, shiftTimeTracker) {
  const aggregated = {}

  console.log(`Aggregating ${records?.length || 0} records`)

  // If no records or no tracker, return empty
  if (!records || records.length === 0 || !shiftTimeTracker || Object.keys(shiftTimeTracker).length === 0) {
    return aggregated
  }

  // Calculate total shift times for each shift
  const totalShiftTimes = {
    shift1: 0,
    shift2: 0,
    shift3: 0
  }
  
  Object.keys(shiftTimeTracker).forEach(key => {
    const shiftNum = key.replace('shift_', '')
    const tracker = shiftTimeTracker[key]
    totalShiftTimes[`shift${shiftNum}`] = tracker.count * tracker.timePerMachine
  })

  console.log('Total shift times:', totalShiftTimes)

  records.forEach(record => {
    const { category, reason, shift, stoppageTime } = record

    if (!aggregated[category]) {
      aggregated[category] = {}
    }

    if (!aggregated[category][reason]) {
      aggregated[category][reason] = {
        shift1: { time: 0 },
        shift2: { time: 0 },
        shift3: { time: 0 },
        total: { time: 0 }
      }
    }

    const shiftKey = `shift${shift}`
    aggregated[category][reason][shiftKey].time += stoppageTime
    aggregated[category][reason].total.time += stoppageTime
  })

  // Add shift times to aggregated data
  Object.keys(aggregated).forEach(category => {
    Object.keys(aggregated[category]).forEach(reason => {
      aggregated[category][reason].shift1.shiftTime = totalShiftTimes.shift1
      aggregated[category][reason].shift2.shiftTime = totalShiftTimes.shift2
      aggregated[category][reason].shift3.shiftTime = totalShiftTimes.shift3
      aggregated[category][reason].total.shiftTime = 
        totalShiftTimes.shift1 + totalShiftTimes.shift2 + totalShiftTimes.shift3
    })
  })

  return aggregated
}

/**
 * Calculate percentages from aggregated data
 * @param {Object} aggregated - Aggregated stoppage data
 * @returns {Object} Data with percentages
 */
function calculatePercentages(aggregated) {
  const result = {}

  Object.keys(aggregated).forEach(category => {
    result[category] = {
      reasons: [],
      categoryTotal: {
        shift1: 0,
        shift2: 0,
        shift3: 0,
        total: 0
      }
    }

    Object.keys(aggregated[category]).forEach(reason => {
      const data = aggregated[category][reason]

      const shift1Pct = data.shift1.shiftTime > 0 
        ? (data.shift1.time / data.shift1.shiftTime) * 100 
        : 0
      const shift2Pct = data.shift2.shiftTime > 0 
        ? (data.shift2.time / data.shift2.shiftTime) * 100 
        : 0
      const shift3Pct = data.shift3.shiftTime > 0 
        ? (data.shift3.time / data.shift3.shiftTime) * 100 
        : 0
      const totalPct = data.total.shiftTime > 0 
        ? (data.total.time / data.total.shiftTime) * 100 
        : 0

      result[category].reasons.push({
        reason,
        shift1: parseFloat(shift1Pct.toFixed(2)),
        shift2: parseFloat(shift2Pct.toFixed(2)),
        shift3: parseFloat(shift3Pct.toFixed(2)),
        total: parseFloat(totalPct.toFixed(2))
      })

      // Add to category totals
      result[category].categoryTotal.shift1 += shift1Pct
      result[category].categoryTotal.shift2 += shift2Pct
      result[category].categoryTotal.shift3 += shift3Pct
      result[category].categoryTotal.total += totalPct
    })

    // Round category totals
    result[category].categoryTotal.shift1 = parseFloat(result[category].categoryTotal.shift1.toFixed(2))
    result[category].categoryTotal.shift2 = parseFloat(result[category].categoryTotal.shift2.toFixed(2))
    result[category].categoryTotal.shift3 = parseFloat(result[category].categoryTotal.shift3.toFixed(2))
    result[category].categoryTotal.total = parseFloat(result[category].categoryTotal.total.toFixed(2))
  })

  return result
}

/**
 * Generate complete preparatory stoppage percentage report
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Object>} Complete report data for all departments
 */
export async function generatePreparatoryStoppageReport(fromDate, toDate) {
  const report = {
    period: { from: fromDate, to: toDate },
    departments: {}
  }

  // Process each department
  for (const [key, dept] of Object.entries(DEPARTMENTS)) {
    try {
      const result = await getDepartmentStoppageData(dept.code, fromDate, toDate)
      const { records, shiftTimeTracker } = result
      const aggregated = aggregateStoppageData(records, shiftTimeTracker)
      const percentages = calculatePercentages(aggregated)

      // Calculate department net total
      let deptNetTotal = 0
      Object.values(percentages).forEach(categoryData => {
        deptNetTotal += categoryData.categoryTotal.total
      })

      report.departments[dept.name] = {
        code: dept.code,
        categories: percentages,
        netTotal: parseFloat(deptNetTotal.toFixed(2))
      }
    } catch(error) {
      console.error(`Error processing ${dept.name}:`, error)
      report.departments[dept.name] = {
        code: dept.code,
        categories: {},
        netTotal: 0,
        error: error.message
      }
    }
  }

  return report
}

/**
 * Get available date range for preparatory production data
 * @returns {Promise<Object>} { minDate, maxDate }
 */
export async function getPreparatoryDateRange() {
  // Check across all department production headers
  const tables = ['carding', 'breaker_drawing', 'lap_former', 'comber', 'finisher_drawing', 'simplex']
  
  let minDate = null
  let maxDate = null

  for (const table of tables) {
    try {
      const result = await prisma[`${table}_production_header`].aggregate({
        _min: { entry_date: true },
        _max: { entry_date: true }
      })

      if (result._min.entry_date && (!minDate || result._min.entry_date < minDate)) {
        minDate = result._min.entry_date
      }
      if (result._max.entry_date && (!maxDate || result._max.entry_date > maxDate)) {
        maxDate = result._max.entry_date
      }
    } catch (error) {
      console.error(`Error getting date range for ${table}:`, error)
    }
  }

  return { minDate, maxDate }
}

export { DEPARTMENTS, CATEGORY_PREFIX, CATEGORY_DISPLAY_NAMES }
