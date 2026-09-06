import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
// Execute the real report modules with read-only database fixtures in place of Prisma.
async function load(path, names, dependencies = {}) {
  const code = (await read(path)).replace(/^import .*$/gm, '').replace(/^export \{.*\}\s*$/gm, '').replace(/\bexport (?=(?:async )?function|const)/g, '')
  return new Function(...Object.keys(dependencies), `${code}\nreturn { ${names.join(', ')} }`)(...Object.values(dependencies))
}
const identity = await load('src/lib/payroll/historicalEmployeeIdentity.js', ['resolveHistoricalEmployeeIdentity'])
const fixture = JSON.parse(await read('tests/fixtures/preparatory-shift-template.json'))
const departments = ['carding', 'breaker_drawing', 'lap_former', 'comber', 'finisher_drawing', 'simplex']
const labels = Object.keys(fixture.departments)
const machines = ['carding_machines', 'drawing_breaker_machines', 'lap_former_machines', 'comber_machines', 'drawing_finisher_machines', 'simplex_machines']
const day = new Date('2025-05-05T00:00:00Z')

function database(tables = {}) {
  const calls = []
  const prisma = new Proxy({}, { get(_, table) {
    return { async findMany(args = {}) {
      calls.push({ table, args })
      let rows = tables[table] || []
      if (rows instanceof Error) throw rows
      rows = rows.filter(row => Object.entries(args.where || {}).every(([key, value]) => {
        if (value && typeof value === 'object') {
          if (value.in) return value.in.includes(row[key])
          return (!value.gte || row[key] >= value.gte) && (!value.lte || row[key] <= value.lte)
        }
        return row[key] === value
      }))
      return rows.map(row => args.select ? Object.fromEntries(Object.keys(args.select).map(key => [key, row[key]])) : { ...row })
    } }
  } })
  return { prisma, calls }
}

function templateTables() {
  const tables = {}
  departments.forEach((model, index) => {
    const rows = fixture.departments[labels[index]]
    tables[`${model}_production_header`] = [{ id: model, entry_date: day, shift: 1, total_time: 510 }]
    tables[machines[index]] = rows.map((row, i) => ({ id: row.machine, machine_no: row.machine, sort_order: i }))
    tables[`${model}_production_detail`] = rows.map(row => ({
      id: `${model}:${row.machine}`, header_id: model, machine_id: row.machine, run_sequence: 1,
      employee_name: 'GOMATHI B', payroll_employee_id: 3688,
      act_hank: row.hank, act_prodn: row.production,
      exp_prodn: row.standard, std_prodn: 9999,
      std_hrs: (model === 'simplex' ? row.hank : row.standard) * 60,
      run_min: row.standard * 60,
      effi_percent: row.efficiency, act_effi_percent: row.efficiency, uti_percent: row.utilization,
      waste_percent: 0.12, waste: 0.1, work_time: 300, run_time: 510, total_stoppage_mins: 210
    }))
  })
  return tables
}

async function reports(db) {
  return load('src/lib/reports/finalReportQueries.js', ['buildFinalReport', 'weighted'], {
    prisma: db.prisma, ...identity,
    getPayrollEmployeesByIds: async ids => ids.map(id => ({ id, emp_name: 'GOMATHI B', token_no: '3688', emp_code: '3688' })),
    getProductionSupervisorDisplayMap: async () => new Map(),
    generatePreparatoryStoppageReport: async () => ({ departments: {} }),
    generateSpinningStoppageReport: async () => ({ success: true, reportData: [] }),
    getAutoconerStoppagePercentageReport: async () => ({ success: true, reportData: [] })
  })
}

test('all six shift department averages reproduce the independently printed PDF totals', async () => {
  const db = database(templateTables())
  const { buildFinalReport, weighted } = await reports(db)
  const report = await buildFinalReport('preparatory-shift-production', day, day, null, 1)
  const expected = [['98.70', '63.41'], ['97.39', '66.18'], ['99.81', '38.56'], ['96.49', '81.30'], ['98.51', '66.11'], ['98.14', '79.71']]
  assert.equal(report.tables.length, 6)
  report.tables.forEach((table, i) => {
    assert.deepEqual(table.footer.slice(5, 7), expected[i])
    assert.equal(table.rows.length, fixture.departments[labels[i]].length)
    assert.equal(table.columns.length, 8)
    assert.equal(table.footer[7], '')
  })
  assert.deepEqual(report.tables[0].rows[0].slice(2, 7), ['50.87', '179.44', '177.48', '98.91', '60.78'])
  assert.deepEqual(report.signatures, ['AM(P)', 'DGM', 'DIRECTOR'])
  // The shared weighting used by other report families is deliberately unchanged.
  assert.equal(weighted([{ production: 1, efficiency: 20 }, { production: 3, efficiency: 80 }], 'efficiency'), 65)
  const headerCalls = db.calls.filter(call => call.table.endsWith('_production_header'))
  assert.ok(headerCalls.every(call => call.args.where.shift === 1))
})

test('Simplex converts minute quantities to template hours and prints the stoppage legend', async () => {
  const tables = templateTables()
  const row = tables.simplex_production_detail[0]
  row.std_hrs = 64.4
  row.run_min = 63
  tables.simplex_stoppage_entry = [{ production_detail_id: row.id, stoppage1_id: 'excess', stoppage1_time: 440 }]
  tables.stoppage_details = [{ id: 'excess', short_code: 'EIU', code: 1, stoppage_name: 'EXCESS STOCK' }]
  const { buildFinalReport } = await reports(database(tables))
  const report = await buildFinalReport('preparatory-shift-production', day, day, null, 1)
  const simplex = report.tables[5]
  assert.deepEqual(simplex.rows[0].slice(2, 4), ['1.07', '1.05'])
  assert.equal(simplex.rows[0][5], '97.83')
  assert.equal(simplex.rows[0][7], 'EIU:440')
  assert.deepEqual(report.notes, ['EXCESS STOCK-EIU'])
})

test('particular sider groups machines into five chronological date/shift rows', async () => {
  const tables = templateTables()
  const originals = tables.comber_production_detail.slice(0, 2)
  tables.comber_production_header = [5, 3, 1, 4, 2].map(d => ({ id: `day${d}`, entry_date: new Date(`2025-05-0${d}T00:00:00Z`), shift: 1 }))
  tables.comber_production_detail = tables.comber_production_header.flatMap(header => originals.map((row, i) => ({ ...row, id: `${header.id}:${i}`, header_id: header.id })))
  const { buildFinalReport } = await reports(database(tables))
  const report = await buildFinalReport('preparatory-particular-sider', '2025-05-01', '2025-05-05', 3688)
  const comber = report.tables.find(table => table.title === 'COMBER')
  assert.equal(comber.rows.length, 5)
  assert.deepEqual(comber.rows.map(row => row[0]), ['01-05-2025', '02-05-2025', '03-05-2025', '04-05-2025', '05-05-2025'])
  assert.equal(comber.rows[0][2], '100.73')
})

test('all-siders Carding reproduces Gomathi totals and sorts names, preserving waste formula', async () => {
  const tables = templateTables()
  const db = database(tables)
  const { generatePreparatorySiderPerformanceReport } = await load('src/lib/queries/preparatorySiderPerformanceReportQueries.js', ['generatePreparatorySiderPerformanceReport'], {
    prisma: db.prisma, ...identity,
    getPayrollEmployeesByIds: async ids => ids.map(id => ({ id, emp_name: 'GOMATHI B', token_no: '3688' }))
  })
  const report = await generatePreparatorySiderPerformanceReport(day, day)
  const employee = report.departments.CARDING.employees[0]
  assert.equal(employee.productionKgs, 4066.57)
  assert.equal(employee.efficiencyPercent, 98.70)
  assert.equal(employee.utilizationPercent, 63.41)
  assert.equal(employee.wastePercent, 0.12)
  tables.carding_production_detail.push({ ...tables.carding_production_detail[0], id: 'extra', employee_name: 'A NAME', payroll_employee_id: 99, act_prodn: 1 })
  const sorted = await generatePreparatorySiderPerformanceReport(day, day)
  assert.equal(sorted.departments.CARDING.employees[0].name, 'A NAME')
})

test('waste month-to-date ends on the selected day in UTC and India, including month end', async () => {
  const code = (await read('src/lib/queries/preparatoryWasteReportQueries.js')).replace(/^import .*$/gm, '').replace(/export /g, '')
  for (const TZ of ['UTC', 'Asia/Calcutta']) {
    const result = JSON.parse(execFileSync(process.execPath, ['-e', `${code}\nconsole.log(JSON.stringify(['2025-05-05','2025-05-31'].map(day => getUpToDateRange(day+'T23:59:59Z'))))`], { env: { ...process.env, TZ }, encoding: 'utf8' }))
    assert.deepEqual(result, [
      { from: '2025-05-01T00:00:00.000Z', to: '2025-05-05T23:59:59.000Z' },
      { from: '2025-05-01T00:00:00.000Z', to: '2025-05-31T23:59:59.000Z' }
    ])
  }
})

function stoppageTables() {
  return {
    carding_production_header: [{ id: 'h', entry_date: day, shift: 1, total_time: 510 }],
    carding_production_detail: [
      { id: 'a', header_id: 'h', machine_id: '1', run_time: 510 },
      { id: 'b', header_id: 'h', machine_id: '2', run_time: 510 }
    ],
    carding_stoppage_entry: [{ production_detail_id: 'a', stoppage1_id: 'r', stoppage1_time: 102 }],
    stoppage_details: [{ id: 'r', stoppage_head_id: 'cl', stoppage_name: 'DAILY CLEANING', is_active: false }],
    stoppage_heads: [{ id: 'cl', stoppage_head_name: 'CLEANING WORK', is_active: false }]
  }
}

test('historical inactive stoppages and machines with no stoppage preserve the denominator', async () => {
  const db = database(stoppageTables())
  const { generatePreparatoryStoppageReport } = await load('src/lib/queries/preparatoryStoppageReportQueries.js', ['generatePreparatoryStoppageReport'], db)
  const report = await generatePreparatoryStoppageReport(day, day)
  const reason = report.departments.CARDING.categories['Cleaning Work'].reasons[0]
  assert.equal(reason.shift1, 10)
  assert.equal(reason.total, 3.33)
  assert.equal(reason.serialNumber, 1)
  assert.ok(db.calls.filter(call => ['stoppage_details', 'stoppage_heads'].includes(call.table)).every(call => !call.args.where?.is_active))
})

test('Comber counts a split machine shift once and prefers historical time, with 420-minute night fallback', async () => {
  for (const totalTime of [360, undefined]) {
    const tables = stoppageTables()
    tables.comber_production_header = [{ id: 'co', entry_date: day, shift: 3, total_time: totalTime }]
    tables.comber_production_detail = [{ id: 'c1', header_id: 'co', machine_id: '1' }, { id: 'c2', header_id: 'co', machine_id: '1' }]
    tables.comber_stoppage_entry = [{ production_detail_id: 'c1', stoppage1_id: 'r', stoppage1_time: 42 }]
    const { generatePreparatoryStoppageReport } = await load('src/lib/queries/preparatoryStoppageReportQueries.js', ['generatePreparatoryStoppageReport'], database(tables))
    const report = await generatePreparatoryStoppageReport(day, day)
    const reason = report.departments.COMBER.categories['Cleaning Work'].reasons[0]
    assert.equal(reason.shift3, totalTime ? 11.67 : 10)
    assert.equal(reason.serialNumber, 2)
  }
})

test('stoppage department nets round once, and failures do not become zero stoppage', async () => {
  const tables = stoppageTables()
  tables.stoppage_heads.push({ id: 'ot', stoppage_head_name: 'OTHERS' })
  tables.stoppage_details.push({ id: 'r2', stoppage_head_id: 'ot', stoppage_name: 'EXCESS STOCK' })
  tables.carding_stoppage_entry[0] = { production_detail_id: 'a', stoppage1_id: 'r', stoppage1_time: 1, stoppage2_id: 'r2', stoppage2_time: 1 }
  const { generatePreparatoryStoppageReport } = await load('src/lib/queries/preparatoryStoppageReportQueries.js', ['generatePreparatoryStoppageReport'], database(tables))
  const report = await generatePreparatoryStoppageReport(day, day)
  assert.equal(report.departments.CARDING.netTotals.shift1, 0.20)
  assert.equal(report.departments.CARDING.netTotal, 0.07)
  tables.stoppage_heads[0].stoppage_head_name = 'UNMAPPED'
  await assert.rejects(() => generatePreparatoryStoppageReport(day, day), /incomplete.*Unmapped/)
})

test('shift filter excludes other shifts, sorts date before department and rejects invalid shifts', async () => {
  const tables = templateTables()
  for (const model of departments) {
    tables[`${model}_production_header`].push({ id: `${model}2`, entry_date: day, shift: 2 })
    tables[`${model}_production_detail`].push({ ...tables[`${model}_production_detail`][0], id: `${model}2`, header_id: `${model}2` })
  }
  const { buildFinalReport } = await reports(database(tables))
  const single = await buildFinalReport('preparatory-shift-production', day, day, null, 1)
  assert.equal(single.tables.length, 6)
  const all = await buildFinalReport('preparatory-shift-production', day, day)
  assert.equal(all.tables.length, 12)
  assert.match(all.tables[5].title, /SIMPLEX.*Shift 1/)
  assert.match(all.tables[6].title, /CARDING.*Shift 2/)
  await assert.rejects(() => buildFinalReport('preparatory-shift-production', day, day, null, 4), /valid shift/)
})

test('PDF export uses the same verified table values, signatures and abstract period label', async () => {
  const { createFinalReportPdf } = await load('src/lib/reports/pdfLayout.js', ['createFinalReportPdf'], { jsPDF, autoTable })
  const { buildFinalReport } = await reports(database(templateTables()))
  const report = await buildFinalReport('preparatory-shift-production', day, day, null, 1)
  const pdf = createFinalReportPdf(report).output()
  assert.ok(pdf.startsWith('%PDF'))
  for (const value of ['63.41', '97.39', '179.44', 'DIRECTOR', 'DGM']) assert.ok(pdf.includes(value), value)
  const abstract = await buildFinalReport('preparatory-abstract', '2025-05-01', '2025-05-05')
  assert.equal(abstract.periodLabel, 'From 01-05-2025 To 05-05-2025')
  assert.ok(createFinalReportPdf(abstract).output().includes('Period totals: From 01-05-2025 To 05-05-2025'))
})

// Compile and render the real page bodies; stub only controls, actions and hook state.
// This checks screen/PDF agreement without a production database or browser login.
async function renderReportPage(path, states, props = {}) {
  const { transform } = require('next/dist/build/swc')
  const { code } = await transform(await read(path), {
    filename: path,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' }
  })
  let stateIndex = 0
  const clicks = []
  let savedPdf
  const control = ({ children, onClick }) => {
    if (onClick) clicks.push(onClick)
    return React.createElement('div', null, children)
  }
  const { createFinalReportPdf } = await load('src/lib/reports/pdfLayout.js', ['createFinalReportPdf'], { jsPDF, autoTable })
  const dependencies = name => {
    if (name === 'react') return { ...React, useState: () => [states[stateIndex++], () => {}], useEffect: () => {}, useMemo: fn => fn() }
    if (name === 'jspdf') return { jsPDF: function (...args) { const doc = new jsPDF(...args); doc.save = () => { savedPdf = doc.output() }; return doc } }
    if (name === 'sonner') return { toast: { success: () => {}, error: message => { throw new Error(message) } } }
    if (name === 'next/link' || name.endsWith('/employee-autocomplete')) return control
    if (name === '@/lib/utils') return { cn: (...args) => args.filter(Boolean).join(' ') }
    if (name === '@/lib/reports/pdfLayout') return { createFinalReportPdf }
    if (name.startsWith('@/app/actions/')) return {}
    if (name.startsWith('@/components/ui/') || name === 'lucide-react') return new Proxy({}, { get: () => control })
    return require(name)
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(dependencies, module, module.exports)
  const html = renderToStaticMarkup(React.createElement(module.exports.default, props))
  return { html, download() { clicks.find(fn => fn.name === 'handleDownload')(); return savedPdf } }
}

test('all six real report page bodies compile and render; dedicated PDF exports agree with screen values', async () => {
  const tables = templateTables()
  const db = database(tables)
  const { buildFinalReport } = await reports(db)
  for (const key of ['preparatory-shift-production', 'preparatory-particular-sider', 'preparatory-abstract']) {
    const report = await buildFinalReport(key, day, day, 3688, 1)
    const { html } = await renderReportPage('src/app/reports/final/[reportKey]/report-client.jsx', ['2025-05-05', '2025-05-05', 'GOMATHI B', 3688, '1', report, false], { reportKey: key, config: { title: report.title } })
    assert.ok(html.includes('CARDING'))
    if (key === 'preparatory-shift-production') {
      assert.match(html, />63\.41</)
      assert.ok(html.includes('All shifts'))
    }
  }
  const { generatePreparatorySiderPerformanceReport } = await load('src/lib/queries/preparatorySiderPerformanceReportQueries.js', ['generatePreparatorySiderPerformanceReport'], {
    prisma: db.prisma, ...identity, getPayrollEmployeesByIds: async ids => ids.map(id => ({ id, emp_name: 'GOMATHI B', token_no: '3688' }))
  })
  const siders = await generatePreparatorySiderPerformanceReport(day, day)
  const siderPage = await renderReportPage('src/app/reports/preparatory/sider-performance/page.jsx', [day, day, siders, false])
  assert.match(siderPage.html, />63\.41</)
  assert.ok(siderPage.download().includes('63.41'))
  assert.ok(siderPage.html.includes('DIRECTOR'))

  const { generatePreparatoryWasteReport } = await load('src/lib/queries/preparatoryWasteReportQueries.js', ['generatePreparatoryWasteReport'], db)
  const waste = await generatePreparatoryWasteReport(day, day)
  const wastePage = await renderReportPage('src/app/reports/preparatory/waste-abstract/page.jsx', [day, day, waste, false])
  assert.ok(wastePage.html.includes('Up To Waste Kgs'))
  assert.ok(!wastePage.html.includes('AM(P)'))
  const wastePdf = wastePage.download()
  // AutoTable wraps this heading into separate PDF text runs.
  assert.ok(wastePdf.includes('Up To') && wastePdf.includes('Waste Kgs'))
  assert.ok(!wastePdf.includes('AM\\(P\\)'))

  const { generatePreparatoryStoppageReport } = await load('src/lib/queries/preparatoryStoppageReportQueries.js', ['generatePreparatoryStoppageReport'], database(stoppageTables()))
  const stoppage = await generatePreparatoryStoppageReport(day, day)
  const stoppagePage = await renderReportPage('src/app/reports/preparatory/stoppage-percentage/page.jsx', [day, day, stoppage, false])
  assert.match(stoppagePage.html, />3\.33</)
  assert.ok(stoppagePage.download().includes('3.33'))
})
