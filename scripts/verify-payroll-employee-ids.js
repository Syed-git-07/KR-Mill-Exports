const path = require('node:path')
const dotenv = require('dotenv')
const { Prisma, PrismaClient } = require('@prisma/client')

dotenv.config({ path: path.resolve('.env.local'), quiet: true })
dotenv.config({ path: path.resolve('.env'), quiet: true })

const SOURCES = [
  { table: 'autoconer_production_detail', name: 'emp_name', column: 'payroll_employee_id', index: 'idx_autoconer_detail_payroll_employee' },
  { table: 'breaker_drawing_production_detail', name: 'employee_name', column: 'payroll_employee_id', index: 'idx_breaker_detail_payroll_employee' },
  { table: 'carding_production_detail', name: 'employee_name', column: 'payroll_employee_id', index: 'idx_carding_detail_payroll_employee' },
  { table: 'comber_production_detail', name: 'employee_name', column: 'payroll_employee_id', index: 'idx_comber_detail_payroll_employee' },
  { table: 'finisher_drawing_production_detail', name: 'employee_name', column: 'payroll_employee_id', index: 'idx_finisher_detail_payroll_employee' },
  { table: 'lap_former_production_detail', name: 'employee_name', column: 'payroll_employee_id', index: 'idx_lap_detail_payroll_employee' },
  { table: 'simplex_production_detail', name: 'employee_name', column: 'payroll_employee_id', index: 'idx_simplex_detail_payroll_employee' },
  { table: 'spinning_production_detail', name: 'sider1_name', column: 'sider1_payroll_employee_id', index: 'idx_spinning_detail_sider1_payroll_employee' },
  { table: 'spinning_production_detail', name: 'sider2_name', column: 'sider2_payroll_employee_id', index: 'idx_spinning_detail_sider2_payroll_employee' }
]

function required(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function identifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Invalid SQL identifier: ${value}`)
  return Prisma.raw(`\`${value}\``)
}

async function main() {
  const productionUrl = required('DATABASE_URL')
  const payrollUrl = required('PAYROLL_DATABASE_URL')
  const companyId = Number(required('PAYROLL_COMPANY_ID'))
  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new Error('PAYROLL_COMPANY_ID must be a positive integer.')
  }

  const production = new PrismaClient({ datasources: { db: { url: productionUrl } } })
  const payroll = new PrismaClient({ datasources: { db: { url: payrollUrl } } })

  try {
    const [productionDatabaseRows, payrollDatabaseRows, localMasterRows] = await Promise.all([
      production.$queryRaw`SELECT DATABASE() AS database_name`,
      payroll.$queryRaw`SELECT DATABASE() AS database_name`,
      production.$queryRaw`
        SELECT COUNT(*) AS table_count
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'employee_master'
      `
    ])

    const storedIds = new Set()
    const fieldStats = []
    const missingColumns = []
    const missingIndexes = []

    for (const source of SOURCES) {
      const table = identifier(source.table)
      const nameColumn = identifier(source.name)
      const idColumn = identifier(source.column)
      const [columnRows, indexRows, countRows, idRows] = await Promise.all([
        production.$queryRaw`
          SELECT COUNT(*) AS column_count
          FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = ${source.table}
            AND column_name = ${source.column}
        `,
        production.$queryRaw`
          SELECT COUNT(*) AS index_count
          FROM information_schema.statistics
          WHERE table_schema = DATABASE()
            AND table_name = ${source.table}
            AND index_name = ${source.index}
            AND column_name = ${source.column}
        `,
        production.$queryRaw(Prisma.sql`
          SELECT
            COUNT(*) AS total_rows,
            SUM(${idColumn} IS NOT NULL) AS linked_rows,
            SUM(${idColumn} IS NULL AND ${nameColumn} IS NOT NULL AND TRIM(${nameColumn}) <> '') AS unresolved_named_rows
          FROM ${table}
        `),
        production.$queryRaw(Prisma.sql`
          SELECT DISTINCT ${idColumn} AS payroll_employee_id
          FROM ${table}
          WHERE ${idColumn} IS NOT NULL
        `)
      ])

      if (Number(columnRows[0].column_count) !== 1) {
        missingColumns.push(`${source.table}.${source.column}`)
      }
      if (Number(indexRows[0].index_count) !== 1) {
        missingIndexes.push(source.index)
      }
      for (const row of idRows) storedIds.add(Number(row.payroll_employee_id))

      fieldStats.push({
        field: `${source.table}.${source.column}`,
        totalRows: Number(countRows[0].total_rows),
        linkedRows: Number(countRows[0].linked_rows || 0),
        unresolvedNamedRows: Number(countRows[0].unresolved_named_rows || 0)
      })
    }

    const companyEmployees = await payroll.$queryRaw`
      SELECT id FROM employees WHERE companyId = ${companyId}
    `
    const validIds = new Set(companyEmployees.map(employee => Number(employee.id)))
    const invalidStoredIds = [...storedIds].filter(id => !validIds.has(id)).sort((a, b) => a - b)
    const employeeMasterPresent = Number(localMasterRows[0].table_count) !== 0

    console.log(`Production database: ${productionDatabaseRows[0].database_name}`)
    console.log(`Payroll database: ${payrollDatabaseRows[0].database_name}`)
    console.table(fieldStats)
    console.log(`Distinct stored payroll employee IDs: ${storedIds.size}`)

    const problems = []
    if (employeeMasterPresent) problems.push('employee_master still exists in the production database.')
    if (missingColumns.length) problems.push(`Missing identity columns: ${missingColumns.join(', ')}`)
    if (missingIndexes.length) problems.push(`Missing identity indexes: ${missingIndexes.join(', ')}`)
    if (invalidStoredIds.length) {
      problems.push(`Stored IDs outside payroll company ${companyId}: ${invalidStoredIds.join(', ')}`)
    }

    if (problems.length) {
      throw new Error(`Payroll identity verification failed:\n- ${problems.join('\n- ')}`)
    }

    console.log('Payroll identity verification passed.')
  } finally {
    await production.$disconnect()
    await payroll.$disconnect()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
