'use server'

import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

/**
 * Fetch sider monthly report data
 * Groups by frame (machine), shift and calculates waste metrics
 */
export async function fetchSiderMonthlyData(fromDate, toDate) {
  try {
    // Get all production details with sider information for the date range
    const productionData = await prisma.$queryRaw`
      SELECT 
        sm.description as frame_no,
        sm.id as machine_id,
        COALESCE(spd.sider1_name, 'NIL') as sider1_name,
        em.doj,
        sph.shift,
        SUM(spd.act_prodn) as total_production,
        SUM(spd.waste) as total_waste,
        COALESCE(
          AVG(spd.waste_percent),
          (SUM(spd.waste) / NULLIF(SUM(spd.act_prodn), 0)) * 100
        ) as avg_waste_percent
      FROM spinning_production_detail spd
      INNER JOIN spinning_production_header sph ON spd.header_id = sph.id
      INNER JOIN spinning_machines sm ON spd.machine_id = sm.id
      LEFT JOIN employee_master em ON spd.sider1_name = em.emp_name
      WHERE sph.entry_date BETWEEN ${format(fromDate, 'yyyy-MM-dd')} AND ${format(toDate, 'yyyy-MM-dd')}
      GROUP BY sm.id, sm.description, spd.sider1_name, em.doj, sph.shift
      ORDER BY 
        CASE 
          WHEN sm.description REGEXP '^RF[0-9]+$' THEN CAST(SUBSTRING(sm.description, 3) AS UNSIGNED)
          WHEN sm.description REGEXP '^RF[0-9]+A$' THEN 1000 + CAST(SUBSTRING(sm.description, 3, LENGTH(sm.description)-4) AS UNSIGNED)
          ELSE 9999
        END,
        sm.description,
        sph.shift
    `

    // Transform data into a structured format
    const frameMap = new Map()

    for (const row of productionData) {
      const frameKey = row.frame_no
      
      if (!frameMap.has(frameKey)) {
        frameMap.set(frameKey, {
          frameNo: row.frame_no,
          shifts: {
            1: { siderName: null, waste: 0, wastePercent: 0, doj: null },
            2: { siderName: null, waste: 0, wastePercent: 0, doj: null },
            3: { siderName: null, waste: 0, wastePercent: 0, doj: null }
          }
        })
      }

      const frame = frameMap.get(frameKey)
      const shift = row.shift

      if (frame.shifts[shift]) {
        frame.shifts[shift].siderName = row.sider1_name || 'NIL'
        frame.shifts[shift].waste = parseFloat(row.total_waste || 0)
        frame.shifts[shift].wastePercent = parseFloat(row.avg_waste_percent || 0)
        // Format DOJ as dd-MMM-yy (e.g., "02-Sep-24")
        if (row.doj) {
          const dojDate = new Date(row.doj)
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const day = String(dojDate.getDate()).padStart(2, '0')
          const month = months[dojDate.getMonth()]
          const year = String(dojDate.getFullYear()).slice(-2)
          frame.shifts[shift].doj = `${day}-${month}-${year}`
        } else {
          frame.shifts[shift].doj = '01-Jan-00'
        }
      }
    }

    // Convert map to array
    const reportData = Array.from(frameMap.values())

    // Calculate totals for each shift
    const totals = {
      shift1: { waste: 0, wastePercent: 0 },
      shift2: { waste: 0, wastePercent: 0 },
      shift3: { waste: 0, wastePercent: 0 }
    }

    let shift1Count = 0
    let shift2Count = 0
    let shift3Count = 0

    reportData.forEach(frame => {
      if (frame.shifts[1].waste > 0) {
        totals.shift1.waste += frame.shifts[1].waste
        totals.shift1.wastePercent += frame.shifts[1].wastePercent
        shift1Count++
      }
      if (frame.shifts[2].waste > 0) {
        totals.shift2.waste += frame.shifts[2].waste
        totals.shift2.wastePercent += frame.shifts[2].wastePercent
        shift2Count++
      }
      if (frame.shifts[3].waste > 0) {
        totals.shift3.waste += frame.shifts[3].waste
        totals.shift3.wastePercent += frame.shifts[3].wastePercent
        shift3Count++
      }
    })

    // Calculate averages
    if (shift1Count > 0) {
      totals.shift1.wastePercent = totals.shift1.wastePercent / shift1Count
    }
    if (shift2Count > 0) {
      totals.shift2.wastePercent = totals.shift2.wastePercent / shift2Count
    }
    if (shift3Count > 0) {
      totals.shift3.wastePercent = totals.shift3.wastePercent / shift3Count
    }

    return {
      reportData,
      totals
    }

  } catch (error) {
    console.error('Error fetching sider monthly data:', error)
    throw error
  }
}
