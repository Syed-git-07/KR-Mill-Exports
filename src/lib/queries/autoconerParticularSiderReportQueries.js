import { prisma } from '../prisma'
import { calculateAutoconerPerformance, finiteNumber } from '../reportMath'

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

    // Historical production remains reportable after a sider is deactivated.
    // The master row is optional because old production can outlive the master.
    const employeeData = await prisma.employee_master.findFirst({
      where: {
        emp_name: empName
      },
      select: {
        emp_name: true,
        emp_code: true,
        doj: true,
        department: true,
        designation: true
      }
    })

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

      const drums = Math.max(0, finiteNumber(detail.total_drums))
      const idleDrums = Math.max(0, finiteNumber(detail.idle_drum))
      const workingDrums = Math.max(0, drums - idleDrums)
      const actProdn = finiteNumber(detail.act_prodn)
      const workTime = Math.max(0, finiteNumber(detail.work_time))
      // An explicit zero is data, not a signal to substitute a 510-minute shift.
      const runTime = Math.max(0, finiteNumber(detail.run_time))
      const redLight = finiteNumber(detail.red_light)

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
        
        const performance = calculateAutoconerPerformance({
          workTime: day.total_work_time,
          runTime: day.total_run_time,
          idleDrums: day.total_idle_drums,
          drumCapacity: day.total_drums_capacity,
          redLight: day.red_light,
          machineCount: day.machine_count,
        })

        return {
          date: day.date,
          drum: day.drums,
          prod_kgs: day.prod_kgs,
          effi_percent: parseFloat(performance.efficiencyPercent.toFixed(2)),
          uti_percent: parseFloat(performance.utilizationPercent.toFixed(2)),
          red_light: parseFloat(performance.averageRedLight.toFixed(2))
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

    // Recalculate totals from their underlying quantities. Averaging daily
    // percentages gives a short/partial day the same weight as a full day.
    const aggregate = Object.values(dailyData).reduce((sum, day) => ({
      workTime: sum.workTime + day.total_work_time,
      runTime: sum.runTime + day.total_run_time,
      idleDrums: sum.idleDrums + day.total_idle_drums,
      drumCapacity: sum.drumCapacity + day.total_drums_capacity,
      redLight: sum.redLight + day.red_light,
      machineCount: sum.machineCount + day.machine_count,
    }), {
      workTime: 0,
      runTime: 0,
      idleDrums: 0,
      drumCapacity: 0,
      redLight: 0,
      machineCount: 0,
    })

    const aggregatePerformance = calculateAutoconerPerformance(aggregate)
    totals.effi_percent = parseFloat(aggregatePerformance.efficiencyPercent.toFixed(2))
    totals.uti_percent = parseFloat(aggregatePerformance.utilizationPercent.toFixed(2))
    totals.red_light = parseFloat(aggregatePerformance.averageRedLight.toFixed(2))

    return {
      success: true,
      data: {
        employee: {
          name: employeeData?.emp_name || empName,
          emp_code: employeeData?.emp_code || 'N/A',
          doj: employeeData?.doj || null,
          department: employeeData?.department || 'N/A',
          designation: employeeData?.designation || 'N/A'
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
      message: 'The report could not be generated. Please try again.'
    }
  }
}
