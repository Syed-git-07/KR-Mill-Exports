'use server'

import { fetchSiderMonthlyData } from './siderMonthlyQueries'

export async function fetchSiderMonthlyReport(fromDate, toDate) {
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
      error: error.message
    }
  }
}
