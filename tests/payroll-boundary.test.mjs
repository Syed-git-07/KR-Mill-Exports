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
  assert.match(payrollEmployees, /employeeCode LIKE/)
  assert.match(payrollEmployees, /toPayrollEmployeeResponse/)
  assert.match(payrollEmployees, /formatPayrollEmployeeName/)
  assert.match(payrollEmployees, /hydratePayrollEmployeeNames/)
  assert.match(autocomplete, /emp\.payroll_employee_id/)
  assert.match(autocomplete, /ID \{employeeId\}/)
  assert.match(autocomplete, /onChange\(nextValue, null\)/)
  assert.match(autocomplete, /employeeReference/)
})

test('the employee contract distinguishes duplicate names by canonical ID and references', async () => {
  const { toPayrollEmployeeResponse } = await import(
    new URL('../src/lib/payroll/employeeContract.js', import.meta.url)
  )
  const commonName = {
    first_name: 'LAKSHMI',
    middle_name: 'M',
    last_name: 'MADASAMY',
    department: 'SPINNING',
    status: 'Active'
  }
  const first = toPayrollEmployeeResponse({
    ...commonName,
    id: 101,
    employee_code: 'E-101',
    token_no: 'T-101'
  })
  const second = toPayrollEmployeeResponse({
    ...commonName,
    id: 202,
    employee_code: 'E-202',
    token_no: 'T-202'
  })

  assert.equal(first.emp_name, second.emp_name)
  assert.notEqual(first.payroll_employee_id, second.payroll_employee_id)
  assert.notEqual(first.employee_code, second.employee_code)
  assert.notEqual(first.token_no, second.token_no)
  assert.equal(first.emp_code, first.token_no)
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
  assert.match(selection, /retainsUnchangedLegacySnapshot/)
  assert.match(selection, /currentId === null && currentName && nextName === currentName/)
  const autoconerParticular = await readFile(path.resolve('src/lib/queries/autoconerParticularSiderReportQueries.js'), 'utf8')
  assert.match(autoconerParticular, /getPayrollEmployeeById/)
})

test('legacy full-entry copy actions cannot bypass payroll identity validation', async () => {
  const actionFiles = [
    'autoconerEntryActions.js',
    'comber-entry.js',
    'simplexEntryActions.js'
  ]
  const queryFiles = [
    'autoconerEntryQueries.js',
    'comberEntryQueries.js',
    'simplexEntryQueries.js'
  ]
  const [actions, queries] = await Promise.all([
    Promise.all(actionFiles.map(file => readFile(path.resolve('src/app/actions', file), 'utf8'))),
    Promise.all(queryFiles.map(file => readFile(path.resolve('src/lib/queries', file), 'utf8')))
  ])

  for (const source of actions) {
    assert.doesNotMatch(source, /copy(?:Autoconer|Comber|Simplex)From/)
  }
  for (const source of queries) {
    assert.doesNotMatch(source, /copy(?:Autoconer|Comber|Simplex)From|employee_name:\s*source|emp_name:\s*source/)
  }
})

test('working copy-previous-speed flows remain available and copy setup speed only', async () => {
  const copyHelper = await readFile(path.resolve('src/lib/queries/copyPreviousSpeed.js'), 'utf8')
  assert.match(copyHelper, /updateSpeed\(setup\.id, sourceSpeedByMachine\.get\(setup\.machine_id\)\)/)
  assert.doesNotMatch(copyHelper, /employee_name|emp_name|sider1_name|sider2_name|payroll_employee_id/)

  const flows = [
    ['breakerDrawingQueries.js', 'breaker-drawing-entry.js', 'copyBreakerDrawingFromPreviousDate'],
    ['cardingEntryQueries.js', 'carding-entry.js', 'copyCardingFromPreviousDate'],
    ['finisherDrawingEntryQueries.js', 'finisher-drawing-entry.js', 'copyFinisherDrawingFromPreviousDate'],
    ['lapFormerQueries.js', 'lapFormerEntryActions.js', 'copyLapFormerFromPreviousDate'],
    ['spinningEntryQueries.js', 'spinning-entry.js', 'copySpinningFromPreviousDate']
  ]

  for (const [queryFile, actionFile, functionName] of flows) {
    const [querySource, actionSource] = await Promise.all([
      readFile(path.resolve('src/lib/queries', queryFile), 'utf8'),
      readFile(path.resolve('src/app/actions', actionFile), 'utf8')
    ])
    assert.match(querySource, new RegExp(`export async function ${functionName}\\(`), queryFile)
    assert.match(querySource, /copyPreviousSpeeds\(\{/, queryFile)
    assert.match(actionSource, new RegExp(`export async function ${functionName}Action\\(`), actionFile)
  }
})

test('entry reads preserve historical snapshots while resolving missing names by payroll ID', async () => {
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
  assert.match(employees, /snapshotName \|\| employee\?\.emp_name \|\| ''/)
  assert.doesNotMatch(employees, /if \(!employees\.length\) return records/)
})

test('historical identity never groups unresolved duplicate names together', async () => {
  const { resolveHistoricalEmployeeIdentity } = await import(
    new URL('../src/lib/payroll/historicalEmployeeIdentity.js', import.meta.url)
  )
  const employee = { id: 41, emp_name: 'CURRENT NAME' }
  const mapped = resolveHistoricalEmployeeIdentity({
    payrollEmployeeId: 41,
    snapshotName: 'HISTORICAL NAME',
    employee,
    assignmentKey: 'carding:1'
  })
  const firstLegacy = resolveHistoricalEmployeeIdentity({
    snapshotName: 'DUPLICATE NAME',
    assignmentKey: 'carding:2'
  })
  const secondLegacy = resolveHistoricalEmployeeIdentity({
    snapshotName: 'DUPLICATE NAME',
    assignmentKey: 'carding:3'
  })

  assert.equal(mapped.groupKey, 'payroll:41')
  assert.equal(mapped.displayName, 'HISTORICAL NAME')
  assert.equal(mapped.identityStatus, 'MAPPED')
  assert.notEqual(firstLegacy.groupKey, secondLegacy.groupKey)
  assert.equal(firstLegacy.displayName, 'Unmapped legacy: DUPLICATE NAME')
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
  const preparatorySider = await readFile(path.resolve('src/lib/queries/preparatorySiderPerformanceReportQueries.js'), 'utf8')
  assert.match(finalReports, /getPayrollEmployeesByIds/)
  assert.match(finalReports, /row\.employeeId/)
  assert.match(finalReports, /resolveHistoricalEmployeeIdentity/)
  assert.doesNotMatch(finalReports, /filter\(row => row\.employeeId != null\)/)
  assert.doesNotMatch(preparatorySider, /payroll_employee_id:\s*\{\s*not: null/)
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
  assert.match(verification, /unresolvedCurrentRows/)
  assert.match(verification, /employee_master still exists/)
  assert.match(migration, /DROP TABLE IF EXISTS employee_master/)
  assert.equal((migration.match(/information_schema\.statistics/g) || []).length, 9)
})

test('administrators can map one unresolved legacy assignment without replacing its snapshot', async () => {
  const [mapping, action, page, row] = await Promise.all([
    readFile(path.resolve('src/lib/payroll/legacyEmployeeMapping.js'), 'utf8'),
    readFile(path.resolve('src/app/actions/payroll-mapping.js'), 'utf8'),
    readFile(path.resolve('src/app/admin/payroll-mapping/page.jsx'), 'utf8'),
    readFile(path.resolve('src/components/admin/LegacyEmployeeMappingRow.jsx'), 'utf8')
  ])

  assert.equal((mapping.match(/key: '(?:autoconer|breaker|carding|comber|finisher|lap_former|simplex|spinning_sider1|spinning_sider2)'/g) || []).length, 9)
  assert.match(mapping, /identity_status: 'UNRESOLVED_LEGACY'/)
  assert.match(mapping, /findActivePayrollEmployeeById/)
  assert.match(mapping, /data: \{ \[config\.idField\]: employee\.payroll_employee_id \}/)
  assert.doesNotMatch(mapping, /data: \{[^}]*\[config\.nameField\]/)
  assert.match(action, /await requireRole\('ADMIN'\)/)
  assert.match(action, /PAYROLL_IDENTITY_MAPPING/)
  assert.match(page, /await requireRole\('ADMIN'\)/)
  assert.match(row, /Map this row/)
  assert.match(row, /EmployeeAutocomplete/)
})

test('supervisor and maisitry roles use payroll identity while remaining local assignments', async () => {
  const [schema, migration, queries, productionSupervisors, form, validation, backfill, verification] = await Promise.all([
    readFile(path.resolve('prisma/schema.prisma'), 'utf8'),
    readFile(path.resolve('prisma/migrations/20260824_supervisor_payroll_identity/migration.sql'), 'utf8'),
    readFile(path.resolve('src/lib/queries/supervisorQueries.js'), 'utf8'),
    readFile(path.resolve('src/lib/queries/productionSupervisorQueries.js'), 'utf8'),
    readFile(path.resolve('src/components/modules/masters/SupervisorForm.jsx'), 'utf8'),
    readFile(path.resolve('src/lib/validation/masterSchemas.js'), 'utf8'),
    readFile(path.resolve('scripts/backfill-payroll-employee-ids.js'), 'utf8'),
    readFile(path.resolve('scripts/verify-payroll-employee-ids.js'), 'utf8')
  ])

  assert.match(schema, /model supervisors \{[\s\S]*payroll_employee_id\s+Int\?[\s\S]*idx_supervisors_payroll_employee/)
  assert.match(migration, /ADD COLUMN payroll_employee_id INT NULL/)
  assert.match(migration, /idx_supervisors_payroll_employee/)
  assert.doesNotMatch(migration, /ADD CONSTRAINT|REFERENCES\s+employees/i)
  assert.match(queries, /findActivePayrollEmployeeById/)
  assert.match(queries, /supervisor_name: employee\.emp_name/)
  assert.match(productionSupervisors, /payroll_employee_id: \{ not: null \}/)
  assert.match(productionSupervisors, /employee\.status === 'Active'/)
  assert.match(productionSupervisors, /validateProductionSupervisorUpdate/)
  assert.match(form, /EmployeeAutocomplete/)
  assert.match(form, /employee\?\.payroll_employee_id \?\? null/)
  assert.match(validation, /supervisorCreateSchema[\s\S]*payroll_employee_id/)
  assert.doesNotMatch(validation, /supervisorCreateSchema = z\.object\(\{\s*supervisor_name/)
  assert.match(backfill, /table: 'supervisors'.*activeOnly: true/)
  assert.match(verification, /idx_supervisors_payroll_employee.*activeOnly: true/)

  const entryQueries = [
    'autoconerEntryQueries.js',
    'breakerDrawingQueries.js',
    'cardingEntryQueries.js',
    'comberEntryQueries.js',
    'finisherDrawingEntryQueries.js',
    'lapFormerQueries.js',
    'simplexEntryQueries.js',
    'spinningEntryQueries.js'
  ]
  for (const file of entryQueries) {
    const source = await readFile(path.resolve('src/lib/queries', file), 'utf8')
    assert.match(source, /getActiveProductionSupervisors/, file)
    assert.match(source, /validateProductionSupervisor/, file)
  }
})

test('holiday and employee payroll queries use the configured company boundary', async () => {
  const [holidayActions, holidayQueries, employees, entryList, holidayPage, holidayAudit] = await Promise.all([
    readFile(path.resolve('src/app/actions/holiday-list.js'), 'utf8'),
    readFile(path.resolve('src/lib/queries/holidayListQueries.js'), 'utf8'),
    readFile(path.resolve('src/lib/payroll/employees.js'), 'utf8'),
    readFile(path.resolve('src/components/modules/common/DateShiftListPage.jsx'), 'utf8'),
    readFile(path.resolve('src/app/holiday-list/page.jsx'), 'utf8'),
    readFile(path.resolve('src/lib/security/holidayAudit.js'), 'utf8')
  ])

  assert.doesNotMatch(holidayActions, /getPayrollCompanyId/)
  assert.match(holidayQueries, /hl\.companyId = \$\{companyId\}/)
  assert.match(holidayQueries, /WHERE id = \$\{listId\} AND companyId = \$\{companyId\}/)
  assert.match(holidayQueries, /Holiday list not found for the configured payroll company/)
  assert.doesNotMatch(holidayQueries, /isMissingTableError|information_schema/)
  assert.match(holidayQueries, /isWeekOff/)
  assert.match(holidayQueries, /Holiday date must be within the selected holiday list period/)
  assert.match(holidayQueries, /assertKrProductionHolidayWriter/)
  assert.equal((holidayActions.match(/await requireRole\('ADMIN'\)/g) || []).length, 7)
  assert.equal((holidayActions.match(/executeAuditedHolidayMutation/g) || []).length, 8)
  assert.match(holidayAudit, /PAYROLL_HOLIDAY_MUTATION/)
  assert.match(holidayPage, /canKrProductionWritePayrollHolidays/)
  assert.match(employees, /e\.companyId = \$\{companyId\}/)
  assert.match(entryList, /holidayLoadError/)
  assert.match(entryList, /New entries are temporarily blocked/)
})

test('deployment templates require independent payroll configuration', async () => {
  const [envExample, securityCheck, readme] = await Promise.all([
    readFile(path.resolve('.env.example'), 'utf8'),
    readFile(path.resolve('scripts/check-production-security.js'), 'utf8'),
    readFile(path.resolve('README.md'), 'utf8')
  ])

  assert.match(envExample, /^PAYROLL_DATABASE_URL=/m)
  assert.match(envExample, /^PAYROLL_COMPANY_ID=/m)
  assert.match(envExample, /^PAYROLL_HOLIDAY_WRITER=/m)
  assert.match(securityCheck, /checkDatabaseUrl\('PAYROLL_DATABASE_URL'\)/)
  assert.match(securityCheck, /PAYROLL_HOLIDAY_WRITER must explicitly be PAYROLL or KR_PRODUCTION/)
  assert.match(securityCheck, /DATABASE_URL and PAYROLL_DATABASE_URL must target different databases/)
  assert.match(readme, /Leave\s+allocation and employee leave balances are owned by payroll/)
})
