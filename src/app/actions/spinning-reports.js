'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

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
export async function generateSpinningStoppageReportAction(selectedDate, selectedToDate = selectedDate) {
  await requireUser()
  try {
    const normalizedDate = normalizeDate(selectedDate)
    const normalizedToDate = normalizeDate(selectedToDate)
    
    const reportData = await generateSpinningStoppageReport(normalizedDate, normalizedToDate)
    
    // Convert dates to ISO strings for JSON serialization
    if (reportData.success && reportData.date) {
      reportData.date = new Date(reportData.date).toISOString()
      reportData.toDate = new Date(reportData.toDate || reportData.date).toISOString()
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
