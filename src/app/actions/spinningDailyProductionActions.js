'use server'

import { requireUser } from '@/lib/security/auth'

import { fetchSpinningDailyProductionReport } from '@/lib/queries/spinningDailyProductionQueries'

/**
 * Server action to fetch Spinning Daily Production Report
 * @param {string} reportDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Report data
 */
export async function getSpinningDailyProductionReport(reportDate) {
  await requireUser()
  return await fetchSpinningDailyProductionReport(reportDate)
}
