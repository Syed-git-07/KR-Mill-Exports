import { prisma } from '../prisma'
import { getPayrollEmployeesByIds } from '../payroll/employees'
import { resolveHistoricalEmployeeIdentity } from '../payroll/historicalEmployeeIdentity'

/**
 * Department configurations for sider performance report
 */
const DEPARTMENTS = {
  CARDING: { code: 'CARDING', name: 'CARDING', table: 'carding', effiField: 'effi_percent' },
  BREAKER: { code: 'BREAKER', name: 'BREAKER DRAWING', table: 'breaker_drawing', effiField: 'effi_percent' },
  LAPFORMER: { code: 'LAPFORMER', name: 'LAP FORMER', table: 'lap_former', effiField: 'effi_percent' },
  COMBER: { code: 'COMBER', name: 'COMBER', table: 'comber', effiField: 'act_effi_percent' },
  FINISHER: { code: 'FINISHER', name: 'FINISHER DRAWING', table: 'finisher_drawing', effiField: 'effi_percent' },
  SIMPLEX: { code: 'SIMPLEX', name: 'SIMPLEX', table: 'simplex', effiField: 'act_effi_percent' }
}

/**
 * Get employee performance data for a single department
 */
async function getDepartmentEmployeePerformance(departmentCode, fromDate, toDate) {
  const dept = Object.values(DEPARTMENTS).find(d => d.code === departmentCode)
  if (!dept) throw new Error(`Invalid department: ${departmentCode}`)

  const tablePrefix = dept.table

  // Query production headers within date range
  const headers = await prisma[`${tablePrefix}_production_header`].findMany({
    where: {
      entry_date: {
        gte: fromDate,
        lte: toDate
      }
    },
    select: {
      id: true,
      entry_date: true
    }
  })

  if (headers.length === 0) {
    return []
  }

  const headerIds = headers.map(h => h.id)

  // Get the correct efficiency field name for this department
  const effiField = dept.effiField

  // Query production details for these headers
  const details = await prisma[`${tablePrefix}_production_detail`].findMany({
    where: {
      header_id: {
        in: headerIds
      }
    },
    select: {
      id: true,
      employee_name: true,
      payroll_employee_id: true,
      act_prodn: true,
      [effiField]: true,
      uti_percent: true,
      waste_percent: true
    }
  })

  if (details.length === 0) {
    return []
  }

  const employeeIds = [...new Set(details.map(detail => detail.payroll_employee_id).filter(Boolean))]
  const employeeMasters = await getPayrollEmployeesByIds(employeeIds)
  const masterById = new Map(employeeMasters.map(employee => [Number(employee.id), employee]))

  // Mapped rows aggregate strictly by payroll employee ID. An unresolved
  // historical assignment gets its own local detail key; names are never used
  // as identity or silently collapsed together.
  const employeeMap = new Map()

  details.forEach(detail => {
    const employee = masterById.get(Number(detail.payroll_employee_id)) || null
    const identity = resolveHistoricalEmployeeIdentity({
      payrollEmployeeId: detail.payroll_employee_id,
      snapshotName: detail.employee_name,
      employee,
      assignmentKey: `${tablePrefix}:${detail.id}`
    })

    if (!employeeMap.has(identity.groupKey)) {
      employeeMap.set(identity.groupKey, {
        identity,
        totalProduction: 0,
        totalEfficiency: 0,
        totalUtilization: 0,
        totalWastePercent: 0,
        metricWeight: 0,
        recordCount: 0
      })
    }

    const production = parseFloat(detail.act_prodn || 0)
    const efficiency = parseFloat(detail[effiField] || 0) // Use dynamic field name
    const utilization = parseFloat(detail.uti_percent || 0)
    const wastePercent = parseFloat(detail.waste_percent || 0)

    const emp = employeeMap.get(identity.groupKey)
    emp.totalProduction += production
    emp.totalEfficiency += efficiency
    emp.totalUtilization += utilization
    emp.totalWastePercent += wastePercent
    emp.metricWeight += production
    emp.recordCount++
    emp.weightedWaste = (emp.weightedWaste || 0) + (Number(detail.waste_percent) || 0) * production
  })

  const employees = [...employeeMap.values()].map(emp => {
    const master = emp.identity.employee
    const average = (weighted, fallback) => emp.metricWeight > 0
      ? weighted / emp.metricWeight
      : (emp.recordCount > 0 ? fallback / emp.recordCount : 0)
    return {
      payrollEmployeeId: emp.identity.payrollEmployeeId,
      identityStatus: emp.identity.identityStatus,
      name: emp.identity.displayName,
      tokenNo: master?.token_no || master?.emp_code || (emp.identity.identityStatus === 'UNRESOLVED_LEGACY' ? 'UNMAPPED' : '-'),
      employeeCode: master?.employee_code || '-',
      doj: master?.doj ? new Date(master.doj).toISOString() : null,
      productionKgs: parseFloat(emp.totalProduction.toFixed(2)),
      efficiencyPercent: parseFloat((emp.recordCount ? emp.totalEfficiency / emp.recordCount : 0).toFixed(2)),
      utilizationPercent: parseFloat((emp.recordCount ? emp.totalUtilization / emp.recordCount : 0).toFixed(2)),
      wastePercent: parseFloat(average(emp.weightedWaste, emp.totalWastePercent).toFixed(2))
    }
  })

  // The template lists names alphabetically within each department.
  employees.sort((a, b) => a.name.localeCompare(b.name) || String(a.tokenNo).localeCompare(String(b.tokenNo), undefined, { numeric: true }) || (a.payrollEmployeeId || 0) - (b.payrollEmployeeId || 0))

  return employees
}

/**
 * Generate Preparatory Sider Performance Report
 */
export async function generatePreparatorySiderPerformanceReport(fromDate, toDate) {
  const reportData = {
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString()
    },
    departments: {}
  }

  let totalEmployees = 0

  const departments = Object.values(DEPARTMENTS)
  const results = await Promise.all(
    departments.map(async (dept) => ({
      dept,
      employees: await getDepartmentEmployeePerformance(dept.code, fromDate, toDate)
    }))
  )

  // Process all departments in the original display order.
  for (const { dept, employees } of results) {

    if (employees.length > 0) {
      reportData.departments[dept.name] = {
        employees
      }
      totalEmployees += employees.length
    }
  }

  return reportData
}
