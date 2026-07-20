import { prisma } from '../prisma'

/**
 * Generate Autoconer Particular Sider Report
 * Shows individual sider performance across date range
 * 
 * @param {string} empName - Employee name to filter by
 * @param {Date} fromDate - Start date for report period
 * @param {Date} toDate - End date for report period
 * @returns {Promise<Object>} Report data with employee info and daily performance
 */
export async function generateAutoconerParticularSiderReport(empName, fromDate, toDate) {
  try {
    if (!empName) {
      throw new Error('Employee name is required')
    }

    if (!fromDate || !toDate) {
      throw new Error('From date and to date are required')
    }

    // Convert dates to ensure they're Date objects
    const from = new Date(fromDate)
    const to = new Date(toDate)

    // Validate date range
    if (from > to) {
      throw new Error('From date must be before or equal to to date')
    }

    // Get employee master data
    const employeeData = await prisma.employee_master.findFirst({
      where: {
        emp_name: empName,
        is_active: true
      },
      select: {
        emp_name: true,
        emp_code: true,
        doj: true,
        department: true,
        designation: true
      }
    })

    if (!employeeData) {
      throw new Error(`Employee "${empName}" not found`)
    }

    // Get all production details for this employee in the date range
    const productionDetails = await prisma.$queryRaw`
      SELECT 
        aph.entry_date as date,
        aph.shift,
        apd.emp_name,
        am.machine_no,
        am.no_of_drums as total_drums,
        apd.idle_drum,
        apd.act_prodn,
        apd.prodn_effi,
        apd.red_light,
        apd.work_time,
        apd.run_time,
        apd.total_stoppage_mins
      FROM autoconer_production_detail apd
      JOIN autoconer_production_header aph ON apd.header_id = aph.id
      JOIN autoconer_machines am ON apd.machine_id = am.id
      WHERE apd.emp_name = ${empName}
        AND aph.entry_date >= ${from}
        AND aph.entry_date <= ${to}
      ORDER BY aph.entry_date ASC, aph.shift ASC, am.machine_no ASC
    `

    if (!productionDetails || productionDetails.length === 0) {
      return {
        success: false,
        message: `No production data found for ${empName} between ${from.toLocaleDateString()} and ${to.toLocaleDateString()}`
      }
    }

    // Group by date and calculate daily totals
    const dailyData = {}

    productionDetails.forEach(detail => {
      const dateKey = detail.date.toISOString().split('T')[0]
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: detail.date,
          drums: 0,
          prod_kgs: 0,
          total_work_time: 0,
          total_run_time: 0,
          total_idle_drums: 0,
          total_drums_capacity: 0,
          red_light: 0,
          machine_count: 0
        }
      }

      const drums = parseInt(detail.total_drums) || 0
      const idleDrums = parseInt(detail.idle_drum) || 0
      const workingDrums = drums - idleDrums
      const actProdn = parseFloat(detail.act_prodn) || 0
      const workTime = parseInt(detail.work_time) || 0
      const runTime = parseInt(detail.run_time) || 510
      const redLight = parseFloat(detail.red_light) || 0

      dailyData[dateKey].drums += workingDrums
      dailyData[dateKey].prod_kgs += actProdn
      dailyData[dateKey].total_work_time += workTime
      dailyData[dateKey].total_run_time += runTime
      dailyData[dateKey].total_idle_drums += idleDrums
      dailyData[dateKey].total_drums_capacity += drums
      dailyData[dateKey].red_light += redLight
      dailyData[dateKey].machine_count += 1
    })

    // Calculate efficiency % and utilization % for each day
    const performanceData = Object.keys(dailyData)
      .sort()
      .map(dateKey => {
        const day = dailyData[dateKey]
        
        // Calculate Efficiency %
        // Effi % = (work_time / run_time) × drum_efficiency
        // drum_efficiency = 100 - (idle_drums / total_drums × 100)
        const drumEfficiency = day.total_drums_capacity > 0 
          ? 100 - ((day.total_idle_drums / day.total_drums_capacity) * 100)
          : 0
        
        const effi_percent = day.total_run_time > 0
          ? (day.total_work_time / day.total_run_time) * drumEfficiency
          : 0

        // Calculate Utilization %
        // UTI % = (work_time / run_time) × 100
        const uti_percent = day.total_run_time > 0
          ? (day.total_work_time / day.total_run_time) * 100
          : 0

        // Average red light across machines
        const avg_red_light = day.machine_count > 0
          ? day.red_light / day.machine_count
          : 0

        return {
          date: day.date,
          drum: day.drums,
          prod_kgs: day.prod_kgs,
          effi_percent: parseFloat(effi_percent.toFixed(2)),
          uti_percent: parseFloat(uti_percent.toFixed(2)),
          red_light: parseFloat(avg_red_light.toFixed(2))
        }
      })

    // Calculate totals
    const totals = {
      drum: performanceData.reduce((sum, d) => sum + d.drum, 0),
      prod_kgs: performanceData.reduce((sum, d) => sum + d.prod_kgs, 0),
      effi_percent: 0,
      uti_percent: 0,
      red_light: 0
    }

    // Calculate weighted averages for totals
    if (performanceData.length > 0) {
      totals.effi_percent = parseFloat(
        (performanceData.reduce((sum, d) => sum + d.effi_percent, 0) / performanceData.length).toFixed(2)
      )
      totals.uti_percent = parseFloat(
        (performanceData.reduce((sum, d) => sum + d.uti_percent, 0) / performanceData.length).toFixed(2)
      )
      totals.red_light = parseFloat(
        (performanceData.reduce((sum, d) => sum + d.red_light, 0) / performanceData.length).toFixed(2)
      )
    }

    return {
      success: true,
      data: {
        employee: {
          name: employeeData.emp_name,
          emp_code: employeeData.emp_code || 'N/A',
          doj: employeeData.doj,
          department: employeeData.department,
          designation: employeeData.designation
        },
        period: {
          from: from,
          to: to
        },
        performance: performanceData,
        totals: totals
      }
    }
  } catch (error) {
    console.error('Error generating autoconer particular sider report:', error)
    return {
      success: false,
      message: error.message || 'Failed to generate report'
    }
  }
}
