import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { getPayrollEmployeesByIds } from '@/lib/payroll/employees'

/**
 * Fetch sider monthly report data
 * Groups by frame (machine), shift and calculates waste metrics
 */
export async function fetchSiderMonthlyData(fromDate, toDate) {
  try {
    // Get all production details with sider information for the date range
    const productionData = await prisma.$queryRaw`
      SELECT 
        sm.machine_no as frame_no,
        sm.id as machine_id,
        GROUP_CONCAT(DISTINCT spd.sider1_payroll_employee_id ORDER BY spd.sider1_payroll_employee_id SEPARATOR ',') as sider1_employee_ids,
        GROUP_CONCAT(DISTINCT spd.sider2_payroll_employee_id ORDER BY spd.sider2_payroll_employee_id SEPARATOR ',') as sider2_employee_ids,
        sph.shift,
        SUM(spd.act_prodn) as total_production,
        SUM(spd.waste) as total_waste,
        COALESCE((SUM(spd.waste) / NULLIF(SUM(spd.act_prodn), 0)) * 100, 0) as avg_waste_percent,
        sm.sort_order
      FROM spinning_production_detail spd
      INNER JOIN spinning_production_header sph ON spd.header_id = sph.id
      INNER JOIN spinning_machines sm ON spd.machine_id = sm.id
      WHERE sph.entry_date BETWEEN ${format(fromDate, 'yyyy-MM-dd')} AND ${format(toDate, 'yyyy-MM-dd')}
      GROUP BY sm.id, sm.machine_no, sm.sort_order, sph.shift
      ORDER BY sm.sort_order, sm.machine_no, sph.shift
    `

    const employeeIds = productionData.flatMap(row => [row.sider1_employee_ids, row.sider2_employee_ids]
      .flatMap(value => String(value || '').split(','))
      .map(Number)
      .filter(id => Number.isSafeInteger(id) && id > 0))
    const employees = await getPayrollEmployeesByIds(employeeIds)
    const employeeById = new Map(employees.map(employee => [Number(employee.id), employee]))

    // Transform data into a structured format
    const frameMap = new Map()

    for (const row of productionData) {
      const frameKey = row.frame_no
      
      if (!frameMap.has(frameKey)) {
        frameMap.set(frameKey, {
          frameNo: row.frame_no,
          shifts: {
            1: { siderName: null, production: 0, waste: 0, wastePercent: 0, doj: null },
            2: { siderName: null, production: 0, waste: 0, wastePercent: 0, doj: null },
            3: { siderName: null, production: 0, waste: 0, wastePercent: 0, doj: null }
          }
        })
      }

      const frame = frameMap.get(frameKey)
      const shift = row.shift

      if (frame.shifts[shift]) {
        const shiftEmployeeIds = [...new Set([row.sider1_employee_ids, row.sider2_employee_ids]
          .flatMap(value => String(value || '').split(','))
          .map(Number)
          .filter(id => Number.isSafeInteger(id) && id > 0))]
        const shiftEmployees = shiftEmployeeIds
          .map(id => employeeById.get(id))
          .filter(Boolean)
        frame.shifts[shift].siderName = shiftEmployees.map(employee => employee.emp_name).join(', ') || 'NIL'
        frame.shifts[shift].production = parseFloat(row.total_production || 0)
        frame.shifts[shift].waste = parseFloat(row.total_waste || 0)
        frame.shifts[shift].wastePercent = parseFloat(row.avg_waste_percent || 0)
        // Format DOJ as dd-MMM-yy (e.g., "02-Sep-24")
        const joiningDates = shiftEmployees.map(employee => employee.doj).filter(Boolean).map(value => new Date(value))
        if (joiningDates.length) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          frame.shifts[shift].doj = joiningDates.map(dojDate => {
            const day = String(dojDate.getDate()).padStart(2, '0')
            const month = months[dojDate.getMonth()]
            const year = String(dojDate.getFullYear()).slice(-2)
            return `${day}-${month}-${year}`
          }).join(', ')
        } else {
          frame.shifts[shift].doj = null
        }
      }
    }

    // Convert map to array
    const reportData = Array.from(frameMap.values())

    // Calculate totals for each shift
    const totals = {
      shift1: { production: 0, waste: 0, wastePercent: 0 },
      shift2: { production: 0, waste: 0, wastePercent: 0 },
      shift3: { production: 0, waste: 0, wastePercent: 0 }
    }

    reportData.forEach(frame => {
      totals.shift1.production += frame.shifts[1].production
      totals.shift1.waste += frame.shifts[1].waste
      totals.shift2.production += frame.shifts[2].production
      totals.shift2.waste += frame.shifts[2].waste
      totals.shift3.production += frame.shifts[3].production
      totals.shift3.waste += frame.shifts[3].waste
    })

    // Totals use total waste / total production, matching the mill report.
    totals.shift1.wastePercent = totals.shift1.production > 0 ? totals.shift1.waste / totals.shift1.production * 100 : 0
    totals.shift2.wastePercent = totals.shift2.production > 0 ? totals.shift2.waste / totals.shift2.production * 100 : 0
    totals.shift3.wastePercent = totals.shift3.production > 0 ? totals.shift3.waste / totals.shift3.production * 100 : 0

    return {
      reportData,
      totals
    }

  } catch (error) {
    console.error('Error fetching sider monthly data:', error)
    throw error
  }
}
