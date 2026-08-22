'use server'

import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/security/auth'
import { safeActionError } from '@/lib/security/errors'
import { buildFinalReport } from '@/lib/reports/finalReportQueries'
import { getFinalReportConfig } from '@/lib/reports/finalReportCatalog'

function reportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Invalid report date')
  return new Date(`${value}T00:00:00.000Z`)
}

export async function generateFinalReportAction(reportKey, from, to, employeeName = '') {
  await requireUser()
  try {
    const config = getFinalReportConfig(reportKey)
    if (!config) return { success: false, error: 'Unknown report type' }
    if (config.requiresEmployee && !employeeName.trim()) return { success: false, error: 'Select a sider to generate this report' }
    const fromDate = reportDate(from)
    const toDate = reportDate(to)
    if (fromDate > toDate) return { success: false, error: 'From date cannot be after To date' }
    const report = await buildFinalReport(reportKey, fromDate, toDate, employeeName.trim())
    return { success: true, data: report }
  } catch (error) {
    console.error(`Failed to generate ${reportKey}:`, error)
    return { success: false, error: safeActionError(error) }
  }
}

export async function listFinalReportEmployeesAction() {
  await requireUser()
  try {
    const employees = await prisma.employee_master.findMany({
      where: { is_active: true },
      select: { emp_name: true, emp_code: true, department: true },
      orderBy: { emp_name: 'asc' }
    })
    return { success: true, data: employees.map(employee => ({ name: employee.emp_name, code: employee.emp_code || '', department: employee.department || '' })) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
