'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

const { getSpinningMachineWiseProductionReport } = require('./spinningMachineWiseProductionQueries')

/**
 * Server action — Spinning Machine-wise Production Report
 * @param {string} fromDate  YYYY-MM-DD
 * @param {string} toDate    YYYY-MM-DD (optional, defaults to fromDate)
 */
export async function fetchSpinningMachineWiseProductionReport(fromDate, toDate = null) {
  await requireUser()
  try {
    const data = await getSpinningMachineWiseProductionReport(fromDate, toDate)
    return { success: true, data }
  } catch (error) {
    console.error('Error in fetchSpinningMachineWiseProductionReport:', error)
    return { success: false, error: safeActionError(error) || 'Failed to fetch report data' }
  }
}
