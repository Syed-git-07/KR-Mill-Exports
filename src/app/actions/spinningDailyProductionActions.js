'use server'

import { fetchSpinningDailyProductionReport } from '@/lib/queries/spinningDailyProductionQueries'

/**
 * Server action to fetch Spinning Daily Production Report
 * @param {string} reportDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Report data
 */
export async function getSpinningDailyProductionReport(reportDate) {
  return await fetchSpinningDailyProductionReport(reportDate)
}
