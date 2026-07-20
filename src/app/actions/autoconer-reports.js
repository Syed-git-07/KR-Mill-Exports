'use server'

/**
 * Server Actions for Autoconer Reports
 * Handles data fetching and processing for various autoconer reports
 */

import {
  generateAutoconerLowEfficiencyReport,
  getAutoconerDateRange
} from '@/lib/queries/autoconerLowEfficiencyReportQueries'
import { generateAutoconerParticularSiderReport } from '@/lib/queries/autoconerParticularSiderReportQueries'
import { generateAutoconerEfficiencyReport } from '@/lib/queries/autoconerEfficiencyReportQueries'

/**
 * Normalize date to UTC midnight for MySQL DATE comparison
 */
function normalizeDate(dateString) {
  const date = new Date(dateString)
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0))
}

/**
 * Generate Autoconer Low Efficiency Report
 * @param {string} selectedDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Report data
 */
export async function generateAutoconerLowEfficiencyReportAction(selectedDate) {
  try {
    const normalizedDate = normalizeDate(selectedDate)
    const reportData = await generateAutoconerLowEfficiencyReport(normalizedDate)
    
    // Convert dates to ISO strings for JSON serialization
    return {
      ...reportData,
      date: reportData.date.toISOString()
    }
  } catch (error) {
    console.error('Error generating autoconer low efficiency report:', error)
    throw new Error('Failed to generate report: ' + error.message)
  }
}

/**
 * Get available date range for autoconer reports
 * @returns {Promise<Object>} { minDate, maxDate } as ISO strings
 */
export async function getAutoconerDateRangeAction() {
  try {
    const { minDate, maxDate } = await getAutoconerDateRange()
    return {
      minDate: minDate ? minDate.toISOString() : null,
      maxDate: maxDate ? maxDate.toISOString() : null
    }
  } catch (error) {
    console.error('Error getting autoconer date range:', error)
    throw new Error('Failed to get date range: ' + error.message)
  }
}

/**
 * Generate Autoconer Particular Sider Report
 * @param {string} empName - Employee name
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date  
 * @returns {Promise<Object>} Report data
 */
export async function generateAutoconerParticularSiderReportAction(empName, fromDate, toDate) {
  try {
    const normalizedFromDate = normalizeDate(fromDate)
    const normalizedToDate = normalizeDate(toDate)
    
    const reportData = await generateAutoconerParticularSiderReport(
      empName,
      normalizedFromDate,
      normalizedToDate
    )
    
    if (!reportData.success) {
      return reportData
    }
    
    // Convert dates to ISO strings for JSON serialization
    return {
      ...reportData,
      data: {
        ...reportData.data,
        employee: {
          ...reportData.data.employee,
          doj: reportData.data.employee.doj ? reportData.data.employee.doj.toISOString() : null
        },
        period: {
          from: reportData.data.period.from.toISOString(),
          to: reportData.data.period.to.toISOString()
        },
        performance: reportData.data.performance.map(p => ({
          ...p,
          date: p.date.toISOString()
        }))
      }
    }
  } catch (error) {
    console.error('Error generating autoconer particular sider report:', error)
    return {
      success: false,
      message: error.message || 'Failed to generate report'
    }
  }
}

/**
 * Generate Autoconer Efficiency Report
 * @param {string} selectedDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Report data with grid structure
 */
export async function generateAutoconerEfficiencyReportAction(selectedDate) {
  try {
    const normalizedDate = normalizeDate(selectedDate)
    const reportData = await generateAutoconerEfficiencyReport(normalizedDate)
    
    if (!reportData.success) {
      return reportData
    }
    
    // Convert dates to ISO strings for JSON serialization
    return {
      ...reportData,
      date: reportData.date.toISOString()
    }
  } catch (error) {
    console.error('Error generating autoconer efficiency report:', error)
    return {
      success: false,
      message: error.message || 'Failed to generate report'
    }
  }
}
