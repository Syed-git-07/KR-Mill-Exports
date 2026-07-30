'use server'

import { safeActionError } from '@/lib/security/errors'

const { getAutoconerCountWiseProductionReport } = require('./autoconerCountWiseProductionQueries')

/**
 * Server action — Autoconer Count-wise Production Report
 * @param {string} fromDate  YYYY-MM-DD
 * @param {string} toDate    YYYY-MM-DD (optional, defaults to fromDate)
 */
export async function fetchAutoconerCountWiseProductionReport(fromDate, toDate = null) {
  try {
    const data = await getAutoconerCountWiseProductionReport(fromDate, toDate)
    return { success: true, data }
  } catch (error) {
    console.error('Error in fetchAutoconerCountWiseProductionReport:', error)
    return { success: false, error: safeActionError(error) || 'Failed to fetch report data' }
  }
}
