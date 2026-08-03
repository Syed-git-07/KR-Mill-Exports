'use server'

import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { finiteNumber, percentageOf } from '@/lib/reportMath'

function formatDoj(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return format(date, 'dd-MMM-yy')
}

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
        spd.act_prodn as production,
        spd.waste as waste
      FROM spinning_production_detail spd
      INNER JOIN spinning_production_header sph ON spd.header_id = sph.id
      INNER JOIN spinning_machines sm ON spd.machine_id = sm.id
      LEFT JOIN employee_master em ON spd.sider1_name = em.emp_name
      WHERE sph.entry_date BETWEEN ${format(fromDate, 'yyyy-MM-dd')} AND ${format(toDate, 'yyyy-MM-dd')}
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
      // A machine lifecycle row is the stable key. Reusing a displayed frame
      // number after deactivation must not merge two historical machines.
      const frameKey = row.machine_id
      
      if (!frameMap.has(frameKey)) {
        frameMap.set(frameKey, {
          frameNo: row.frame_no,
          shifts: {
            1: { siders: new Map(), production: 0, waste: 0 },
            2: { siders: new Map(), production: 0, waste: 0 },
            3: { siders: new Map(), production: 0, waste: 0 }
          }
        })
      }

      const frame = frameMap.get(frameKey)
      const shift = row.shift

      if (frame.shifts[shift]) {
        const shiftData = frame.shifts[shift]
        const siderName = row.sider1_name || 'NIL'
        if (!shiftData.siders.has(siderName)) {
          shiftData.siders.set(siderName, formatDoj(row.doj))
        }
        shiftData.production += finiteNumber(row.production)
        shiftData.waste += finiteNumber(row.waste)
      }
    }

    // Convert accumulators into the shape consumed by the report. Multiple
    // siders on the same frame/shift are retained instead of the last one
    // overwriting all earlier rows.
    const reportData = Array.from(frameMap.values()).map(frame => ({
      frameNo: frame.frameNo,
      shifts: Object.fromEntries([1, 2, 3].map(shift => {
        const data = frame.shifts[shift]
        const names = [...data.siders.keys()]
        const dojs = [...new Set([...data.siders.values()].filter(Boolean))]
        return [shift, {
          siderName: names.length > 0 ? names.join(', ') : 'NIL',
          doj: dojs.length > 0 ? dojs.join(', ') : '-',
          production: data.production,
          waste: data.waste,
          wastePercent: percentageOf(data.waste, data.production),
        }]
      }))
    }))

    // Calculate totals for each shift
    const totals = {
      shift1: { production: 0, waste: 0, wastePercent: 0 },
      shift2: { production: 0, waste: 0, wastePercent: 0 },
      shift3: { production: 0, waste: 0, wastePercent: 0 }
    }

    reportData.forEach(frame => {
      for (const shift of [1, 2, 3]) {
        const target = totals[`shift${shift}`]
        target.production += frame.shifts[shift].production
        target.waste += frame.shifts[shift].waste
      }
    })

    // A total percentage must be recomputed from total kilograms, not averaged
    // from per-frame percentages (which weights small and large frames equally).
    for (const shift of [1, 2, 3]) {
      const target = totals[`shift${shift}`]
      target.wastePercent = percentageOf(target.waste, target.production)
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
