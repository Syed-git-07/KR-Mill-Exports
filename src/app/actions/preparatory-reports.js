'use server'

import { safeActionError } from '@/lib/security/errors'

import { generatePreparatoryStoppageReport, getPreparatoryDateRange } from '@/lib/queries/preparatoryStoppageReportQueries'
import { generatePreparatoryWasteReport } from '@/lib/queries/preparatoryWasteReportQueries'
import { generatePreparatorySiderPerformanceReport } from '@/lib/queries/preparatorySiderPerformanceReportQueries'

/**
 * Server action to generate preparatory stoppage percentage report
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date
 * @returns {Promise<Object>} { success, data, error }
 */
export async function generatePreparatoryStoppageReportAction(fromDate, toDate) {
  try {
    // Convert strings to Date objects if needed
    let from = typeof fromDate === 'string' ? new Date(fromDate) : fromDate
    let to = typeof toDate === 'string' ? new Date(toDate) : toDate
    
    // Create date-only values for MySQL DATE comparison (no timezone conversion)
    // Extract year, month, day and create new Date in UTC
    const fromYear = from.getFullYear()
    const fromMonth = from.getMonth()
    const fromDay = from.getDate()
    
    const toYear = to.getFullYear()
    const toMonth = to.getMonth()
    const toDay = to.getDate()
    
    // Create dates at midnight UTC to match MySQL DATE storage
    const normalizedFrom = new Date(Date.UTC(fromYear, fromMonth, fromDay, 0, 0, 0))
    const normalizedTo = new Date(Date.UTC(toYear, toMonth, toDay, 23, 59, 59))

    const report = await generatePreparatoryStoppageReport(normalizedFrom, normalizedTo)
    
    return {
      success: true,
      data: report
    }
  } catch (error) {
    console.error('Error generating preparatory stoppage report:', error)
    return {
      success: false,
      error: safeActionError(error) || 'Failed to generate report'
    }
  }
}

/**
 * Server action to get available date range for preparatory data
 * @returns {Promise<Object>} { success, data: { minDate, maxDate }, error }
 */
export async function getPreparatoryDateRangeAction() {
  try {
    const dateRange = await getPreparatoryDateRange()
    
    return {
      success: true,
      data: dateRange
    }
  } catch (error) {
    console.error('Error getting preparatory date range:', error)
    return {
      success: false,
      error: safeActionError(error) || 'Failed to get date range'
    }
  }
}

/**
 * Server action to generate preparatory waste abstract report
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date
 * @returns {Promise<Object>} { success, data, error }
 */
export async function generatePreparatoryWasteReportAction(fromDate, toDate) {
  try {
    // Convert strings to Date objects if needed
    let from = typeof fromDate === 'string' ? new Date(fromDate) : fromDate
    let to = typeof toDate === 'string' ? new Date(toDate) : toDate
    
    // Create date-only values for MySQL DATE comparison (no timezone conversion)
    // Extract year, month, day and create new Date in UTC
    const fromYear = from.getFullYear()
    const fromMonth = from.getMonth()
    const fromDay = from.getDate()
    
    const toYear = to.getFullYear()
    const toMonth = to.getMonth()
    const toDay = to.getDate()
    
    // Create dates at midnight UTC to match MySQL DATE storage
    const normalizedFrom = new Date(Date.UTC(fromYear, fromMonth, fromDay, 0, 0, 0))
    const normalizedTo = new Date(Date.UTC(toYear, toMonth, toDay, 23, 59, 59))

    const report = await generatePreparatoryWasteReport(normalizedFrom, normalizedTo)
    
    return {
      success: true,
      data: report
    }
  } catch (error) {
    console.error('Error generating preparatory waste report:', error)
    return {
      success: false,
      error: safeActionError(error) || 'Failed to generate report'
    }
  }
}

/**
 * Server action to generate preparatory sider performance report
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date
 * @returns {Promise<Object>} { success, data, error }
 */
export async function generatePreparatorySiderPerformanceReportAction(fromDate, toDate) {
  try {
    // Convert strings to Date objects if needed
    let from = typeof fromDate === 'string' ? new Date(fromDate) : fromDate
    let to = typeof toDate === 'string' ? new Date(toDate) : toDate
    
    // Create date-only values for MySQL DATE comparison (no timezone conversion)
    // Extract year, month, day and create new Date in UTC
    const fromYear = from.getFullYear()
    const fromMonth = from.getMonth()
    const fromDay = from.getDate()
    
    const toYear = to.getFullYear()
    const toMonth = to.getMonth()
    const toDay = to.getDate()
    
    // Create dates at midnight UTC to match MySQL DATE storage
    const normalizedFrom = new Date(Date.UTC(fromYear, fromMonth, fromDay, 0, 0, 0))
    const normalizedTo = new Date(Date.UTC(toYear, toMonth, toDay, 23, 59, 59))

    const report = await generatePreparatorySiderPerformanceReport(normalizedFrom, normalizedTo)
    
    return {
      success: true,
      data: report
    }
  } catch (error) {
    console.error('Error generating preparatory sider performance report:', error)
    return {
      success: false,
      error: safeActionError(error) || 'Failed to generate report'
    }
  }
}

