import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const source = path => readFile(new URL(path, root), 'utf8')

test('report catalog exposes all 25 final-format reports and ten completed gap routes', async () => {
  const catalog = await source('src/lib/reports/finalReportCatalog.js')
  assert.equal((catalog.match(/href: '/g) || []).length, 25)
  assert.equal((catalog.match(/: \{ title: /g) || []).length, 10)
  assert.doesNotMatch(catalog, /coming soon/i)
})

test('critical report calculations use the corrected production rules', async () => {
  const [abstractQuery, lowEfficiency, particularSider, finalReports, spinningStoppage, waste] = await Promise.all([
    source('src/app/reports/autoconer/abstract/autoconerAbstractReportQueries.js'),
    source('src/lib/queries/autoconerLowEfficiencyReportQueries.js'),
    source('src/lib/queries/autoconerParticularSiderReportQueries.js'),
    source('src/lib/reports/finalReportQueries.js'),
    source('src/lib/queries/spinningStoppageReportQueries.js'),
    source('src/lib/queries/preparatoryWasteReportQueries.js')
  ])

  assert.doesNotMatch(abstractQuery, /d\.run_time \/ d\.work_time/)
  assert.match(abstractQuery, /SUM\(COALESCE\(d\.work_time, 0\)\)[\s\S]*NULLIF\(SUM\(COALESCE\(d\.run_time, 0\)\), 0\)/)
  assert.match(abstractQuery, /d\.prodn_effi/)
  assert.doesNotMatch(abstractQuery, /m\.no_of_drums > 0/)
  assert.doesNotMatch(lowEfficiency, /if \(shiftEffi === 0/)
  assert.match(lowEfficiency, /filter\(item => item\?\.is_low_efficiency\)/)
  assert.match(particularSider, /Number\(detail\.prodn_effi\)/)
  assert.match(finalReports, /function spinningGps\(rows\)/)
  assert.match(finalReports, /new Set\(\[row\.sider1Id, row\.sider2Id\]/)
  assert.match(spinningStoppage, /shift === 3 \? 420 : 510/)
  assert.match(waste, /getUpToDateRange\(toDate\)/)
})

test('final report PDF layout keeps the compact reference hierarchy', async () => {
  const layout = await source('src/lib/reports/pdfLayout.js')
  assert.match(layout, /KAYAAR EXPORTS PRIVATE LIMITED/)
  assert.match(layout, /accent: \[145, 32, 38\]/)
  assert.match(layout, /fontSize: report\.orientation === 'landscape' \? 6\.7 : 7\.2/)
  assert.match(layout, /Page \$\{page\} of \$\{totalPages\}/)
})

test('spinning and autoconer reports retain every count run and aggregate stored values', async () => {
  const [daily, machineWise, abstract, siderMonthly, autoconerGrid, spinningStoppage] = await Promise.all([
    source('src/lib/queries/spinningDailyProductionQueries.js'),
    source('src/app/reports/spinning/machine-wise-production/spinningMachineWiseProductionQueries.js'),
    source('src/app/reports/spinning/production-abstract/spinningAbstractQueries.js'),
    source('src/app/reports/spinning/sider-monthly/siderMonthlyQueries.js'),
    source('src/lib/queries/autoconerEfficiencyReportQueries.js'),
    source('src/lib/queries/spinningStoppageReportQueries.js')
  ])

  assert.match(daily, /shiftData\.production \+= production/)
  assert.match(daily, /shiftData\.workedSpindles \+= workedSpindles/)
  assert.doesNotMatch(daily, /machine\.shifts\[shift\] = \{/)
  assert.match(machineWise, /SUM\(COALESCE\(d\.act_prodn, 0\)\)[\s\S]*SUM\(COALESCE\(d\.worked_spindles, 0\)\)/)
  assert.doesNotMatch(abstract, /AVG\(d\.(?:gps|exp_gps)\)/)
  assert.match(abstract, /sms\.run_sequence = d\.run_sequence/)
  assert.match(siderMonthly, /sider2_payroll_employee_id/)
  assert.doesNotMatch(siderMonthly, /if \(frame\.shifts\[[123]\]\.waste > 0\)/)
  assert.match(autoconerGrid, /apd\.act_prodn/)
  assert.doesNotMatch(autoconerGrid, /apd\.prodn_effi/)
  assert.match(spinningStoppage, /setup\?\.allocated_spindles \?\? machine\.allocated_spindles/)
})
