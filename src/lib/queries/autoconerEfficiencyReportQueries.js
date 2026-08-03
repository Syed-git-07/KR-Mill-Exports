import { prisma } from '../prisma'
import { parseStrictDate } from '../strictDate.js'

const BASELINE_GROUPS = 13
const BASELINE_POSITIONS = 5

const naturalCompare = (left, right) => String(left).localeCompare(String(right), undefined, {
  numeric: true,
  sensitivity: 'base',
})

const mostFrequentValue = (counts, fallback = 'UNKNOWN') => {
  const entries = [...counts.entries()].sort((left, right) => {
    const frequencyDifference = right[1] - left[1]
    return frequencyDifference || naturalCompare(left[0], right[0])
  })

  return entries[0]?.[0] || fallback
}

/**
 * Normalize a report date without JavaScript's permissive date rollover or
 * local-time conversion. Database DATE columns are compared at UTC midnight.
 */
export function normalizeAutoconerEfficiencyDate(value) {
  const parsed = parseStrictDate(value, 'Report date')
  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate()
  ))
}

export function autoconerEfficiencyDateKey(value) {
  return normalizeAutoconerEfficiencyDate(value).toISOString().slice(0, 10)
}

/**
 * Resolve a machine into a report group and position.
 *
 * Standard names (AC1-1) retain the legacy numeric headers. Other persisted
 * names are still represented: a numeric suffix is used as the position and
 * the preceding text as the group; a name without a numeric suffix receives
 * its own group at position 1.
 */
export function parseAutoconerEfficiencyMachine(machineNumber) {
  const machineNo = String(machineNumber ?? '').trim()
  if (!machineNo) {
    return {
      groupKey: 'machine:UNNAMED',
      groupName: 'UNNAMED',
      groupNumber: null,
      position: 1,
      isBaseline: false,
    }
  }

  const standardMatch = /^AC(\d+)-(\d+)$/i.exec(machineNo)
  if (standardMatch) {
    const groupNumber = Number(standardMatch[1])
    const position = Number(standardMatch[2])
    return {
      groupKey: `AC${groupNumber}`,
      groupName: `AC${groupNumber}`,
      groupNumber,
      position: position > 0 ? position : 1,
      isBaseline: groupNumber >= 1 && groupNumber <= BASELINE_GROUPS,
    }
  }

  const suffixedMatch = /^(.*?)-(\d+)$/.exec(machineNo)
  if (suffixedMatch && suffixedMatch[1].trim()) {
    const groupName = suffixedMatch[1].trim()
    const position = Number(suffixedMatch[2])
    return {
      groupKey: `group:${groupName}`,
      groupName,
      groupNumber: null,
      position: position > 0 ? position : 1,
      isBaseline: false,
    }
  }

  return {
    groupKey: `machine:${machineNo}`,
    groupName: machineNo,
    groupNumber: null,
    position: 1,
    isBaseline: false,
  }
}

/**
 * Build a complete display grid from persisted production rows. The legacy
 * AC1..AC13 and positions 1..5 remain present, while additional groups,
 * positions and coordinate collisions are appended instead of being dropped.
 */
export function buildAutoconerEfficiencyShifts(productionRows = [], supervisorRows = []) {
  const supervisorMap = new Map()
  for (const row of supervisorRows) {
    const shiftKey = String(row.shift)
    const supervisor = String(row.supervisor_name ?? '').trim()
    if (!supervisorMap.has(shiftKey) || supervisorMap.get(shiftKey) === 'N/A') {
      supervisorMap.set(shiftKey, supervisor || 'N/A')
    }
  }

  const shifts = new Map()

  for (const row of productionRows) {
    const shiftKey = String(row.shift)
    if (!shifts.has(shiftKey)) {
      const groups = new Map()
      for (let groupNumber = 1; groupNumber <= BASELINE_GROUPS; groupNumber += 1) {
        groups.set(`AC${groupNumber}`, {
          groupKey: `AC${groupNumber}`,
          groupName: `AC${groupNumber}`,
          groupNumber,
          isBaseline: true,
          counts: new Map(),
          machinesByPosition: new Map(),
        })
      }

      shifts.set(shiftKey, {
        shift: row.shift,
        supervisor_name: supervisorMap.get(shiftKey) || 'N/A',
        counts: new Map(),
        groups,
        positions: new Set(Array.from({ length: BASELINE_POSITIONS }, (_, index) => index + 1)),
      })
    }

    const shift = shifts.get(shiftKey)
    const countName = String(row.count_name ?? '').trim() || 'UNKNOWN'
    shift.counts.set(countName, (shift.counts.get(countName) || 0) + 1)

    const coordinate = parseAutoconerEfficiencyMachine(row.machine_no)
    if (!shift.groups.has(coordinate.groupKey)) {
      shift.groups.set(coordinate.groupKey, {
        ...coordinate,
        counts: new Map(),
        machinesByPosition: new Map(),
      })
    }

    const group = shift.groups.get(coordinate.groupKey)
    group.counts.set(countName, (group.counts.get(countName) || 0) + 1)
    shift.positions.add(coordinate.position)

    if (!group.machinesByPosition.has(coordinate.position)) {
      group.machinesByPosition.set(coordinate.position, [])
    }

    const parsedEfficiency = Number(row.prodn_effi)
    group.machinesByPosition.get(coordinate.position).push({
      position: coordinate.position,
      machine_no: String(row.machine_no ?? '').trim() || 'UNNAMED',
      efficiency: Number.isFinite(parsedEfficiency) ? parsedEfficiency : 0,
      count: countName,
    })
  }

  return [...shifts.values()]
    .sort((left, right) => Number(left.shift) - Number(right.shift) || naturalCompare(left.shift, right.shift))
    .map(shift => {
      const primaryCount = mostFrequentValue(shift.counts)
      const groups = [...shift.groups.values()].sort((left, right) => {
        if (left.isBaseline !== right.isBaseline) return left.isBaseline ? -1 : 1
        if (left.groupNumber !== null && right.groupNumber !== null) {
          return left.groupNumber - right.groupNumber
        }
        return naturalCompare(left.groupName, right.groupName)
      })

      const positions = [...shift.positions].sort((left, right) => left - right)
      const positionRows = []
      for (const position of positions) {
        const occurrences = Math.max(
          1,
          ...groups.map(group => group.machinesByPosition.get(position)?.length || 0)
        )
        for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
          positionRows.push({
            position,
            occurrence,
            label: occurrence === 0 ? String(position) : `${position} (${occurrence + 1})`,
          })
        }
      }

      return {
        shift: shift.shift,
        supervisor_name: shift.supervisor_name,
        primary_count: primaryCount,
        positionRows,
        groups: groups.map(group => ({
          groupKey: group.groupKey,
          groupNumber: group.groupNumber,
          groupName: group.groupName,
          headerLabel: group.groupNumber === null
            ? group.groupName
            : String(group.groupNumber),
          isBaseline: group.isBaseline,
          count: mostFrequentValue(group.counts, primaryCount),
          machines: positionRows.map(({ position, occurrence }) => (
            group.machinesByPosition.get(position)?.[occurrence] || null
          )),
        })),
      }
    })
}

/**
 * Generate Autoconer Efficiency Report.
 * Shows an efficiency grid with machine groups as columns and positions as rows.
 */
export async function generateAutoconerEfficiencyReport(selectedDate) {
  try {
    const date = normalizeAutoconerEfficiencyDate(selectedDate)
    const dateKey = date.toISOString().slice(0, 10)

    const productionData = await prisma.$queryRaw`
      SELECT
        aph.shift,
        am.machine_no,
        apd.count_name,
        apd.prodn_effi
      FROM autoconer_production_detail apd
      JOIN autoconer_production_header aph ON apd.header_id = aph.id
      JOIN autoconer_machines am ON apd.machine_id = am.id
      WHERE aph.entry_date = ${date}
      ORDER BY aph.shift, am.machine_no
    `

    if (!productionData?.length) {
      return {
        success: false,
        message: `No production data found for ${dateKey}`,
      }
    }

    const supervisorData = await prisma.$queryRaw`
      SELECT
        aph.shift,
        s.supervisor_name
      FROM autoconer_production_header aph
      LEFT JOIN supervisors s ON aph.supervisor_id = s.id
      WHERE aph.entry_date = ${date}
      ORDER BY aph.shift
    `

    return {
      success: true,
      date,
      shifts: buildAutoconerEfficiencyShifts(productionData, supervisorData),
    }
  } catch (error) {
    console.error('Error generating autoconer efficiency report:', error)
    return {
      success: false,
      message: error?.code === 'INVALID_DATE'
        ? error.message
        : 'The report could not be generated. Please try again.',
    }
  }
}
