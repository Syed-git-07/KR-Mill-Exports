'use server'

const { getSpinningShiftCountProductionReport } = require('./spinningShiftCountProductionQueries')

/**
 * Server action to fetch Spinning Shift & Count wise Production Report
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date (optional, defaults to fromDate)
 * @returns {Promise<Object>} Report data
 */
export async function fetchSpinningShiftCountProductionReport(fromDate, toDate = null) {
  try {
    const reportData = await getSpinningShiftCountProductionReport(fromDate, toDate)
    return {
      success: true,
      data: reportData
    }
  } catch (error) {
    console.error('Error in fetchSpinningShiftCountProductionReport:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch report data'
    }
  }
}
