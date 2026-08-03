'use server'

import { safeActionError } from '@/lib/security/errors'

import { generatePreparatoryStoppageReport, getPreparatoryDateRange } from '@/lib/queries/preparatoryStoppageReportQueries'
import { generatePreparatoryWasteReport } from '@/lib/queries/preparatoryWasteReportQueries'
import { generatePreparatorySiderPerformanceReport } from '@/lib/queries/preparatorySiderPerformanceReportQueries'
import { parseStrictDate } from '@/lib/strictDate'

function normalizeReportDate(value, label) {
  if (!(value instanceof Date)) return parseStrictDate(value, label)
  if (Number.isNaN(value.getTime())) return parseStrictDate('', label)
  const localDateKey = [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0')
  ].join('-')
  return parseStrictDate(localDateKey, label)
}

function normalizeReportRange(fromDate, toDate) {
  const from = normalizeReportDate(fromDate, 'From date')
  const toDateOnly = normalizeReportDate(toDate, 'To date')
  if (from > toDateOnly) {
    const error = new Error('From date cannot be after to date')
    error.code = 'INVALID_DATE'
    throw error
  }
  const to = new Date(toDateOnly)
  to.setUTCHours(23, 59, 59, 999)
  return { from, to }
}

/**
 * Server action to generate preparatory stoppage percentage report
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date
 * @returns {Promise<Object>} { success, data, error }
 */
export async function generatePreparatoryStoppageReportAction(fromDate, toDate) {
  try {
    const { from: normalizedFrom, to: normalizedTo } = normalizeReportRange(fromDate, toDate)

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
    const { from: normalizedFrom, to: normalizedTo } = normalizeReportRange(fromDate, toDate)

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
    const { from: normalizedFrom, to: normalizedTo } = normalizeReportRange(fromDate, toDate)

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

