/**
 * Spinning Shift & Count wise Production Report Query
 * 
 * This query generates a report showing production data grouped by:
 * - Date
 * - Shift (1, 2, 3)
 * - Count Name (e.g., "68 COMBED STAR")
 * 
 * The report shows actual production (act_prodn) for each count per shift
 * Supports date range filtering (from_date to to_date)
 */

const { prisma } = require('../../../../../lib/prisma')

/**
 * Normalize date to local date string for MySQL DATE comparison
 * Prevents timezone offset issues when comparing with DATE fields
 */
function normalizeDateString(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get Spinning Shift & Count wise Production Report
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date (optional, defaults to fromDate)
 * @returns {Object} Report data with production grouped by date, shift, and count
 */
async function getSpinningShiftCountProductionReport(fromDate, toDate = null) {
  try {
    // If toDate is not provided, use fromDate
    const endDate = toDate || fromDate
    
    // Normalize dates to prevent timezone issues
    const startDateStr = normalizeDateString(fromDate)
    const endDateStr = normalizeDateString(endDate)

    // Query to get production data grouped by date, shift, and count
    const productionData = await prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(h.entry_date, '%d-%b-%y') as date,
        h.entry_date as raw_date,
        h.shift,
        d.count_name,
        ROUND(SUM(d.act_prodn), 2) as production
      FROM spinning_production_header h
      JOIN spinning_production_detail d ON h.id = d.header_id
      WHERE h.entry_date BETWEEN ${startDateStr} AND ${endDateStr}
      GROUP BY h.entry_date, h.shift, d.count_name
      ORDER BY h.entry_date, h.shift, d.count_name
    `

    // Get unique count names (columns)
    const uniqueCounts = [...new Set(productionData.map(row => row.count_name))].sort()
    
    // Get unique dates
    const uniqueDates = [...new Set(productionData.map(row => row.date))]
    
    // Structure data by date and shift
    const reportData = []
    let dateIndex = 0
    
    uniqueDates.forEach(date => {
      const dateData = productionData.filter(row => row.date === date)
      const shifts = [...new Set(dateData.map(row => row.shift))].sort()
      
      shifts.forEach((shift, shiftIndex) => {
        const shiftData = dateData.filter(row => row.shift === shift)
        
        const rowData = {
          dateDisplay: shiftIndex === 0 ? date : '',  // Show date only on first shift
          shift: shift,
          counts: {},
          rowTotal: 0
        }
        
        // Add production for each count
        uniqueCounts.forEach(countName => {
          const countData = shiftData.find(row => row.count_name === countName)
          const production = countData && countData.production !== null ? parseFloat(countData.production) : 0
          rowData.counts[countName] = production
          rowData.rowTotal += production
        })
        
        reportData.push(rowData)
      })
      
      // Add date total row
      const dateTotal = {
        dateDisplay: '',
        shift: 'Total',
        counts: {},
        rowTotal: 0,
        isDateTotal: true
      }
      
      uniqueCounts.forEach(countName => {
        const dateCounts = dateData.filter(row => row.count_name === countName)
        const total = dateCounts.reduce((sum, row) => {
          const value = row.production !== null ? parseFloat(row.production) : 0
          return sum + value
        }, 0)
        dateTotal.counts[countName] = total
        dateTotal.rowTotal += total
      })
      
      reportData.push(dateTotal)
    })
    
    // Calculate grand totals
    const grandTotal = {
      counts: {},
      rowTotal: 0
    }
    
    uniqueCounts.forEach(countName => {
      const countTotal = productionData
        .filter(row => row.count_name === countName)
        .reduce((sum, row) => {
          const value = row.production !== null ? parseFloat(row.production) : 0
          return sum + value
        }, 0)
      grandTotal.counts[countName] = countTotal
      grandTotal.rowTotal += countTotal
    })

    return {
      reportData,
      uniqueCounts,
      grandTotal,
      dateRange: {
        from: new Date(startDateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        to: new Date(endDateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    }
    
  } catch (error) {
    console.error('Error fetching spinning shift count production report:', error)
    throw error
  }
}

module.exports = {
  getSpinningShiftCountProductionReport
}
