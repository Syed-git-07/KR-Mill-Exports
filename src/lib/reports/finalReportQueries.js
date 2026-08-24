import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generatePreparatoryStoppageReport } from '@/lib/queries/preparatoryStoppageReportQueries'
import { generateSpinningStoppageReport } from '@/lib/queries/spinningStoppageReportQueries'
import { getAutoconerStoppagePercentageReport } from '@/app/reports/autoconer/stoppage-percentage/autoconerStoppagePercentageQueries'

const PREPARATORY_DEPARTMENTS = [
  { label: 'CARDING', model: 'carding', machineModel: 'carding_machines', effi: 'effi_percent', std: 'std_prodn' },
  { label: 'BREAKER DRAWING', model: 'breaker_drawing', machineModel: 'drawing_breaker_machines', effi: 'effi_percent', std: 'std_prodn' },
  { label: 'LAP FORMER', model: 'lap_former', machineModel: 'lap_former_machines', effi: 'effi_percent', std: 'std_prodn' },
  { label: 'COMBER', model: 'comber', machineModel: 'comber_machines', effi: 'act_effi_percent', std: 'std_hrs' },
  { label: 'FINISHER DRAWING', model: 'finisher_drawing', machineModel: 'drawing_finisher_machines', effi: 'effi_percent', std: 'std_prodn' },
  { label: 'SIMPLEX', model: 'simplex', machineModel: 'simplex_machines', effi: 'act_effi_percent', std: 'std_hrs' }
]

const n = value => Number(value) || 0
const fixed = (value, digits = 2) => n(value).toFixed(digits)
const dateKey = value => {
  const date = new Date(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
const displayDate = value => {
  const [year, month, day] = dateKey(value).split('-')
  return `${day}-${month}-${year}`
}
const shortDisplayDate = value => {
  const date = new Date(value)
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  return `${String(date.getUTCDate()).padStart(2, '0')}-${month}-${String(date.getUTCFullYear()).slice(-2)}`
}
const monthStart = value => {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}
const periodText = (fromDate, toDate) => dateKey(fromDate) === dateKey(toDate)
  ? `Date: ${displayDate(fromDate)}`
  : `From ${displayDate(fromDate)} To ${displayDate(toDate)}`

function baseReport(title, fromDate, toDate, orientation = 'portrait') {
  return {
    title,
    orientation,
    period: periodText(fromDate, toDate),
    filename: `${title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_${dateKey(fromDate)}_${dateKey(toDate)}.pdf`,
    meta: [],
    notes: [],
    signatures: ['AM(P)', 'GM / DGM', 'M.D. / DIRECTOR'],
    tables: []
  }
}

async function employeeMasterMap(names) {
  const uniqueNames = [...new Set(names.filter(Boolean))]
  if (!uniqueNames.length) return new Map()
  const employees = await prisma.employee_master.findMany({
    where: { emp_name: { in: uniqueNames } },
    select: { emp_name: true, emp_code: true, doj: true, department: true }
  })
  return new Map(employees.map(employee => [employee.emp_name, employee]))
}

async function supervisorMap(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (!uniqueIds.length) return new Map()
  const supervisors = await prisma.supervisors.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, supervisor_name: true }
  })
  return new Map(supervisors.map(supervisor => [supervisor.id, supervisor.supervisor_name]))
}

async function getPreparatoryRecords(fromDate, toDate, { includeSimplexHank = false } = {}) {
  const departmentResults = await Promise.all(PREPARATORY_DEPARTMENTS.map(async department => {
    const headers = await prisma[`${department.model}_production_header`].findMany({
      where: { entry_date: { gte: fromDate, lte: toDate } },
      select: { id: true, entry_date: true, shift: true, supervisor_id: true },
      orderBy: [{ entry_date: 'asc' }, { shift: 'asc' }]
    })
    if (!headers.length) return []

    const select = {
      header_id: true, machine_id: true, employee_name: true, run_sequence: true,
      act_prodn: true, uti_percent: true, waste: true, waste_percent: true,
      work_time: true, [department.effi]: true, [department.std]: true
    }
    if (department.model !== 'comber') select.run_time = true
    if (department.model !== 'simplex') select.act_hank = true
    if (department.model !== 'simplex') select.total_stoppage_mins = true

    const details = await prisma[`${department.model}_production_detail`].findMany({
      where: { header_id: { in: headers.map(header => header.id) } }, select
    })
    const machineIds = [...new Set(details.map(detail => detail.machine_id))]
    const machines = machineIds.length ? await prisma[department.machineModel].findMany({
      where: { id: { in: machineIds } }, select: { id: true, machine_no: true, sort_order: true }
    }) : []
    const machineById = new Map(machines.map(machine => [machine.id, machine]))
    const headerById = new Map(headers.map(header => [header.id, header]))
    const simplexSetups = includeSimplexHank && department.model === 'simplex' && machineIds.length
      ? await prisma.simplex_machine_setup.findMany({
          where: { entry_date: { gte: fromDate, lte: toDate }, machine_id: { in: machineIds } },
          select: { machine_id: true, entry_date: true, shift: true, run_sequence: true, sl_hank: true }
        })
      : []
    const simplexSetupByKey = new Map(simplexSetups.map(setup => [
      `${setup.machine_id}|${dateKey(setup.entry_date)}|${setup.shift}|${setup.run_sequence}`,
      setup
    ]))

    return details.map(detail => {
      const header = headerById.get(detail.header_id)
      const machine = machineById.get(detail.machine_id)
      return {
        department: department.label,
        date: header.entry_date,
        shift: header.shift,
        supervisorId: header.supervisor_id,
        machineNo: machine?.machine_no || '-',
        sortOrder: machine?.sort_order || 0,
        employeeName: detail.employee_name || 'NIL',
        hank: includeSimplexHank && department.model === 'simplex'
          ? n(simplexSetupByKey.get(`${detail.machine_id}|${dateKey(header.entry_date)}|${header.shift}|${detail.run_sequence}`)?.sl_hank)
          : n(detail.act_hank),
        standard: n(detail[department.std]),
        production: n(detail.act_prodn),
        efficiency: n(detail[department.effi]),
        utilization: n(detail.uti_percent),
        waste: n(detail.waste),
        wastePercent: n(detail.waste_percent),
        stoppage: n(detail.total_stoppage_mins),
        workTime: n(detail.work_time),
        runTime: n(detail.run_time)
      }
    })
  }))
  return departmentResults.flat()
}

function weighted(rows, field) {
  const weight = rows.reduce((sum, row) => sum + row.production, 0)
  if (weight > 0) return rows.reduce((sum, row) => sum + row[field] * row.production, 0) / weight
  return rows.length ? rows.reduce((sum, row) => sum + row[field], 0) / rows.length : 0
}

async function preparatoryAbstract(fromDate, toDate) {
  const report = baseReport('Preparatory Abstract Report', fromDate, toDate, 'landscape')
  const uptoFrom = monthStart(toDate)
  const queryFrom = fromDate < uptoFrom ? fromDate : uptoFrom
  const records = await getPreparatoryRecords(queryFrom, toDate, { includeSimplexHank: true })
  const productionRows = PREPARATORY_DEPARTMENTS.map(department => {
    const periodRows = records.filter(row => row.department === department.label && row.date >= fromDate && row.date <= toDate)
    const uptoRows = records.filter(row => row.department === department.label && row.date >= uptoFrom && row.date <= toDate)
    return [
      department.label,
      fixed(periodRows.reduce((s, r) => s + r.hank, 0)),
      fixed(uptoRows.reduce((s, r) => s + r.hank, 0)),
      fixed(periodRows.reduce((s, r) => s + r.standard, 0)),
      fixed(uptoRows.reduce((s, r) => s + r.standard, 0)),
      fixed(periodRows.reduce((s, r) => s + r.production, 0)),
      fixed(uptoRows.reduce((s, r) => s + r.production, 0)),
      fixed(weighted(periodRows, 'efficiency')),
      fixed(weighted(uptoRows, 'efficiency')),
      fixed(weighted(periodRows, 'utilization')),
      fixed(weighted(uptoRows, 'utilization'))
    ]
  })
  report.template = 'preparatory-abstract'
  report.referenceDate = shortDisplayDate(toDate)
  report.signatures = ['AM(P)', 'GM', 'M.D']
  report.meta.push(['Up To', periodText(uptoFrom, toDate)])
  report.tables.push({
    columns: ['Department', 'Hank', 'Up Hank', 'Std Hank\\Prod', 'Up StdHank', 'PROD(Kg)', 'Up ProdKgs', 'Effi', 'Up Effi', 'UTTi', 'Up Utti'],
    rows: productionRows
  })

  const [stoppage, spinningStoppage, autoconerStoppage] = await Promise.all([
    generatePreparatoryStoppageReport(fromDate, toDate),
    generateSpinningStoppageReport(fromDate, toDate),
    getAutoconerStoppagePercentageReport(dateKey(fromDate), dateKey(toDate))
  ])
  const abstractStoppageRow = (name, categories, total) => {
    const category = label => categories?.[label]
    const reasonTotal = pattern => Object.values(categories || {}).reduce((sum, item) => sum + (item.reasons || [])
      .filter(reason => pattern.test(reason.reason || ''))
      .reduce((reasonSum, reason) => reasonSum + n(reason.total), 0), 0)
    const totalStop = n(total)
    return [
      name,
      fixed(category('Maintenance Routine')?.categoryTotal?.total),
      fixed(category('Maintenance Breakdown')?.categoryTotal?.total),
      fixed(category('Cleaning Work')?.categoryTotal?.total),
      fixed(reasonTotal(/elect.*routine|routine.*elect/i)),
      fixed(category('Electrical Breakdown')?.categoryTotal?.total),
      fixed(reasonTotal(/power\s*fail/i)),
      fixed(reasonTotal(/excess\s*stock/i)),
      fixed(reasonTotal(/line\s*change/i)),
      fixed(totalStop),
      fixed(100 - totalStop)
    ]
  }
  const stoppageRows = Object.entries(stoppage.departments).map(([name, dept]) =>
    abstractStoppageRow(name, dept.categories, dept.netTotals?.total ?? dept.netTotal)
  )
  const externalStoppageRow = (name, data, total) => {
    const heads = data || []
    const headTotal = pattern => heads.filter(head => pattern.test(head.headName || '')).reduce((sum, head) => sum + n(head.shifts?.total?.percentage), 0)
    const detailTotal = pattern => heads.flatMap(head => Array.isArray(head.details) ? head.details : Object.values(head.details || {}))
      .filter(detail => pattern.test(detail.reasonName || detail.detailName || ''))
      .reduce((sum, detail) => sum + n(detail.shifts?.total?.percentage), 0)
    const totalStop = n(total)
    return [name, fixed(headTotal(/MAINTEN.*ROUTINE/i)), fixed(headTotal(/MAINTEN.*BREAKDOWN/i)), fixed(headTotal(/CLEANING/i)), fixed(detailTotal(/elect.*routine|routine.*elect/i)), fixed(headTotal(/ELECT.*BREAKDOWN/i)), fixed(detailTotal(/power\s*fail/i)), fixed(detailTotal(/excess\s*stock/i)), fixed(detailTotal(/line\s*change/i)), fixed(totalStop), fixed(100 - totalStop)]
  }
  if (spinningStoppage.success) stoppageRows.push(externalStoppageRow('SPINNING', spinningStoppage.reportData, spinningStoppage.grandTotal?.shifts?.total?.percentage))
  if (autoconerStoppage.success) stoppageRows.push(externalStoppageRow('AUTO CONER', autoconerStoppage.reportData, autoconerStoppage.netTotal?.total?.percentage))
  report.tables.push({
    columns: ['DEPARTMENT', 'ROUT.', 'B.D', 'CLEAN', 'ROUT.', 'B.D', 'POWER FAIL', 'EXCESS', 'LINE CHANGE', 'TOTAL Stop %', 'UTI %'],
    headerGroups: [
      { label: 'DEPARTMENT', span: 1 }, { label: 'MAINTENANCE', span: 3 }, { label: 'ELECTRICAL', span: 2 },
      { label: 'POWER', span: 1 }, { label: 'OTHERS', span: 1 }, { label: 'LINE', span: 1 }, { label: 'TOTAL', span: 1 }, { label: 'UTI %', span: 1 }
    ],
    rows: stoppageRows
  })
  return report
}

async function payrollEmployeeMap(names) {
  const uniqueNames = [...new Set(names.filter(Boolean))]
  if (!uniqueNames.length) return new Map()
  const employees = await prisma.$queryRaw`
    SELECT
      firstName AS emp_name,
      CAST(biometricEnrollmentId AS CHAR) AS emp_code,
      dateOfJoining AS doj
    FROM payroll.employees
    WHERE firstName IN (${Prisma.join(uniqueNames)})
  `
  return new Map(employees.map(employee => [employee.emp_name.trim().toLowerCase(), employee]))
}

async function preparatoryParticularSider(fromDate, toDate, employeeName) {
  const report = baseReport('Preparatory Particular Sider Report', fromDate, toDate)
  const records = (await getPreparatoryRecords(fromDate, toDate)).filter(row => row.employeeName.toLowerCase() === employeeName.trim().toLowerCase())
  const masters = await payrollEmployeeMap([employeeName])
  const employee = masters.get(employeeName.trim().toLowerCase())
  report.meta.push(['Sider', employee?.emp_name || '-'], ['Token No', employee?.emp_code || '-'], ['DOJ', employee?.doj ? displayDate(employee.doj) : '-'])
  report.tables.push({
    columns: ['SL No', 'Date', 'Department', 'Shift', 'Effi %', 'UTTI %', 'Waste %'],
    rows: records.map((row, index) => [index + 1, displayDate(row.date), row.department, row.shift, fixed(row.efficiency), fixed(row.utilization), fixed(row.wastePercent)]),
    footer: ['TOTAL', '', '', '', fixed(weighted(records, 'efficiency')), fixed(weighted(records, 'utilization')), fixed(weighted(records, 'wastePercent'))]
  })
  return report
}

async function preparatoryShiftProduction(fromDate, toDate) {
  const report = baseReport('Preparatory Shift Wise Production Report', fromDate, toDate, 'landscape')
  const records = await getPreparatoryRecords(fromDate, toDate)
  const supervisors = await supervisorMap(records.map(row => row.supervisorId))
  const groups = new Map()
  for (const row of records) {
    const key = `${dateKey(row.date)}|${row.shift}|${row.department}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  for (const [key, rows] of groups) {
    const [date, shift, department] = key.split('|')
    const supervisor = supervisors.get(rows[0].supervisorId) || 'Not Assigned'
    report.tables.push({
      title: `${department} - ${displayDate(date)} - Shift ${shift} - ${supervisor}`,
      columns: ['MC No', 'Sider Name', 'Hank', 'Std. Hk / Prod', 'Prod Kgs', 'Effi %', 'UTTI %', 'Stoppage'],
      rows: rows.sort((a, b) => a.sortOrder - b.sortOrder || a.machineNo.localeCompare(b.machineNo, undefined, { numeric: true })).map(row => [row.machineNo, row.employeeName, fixed(row.hank), fixed(row.standard), fixed(row.production), fixed(row.efficiency), fixed(row.utilization), fixed(row.stoppage, 0)]),
      footer: ['TOTAL', '', fixed(rows.reduce((s, r) => s + r.hank, 0)), fixed(rows.reduce((s, r) => s + r.standard, 0)), fixed(rows.reduce((s, r) => s + r.production, 0)), fixed(weighted(rows, 'efficiency')), fixed(weighted(rows, 'utilization')), fixed(rows.reduce((s, r) => s + r.stoppage, 0), 0)]
    })
  }
  return report
}

async function getAutoconerRecords(fromDate, toDate) {
  const headers = await prisma.autoconer_production_header.findMany({
    where: { entry_date: { gte: fromDate, lte: toDate } },
    select: { id: true, entry_date: true, shift: true, supervisor_id: true },
    orderBy: [{ entry_date: 'asc' }, { shift: 'asc' }]
  })
  if (!headers.length) return []
  const details = await prisma.autoconer_production_detail.findMany({ where: { header_id: { in: headers.map(header => header.id) } } })
  const machines = await prisma.autoconer_machines.findMany({
    where: { id: { in: [...new Set(details.map(detail => detail.machine_id))] } },
    select: { id: true, machine_no: true, no_of_drums: true, group_id: true }
  })
  const headerById = new Map(headers.map(header => [header.id, header]))
  const machineById = new Map(machines.map(machine => [machine.id, machine]))
  return details.map(detail => {
    const header = headerById.get(detail.header_id)
    const machine = machineById.get(detail.machine_id)
    const runTime = n(detail.run_time)
    return {
      date: header.entry_date, shift: header.shift, supervisorId: header.supervisor_id,
      machineNo: machine?.machine_no || '-', employeeName: detail.emp_name || 'NIL',
      count: detail.count_name || '-', production: n(detail.act_prodn),
      drums: Math.max(0, n(machine?.no_of_drums) - n(detail.idle_drum)),
      efficiency: n(detail.prodn_effi),
      utilization: runTime > 0 ? n(detail.work_time) / runTime * 100 : 0,
      red: n(detail.red_light), stoppage: n(detail.total_stoppage_mins)
    }
  })
}

async function autoconerShiftProduction(fromDate, toDate) {
  const report = baseReport('Autoconer Shift Wise Production Report', fromDate, toDate, 'landscape')
  const records = await getAutoconerRecords(fromDate, toDate)
  const supervisors = await supervisorMap(records.map(row => row.supervisorId))
  const masters = await employeeMasterMap(records.map(row => row.employeeName))
  const groups = new Map()
  for (const row of records) {
    const key = `${dateKey(row.date)}|${row.shift}|${row.count}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  for (const [key, rows] of groups) {
    const [date, shift, count] = key.split('|')
    report.tables.push({
      title: `${displayDate(date)} - Shift ${shift} - ${count} - ${supervisors.get(rows[0].supervisorId) || 'Not Assigned'}`,
      columns: ['SL No', 'MC No', 'Employee', 'DOJ', 'Drums', 'Prod Kgs', 'Effi %', 'UTTI %', 'RED', 'Stoppage'],
      rows: rows.sort((a, b) => a.machineNo.localeCompare(b.machineNo, undefined, { numeric: true })).map((row, index) => {
        const employee = masters.get(row.employeeName)
        return [index + 1, row.machineNo, row.employeeName, employee?.doj ? displayDate(employee.doj) : '-', fixed(row.drums, 0), fixed(row.production), fixed(row.efficiency), fixed(row.utilization), fixed(row.red), fixed(row.stoppage, 0)]
      }),
      footer: ['TOTAL', '', '', '', fixed(rows.reduce((s, r) => s + r.drums, 0), 0), fixed(rows.reduce((s, r) => s + r.production, 0)), fixed(weighted(rows, 'efficiency')), fixed(weighted(rows, 'utilization')), fixed(weighted(rows, 'red')), fixed(rows.reduce((s, r) => s + r.stoppage, 0), 0)]
    })
  }
  return report
}

async function autoconerSiderMonthly(fromDate, toDate) {
  const report = baseReport('Sider Monthly Autoconer Production Report', fromDate, toDate, 'landscape')
  const records = await getAutoconerRecords(fromDate, toDate)
  const masters = await employeeMasterMap(records.map(row => row.employeeName))
  const groups = new Map()
  for (const row of records) {
    const key = `${row.employeeName}|${row.count}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const rows = [...groups.entries()].map(([key, items]) => {
    const [name, count] = key.split('|')
    const employee = masters.get(name)
    return [employee?.emp_code || '-', name, employee?.doj ? displayDate(employee.doj) : '-', count, fixed(items.reduce((s, r) => s + r.production, 0)), fixed(weighted(items, 'efficiency')), fixed(weighted(items, 'red'))]
  }).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
  report.tables.push({ columns: ['Token No', 'Sider Name', 'DOJ', 'Count', 'Prod Kgs', 'EFF %', 'RED'], rows: rows.map((row, index) => [index + 1, ...row]), columnPrefix: 'S No' })
  // Keep the first column label explicit after adding the serial number.
  report.tables[0].columns = ['S No', 'Token No', 'Sider Name', 'DOJ', 'Count', 'Prod Kgs', 'EFF %', 'RED']
  return report
}

async function getSpinningRecords(fromDate, toDate) {
  const headers = await prisma.spinning_production_header.findMany({
    where: { entry_date: { gte: fromDate, lte: toDate } },
    select: { id: true, entry_date: true, shift: true, supervisor_id: true },
    orderBy: [{ entry_date: 'asc' }, { shift: 'asc' }]
  })
  if (!headers.length) return []
  const details = await prisma.spinning_production_detail.findMany({ where: { header_id: { in: headers.map(header => header.id) } } })
  const machines = await prisma.spinning_machines.findMany({
    where: { id: { in: [...new Set(details.map(detail => detail.machine_id))] } },
    select: { id: true, machine_no: true, sort_order: true, allocated_spindles: true }
  })
  const setups = await prisma.spinning_machine_setup.findMany({
    where: { entry_date: { gte: fromDate, lte: toDate }, machine_id: { in: [...new Set(details.map(detail => detail.machine_id))] } },
    select: { machine_id: true, entry_date: true, shift: true, run_sequence: true, allocated_spindles: true, conv_40s_value: true }
  })
  const headerById = new Map(headers.map(header => [header.id, header]))
  const machineById = new Map(machines.map(machine => [machine.id, machine]))
  const setupByKey = new Map(setups.map(setup => [`${setup.machine_id}|${dateKey(setup.entry_date)}|${setup.shift}|${setup.run_sequence}`, setup]))
  return details.map(detail => {
    const header = headerById.get(detail.header_id)
    const machine = machineById.get(detail.machine_id)
    const setup = setupByKey.get(`${detail.machine_id}|${dateKey(header.entry_date)}|${header.shift}|${detail.run_sequence}`)
    return {
      date: header.entry_date, shift: header.shift, supervisorId: header.supervisor_id,
      machineNo: machine?.machine_no || '-', sortOrder: machine?.sort_order || 0,
      count: detail.count_name || 'UNSPECIFIED', hank: n(detail.act_hank), production: n(detail.act_prodn),
      waste: n(detail.waste), wastePercent: n(detail.waste_percent), gps: n(detail.gps), expGps: n(detail.exp_gps),
      workedSpindles: n(detail.worked_spindles), stoppedSpindles: n(detail.stopped_spindles),
      allocatedSpindles: n(setup?.allocated_spindles) || n(machine?.allocated_spindles),
      conv40s: n(setup?.conv_40s_value), stoppage: n(detail.total_stoppage_mins),
      sider1: detail.sider1_name || '', sider2: detail.sider2_name || '', remarks: detail.remarks || ''
    }
  })
}

async function spinningCountGps(fromDate, toDate) {
  const report = baseReport('Count Wise Spinning GPS Report', fromDate, toDate, 'landscape')
  const records = await getSpinningRecords(fromDate, toDate)
  const groups = new Map()
  for (const row of records) {
    const key = `${row.count}|${row.machineNo}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const byCount = new Map()
  for (const [key, rows] of groups) {
    const [count, frame] = key.split('|')
    if (!byCount.has(count)) byCount.set(count, [])
    byCount.get(count).push({ frame, rows })
  }
  for (const [count, frames] of byCount) {
    const countRows = frames.flatMap(frame => frame.rows)
    report.tables.push({
      title: count,
      columns: ['Count', 'Frame', 'Production Kgs', 'Waste Kgs', 'Waste %', 'GPS'],
      rows: frames.sort((a, b) => a.frame.localeCompare(b.frame, undefined, { numeric: true })).map(frame => [count, frame.frame, fixed(frame.rows.reduce((s, r) => s + r.production, 0)), fixed(frame.rows.reduce((s, r) => s + r.waste, 0)), fixed(frame.rows.reduce((s, r) => s + r.waste, 0) / Math.max(frame.rows.reduce((s, r) => s + r.production, 0), 1) * 100), fixed(weighted(frame.rows, 'gps'))]),
      footer: ['TOTAL', '', fixed(countRows.reduce((s, r) => s + r.production, 0)), fixed(countRows.reduce((s, r) => s + r.waste, 0)), fixed(countRows.reduce((s, r) => s + r.waste, 0) / Math.max(countRows.reduce((s, r) => s + r.production, 0), 1) * 100), fixed(weighted(countRows, 'gps'))]
    })
  }
  return report
}

function siderShares(record) {
  const names = [...new Set([record.sider1, record.sider2].filter(Boolean))]
  if (!names.length) return []
  return names.map(name => ({ name, production: record.production / names.length, waste: record.waste / names.length }))
}

async function spinningSiderWise(fromDate, toDate) {
  const report = baseReport('Sider Wise Spinning Report', fromDate, toDate, 'landscape')
  const records = await getSpinningRecords(fromDate, toDate)
  const map = new Map()
  for (const record of records) {
    for (const share of siderShares(record)) {
      if (!map.has(share.name)) map.set(share.name, { production: 0, waste: 0 })
      map.get(share.name).production += share.production
      map.get(share.name).waste += share.waste
    }
  }
  const masters = await employeeMasterMap([...map.keys()])
  const rows = [...map.entries()].map(([name, values]) => {
    const employee = masters.get(name)
    return [employee?.emp_code || '-', name, employee?.doj ? displayDate(employee.doj) : '-', fixed(values.production), fixed(values.waste), fixed(values.production > 0 ? values.waste / values.production * 100 : 0)]
  }).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
  report.tables.push({ columns: ['Ticket No', 'Employee Name', 'DOJ', 'Prod Kgs', 'Waste Kgs', 'Waste %'], rows })
  report.notes.push('When two siders are recorded on one frame, production and waste are shared equally so report totals are not duplicated.')
  return report
}

async function spinningDailyShift(fromDate, toDate) {
  const report = baseReport('Spinning Daily Shift Production', fromDate, toDate, 'landscape')
  const records = await getSpinningRecords(fromDate, toDate)
  const supervisors = await supervisorMap(records.map(row => row.supervisorId))
  const groups = new Map()
  for (const row of records) {
    const key = `${dateKey(row.date)}|${row.shift}|${row.count}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  for (const [key, rows] of groups) {
    const [date, shift, count] = key.split('|')
    report.tables.push({
      title: `${displayDate(date)} - Shift ${shift} - ${count} - ${supervisors.get(rows[0].supervisorId) || 'Not Assigned'}`,
      columns: ['MC No', 'Hank', 'Worked Spl', 'Prod Kgs', 'GPS Std', 'GPS Act', 'Waste Kgs', 'Waste %', 'Gain / Loss', 'Stopped Spl', 'Stoppage Detail'],
      rows: rows.sort((a, b) => a.sortOrder - b.sortOrder || a.machineNo.localeCompare(b.machineNo, undefined, { numeric: true })).map(row => [row.machineNo, fixed(row.hank), fixed(row.workedSpindles), fixed(row.production), fixed(row.expGps), fixed(row.gps), fixed(row.waste), fixed(row.wastePercent), fixed(row.expGps - row.gps), fixed(row.stoppedSpindles), row.remarks || '-']),
      footer: ['TOTAL', fixed(rows.reduce((s, r) => s + r.hank, 0)), fixed(rows.reduce((s, r) => s + r.workedSpindles, 0)), fixed(rows.reduce((s, r) => s + r.production, 0)), fixed(weighted(rows, 'expGps')), fixed(weighted(rows, 'gps')), fixed(rows.reduce((s, r) => s + r.waste, 0)), fixed(rows.reduce((s, r) => s + r.waste, 0) / Math.max(rows.reduce((s, r) => s + r.production, 0), 1) * 100), fixed(weighted(rows, 'expGps') - weighted(rows, 'gps')), fixed(rows.reduce((s, r) => s + r.stoppedSpindles, 0)), '']
    })
  }
  report.notes.push('Energy-unit and power-failure fields are not present in the current production or master schema, so no values are invented in this report.')
  return report
}

async function spinningParticularSider(fromDate, toDate, employeeName) {
  const report = baseReport('Spinning Particular Sider Report', fromDate, toDate)
  const records = (await getSpinningRecords(fromDate, toDate)).filter(row => [row.sider1, row.sider2].some(name => name.toLowerCase() === employeeName.trim().toLowerCase()))
  const masters = await employeeMasterMap([employeeName])
  const employee = masters.get(employeeName) || [...masters.values()][0]
  report.meta.push(['Sider', employeeName || '-'], ['Ticket No', employee?.emp_code || '-'], ['DOJ', employee?.doj ? displayDate(employee.doj) : '-'])
  const rows = records.map((row, index) => {
    const divisor = [...new Set([row.sider1, row.sider2].filter(Boolean))].length || 1
    return [index + 1, displayDate(row.date), row.shift, row.machineNo, fixed(row.production / divisor), fixed(row.waste / divisor), fixed(row.production > 0 ? row.waste / row.production * 100 : 0)]
  })
  report.tables.push({
    columns: ['SL No', 'Date', 'Shift', 'Frame', 'Prod Kgs', 'Waste Kgs', 'Waste %'], rows,
    footer: ['TOTAL', '', '', '', fixed(rows.reduce((s, row) => s + n(row[4]), 0)), fixed(rows.reduce((s, row) => s + n(row[5]), 0)), fixed(rows.reduce((s, row) => s + n(row[5]), 0) / Math.max(rows.reduce((s, row) => s + n(row[4]), 0), 1) * 100)]
  })
  return report
}

async function spinningStoppageAbstract(fromDate, toDate) {
  const report = baseReport('Spinning Stoppage Percentage Abstract Report', fromDate, toDate, 'landscape')
  const data = await generateSpinningStoppageReport(fromDate, toDate)
  if (!data.success) return { ...report, notes: [data.message], tables: [] }
  const shifts = [1, 2, 3]
  report.tables.push({
    title: 'Stoppage Category Abstract',
    columns: ['SL No', 'Stoppage Head', 'I Shift Spl', 'I %', 'II Shift Spl', 'II %', 'III Shift Spl', 'III %', 'Total Spl', 'Total %'],
    rows: data.reportData.map((head, index) => [index + 1, head.headName, ...shifts.flatMap(shift => [fixed(head.shifts[shift].stoppedSpindles), fixed(head.shifts[shift].percentage)]), fixed(head.shifts.total.stoppedSpindles), fixed(head.shifts.total.percentage)]),
    footer: ['TOTAL', '', ...shifts.flatMap(shift => [fixed(data.grandTotal.shifts[shift].stoppedSpindles), fixed(data.grandTotal.shifts[shift].percentage)]), fixed(data.grandTotal.shifts.total.stoppedSpindles), fixed(data.grandTotal.shifts.total.percentage)]
  })
  report.tables.push({
    title: 'Spindle Summary',
    columns: ['Measure', 'I Shift', 'II Shift', 'III Shift', 'Total'],
    rows: [
      ['Allotted / Worked Spindles', ...shifts.map(shift => fixed(data.totalNoOfSpindlesPerShift[shift])), fixed(Object.values(data.totalNoOfSpindlesPerShift).reduce((s, value) => s + value, 0))],
      ['Stopped Spindles', ...shifts.map(shift => fixed(data.grandTotal.shifts[shift].stoppedSpindles)), fixed(data.grandTotal.shifts.total.stoppedSpindles)],
      ['Stopped %', ...shifts.map(shift => fixed(data.grandTotal.shifts[shift].percentage)), fixed(data.grandTotal.shifts.total.percentage)],
      ['Utilization %', ...shifts.map(shift => fixed(100 - data.grandTotal.shifts[shift].percentage)), fixed(100 - data.grandTotal.shifts.total.percentage)]
    ]
  })
  return report
}

const REPORT_BUILDERS = {
  'preparatory-abstract': preparatoryAbstract,
  'preparatory-particular-sider': preparatoryParticularSider,
  'preparatory-shift-production': preparatoryShiftProduction,
  'autoconer-shift-production': autoconerShiftProduction,
  'autoconer-sider-monthly': autoconerSiderMonthly,
  'spinning-count-gps': spinningCountGps,
  'spinning-sider-wise': spinningSiderWise,
  'spinning-daily-shift': spinningDailyShift,
  'spinning-particular-sider': spinningParticularSider,
  'spinning-stoppage-abstract': spinningStoppageAbstract
}

export async function buildFinalReport(reportKey, fromDate, toDate, employeeName = '') {
  const builder = REPORT_BUILDERS[reportKey]
  if (!builder) throw new Error('Unknown report type')
  return builder(fromDate, toDate, employeeName)
}
