'use server'

import { safeActionError } from '@/lib/security/errors'

const { getAutoconerStoppagePercentageReport } = require('./autoconerStoppagePercentageQueries')

/**
 * Server action — Autoconer Stoppage Percentage Report
 * @param {string} fromDate  YYYY-MM-DD
 * @param {string} toDate    YYYY-MM-DD (optional, defaults to fromDate)
 */
export async function fetchAutoconerStoppagePercentageReport(fromDate, toDate = null) {
  try {
    const data = await getAutoconerStoppagePercentageReport(fromDate, toDate)
    return data
  } catch (error) {
    console.error('Error in fetchAutoconerStoppagePercentageReport:', error)
    return { success: false, error: safeActionError(error) || 'Failed to fetch report data' }
  }
}
