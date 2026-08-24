import { prisma } from '../prisma'
import { getPayrollEmployeeById } from '../payroll/employees'

/**
 * Generate an Autoconer particular-sider report.
 * Employee identity comes from payroll; production values come from the
 * production entry snapshot selected by payroll employee ID.
 */
export async function generateAutoconerParticularSiderReport(employeeId, fromDate, toDate) {
  try {
    const payrollEmployeeId = Number(employeeId)
    if (!Number.isSafeInteger(payrollEmployeeId) || payrollEmployeeId <= 0) {
      throw new Error('A payroll employee is required')
    }
    if (!fromDate || !toDate) throw new Error('From date and to date are required')

    const from = new Date(fromDate)
    const to = new Date(toDate)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new Error('From date must be before or equal to to date')
    }

    const employeeData = await getPayrollEmployeeById(payrollEmployeeId)
    if (!employeeData) throw new Error('Employee not found in the configured payroll company')

    const productionDetails = await prisma.$queryRaw`
      SELECT
        aph.entry_date as date,
        aph.shift,
        am.machine_no,
        am.no_of_drums as total_drums,
        apd.idle_drum,
        apd.act_prodn,
        apd.prodn_effi,
        apd.red_light,
        apd.work_time,
        apd.run_time
      FROM autoconer_production_detail apd
      JOIN autoconer_production_header aph ON apd.header_id = aph.id
      JOIN autoconer_machines am ON apd.machine_id = am.id
      WHERE apd.payroll_employee_id = ${payrollEmployeeId}
        AND aph.entry_date >= ${from}
        AND aph.entry_date <= ${to}
      ORDER BY aph.entry_date ASC, aph.shift ASC, am.machine_no ASC
    `

    if (!productionDetails?.length) {
      return {
        success: false,
        message: `No production data found for ${employeeData.emp_name} between ${from.toLocaleDateString()} and ${to.toLocaleDateString()}`
      }
    }

    const dailyData = new Map()
    for (const detail of productionDetails) {
      const dateKey = detail.date.toISOString().split('T')[0]
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          date: detail.date,
          drums: 0,
          prod_kgs: 0,
          total_work_time: 0,
          total_run_time: 0,
          efficiency_weighted: 0,
          efficiency_weight: 0,
          efficiency_sum: 0,
          red_light: 0,
          machine_count: 0
        })
      }

      const day = dailyData.get(dateKey)
      const drums = Number(detail.total_drums) || 0
      const idleDrums = Number(detail.idle_drum) || 0
      const production = Number(detail.act_prodn) || 0
      const efficiency = Number(detail.prodn_effi) || 0
      const productionWeight = Math.max(production, 0)

      day.drums += Math.max(drums - idleDrums, 0)
      day.prod_kgs += production
      day.total_work_time += Math.max(Number(detail.work_time) || 0, 0)
      day.total_run_time += Math.max(Number(detail.run_time) || 0, 0)
      day.efficiency_weighted += efficiency * productionWeight
      day.efficiency_weight += productionWeight
      day.efficiency_sum += efficiency
      day.red_light += Number(detail.red_light) || 0
      day.machine_count += 1
    }

    const performanceData = [...dailyData.values()].map(day => {
      const efficiency = day.efficiency_weight > 0
        ? day.efficiency_weighted / day.efficiency_weight
        : day.machine_count > 0 ? day.efficiency_sum / day.machine_count : 0
      const utilization = day.total_run_time > 0
        ? day.total_work_time / day.total_run_time * 100
        : 0

      return {
        date: day.date,
        drum: day.drums,
        prod_kgs: day.prod_kgs,
        effi_percent: Number(efficiency.toFixed(2)),
        uti_percent: Number(utilization.toFixed(2)),
        red_light: Number((day.machine_count > 0 ? day.red_light / day.machine_count : 0).toFixed(2))
      }
    })

    const allDays = [...dailyData.values()]
    const totalProduction = allDays.reduce((sum, day) => sum + day.prod_kgs, 0)
    const efficiencyWeight = allDays.reduce((sum, day) => sum + day.efficiency_weight, 0)
    const machineCount = allDays.reduce((sum, day) => sum + day.machine_count, 0)
    const totalRunTime = allDays.reduce((sum, day) => sum + day.total_run_time, 0)
    const totalWorkTime = allDays.reduce((sum, day) => sum + day.total_work_time, 0)
    const efficiency = efficiencyWeight > 0
      ? allDays.reduce((sum, day) => sum + day.efficiency_weighted, 0) / efficiencyWeight
      : machineCount > 0
        ? allDays.reduce((sum, day) => sum + day.efficiency_sum, 0) / machineCount
        : 0

    const totals = {
      drum: performanceData.reduce((sum, day) => sum + day.drum, 0),
      prod_kgs: totalProduction,
      effi_percent: Number(efficiency.toFixed(2)),
      uti_percent: Number((totalRunTime > 0 ? totalWorkTime / totalRunTime * 100 : 0).toFixed(2)),
      red_light: Number((machineCount > 0
        ? allDays.reduce((sum, day) => sum + day.red_light, 0) / machineCount
        : 0).toFixed(2))
    }

    return {
      success: true,
      data: {
        employee: {
          name: employeeData.emp_name,
          emp_code: employeeData.emp_code || 'N/A',
          doj: employeeData.doj
        },
        period: { from, to },
        performance: performanceData,
        totals
      }
    }
  } catch (error) {
    console.error('Error generating autoconer particular sider report:', error)
    return { success: false, message: 'The report could not be generated. Please try again.' }
  }
}
