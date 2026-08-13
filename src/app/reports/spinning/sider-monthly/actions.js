'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { fetchSiderMonthlyData } from './siderMonthlyQueries'

export async function fetchSiderMonthlyReport(fromDate, toDate) {
  await requireUser()
  try {
    const { reportData, totals } = await fetchSiderMonthlyData(fromDate, toDate)
    
    return {
      success: true,
      data: {
        reportData,
        totals
      }
    }
  } catch (error) {
    console.error('Error fetching sider monthly report:', error)
    return {
      success: false,
      error: safeActionError(error)
    }
  }
}
