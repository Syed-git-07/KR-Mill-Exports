import { prisma } from '../prisma'
import { getProductionSupervisorDisplayMap } from './productionSupervisorQueries'

/**
 * Generate the Autoconer Production Report grid.
 * Shows actual production with machine groups as columns and positions as rows.
 * 
 * @param {Date} selectedDate - Date for the report
 * @returns {Promise<Object>} Report data with grid structure for all shifts
 */
export async function generateAutoconerEfficiencyReport(selectedDate) {
  try {
    if (!selectedDate) {
      throw new Error('Date is required')
    }

    const date = new Date(selectedDate)

    // Get all production data for the selected date (all shifts)
    const productionData = await prisma.$queryRaw`
      SELECT 
        aph.shift,
        am.machine_no,
        apd.count_name,
        apd.act_prodn,
        SUBSTRING_INDEX(am.machine_no, '-', 1) as machine_group,
        CAST(SUBSTRING_INDEX(am.machine_no, '-', -1) AS UNSIGNED) as machine_position
      FROM autoconer_production_detail apd
      JOIN autoconer_production_header aph ON apd.header_id = aph.id
      JOIN autoconer_machines am ON apd.machine_id = am.id
      WHERE aph.entry_date = ${date}
      ORDER BY aph.shift, machine_group, machine_position
    `

    if (!productionData || productionData.length === 0) {
      return {
        success: false,
        message: `No production data found for ${date.toLocaleDateString()}`
      }
    }

    // Get supervisor names for each shift
    const supervisorData = await prisma.$queryRaw`
      SELECT 
        aph.shift,
        aph.supervisor_id
      FROM autoconer_production_header aph
      WHERE aph.entry_date = ${date}
      ORDER BY aph.shift
    `

    // Create supervisor map
    const supervisorNames = await getProductionSupervisorDisplayMap(supervisorData.map(row => row.supervisor_id))
    const supervisorMap = {}
    supervisorData.forEach(s => {
      supervisorMap[s.shift] = supervisorNames.get(s.supervisor_id) || 'N/A'
    })

    // Group data by shift
    const shiftDataMap = {}
    
    productionData.forEach(row => {
      const shift = row.shift
      
      if (!shiftDataMap[shift]) {
        shiftDataMap[shift] = {
          shift: shift,
          supervisor_name: supervisorMap[shift] || 'N/A',
          counts: {}, // Track different counts used
          grid: {} // Machine grid data
        }
      }

      const shiftData = shiftDataMap[shift]
      const countName = row.count_name || 'UNKNOWN'
      
      // Track count usage
      if (!shiftData.counts[countName]) {
        shiftData.counts[countName] = 0
      }
      shiftData.counts[countName]++

      // Extract group number (AC1 -> 1, AC10 -> 10, etc.)
      const groupMatch = row.machine_group.match(/AC(\d+)/)
      if (!groupMatch) return

      const groupNum = parseInt(groupMatch[1])
      const position = parseInt(row.machine_position)
      const production = parseFloat(row.act_prodn) || 0

      // Initialize group if not exists
      if (!shiftData.grid[groupNum]) {
        shiftData.grid[groupNum] = {
          groupName: row.machine_group,
          groupNumber: groupNum,
          counts: new Set(),
          machines: {}
        }
      }
      shiftData.grid[groupNum].counts.add(countName)

      // AC1 and AC1A share a printed group. Add matching positions instead
      // of allowing the later detail to overwrite the earlier one.
      const existing = shiftData.grid[groupNum].machines[position]
      shiftData.grid[groupNum].machines[position] = existing
        ? {
            machine_no: `${existing.machine_no} + ${row.machine_no}`,
            production: existing.production + production,
              count: existing.count === countName ? existing.count : `${existing.count} / ${countName}`
          }
        : {
            machine_no: row.machine_no,
            production,
            count: countName
          }
    })

    // Convert map to array and ensure proper structure
    const shifts = Object.keys(shiftDataMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(shiftKey => {
        const shift = shiftDataMap[shiftKey]
        
        // Determine primary count (most used count in this shift)
        const primaryCount = Object.keys(shift.counts).reduce((a, b) => 
          shift.counts[a] > shift.counts[b] ? a : b
        )

        // Convert grid to array format
        const groups = []
        for (let groupNum = 1; groupNum <= 13; groupNum++) {
          const groupData = shift.grid[groupNum]
          
          if (groupData) {
            // Build machines array (positions 1-5)
            const machines = []
            for (let pos = 1; pos <= 5; pos++) {
              if (groupData.machines[pos]) {
                machines.push({
                  position: pos,
                  machine_no: groupData.machines[pos].machine_no,
                  production: groupData.machines[pos].production,
                  count: groupData.machines[pos].count
                })
              } else {
                machines.push(null) // Empty position
              }
            }

            groups.push({
              groupNumber: groupNum,
              groupName: groupData.groupName,
              count: [...groupData.counts].join(' / '),
              machines: machines
            })
          } else {
            // Empty group
            groups.push({
              groupNumber: groupNum,
              groupName: `AC${groupNum}`,
              count: primaryCount,
              machines: [null, null, null, null, null]
            })
          }
        }

        return {
          shift: shift.shift,
          supervisor_name: shift.supervisor_name,
          primary_count: primaryCount,
          groups: groups
        }
      })

    return {
      success: true,
      date: date,
      shifts: shifts
    }
  } catch (error) {
    console.error('Error generating autoconer efficiency report:', error)
    return {
      success: false,
      message: 'The report could not be generated. Please try again.'
    }
  }
}
