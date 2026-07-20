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

  console.log(`[${departmentCode}] Querying employee performance...`)

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
    console.log(`[${departmentCode}] No headers found`)
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
    }
  })

  if (details.length === 0) {
    console.log(`[${departmentCode}] No employee data found`)
    return []
  }

  console.log(`[${departmentCode}] Found ${details.length} production records`)

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
    employeeMap[empName].recordCount++
  })

  // Convert to array and calculate averages
  const employees = Object.values(employeeMap).map(emp => ({
    name: emp.name,
    productionKgs: parseFloat(emp.totalProduction.toFixed(2)),
    efficiencyPercent: emp.recordCount > 0 ? parseFloat((emp.totalEfficiency / emp.recordCount).toFixed(2)) : 0,
    utilizationPercent: emp.recordCount > 0 ? parseFloat((emp.totalUtilization / emp.recordCount).toFixed(2)) : 0,
    wastePercent: emp.recordCount > 0 ? parseFloat((emp.totalWastePercent / emp.recordCount).toFixed(2)) : 0
  }))

  // Sort by production descending
  employees.sort((a, b) => b.productionKgs - a.productionKgs)

  console.log(`[${departmentCode}] Aggregated ${employees.length} employees`)
  
  return employees
}

/**
 * Generate Preparatory Sider Performance Report
 */
export async function generatePreparatorySiderPerformanceReport(fromDate, toDate) {
  console.log('Generating Preparatory Sider Performance Report...')
  console.log('  Period From:', fromDate.toISOString())
  console.log('  Period To:', toDate.toISOString())

  const reportData = {
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString()
    },
    departments: {}
  }

  let totalEmployees = 0

  // Process all departments
  for (const dept of Object.values(DEPARTMENTS)) {
    console.log(`Processing ${dept.name}...`)

    const employees = await getDepartmentEmployeePerformance(dept.code, fromDate, toDate)

    if (employees.length > 0) {
      reportData.departments[dept.name] = {
        employees
      }
      totalEmployees += employees.length
    }
  }

  console.log(`Report generation complete! Total employees: ${totalEmployees}`)
  return reportData
}
