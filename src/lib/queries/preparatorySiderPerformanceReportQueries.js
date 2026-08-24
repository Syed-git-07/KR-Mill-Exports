import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

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
      },
      employee_name: {
        not: null
      }
    },
    select: {
      employee_name: true,
      act_prodn: true,
      [effiField]: true,
      uti_percent: true,
      waste_percent: true
    }
  })

  if (details.length === 0) {
    return []
  }

  const employeeNames = [...new Set(details.map(detail => detail.employee_name).filter(Boolean))]
  const employeeMasters = await prisma.$queryRaw`
    SELECT
      firstName AS emp_name,
      CAST(biometricEnrollmentId AS CHAR) AS emp_code,
      dateOfJoining AS doj
    FROM payroll.employees
    WHERE firstName IN (${Prisma.join(employeeNames)})
  `
  const masterByName = new Map(employeeMasters.map(employee => [employee.emp_name.trim().toLowerCase(), employee]))

  // Aggregate by employee
  const employeeMap = {}

  details.forEach(detail => {
    const empName = detail.employee_name
    if (!empName) return

    if (!employeeMap[empName]) {
      employeeMap[empName] = {
        name: empName,
        totalProduction: 0,
        totalEfficiency: 0,
        totalUtilization: 0,
        totalWastePercent: 0,
        metricWeight: 0,
        recordCount: 0
      }
    }

    const production = parseFloat(detail.act_prodn || 0)
    const efficiency = parseFloat(detail[effiField] || 0) // Use dynamic field name
    const utilization = parseFloat(detail.uti_percent || 0)
    const wastePercent = parseFloat(detail.waste_percent || 0)

    employeeMap[empName].totalProduction += production
    employeeMap[empName].totalEfficiency += efficiency
    employeeMap[empName].totalUtilization += utilization
    employeeMap[empName].totalWastePercent += wastePercent
    employeeMap[empName].metricWeight += production
    employeeMap[empName].recordCount++
  })

  // The stored row percentages are authoritative. Weight them by production
  // for a range report so a very small run does not distort a sider's result.
  details.forEach(detail => {
    const emp = employeeMap[detail.employee_name]
    if (!emp) return
    const production = Number(detail.act_prodn) || 0
    emp.weightedEfficiency = (emp.weightedEfficiency || 0) + (Number(detail[effiField]) || 0) * production
    emp.weightedUtilization = (emp.weightedUtilization || 0) + (Number(detail.uti_percent) || 0) * production
    emp.weightedWaste = (emp.weightedWaste || 0) + (Number(detail.waste_percent) || 0) * production
  })

  const employees = Object.values(employeeMap).flatMap(emp => {
    const master = masterByName.get(emp.name.trim().toLowerCase())
    if (!master) return []
    const average = (weighted, fallback) => emp.metricWeight > 0
      ? weighted / emp.metricWeight
      : (emp.recordCount > 0 ? fallback / emp.recordCount : 0)
    return [{
      name: master.emp_name,
      tokenNo: master.emp_code || '-',
      doj: master.doj ? master.doj.toISOString() : null,
      productionKgs: parseFloat(emp.totalProduction.toFixed(2)),
      efficiencyPercent: parseFloat(average(emp.weightedEfficiency, emp.totalEfficiency).toFixed(2)),
      utilizationPercent: parseFloat(average(emp.weightedUtilization, emp.totalUtilization).toFixed(2)),
      wastePercent: parseFloat(average(emp.weightedWaste, emp.totalWastePercent).toFixed(2))
    }]
  })

  // Sort by production descending
  employees.sort((a, b) => b.productionKgs - a.productionKgs)

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
