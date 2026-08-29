import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { getPayrollEmployeesByIds } from '@/lib/payroll/employees'
import { resolveHistoricalEmployeeIdentity } from '@/lib/payroll/historicalEmployeeIdentity'

/**
 * Fetch sider monthly report data
 * Groups by frame (machine), shift and calculates waste metrics
 */
export async function fetchSiderMonthlyData(fromDate, toDate) {
  try {
    // Calendar selections arrive from the browser as local-midnight instants
    // (for example, 28 Aug in IST is serialized as 27 Aug 18:30 UTC). Prisma
    // compares DateTime values in UTC, while the aggregate query below uses
    // the local calendar date. Normalize both paths to the database's DATE
    // representation so production totals and sider identities stay aligned.
    const fromDateKey = format(fromDate, 'yyyy-MM-dd')
    const toDateKey = format(toDate, 'yyyy-MM-dd')
    const databaseFromDate = new Date(`${fromDateKey}T00:00:00.000Z`)
    const databaseToDate = new Date(`${toDateKey}T00:00:00.000Z`)

    // Get all production details with sider information for the date range
    const [productionData, headers] = await Promise.all([prisma.$queryRaw`
      SELECT 
        sm.machine_no as frame_no,
        sm.id as machine_id,
        sph.shift,
        SUM(spd.act_prodn) as total_production,
        SUM(spd.waste) as total_waste,
        COALESCE((SUM(spd.waste) / NULLIF(SUM(spd.act_prodn), 0)) * 100, 0) as avg_waste_percent,
        sm.sort_order
      FROM spinning_production_detail spd
      INNER JOIN spinning_production_header sph ON spd.header_id = sph.id
      INNER JOIN spinning_machines sm ON spd.machine_id = sm.id
      WHERE sph.entry_date BETWEEN ${fromDateKey} AND ${toDateKey}
      GROUP BY sm.id, sm.machine_no, sm.sort_order, sph.shift
      ORDER BY sm.sort_order, sm.machine_no, sph.shift
    `, prisma.spinning_production_header.findMany({
      where: { entry_date: { gte: databaseFromDate, lte: databaseToDate } },
      select: { id: true, shift: true }
    })])

    const identityDetails = headers.length
      ? await prisma.spinning_production_detail.findMany({
          where: { header_id: { in: headers.map(header => header.id) } },
          select: {
            id: true,
            header_id: true,
            machine_id: true,
            sider1_name: true,
            sider1_payroll_employee_id: true,
            sider2_name: true,
            sider2_payroll_employee_id: true
          }
        })
      : []
    const employeeIds = identityDetails.flatMap(detail => [
      detail.sider1_payroll_employee_id,
      detail.sider2_payroll_employee_id
    ])
    const employees = await getPayrollEmployeesByIds(employeeIds)
    const employeeById = new Map(employees.map(employee => [Number(employee.id), employee]))
    const headerById = new Map(headers.map(header => [header.id, header]))
    const identitiesByMachineShift = new Map()

    for (const detail of identityDetails) {
      const shift = headerById.get(detail.header_id)?.shift
      const key = `${detail.machine_id}|${shift}`
      if (!identitiesByMachineShift.has(key)) identitiesByMachineShift.set(key, [])
      const identities = [
        resolveHistoricalEmployeeIdentity({
          payrollEmployeeId: detail.sider1_payroll_employee_id,
          snapshotName: detail.sider1_name,
          employee: employeeById.get(Number(detail.sider1_payroll_employee_id)) || null,
          assignmentKey: `spinning:${detail.id}:sider1`
        }),
        resolveHistoricalEmployeeIdentity({
          payrollEmployeeId: detail.sider2_payroll_employee_id,
          snapshotName: detail.sider2_name,
          employee: employeeById.get(Number(detail.sider2_payroll_employee_id)) || null,
          assignmentKey: `spinning:${detail.id}:sider2`
        })
      ].filter(identity => identity.identityStatus !== 'UNASSIGNED')
      identitiesByMachineShift.get(key).push(...identities)
    }

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
        const identityGroups = new Map()
        for (const identity of identitiesByMachineShift.get(`${row.machine_id}|${shift}`) || []) {
          if (!identityGroups.has(identity.groupKey)) {
            identityGroups.set(identity.groupKey, { identity, names: new Set() })
          }
          identityGroups.get(identity.groupKey).names.add(identity.displayName)
        }
        const shiftIdentities = [...identityGroups.values()]
        frame.shifts[shift].siderName = shiftIdentities
          .flatMap(group => [...group.names])
          .join(', ') || 'NIL'
        frame.shifts[shift].production = parseFloat(row.total_production || 0)
        frame.shifts[shift].waste = parseFloat(row.total_waste || 0)
        frame.shifts[shift].wastePercent = parseFloat(row.avg_waste_percent || 0)
        // Format DOJ as dd-MMM-yy (e.g., "02-Sep-24")
        const joiningDates = [...new Set(shiftIdentities
          .map(group => group.identity.employee?.doj)
          .filter(Boolean)
          .map(value => new Date(value).toISOString()))]
          .map(value => new Date(value))
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
