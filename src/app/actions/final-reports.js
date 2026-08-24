'use server'

import { requireUser } from '@/lib/security/auth'
import { safeActionError } from '@/lib/security/errors'
import { buildFinalReport } from '@/lib/reports/finalReportQueries'
import { getFinalReportConfig } from '@/lib/reports/finalReportCatalog'

function reportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Invalid report date')
  return new Date(`${value}T00:00:00.000Z`)
}

export async function generateFinalReportAction(reportKey, from, to, employeeId = null) {
  await requireUser()
  try {
    const config = getFinalReportConfig(reportKey)
    if (!config) return { success: false, error: 'Unknown report type' }
    const payrollEmployeeId = employeeId == null || employeeId === '' ? null : Number(employeeId)
    if (config.requiresEmployee && (!Number.isSafeInteger(payrollEmployeeId) || payrollEmployeeId <= 0)) {
      return { success: false, error: 'Select a payroll employee to generate this report' }
    }
    const fromDate = reportDate(from)
    const toDate = reportDate(to)
    if (fromDate > toDate) return { success: false, error: 'From date cannot be after To date' }
    const report = await buildFinalReport(reportKey, fromDate, toDate, payrollEmployeeId)
    return { success: true, data: report }
  } catch (error) {
    console.error(`Failed to generate ${reportKey}:`, error)
    return { success: false, error: safeActionError(error) }
  }
}
