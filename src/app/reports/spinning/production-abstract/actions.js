'use server'

import { fetchSpinningAbstractSummary, fetchSpinningAbstractTableData, fetchCountwiseSummary } from './spinningAbstractQueries'

export async function fetchSpinningProductionAbstract(reportDate) {
  try {
    const summaryData = await fetchSpinningAbstractSummary(reportDate)
    const abstractData = await fetchSpinningAbstractTableData(reportDate)
    const countwiseSummary = await fetchCountwiseSummary(reportDate)
    
    return {
      success: true,
      data: {
        ...summaryData,
        abstractData,
        countwiseSummary
      }
    }
  } catch (error) {
    console.error('Error fetching spinning production abstract:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
