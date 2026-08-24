import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const resolved = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(resolved)
    return /\.(?:js|jsx|mjs)$/.test(entry.name) ? [resolved] : []
  }))
  return files.flat()
}

test('runtime code has no hardcoded payroll schema qualifier', async () => {
  const files = await sourceFiles(path.resolve('src'))
  const offenders = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/\bpayroll\.(?:employees|departments|companies|holiday_lists|holidays)\b/i.test(source)) {
      offenders.push(path.relative(process.cwd(), file))
    }
  }

  assert.deepEqual(offenders, [])
})

test('payroll client is isolated and cannot silently use the production URL', async () => {
  const [client, config, productionClient] = await Promise.all([
    readFile(path.resolve('src/lib/payroll/client.js'), 'utf8'),
    readFile(path.resolve('src/lib/payroll/config.js'), 'utf8'),
    readFile(path.resolve('src/lib/prisma.js'), 'utf8')
  ])

  assert.match(client, /getPayrollDatabaseUrl/)
  assert.match(config, /PAYROLL_DATABASE_URL/)
  assert.match(config, /PAYROLL_COMPANY_ID/)
  assert.doesNotMatch(client, /process\.env\.DATABASE_URL/)
  assert.doesNotMatch(productionClient, /PAYROLL_DATABASE_URL/)
})

test('employee autocomplete fails visibly instead of falling back to employee_master', async () => {
  const [source, payrollEmployees, autocomplete] = await Promise.all([
    readFile(path.resolve('src/lib/queries/employeeQueries.js'), 'utf8'),
    readFile(path.resolve('src/lib/payroll/employees.js'), 'utf8'),
    readFile(path.resolve('src/components/ui/employee-autocomplete.jsx'), 'utf8')
  ])

  assert.match(source, /searchPayrollEmployees/)
  assert.doesNotMatch(source, /employee_master|@\/lib\/prisma/)
  assert.match(payrollEmployees, /middleName/)
  assert.match(payrollEmployees, /lastName/)
  assert.match(payrollEmployees, /biometricEnrollmentId LIKE/)
  assert.match(payrollEmployees, /formatPayrollEmployeeName/)
  assert.match(payrollEmployees, /hydratePayrollEmployeeNames/)
  assert.match(autocomplete, /emp\.payroll_employee_id/)
  assert.match(autocomplete, /ID \{employeeId\}/)
  assert.match(autocomplete, /onChange\(nextValue, null\)/)
})

test('production schema and every employee entry flow persist payroll primary keys', async () => {
  const schema = await readFile(path.resolve('prisma/schema.prisma'), 'utf8')
  assert.doesNotMatch(schema, /model employee_master/)
  for (const field of ['payroll_employee_id', 'sider1_payroll_employee_id', 'sider2_payroll_employee_id']) {
    assert.match(schema, new RegExp(`\\b${field}\\b`))
  }

  const entryFiles = [
    'src/components/modules/preparatory-entry/BreakerDrawingProductionTab.jsx',
    'src/components/modules/preparatory-entry/CardingProductionTab.jsx',
    'src/components/modules/preparatory-entry/ComberProductionTab.jsx',
    'src/components/modules/preparatory-entry/FinisherDrawingProductionTab.jsx',
    'src/components/modules/preparatory-entry/LapFormerProductionTab.jsx',
    'src/components/modules/preparatory-entry/SimplexProductionTab.jsx',
    'src/components/modules/post-preparatory/autoconer/AutoconerProductionTab.jsx',
    'src/components/modules/post-preparatory/spinning/SpinningProductionTab.jsx'
  ]
  for (const file of entryFiles) {
    const source = await readFile(path.resolve(file), 'utf8')
    assert.match(source, /payroll_employee_id/, file)
    assert.match(source, /employeeId=/, file)
  }
})

test('all production employee writes are canonicalized against payroll', async () => {
  const queryFiles = [
    'autoconerEntryQueries.js',
    'breakerDrawingQueries.js',
    'cardingEntryQueries.js',
    'comberEntryQueries.js',
    'finisherDrawingEntryQueries.js',
    'lapFormerQueries.js',
    'simplexEntryQueries.js',
    'spinningEntryQueries.js'
  ]
  for (const file of queryFiles) {
    const source = await readFile(path.resolve('src/lib/queries', file), 'utf8')
    assert.match(source, /preparePayrollEmployeeUpdate/, file)
  }

  const selection = await readFile(path.resolve('src/lib/payroll/employeeSelection.js'), 'utf8')
  assert.match(selection, /typed name alone cannot be saved/)
  assert.match(selection, /findActivePayrollEmployeeById/)
  assert.match(selection, /getPayrollEmployeeById/)
  assert.match(selection, /isUnchangedEmployee/)
  assert.doesNotMatch(selection, /unchangedLegacyName/)
  const autoconerParticular = await readFile(path.resolve('src/lib/queries/autoconerParticularSiderReportQueries.js'), 'utf8')
  assert.match(autoconerParticular, /getPayrollEmployeeById/)
})

test('legacy full-entry copy actions cannot bypass payroll identity validation', async () => {
  const actions = await Promise.all([
    'autoconerEntryActions.js',
    'comber-entry.js',
    'simplexEntryActions.js'
  ].map(file => readFile(path.resolve('src/app/actions', file), 'utf8')))

  for (const source of actions) {
    assert.doesNotMatch(source, /queries\.copy(?:Autoconer|Comber|Simplex)From/)
  }
})

test('entry reads resolve payroll names by stored payroll IDs', async () => {
  const actionFiles = [
    'autoconerEntryActions.js',
    'breaker-drawing-entry.js',
    'carding-entry.js',
    'comber-entry.js',
    'finisher-drawing-entry.js',
    'lapFormerEntryActions.js',
    'simplexEntryActions.js',
    'spinning-entry.js'
  ]

  for (const file of actionFiles) {
    const source = await readFile(path.resolve('src/app/actions', file), 'utf8')
    assert.match(source, /hydratePayrollEmployeeNames/, file)
  }

  const employees = await readFile(path.resolve('src/lib/payroll/employees.js'), 'utf8')
  assert.match(employees, /hydrated\[nameField\] = employee\?\.emp_name \|\| ''/)
  assert.doesNotMatch(employees, /if \(!employees\.length\) return records/)
})

test('reports no longer join or filter employees through local names', async () => {
  const files = await sourceFiles(path.resolve('src'))
  const offenders = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/employee_master/.test(source)) offenders.push(path.relative(process.cwd(), file))
  }
  assert.deepEqual(offenders, [])

  const finalReports = await readFile(path.resolve('src/lib/reports/finalReportQueries.js'), 'utf8')
  const autoconerReport = await readFile(path.resolve('src/lib/queries/autoconerParticularSiderReportQueries.js'), 'utf8')
  assert.match(finalReports, /getPayrollEmployeesByIds/)
  assert.match(finalReports, /row\.employeeId/)
  assert.match(autoconerReport, /apd\.payroll_employee_id/)
})

test('employee backfill is dry-run by default and never guesses duplicates', async () => {
  const [source, verification] = await Promise.all([
    readFile(path.resolve('scripts/backfill-payroll-employee-ids.js'), 'utf8'),
    readFile(path.resolve('scripts/verify-payroll-employee-ids.js'), 'utf8')
  ])
  const migration = await readFile(path.resolve('prisma/migrations/20260824_payroll_employee_identity/migration.sql'), 'utf8')
  assert.match(source, /process\.argv\.includes\('--apply'\)/)
  assert.match(source, /ids\.size !== 1/)
  assert.match(source, /Dry run only/)
  assert.match(verification, /invalidStoredIds/)
  assert.match(verification, /employee_master still exists/)
  assert.match(migration, /DROP TABLE IF EXISTS employee_master/)
  assert.equal((migration.match(/information_schema\.statistics/g) || []).length, 9)
})

test('holiday and employee payroll queries use the configured company boundary', async () => {
  const [holidayActions, holidayQueries, employees, entryList] = await Promise.all([
    readFile(path.resolve('src/app/actions/holiday-list.js'), 'utf8'),
    readFile(path.resolve('src/lib/queries/holidayListQueries.js'), 'utf8'),
    readFile(path.resolve('src/lib/payroll/employees.js'), 'utf8'),
    readFile(path.resolve('src/components/modules/common/DateShiftListPage.jsx'), 'utf8')
  ])

  assert.doesNotMatch(holidayActions, /getPayrollCompanyId/)
  assert.match(holidayQueries, /hl\.companyId = \$\{companyId\}/)
  assert.match(holidayQueries, /WHERE id = \$\{listId\} AND companyId = \$\{companyId\}/)
  assert.match(holidayQueries, /Holiday list not found for the configured payroll company/)
  assert.doesNotMatch(holidayQueries, /isMissingTableError|information_schema/)
  assert.match(holidayQueries, /isWeekOff/)
  assert.match(holidayQueries, /Holiday date must be within the selected holiday list period/)
  assert.match(employees, /e\.companyId = \$\{companyId\}/)
  assert.match(entryList, /holidayLoadError/)
  assert.match(entryList, /New entries are temporarily blocked/)
})

test('deployment templates require independent payroll configuration', async () => {
  const [envExample, securityCheck] = await Promise.all([
    readFile(path.resolve('.env.example'), 'utf8'),
    readFile(path.resolve('scripts/check-production-security.js'), 'utf8')
  ])

  assert.match(envExample, /^PAYROLL_DATABASE_URL=/m)
  assert.match(envExample, /^PAYROLL_COMPANY_ID=/m)
  assert.match(securityCheck, /checkDatabaseUrl\('PAYROLL_DATABASE_URL'\)/)
  assert.match(securityCheck, /DATABASE_URL and PAYROLL_DATABASE_URL must target different databases/)
})
