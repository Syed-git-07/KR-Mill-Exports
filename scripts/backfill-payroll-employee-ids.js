const path = require('node:path')
const dotenv = require('dotenv')
const { Prisma, PrismaClient } = require('@prisma/client')

dotenv.config({ path: path.resolve('.env.local'), quiet: true })
dotenv.config({ path: path.resolve('.env'), quiet: true })

const APPLY = process.argv.includes('--apply')
const SOURCES = [
  { table: 'autoconer_production_detail', name: 'emp_name', id: 'payroll_employee_id' },
  { table: 'breaker_drawing_production_detail', name: 'employee_name', id: 'payroll_employee_id' },
  { table: 'carding_production_detail', name: 'employee_name', id: 'payroll_employee_id' },
  { table: 'comber_production_detail', name: 'employee_name', id: 'payroll_employee_id' },
  { table: 'finisher_drawing_production_detail', name: 'employee_name', id: 'payroll_employee_id' },
  { table: 'lap_former_production_detail', name: 'employee_name', id: 'payroll_employee_id' },
  { table: 'simplex_production_detail', name: 'employee_name', id: 'payroll_employee_id' },
  { table: 'spinning_production_detail', name: 'sider1_name', id: 'sider1_payroll_employee_id' },
  { table: 'spinning_production_detail', name: 'sider2_name', id: 'sider2_payroll_employee_id' },
  { table: 'supervisors', name: 'supervisor_name', id: 'payroll_employee_id', activeOnly: true }
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

function normalizedName(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleUpperCase('en-IN')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function actualPart(value) {
  const part = String(value || '').trim()
  return part && part !== '-' ? part : ''
}

function employeeNameVariants(employee) {
  const first = actualPart(employee.firstName)
  const middle = actualPart(employee.middleName)
  const last = actualPart(employee.lastName)
  return new Set([
    first,
    [first, middle].filter(Boolean).join(' '),
    [first, last].filter(Boolean).join(' '),
    [first, middle, last].filter(Boolean).join(' ')
  ].map(normalizedName).filter(Boolean))
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
    const employees = await payroll.$queryRaw`
      SELECT id, firstName, middleName, lastName, status
      FROM employees
      WHERE companyId = ${companyId}
    `
    const idsByName = new Map()
    const activeIdsByName = new Map()
    for (const employee of employees) {
      for (const variant of employeeNameVariants(employee)) {
        const ids = idsByName.get(variant) || new Set()
        ids.add(Number(employee.id))
        idsByName.set(variant, ids)
        if (employee.status === 'Active') {
          const activeIds = activeIdsByName.get(variant) || new Set()
          activeIds.add(Number(employee.id))
          activeIdsByName.set(variant, activeIds)
        }
      }
    }

    const summaries = []
    for (const source of SOURCES) {
      const table = identifier(source.table)
      const nameColumn = identifier(source.name)
      const idColumn = identifier(source.id)
      const rows = await production.$queryRaw(Prisma.sql`
        SELECT id, ${nameColumn} AS employee_name
        FROM ${table}
        WHERE ${idColumn} IS NULL
          AND ${nameColumn} IS NOT NULL
          AND TRIM(${nameColumn}) <> ''
      `)
      const updates = []
      let ambiguous = 0
      let unmatched = 0

      for (const row of rows) {
        const ids = (source.activeOnly ? activeIdsByName : idsByName).get(normalizedName(row.employee_name))
        if (!ids) {
          unmatched++
        } else if (ids.size !== 1) {
          ambiguous++
        } else {
          updates.push({ rowId: row.id, payrollEmployeeId: [...ids][0] })
        }
      }

      if (APPLY && updates.length) {
        await production.$transaction(async tx => {
          for (const update of updates) {
            await tx.$executeRaw(Prisma.sql`
              UPDATE ${table}
              SET ${idColumn} = ${update.payrollEmployeeId}
              WHERE id = ${update.rowId} AND ${idColumn} IS NULL
            `)
          }
        })
      }

      summaries.push({
        field: `${source.table}.${source.name}`,
        candidates: rows.length,
        uniquelyResolved: updates.length,
        ambiguous,
        unmatched,
        applied: APPLY ? updates.length : 0
      })
    }

    console.table(summaries)
    console.log(APPLY
      ? 'Backfill applied. Ambiguous and unmatched rows were intentionally left unresolved.'
      : 'Dry run only. Re-run with --apply after reviewing these counts.')
  } finally {
    await Promise.all([production.$disconnect(), payroll.$disconnect()])
  }
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
