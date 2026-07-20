'use server'

import { generateSpinningStoppageReport } from '@/lib/queries/spinningStoppageReportQueries'

/**
 * Normalize date to UTC midnight for MySQL DATE comparison
 * Prevents timezone offset issues when comparing with DATE fields
 */
function normalizeDate(dateString) {
  const date = new Date(dateString)
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0))
}

/**
 * Server action to generate Spinning Stoppage Percentage Report
 * @param {string} selectedDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Report data with stoppage details by category
 */
export async function generateSpinningStoppageReportAction(selectedDate) {
  try {
    const normalizedDate = normalizeDate(selectedDate)
    
    console.log('Spinning Stoppage Report requested:')
    console.log('  Original date:', selectedDate)
    console.log('  Normalized date:', normalizedDate.toISOString())
    
    const reportData = await generateSpinningStoppageReport(normalizedDate)
    
    // Convert dates to ISO strings for JSON serialization
    if (reportData.success && reportData.date) {
      reportData.date = new Date(reportData.date).toISOString()
    }
    
    return reportData
  } catch (error) {
    console.error('Error in generateSpinningStoppageReportAction:', error)
    return {
      success: false,
      message: error.message || 'Failed to generate report'
    }
  }
}
