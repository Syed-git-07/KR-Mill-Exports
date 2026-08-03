'use server'

import { safeActionError } from '@/lib/security/errors'

import { generateSpinningStoppageReport } from '@/lib/queries/spinningStoppageReportQueries'
import { parseStrictDate } from '@/lib/strictDate'

/**
 * Normalize date to UTC midnight for MySQL DATE comparison
 * Prevents timezone offset issues when comparing with DATE fields
 */
function normalizeDate(dateString) {
  return parseStrictDate(dateString, 'Report date')
}

/**
 * Server action to generate Spinning Stoppage Percentage Report
 * @param {string} selectedDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Report data with stoppage details by category
 */
export async function generateSpinningStoppageReportAction(selectedDate) {
  try {
    const normalizedDate = normalizeDate(selectedDate)
    
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
      message: safeActionError(error)
    }
  }
}
