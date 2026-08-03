import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const loadReportModule = async () => {
  const strictDateSource = await readFile(
    new URL('../src/lib/strictDate.js', import.meta.url),
    'utf8'
  )
  const strictDateUrl = `data:text/javascript;base64,${Buffer.from(strictDateSource).toString('base64')}`

  let reportSource = await readFile(
    new URL('../src/lib/queries/autoconerEfficiencyReportQueries.js', import.meta.url),
    'utf8'
  )
  reportSource = reportSource
    .replace("import { prisma } from '../prisma'", 'const prisma = {}')
    .replace("from '../strictDate.js'", `from '${strictDateUrl}'`)

  return import(`data:text/javascript;base64,${Buffer.from(reportSource).toString('base64')}`)
}

const {
  autoconerEfficiencyDateKey,
  buildAutoconerEfficiencyShifts,
  normalizeAutoconerEfficiencyDate,
} = await loadReportModule()

test('Autoconer efficiency grid preserves the legacy 13 by 5 layout', () => {
  const [shift] = buildAutoconerEfficiencyShifts([
    {
      shift: 1,
      machine_no: 'AC1-1',
      count_name: '68 COMBED STAR',
      prodn_effi: '87.25',
    },
  ], [{ shift: 1, supervisor_name: 'Supervisor One' }])

  assert.equal(shift.groups.length, 13)
  assert.deepEqual(shift.groups.map(group => group.headerLabel), [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
  ])
  assert.deepEqual(shift.positionRows.map(row => row.label), ['1', '2', '3', '4', '5'])
  assert.equal(shift.groups[0].machines[0].machine_no, 'AC1-1')
  assert.equal(shift.groups[0].machines[0].efficiency, 87.25)
  assert.equal(shift.supervisor_name, 'Supervisor One')
})

test('Autoconer efficiency grid appends every extra group, position and collision', () => {
  const rows = [
    { shift: 1, machine_no: 'AC1-1', count_name: '68 CS', prodn_effi: 80 },
    { shift: 1, machine_no: 'AC01-1', count_name: '68 CS', prodn_effi: 81 },
    { shift: 1, machine_no: 'AC14-7', count_name: '60 CS', prodn_effi: 82 },
    { shift: 1, machine_no: 'CUSTOM-8', count_name: '50 CS', prodn_effi: 83 },
    { shift: 1, machine_no: 'LooseName', count_name: '40 CS', prodn_effi: 84 },
  ]

  const [shift] = buildAutoconerEfficiencyShifts(rows, [])
  const groupNames = shift.groups.map(group => group.groupName)
  const persistedMachines = shift.groups
    .flatMap(group => group.machines)
    .filter(Boolean)
    .map(machine => machine.machine_no)
    .sort()

  assert.ok(groupNames.includes('AC14'))
  assert.ok(groupNames.includes('CUSTOM'))
  assert.ok(groupNames.includes('LooseName'))
  assert.ok(shift.positionRows.some(row => row.label === '7'))
  assert.ok(shift.positionRows.some(row => row.label === '8'))
  assert.ok(shift.positionRows.some(row => row.label === '1 (2)'))
  assert.deepEqual(persistedMachines, rows.map(row => row.machine_no).sort())
})

test('Autoconer efficiency report dates are strict and timezone-independent', () => {
  const date = normalizeAutoconerEfficiencyDate('2026-08-09')
  assert.equal(date.toISOString(), '2026-08-09T00:00:00.000Z')
  assert.equal(
    autoconerEfficiencyDateKey('2026-08-09T23:30:00-07:00'),
    '2026-08-09'
  )
  assert.throws(
    () => normalizeAutoconerEfficiencyDate('2026-02-30'),
    /real calendar date/
  )
  assert.throws(
    () => normalizeAutoconerEfficiencyDate('09/08/2026'),
    /YYYY-MM-DD/
  )
})

test('Autoconer efficiency screen and PDF consume the dynamic report dimensions', async () => {
  const pageSource = await readFile(
    new URL('../src/app/reports/autoconer/efficiency/page.jsx', import.meta.url),
    'utf8'
  )

  assert.ok(pageSource.match(/chunkGroups\(shift\.groups\)/g)?.length >= 2)
  assert.ok(pageSource.match(/positionRows\.map/g)?.length >= 2)
  assert.doesNotMatch(pageSource, /\[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13\]/)
  assert.doesNotMatch(pageSource, /new Date\(reportData\.date\)/)
})
