import { prisma } from '@/lib/prisma'
import { getPayrollEmployeesByIds } from '@/lib/payroll/employees'
import { resolveHistoricalEmployeeIdentity } from '@/lib/payroll/historicalEmployeeIdentity'
import { getProductionSupervisorDisplayMap } from '@/lib/queries/productionSupervisorQueries'
import { generatePreparatoryStoppageReport } from '@/lib/queries/preparatoryStoppageReportQueries'
import { generateSpinningStoppageReport } from '@/lib/queries/spinningStoppageReportQueries'
import { getAutoconerStoppagePercentageReport } from '@/app/reports/autoconer/stoppage-percentage/autoconerStoppagePercentageQueries'

const PREPARATORY_DEPARTMENTS = [
  { label: 'CARDING', model: 'carding', machineModel: 'carding_machines', effi: 'effi_percent', std: 'exp_prodn' },
  { label: 'BREAKER DRAWING', model: 'breaker_drawing', machineModel: 'drawing_breaker_machines', effi: 'effi_percent', std: 'exp_prodn' },
  { label: 'LAP FORMER', model: 'lap_former', machineModel: 'lap_former_machines', effi: 'effi_percent', std: 'exp_prodn' },
  { label: 'COMBER', model: 'comber', machineModel: 'comber_machines', effi: 'act_effi_percent', std: 'std_hrs' },
  { label: 'FINISHER DRAWING', model: 'finisher_drawing', machineModel: 'drawing_finisher_machines', effi: 'effi_percent', std: 'exp_prodn' },
  { label: 'SIMPLEX', model: 'simplex', machineModel: 'simplex_machines', effi: 'act_effi_percent', std: 'std_hrs' }
]

const n = value => Number(value) || 0
const fixed = (value, digits = 2) => n(value).toFixed(digits)
const reportDate = (value, label) => {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
      ? new Date(`${value}T00:00:00.000Z`)
      : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
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

async function payrollEmployeeMap(ids) {
  const employees = await getPayrollEmployeesByIds(ids)
  return new Map(employees.map(employee => [Number(employee.id), employee]))
}

async function supervisorMap(ids) {
  return getProductionSupervisorDisplayMap(ids)
}

async function getPreparatoryRecords(fromDate, toDate, { includeSimplexHank = false, includeStoppageDetails = false, shift = null } = {}) {
  const departmentResults = await Promise.all(PREPARATORY_DEPARTMENTS.map(async department => {
    const headers = await prisma[`${department.model}_production_header`].findMany({
      where: { entry_date: { gte: fromDate, lte: toDate }, ...(shift == null ? {} : { shift }) },
      select: { id: true, entry_date: true, shift: true, supervisor_id: true },
      orderBy: [{ entry_date: 'asc' }, { shift: 'asc' }]
    })
    if (!headers.length) return []

    const select = {
      id: true, header_id: true, machine_id: true, employee_name: true, payroll_employee_id: true, run_sequence: true,
      act_prodn: true, uti_percent: true, waste: true, waste_percent: true,
      work_time: true, [department.effi]: true, [department.std]: true
    }
    if (department.model !== 'comber') select.run_time = true
    if (department.model === 'simplex') select.run_min = true
    if (department.model !== 'simplex') select.act_hank = true
    if (department.model !== 'simplex') select.total_stoppage_mins = true

    const details = await prisma[`${department.model}_production_detail`].findMany({
      where: { header_id: { in: headers.map(header => header.id) } }, select
    })
    const machineIds = [...new Set(details.map(detail => detail.machine_id))]
    const [machines, stoppageEntries] = await Promise.all([
      machineIds.length ? prisma[department.machineModel].findMany({
        where: { id: { in: machineIds } }, select: { id: true, machine_no: true, sort_order: true }
      }) : [],
      includeStoppageDetails && details.length ? prisma[`${department.model}_stoppage_entry`].findMany({
        where: { production_detail_id: { in: details.map(detail => detail.id) } },
        select: {
          production_detail_id: true,
          stoppage1_id: true, stoppage1_time: true,
          stoppage2_id: true, stoppage2_time: true,
          stoppage3_id: true, stoppage3_time: true,
          stoppage4_id: true, stoppage4_time: true
        }
      }) : []
    ])
    const machineById = new Map(machines.map(machine => [machine.id, machine]))
    const headerById = new Map(headers.map(header => [header.id, header]))
    const stoppageByDetailId = new Map(stoppageEntries.map(entry => [entry.production_detail_id, entry]))
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
      const stoppageEntry = stoppageByDetailId.get(detail.id)
      return {
        department: department.label,
        date: header.entry_date,
        shift: header.shift,
        supervisorId: header.supervisor_id,
        machineNo: machine?.machine_no || '-',
        sortOrder: machine?.sort_order || 0,
        detailId: detail.id,
        employeeId: detail.payroll_employee_id,
        employeeName: detail.employee_name || '',
        hank: department.model === 'simplex'
          ? (includeSimplexHank
            ? n(simplexSetupByKey.get(`${detail.machine_id}|${dateKey(header.entry_date)}|${header.shift}|${detail.run_sequence}`)?.sl_hank)
            : n(detail.std_hrs) / 60)
          : n(detail.act_hank),
        standard: department.model === 'simplex' && !includeSimplexHank
          ? n(detail.run_min) / 60
          : n(detail[department.std]) / (department.std === 'std_hrs' ? 60 : 1),
        production: n(detail.act_prodn),
        efficiency: n(detail[department.effi]),
        utilization: n(detail.uti_percent),
        waste: n(detail.waste),
        wastePercent: n(detail.waste_percent),
        stoppageTotal: n(detail.total_stoppage_mins),
        stoppageSlots: includeStoppageDetails ? [1, 2, 3, 4].map(slot => ({
          id: stoppageEntry?.[`stoppage${slot}_id`],
          time: n(stoppageEntry?.[`stoppage${slot}_time`])
        })).filter(slot => slot.id && slot.time > 0) : [],
        workTime: n(detail.work_time),
        runTime: n(detail.run_time)
      }
    })
  }))
  const rawRecords = departmentResults.flat()
  const stoppageIds = [...new Set(rawRecords.flatMap(record => record.stoppageSlots.map(slot => slot.id)))]
  const [employees, stoppageDetails] = await Promise.all([
    payrollEmployeeMap(rawRecords.map(record => record.employeeId)),
    includeStoppageDetails && stoppageIds.length ? prisma.stoppage_details.findMany({
      where: { id: { in: stoppageIds } },
      select: { id: true, short_code: true, code: true, stoppage_name: true }
    }) : []
  ])
  const stoppageCodeById = new Map(stoppageDetails.map(detail => [detail.id, detail.short_code || String(detail.code)]))
  return rawRecords.map(record => {
    const stoppage = includeStoppageDetails ? record.stoppageSlots
      .map(slot => `${stoppageCodeById.get(slot.id) || '-'}:${fixed(slot.time, 0)}`)
      .join(',') : record.stoppageTotal
    const employee = employees.get(Number(record.employeeId)) || null
    const identity = resolveHistoricalEmployeeIdentity({
      payrollEmployeeId: record.employeeId,
      snapshotName: record.employeeName,
      employee,
      assignmentKey: `${record.department}:${record.detailId}`
    })
    return {
      ...record,
      employee,
      employeeIdentity: identity,
      identityStatus: identity.identityStatus,
      employeeName: identity.displayName,
      stoppageLegend: record.stoppageSlots.map(slot => {
        const detail = stoppageDetails.find(item => item.id === slot.id)
        return detail ? `${detail.stoppage_name}-${stoppageCodeById.get(slot.id)}` : null
      }).filter(Boolean),
      stoppage
    }
  })
}

function weighted(rows, field) {
  const weight = rows.reduce((sum, row) => sum + row.production, 0)
  if (weight > 0) return rows.reduce((sum, row) => sum + row[field] * row.production, 0) / weight
  return rows.length ? rows.reduce((sum, row) => sum + row[field], 0) / rows.length : 0
}

// Template shift totals average the stored machine/run percentages, not kilograms.
function preparatoryAverage(rows, field) {
  return rows.length ? rows.reduce((sum, row) => sum + n(row[field]), 0) / rows.length : 0
}

function spinningGps(rows) {
  const workedSpindles = rows.reduce((sum, row) => sum + row.workedSpindles, 0)
  return workedSpindles > 0
    ? rows.reduce((sum, row) => sum + row.production, 0) / workedSpindles * 1000
    : 0
}

function workedSpindleWeighted(rows, field) {
  const workedSpindles = rows.reduce((sum, row) => sum + row.workedSpindles, 0)
  if (workedSpindles > 0) {
    return rows.reduce((sum, row) => sum + row[field] * row.workedSpindles, 0) / workedSpindles
  }
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
  report.periodLabel = dateKey(fromDate) === dateKey(toDate) ? '' : periodText(fromDate, toDate)
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

async function preparatoryParticularSider(fromDate, toDate, employeeId) {
  const report = baseReport('Preparatory Particular Sider Report', fromDate, toDate)
  report.signatures = ['AM(P)', 'DGM', 'DIRECTOR']
  const payrollId = Number(employeeId)
  const records = (await getPreparatoryRecords(fromDate, toDate)).filter(row => Number(row.employeeId) === payrollId)
  const masters = await payrollEmployeeMap([payrollId])
  const employee = masters.get(payrollId)
  report.meta.push(['Sider', employee?.emp_name || '-'], ['Token No', employee?.emp_code || '-'], ['DOJ', employee?.doj ? displayDate(employee.doj) : '-'])
  const recordsByDepartment = new Map()
  for (const record of records) {
    if (!recordsByDepartment.has(record.department)) recordsByDepartment.set(record.department, [])
    recordsByDepartment.get(record.department).push(record)
  }
  for (const [department, departmentRecords] of recordsByDepartment) {
    const shifts = new Map()
    for (const row of departmentRecords) {
      const key = `${dateKey(row.date)}|${row.shift}`
      if (!shifts.has(key)) shifts.set(key, [])
      shifts.get(key).push(row)
    }
    report.tables.push({
      title: department,
      columns: ['Date', 'Shift', 'Effi %', 'UTTI %', 'Waste %'],
      rows: [...shifts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, rows]) => [displayDate(rows[0].date), rows[0].shift, fixed(preparatoryAverage(rows, 'efficiency')), fixed(preparatoryAverage(rows, 'utilization')), fixed(weighted(rows, 'wastePercent'))]),
      footer: ['TOTAL', '', fixed(weighted(departmentRecords, 'efficiency')), fixed(weighted(departmentRecords, 'utilization')), fixed(weighted(departmentRecords, 'wastePercent'))]
    })
  }
  return report
}

async function preparatoryShiftProduction(fromDate, toDate, employeeId, selectedShift = null) {
  const report = baseReport('Preparatory Shift Wise Production Report', fromDate, toDate, 'landscape')
  report.signatures = ['AM(P)', 'DGM', 'DIRECTOR']
  const records = await getPreparatoryRecords(fromDate, toDate, { includeStoppageDetails: true, shift: selectedShift })
  if (selectedShift != null) report.meta.push(['Shift', selectedShift])
  report.notes = [...new Set(records.flatMap(row => row.stoppageLegend))].sort()
  const supervisors = await supervisorMap(records.map(row => row.supervisorId))
  const groups = new Map()
  for (const row of records) {
    const key = `${dateKey(row.date)}|${row.shift}|${row.department}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const orderedGroups = [...groups.entries()].sort(([a], [b]) => {
    const [aDate, aShift, aDepartment] = a.split('|')
    const [bDate, bShift, bDepartment] = b.split('|')
    return aDate.localeCompare(bDate) || Number(aShift) - Number(bShift)
      || PREPARATORY_DEPARTMENTS.findIndex(dept => dept.label === aDepartment) - PREPARATORY_DEPARTMENTS.findIndex(dept => dept.label === bDepartment)
  })
  for (const [key, rows] of orderedGroups) {
    const [date, shift, department] = key.split('|')
    const supervisor = supervisors.get(rows[0].supervisorId) || 'Not Assigned'
    report.tables.push({
      title: `${department} - ${displayDate(date)} - Shift ${shift} - ${supervisor}`,
      columns: ['MC No', 'Sider Name', 'Hank', 'Std. Hk / Prod', 'Prod Kgs', 'Effi %', 'UTTI %', 'Stoppage'],
      rows: rows.sort((a, b) => a.sortOrder - b.sortOrder || a.machineNo.localeCompare(b.machineNo, undefined, { numeric: true })).map(row => [row.machineNo, row.employeeName, fixed(row.hank), fixed(row.standard), fixed(row.production), fixed(row.efficiency), fixed(row.utilization), row.stoppage]),
      footer: ['TOTAL', '', fixed(rows.reduce((s, r) => s + r.hank, 0)), fixed(rows.reduce((s, r) => s + r.standard, 0)), fixed(rows.reduce((s, r) => s + r.production, 0)), fixed(preparatoryAverage(rows, 'efficiency')), fixed(preparatoryAverage(rows, 'utilization')), '']
    })
  }
  return report
}

async function getAutoconerRecords(fromDate, toDate, { includeStoppageDetails = false } = {}) {
  const headers = await prisma.autoconer_production_header.findMany({
    where: { entry_date: { gte: fromDate, lte: toDate } },
    select: { id: true, entry_date: true, shift: true, supervisor_id: true },
    orderBy: [{ entry_date: 'asc' }, { shift: 'asc' }]
  })
  if (!headers.length) return []
  const details = await prisma.autoconer_production_detail.findMany({ where: { header_id: { in: headers.map(header => header.id) } } })
  const [machines, stoppageEntries] = await Promise.all([
    prisma.autoconer_machines.findMany({
      where: { id: { in: [...new Set(details.map(detail => detail.machine_id))] } },
      select: { id: true, machine_no: true, no_of_drums: true, group_id: true }
    }),
    includeStoppageDetails ? prisma.autoconer_stoppage_entry.findMany({
      where: { production_detail_id: { in: details.map(detail => detail.id) } },
      select: {
        production_detail_id: true,
        stoppage1_id: true, stoppage1_time: true,
        stoppage2_id: true, stoppage2_time: true,
        stoppage3_id: true, stoppage3_time: true,
        stoppage4_id: true, stoppage4_time: true
      }
    }) : []
  ])
  const headerById = new Map(headers.map(header => [header.id, header]))
  const machineById = new Map(machines.map(machine => [machine.id, machine]))
  const stoppageIds = [...new Set(stoppageEntries.flatMap(entry => [
    entry.stoppage1_id, entry.stoppage2_id, entry.stoppage3_id, entry.stoppage4_id
  ]).filter(Boolean))]
  const [employees, stoppageDetails] = await Promise.all([
    payrollEmployeeMap(details.map(detail => detail.payroll_employee_id)),
    stoppageIds.length ? prisma.stoppage_details.findMany({
      where: { id: { in: stoppageIds } },
      select: { id: true, short_code: true, code: true }
    }) : []
  ])
  const stoppageCodeById = new Map(stoppageDetails.map(detail => [detail.id, detail.short_code || String(detail.code)]))
  const stoppageByDetailId = new Map(stoppageEntries.map(entry => [
    entry.production_detail_id,
    [1, 2, 3, 4].flatMap(slot => {
      const id = entry[`stoppage${slot}_id`]
      const time = n(entry[`stoppage${slot}_time`])
      const code = stoppageCodeById.get(id)
      return id && time > 0 && code ? [`${code}:${fixed(time, 0)}`] : []
    }).join(',')
  ]))
  return details.map(detail => {
    const header = headerById.get(detail.header_id)
    const machine = machineById.get(detail.machine_id)
    const runTime = n(detail.run_time)
    return {
      date: header.entry_date, shift: header.shift, supervisorId: header.supervisor_id,
      detailId: detail.id, machineNo: machine?.machine_no || '-', employeeId: detail.payroll_employee_id,
      employee: employees.get(Number(detail.payroll_employee_id)) || null,
      employeeSnapshot: detail.emp_name || '',
      count: detail.count_name || '-', production: n(detail.act_prodn),
      drums: Math.max(0, n(machine?.no_of_drums) - n(detail.idle_drum)),
      efficiency: n(detail.prodn_effi),
      utilization: runTime > 0 ? n(detail.work_time) / runTime * 100 : 0,
      red: n(detail.red_light),
      stoppageTotal: n(detail.total_stoppage_mins),
      stoppage: includeStoppageDetails ? (stoppageByDetailId.get(detail.id) || '') : n(detail.total_stoppage_mins)
    }
  }).map(record => {
    const identity = resolveHistoricalEmployeeIdentity({
      payrollEmployeeId: record.employeeId,
      snapshotName: record.employeeSnapshot,
      employee: record.employee,
      assignmentKey: `autoconer:${record.detailId}`
    })
    return { ...record, employeeIdentity: identity, identityStatus: identity.identityStatus, employeeName: identity.displayName }
  })
}

async function autoconerShiftProduction(fromDate, toDate) {
  const report = baseReport('Autoconer Shift Wise Production Report', fromDate, toDate, 'landscape')
  const records = await getAutoconerRecords(fromDate, toDate, { includeStoppageDetails: true })
  const supervisors = await supervisorMap(records.map(row => row.supervisorId))
  const groups = new Map()
  for (const row of records) {
    const key = `${dateKey(row.date)}|${row.shift}|${row.count}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const orderedGroups = [...groups.entries()].sort(([leftKey], [rightKey]) => {
    const [leftDate, leftShift] = leftKey.split('|')
    const [rightDate, rightShift] = rightKey.split('|')
    return leftDate.localeCompare(rightDate) || Number(leftShift) - Number(rightShift)
  })
  for (const [key, rows] of orderedGroups) {
    const [date, shift, count] = key.split('|')
    report.tables.push({
      title: `${displayDate(date)} - Shift ${shift} - ${count} - ${supervisors.get(rows[0].supervisorId) || 'Not Assigned'}`,
      columns: ['SL No', 'MC No', 'Employee', 'DOJ', 'Drums', 'Prod Kgs', 'Effi %', 'UTTI %', 'RED', 'Stoppage'],
      rows: rows.sort((a, b) => a.machineNo.localeCompare(b.machineNo, undefined, { numeric: true })).map((row, index) => {
        const employee = row.employee
        return [index + 1, row.machineNo, row.employeeName, employee?.doj ? displayDate(employee.doj) : '-', fixed(row.drums, 0), fixed(row.production), fixed(row.efficiency), fixed(row.utilization), fixed(row.red), row.stoppage]
      }),
      footer: ['TOTAL', '', '', '', fixed(rows.reduce((s, r) => s + r.drums, 0), 0), fixed(rows.reduce((s, r) => s + r.production, 0)), fixed(weighted(rows, 'efficiency')), fixed(weighted(rows, 'utilization')), fixed(weighted(rows, 'red')), fixed(rows.reduce((s, r) => s + r.stoppageTotal, 0), 0)]
    })
  }
  return report
}

async function autoconerSiderMonthly(fromDate, toDate) {
  const report = baseReport('Sider Monthly Autoconer Production Report', fromDate, toDate, 'landscape')
  report.title = `Month wise Report for Autoconer Sider From ${displayDate(fromDate)} To ${displayDate(toDate)}`
  report.period = ''
  const records = (await getAutoconerRecords(fromDate, toDate)).filter(row => row.identityStatus !== 'UNASSIGNED')
  const groups = new Map()
  for (const row of records) {
    const key = `${row.employeeIdentity.groupKey}|${row.count}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const rows = [...groups.entries()].map(([key, items]) => {
    const count = key.slice(key.lastIndexOf('|') + 1)
    const employee = items[0]?.employee
    const snapshots = [...new Set(items.map(item => item.employeeName).filter(Boolean))]
    const token = employee?.token_no || employee?.emp_code || (items[0]?.identityStatus === 'UNRESOLVED_LEGACY' ? 'UNMAPPED' : '-')
    return [token, snapshots.join(' / ') || 'NIL', employee?.doj ? displayDate(employee.doj) : '-', count, fixed(items.reduce((s, r) => s + r.production, 0)), fixed(weighted(items, 'efficiency')), fixed(weighted(items, 'red'))]
  }).sort((a, b) => String(a[1]).localeCompare(String(b[1]), undefined, { sensitivity: 'base' }))
  report.tables.push({
    columns: ['Token No', 'Sider Name', 'DOJ', 'Count', 'Prod Kgs', 'EFF %', 'RED'],
    rows: rows.map((row, index) => [index + 1, ...row]),
    footer: ['TOTAL', '', '', '', '', fixed(records.reduce((sum, record) => sum + record.production, 0)), fixed(weighted(records, 'efficiency')), fixed(weighted(records, 'red'))],
    columnPrefix: 'S No'
  })
  // Keep the first column label explicit after adding the serial number.
  report.tables[0].columns = ['S No', 'Token No', 'Sider Name', 'DOJ', 'Count', 'Prod Kgs', 'EFF %', 'RED']
  return report
}

async function getSpinningRecords(fromDate, toDate, { includeStoppageDetails = false } = {}) {
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
    select: { machine_id: true, entry_date: true, shift: true, run_sequence: true, allocated_spindles: true, conv_40s_value: true, act_count: true }
  })
  const headerById = new Map(headers.map(header => [header.id, header]))
  const machineById = new Map(machines.map(machine => [machine.id, machine]))
  const setupByKey = new Map(setups.map(setup => [`${setup.machine_id}|${dateKey(setup.entry_date)}|${setup.shift}|${setup.run_sequence}`, setup]))
  const stoppageEntries = includeStoppageDetails
    ? await prisma.spinning_stoppage_entry.findMany({
        where: { production_detail_id: { in: details.map(detail => detail.id) } },
        select: {
          production_detail_id: true,
          stoppage1_id: true, stoppage1_time: true,
          stoppage2_id: true, stoppage2_time: true,
          stoppage3_id: true, stoppage3_time: true,
          stoppage4_id: true, stoppage4_time: true
        }
      })
    : []
  const stoppageReasonIds = [...new Set(stoppageEntries.flatMap(entry => [
    entry.stoppage1_id, entry.stoppage2_id, entry.stoppage3_id, entry.stoppage4_id
  ]).filter(Boolean))]
  const stoppageReasons = stoppageReasonIds.length
    ? await prisma.stoppage_details.findMany({
        where: { id: { in: stoppageReasonIds } },
        select: { id: true, short_code: true, stoppage_name: true }
      })
    : []
  const stoppageReasonById = new Map(stoppageReasons.map(reason => [reason.id, reason]))
  const stoppageByDetailId = new Map(stoppageEntries.map(entry => {
    const formatted = [1, 2, 3, 4].flatMap(slot => {
      const reasonId = entry[`stoppage${slot}_id`]
      const minutes = n(entry[`stoppage${slot}_time`])
      if (!reasonId || minutes <= 0) return []
      const reason = stoppageReasonById.get(reasonId)
      const label = reason?.short_code || reason?.stoppage_name
      return label ? [`${label}:${minutes}`] : []
    }).join(',')
    return [entry.production_detail_id, formatted]
  }))
  const employees = await payrollEmployeeMap(details.flatMap(detail => [detail.sider1_payroll_employee_id, detail.sider2_payroll_employee_id]))
  return details.map(detail => {
    const header = headerById.get(detail.header_id)
    const machine = machineById.get(detail.machine_id)
    const setup = setupByKey.get(`${detail.machine_id}|${dateKey(header.entry_date)}|${header.shift}|${detail.run_sequence}`)
    return {
      date: header.entry_date, shift: header.shift, supervisorId: header.supervisor_id,
      detailId: detail.id, machineNo: machine?.machine_no || '-', sortOrder: machine?.sort_order || 0,
      count: detail.count_name || 'UNSPECIFIED', hank: n(detail.act_hank), production: n(detail.act_prodn),
      waste: n(detail.waste), wastePercent: n(detail.waste_percent), gps: n(detail.gps), expGps: n(detail.exp_gps),
      workedSpindles: n(detail.worked_spindles), stoppedSpindles: n(detail.stopped_spindles),
      allocatedSpindles: n(setup?.allocated_spindles ?? machine?.allocated_spindles),
      conv40s: n(setup?.conv_40s_value), actCount: n(setup?.act_count), stoppage: n(detail.total_stoppage_mins),
      sider1Id: detail.sider1_payroll_employee_id,
      sider2Id: detail.sider2_payroll_employee_id,
      sider1Snapshot: detail.sider1_name || '',
      sider2Snapshot: detail.sider2_name || '',
      sider1Employee: employees.get(Number(detail.sider1_payroll_employee_id)) || null,
      sider2Employee: employees.get(Number(detail.sider2_payroll_employee_id)) || null,
      remarks: includeStoppageDetails ? (stoppageByDetailId.get(detail.id) || '') : (detail.remarks || '')
    }
  }).map(record => {
    const sider1Identity = resolveHistoricalEmployeeIdentity({
      payrollEmployeeId: record.sider1Id,
      snapshotName: record.sider1Snapshot,
      employee: record.sider1Employee,
      assignmentKey: `spinning:${record.detailId}:sider1`
    })
    const sider2Identity = resolveHistoricalEmployeeIdentity({
      payrollEmployeeId: record.sider2Id,
      snapshotName: record.sider2Snapshot,
      employee: record.sider2Employee,
      assignmentKey: `spinning:${record.detailId}:sider2`
    })
    return {
      ...record,
      sider1: sider1Identity.displayName,
      sider2: sider2Identity.displayName,
      sider1Identity,
      sider2Identity
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
    const sortedFrames = frames.sort((a, b) => a.frame.localeCompare(b.frame, undefined, { numeric: true }))
    const frameGpsValues = sortedFrames.map(frame => spinningGps(frame.rows))
    const averageFrameGps = frameGpsValues.length
      ? frameGpsValues.reduce((sum, gps) => sum + gps, 0) / frameGpsValues.length
      : 0
    report.tables.push({
      title: count,
      columns: ['Frame', 'Production Kgs', 'Waste Kgs', 'Waste %', 'GPS'],
      rows: sortedFrames.map((frame, index) => [frame.frame, fixed(frame.rows.reduce((s, r) => s + r.production, 0)), fixed(frame.rows.reduce((s, r) => s + r.waste, 0)), fixed(frame.rows.reduce((s, r) => s + r.waste, 0) / Math.max(frame.rows.reduce((s, r) => s + r.production, 0), 1) * 100), fixed(frameGpsValues[index])]),
      footer: ['TOTAL', fixed(countRows.reduce((s, r) => s + r.production, 0)), fixed(countRows.reduce((s, r) => s + r.waste, 0)), fixed(countRows.reduce((s, r) => s + r.waste, 0) / Math.max(countRows.reduce((s, r) => s + r.production, 0), 1) * 100), fixed(averageFrameGps)]
    })
  }
  return report
}

function siderShares(record) {
  const identities = new Map([record.sider1Identity, record.sider2Identity]
    .filter(identity => identity?.identityStatus !== 'UNASSIGNED')
    .map(identity => [identity.groupKey, identity]))
  if (!identities.size) return []
  return [...identities.values()].map(identity => ({
    identity,
    employeeId: identity.payrollEmployeeId,
    employee: identity.employee,
    production: record.production / identities.size,
    waste: record.waste / identities.size
  }))
}

async function spinningSiderWise(fromDate, toDate) {
  const report = baseReport('Sider Wise Spinning Report', fromDate, toDate, 'landscape')
  const records = await getSpinningRecords(fromDate, toDate)
  const map = new Map()
  for (const record of records) {
    for (const share of siderShares(record)) {
      const key = share.identity.groupKey
      if (!map.has(key)) map.set(key, { employee: share.employee, identity: share.identity, displayNames: new Set(), production: 0, waste: 0 })
      map.get(key).displayNames.add(share.identity.displayName)
      map.get(key).production += share.production
      map.get(key).waste += share.waste
    }
  }
  const rows = [...map.values()].map(values => {
    const employee = values.employee
    const token = employee?.token_no || employee?.emp_code || (values.identity.identityStatus === 'UNRESOLVED_LEGACY' ? 'UNMAPPED' : '-')
    return [token, [...values.displayNames].join(' / ') || values.identity.displayName, employee?.doj ? displayDate(employee.doj) : '-', fixed(values.production), fixed(values.waste), fixed(values.production > 0 ? values.waste / values.production * 100 : 0)]
  }).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
  report.tables.push({ columns: ['Ticket No', 'Employee Name', 'DOJ', 'Prod Kgs', 'Waste Kgs', 'Waste %'], rows })
  report.notes.push('When two siders are recorded on one frame, production and waste are shared equally so report totals are not duplicated.')
  return report
}

async function spinningDailyShift(fromDate, toDate) {
  const report = baseReport('Spinning Daily Shift Production', fromDate, toDate, 'landscape')
  const records = await getSpinningRecords(fromDate, toDate, { includeStoppageDetails: true })
  const supervisors = await supervisorMap(records.map(row => row.supervisorId))
  const groups = new Map()
  for (const row of records) {
    const key = `${dateKey(row.date)}|${row.shift}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const orderedGroups = [...groups.entries()].sort(([leftKey], [rightKey]) => {
    const [leftDate, leftShift] = leftKey.split('|')
    const [rightDate, rightShift] = rightKey.split('|')
    return leftDate.localeCompare(rightDate) || Number(leftShift) - Number(rightShift)
  })
  for (const [key, rows] of orderedGroups) {
    const [date, shift] = key.split('|')
    const sortedRows = rows.sort((a, b) => a.sortOrder - b.sortOrder || a.machineNo.localeCompare(b.machineNo, undefined, { numeric: true }))
    const rowsByCount = new Map()
    for (const row of sortedRows) {
      if (!rowsByCount.has(row.count)) rowsByCount.set(row.count, [])
      rowsByCount.get(row.count).push(row)
    }
    for (const [count, countRows] of rowsByCount) {
      const totalProduction = countRows.reduce((sum, row) => sum + row.production, 0)
      const standardGps = workedSpindleWeighted(countRows, 'expGps')
      const actualGps = spinningGps(countRows)
      report.tables.push({
        title: `${displayDate(date)} - Shift ${shift} - ${count} - ${supervisors.get(rows[0].supervisorId) || 'Not Assigned'}`,
        columns: ['MC No', 'Hank', 'Worked Spindles', 'Production Kgs', 'GPS Std', 'GPS Act', 'Waste Kgs', 'Waste %', 'Gain / Loss', 'Stopped Spl', 'Stoppage Detail'],
        rows: countRows.map(row => [row.machineNo, fixed(row.hank), fixed(row.workedSpindles), fixed(row.production), fixed(row.expGps), fixed(row.gps), fixed(row.waste), fixed(row.wastePercent), fixed(row.gps ? (row.production * (row.gps - row.expGps)) / row.gps : 0), fixed(row.stoppedSpindles), row.remarks || '-']),
        footer: ['TOTAL', fixed(countRows.reduce((s, r) => s + r.hank, 0)), fixed(countRows.reduce((s, r) => s + r.workedSpindles, 0)), fixed(totalProduction), fixed(standardGps), fixed(actualGps), fixed(countRows.reduce((s, r) => s + r.waste, 0)), fixed(countRows.reduce((s, r) => s + r.waste, 0) / Math.max(totalProduction, 1) * 100), fixed(actualGps ? (totalProduction * (actualGps - standardGps)) / actualGps : 0), fixed(countRows.reduce((s, r) => s + r.stoppedSpindles, 0)), '']
      })
    }

    const production = rows.reduce((sum, row) => sum + row.production, 0)
    const waste = rows.reduce((sum, row) => sum + row.waste, 0)
    const hank = rows.reduce((sum, row) => sum + row.hank, 0)
    const allottedSpindles = rows.reduce((sum, row) => sum + row.allocatedSpindles, 0)
    const workedSpindles = rows.reduce((sum, row) => sum + row.workedSpindles, 0)
    const convertedProduction = rows.reduce((sum, row) => sum + row.production * row.conv40s, 0)
    report.tables.push({
      title: `${displayDate(date)} - Shift ${shift} - Summary`,
      columns: ['Production Summary', 'Value', 'Power / Conversion Summary', 'Value'],
      rows: [
        ['Production', fixed(production), 'EB Unit / Shift', '-'],
        ['Utilisation %', fixed(allottedSpindles > 0 ? workedSpindles / allottedSpindles * 100 : 0), 'Genset Unit / Shift', '-'],
        ["40's Conv Production", fixed(convertedProduction), 'Total Unit / Shift', '-'],
        ['Average Count', fixed(weighted(rows, 'actCount')), 'Actual Prod. / Unit / Kg', '-'],
        ["40's Converted GPS", fixed(workedSpindles > 0 ? convertedProduction / workedSpindles * 1000 : 0), "40's Conv Prod. / Unit / Kg", '-'],
        ['Unit / 1000 Spindles', '-', 'Total Hanks', fixed(hank)],
        ['Total Allotted Spindles', fixed(allottedSpindles), 'Total Worked Spindles', fixed(workedSpindles)],
        ['Total Wastages', fixed(waste), 'Total Waste %', fixed(production > 0 ? waste / production * 100 : 0)]
      ]
    })

    const siderMap = new Map()
    for (const row of rows) {
      const identities = [row.sider1Identity, row.sider2Identity].filter(identity => identity?.identityStatus !== 'UNASSIGNED')
      for (const identity of identities) {
        if (!siderMap.has(identity.groupKey)) {
          siderMap.set(identity.groupKey, { identity, employee: identity.employee, names: new Set(), counts: new Set(), machines: new Set(), sides: 0, production: 0, waste: 0 })
        }
        const sider = siderMap.get(identity.groupKey)
        sider.names.add(identity.displayName)
        sider.counts.add(row.count)
        sider.machines.add(row.machineNo)
        sider.sides += 1
      }
      for (const share of siderShares(row)) {
        const sider = siderMap.get(share.identity.groupKey)
        if (sider) {
          sider.production += share.production
          sider.waste += share.waste
        }
      }
    }
    const siderRows = [...siderMap.values()]
      .sort((a, b) => [...a.names].join(' / ').localeCompare([...b.names].join(' / '), undefined, { numeric: true }))
      .map((sider, index) => [index + 1, [...sider.names].join(' / '), [...sider.counts].join(', '), sider.sides, fixed(sider.production), fixed(sider.waste), fixed(sider.production > 0 ? sider.waste / sider.production * 100 : 0), [...sider.machines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', '), sider.employee?.doj ? shortDisplayDate(sider.employee.doj) : '-'])
    report.tables.push({
      title: `${displayDate(date)} - Shift ${shift} - Sider Summary`,
      columns: ['SL No', 'Employee Name', 'Count Name', 'No of Side', 'Production', 'Waste Kgs', 'Waste %', 'Machine', 'D.O.J'],
      rows: siderRows
    })
  }
  report.notes.push('Energy-unit and power-failure fields are not present in the current production or master schema, so no values are invented in this report.')
  return report
}

async function spinningParticularSider(fromDate, toDate, employeeId) {
  const report = baseReport('Spinning Particular Sider Report', fromDate, toDate)
  const payrollId = Number(employeeId)
  const records = (await getSpinningRecords(fromDate, toDate)).filter(row => [row.sider1Id, row.sider2Id].some(id => Number(id) === payrollId))
  const employee = (await payrollEmployeeMap([payrollId])).get(payrollId)
  report.meta.push(['Sider', employee?.emp_name || '-'], ['Ticket No', employee?.emp_code || '-'], ['DOJ', employee?.doj ? displayDate(employee.doj) : '-'])
  const rows = records.map((row, index) => {
    const divisor = siderShares(row).length || 1
    return [index + 1, displayDate(row.date), fixed(row.production / divisor), fixed(row.waste / divisor), fixed(row.production > 0 ? row.waste / row.production * 100 : 0)]
  })
  report.tables.push({
    columns: ['SL No', 'Date', 'Prod Kgs', 'Waste Kgs', 'Waste %'], rows,
    footer: ['TOTAL', '', fixed(rows.reduce((s, row) => s + n(row[2]), 0)), fixed(rows.reduce((s, row) => s + n(row[3]), 0)), fixed(rows.reduce((s, row) => s + n(row[3]), 0) / Math.max(rows.reduce((s, row) => s + n(row[2]), 0), 1) * 100)]
  })
  return report
}

async function spinningStoppageAbstract(fromDate, toDate) {
  const report = baseReport('Spinning Stoppage Percentage Abstract Report', fromDate, toDate, 'landscape')
  const data = await generateSpinningStoppageReport(fromDate, toDate)
  if (!data.success) return { ...report, notes: [data.message], tables: [] }
  const shifts = [1, 2, 3]
  const workedByShift = Object.fromEntries(shifts.map(shift => [shift, data.totalNoOfSpindlesPerShift[shift]]))
  const stoppedByShift = Object.fromEntries(shifts.map(shift => [shift, data.grandTotal.shifts[shift].stoppedSpindles]))
  const allottedByShift = Object.fromEntries(shifts.map(shift => [shift, workedByShift[shift] + stoppedByShift[shift]]))
  const totalWorked = shifts.reduce((sum, shift) => sum + workedByShift[shift], 0)
  const totalStopped = data.grandTotal.shifts.total.stoppedSpindles
  const totalAllotted = totalWorked + totalStopped
  const utilization = totalAllotted > 0 ? totalWorked / totalAllotted * 100 : 0
  const stoppedPercent = totalAllotted > 0 ? totalStopped / totalAllotted * 100 : 0
  const workedDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1

  report.tables.push({
    columns: ['SL No', 'SHIFT', 'Worked Spl', '%'],
    rows: shifts.map(shift => [shift, shift, fixed(workedByShift[shift]), fixed(allottedByShift[shift] > 0 ? workedByShift[shift] / allottedByShift[shift] * 100 : 0)]),
    footer: ['TOTAL', '', fixed(totalWorked), fixed(utilization)]
  })
  report.tables.push({
    columns: ['Report Parameter', 'Value', 'Report Parameter', 'Value'],
    rows: [
      ['Allotted Spindles', fixed(totalAllotted), 'Shift', shifts.length],
      ['Worked Days', workedDays, '', '']
    ]
  })
  report.tables.push({
    headerGroups: [
      { label: 'SL No', span: 1 },
      { label: 'Reasons', span: 1 },
      { label: 'I Shift', span: 2 },
      { label: 'II Shift', span: 2 },
      { label: 'III Shift', span: 2 },
      { label: 'Total', span: 2 }
    ],
    columns: ['', '', 'Spl', '%', 'Spl', '%', 'Spl', '%', 'Spl', '%'],
    rows: data.reportData.map((head, index) => [index + 1, head.headName, ...shifts.flatMap(shift => [fixed(head.shifts[shift].stoppedSpindles), fixed(head.shifts[shift].percentage)]), fixed(head.shifts.total.stoppedSpindles), fixed(head.shifts.total.percentage)]),
    footer: ['TOTAL', '', ...shifts.flatMap(shift => [fixed(data.grandTotal.shifts[shift].stoppedSpindles), fixed(data.grandTotal.shifts[shift].percentage)]), fixed(data.grandTotal.shifts.total.stoppedSpindles), fixed(data.grandTotal.shifts.total.percentage)]
  })
  report.tables.push({
    title: 'Abstract',
    columns: ['Measure', 'Value'],
    rows: [
      ['Allotted Spindles', fixed(totalAllotted)],
      ['Worked Spindles', fixed(totalWorked)],
      ['Utilization %', fixed(utilization)],
      ['Stopped Spindles', fixed(totalStopped)],
      ['Stopped Spindles %', fixed(stoppedPercent)],
      ['Abstract', fixed(stoppedPercent)]
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

export async function buildFinalReport(reportKey, fromDate, toDate, employeeId = null, shift = null) {
  const builder = REPORT_BUILDERS[reportKey]
  if (!builder) throw new Error('Unknown report type')
  const normalizedFrom = reportDate(fromDate, 'From date')
  const normalizedTo = reportDate(toDate, 'To date')
  if (normalizedFrom > normalizedTo) throw new Error('From date cannot be after To date')
  if (reportKey === 'preparatory-shift-production') {
    const selectedShift = shift == null || shift === '' ? null : Number(shift)
    if (selectedShift != null && ![1, 2, 3].includes(selectedShift)) throw new Error('Select a valid shift')
    return builder(normalizedFrom, normalizedTo, employeeId, selectedShift)
  }
  return builder(normalizedFrom, normalizedTo, employeeId)
}
