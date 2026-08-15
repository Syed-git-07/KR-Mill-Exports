'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { fetchSpinningAbstractSummary, fetchSpinningAbstractTableData, fetchCountwiseSummary } from './spinningAbstractQueries'

export async function fetchSpinningProductionAbstract(reportDate) {
  await requireUser()
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
      error: safeActionError(error)
    }
  }
}
