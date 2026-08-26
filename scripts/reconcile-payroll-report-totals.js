const path = require('node:path')
const dotenv = require('dotenv')
const { Prisma, PrismaClient } = require('@prisma/client')

dotenv.config({ path: path.resolve('.env.local'), quiet: true })
dotenv.config({ path: path.resolve('.env'), quiet: true })

const SOURCES = [
  { module: 'Autoconer', table: 'autoconer_production_detail', waste: 'waste_kg', slots: [{ name: 'emp_name', id: 'payroll_employee_id' }] },
  { module: 'Breaker Drawing', table: 'breaker_drawing_production_detail', slots: [{ name: 'employee_name', id: 'payroll_employee_id' }] },
  { module: 'Carding', table: 'carding_production_detail', slots: [{ name: 'employee_name', id: 'payroll_employee_id' }] },
  { module: 'Comber', table: 'comber_production_detail', slots: [{ name: 'employee_name', id: 'payroll_employee_id' }] },
  { module: 'Finisher Drawing', table: 'finisher_drawing_production_detail', slots: [{ name: 'employee_name', id: 'payroll_employee_id' }] },
  { module: 'Lap Former', table: 'lap_former_production_detail', slots: [{ name: 'employee_name', id: 'payroll_employee_id' }] },
  { module: 'Simplex', table: 'simplex_production_detail', slots: [{ name: 'employee_name', id: 'payroll_employee_id' }] },
  {
    module: 'Spinning',
    table: 'spinning_production_detail',
    slots: [
      { name: 'sider1_name', id: 'sider1_payroll_employee_id' },
      { name: 'sider2_name', id: 'sider2_payroll_employee_id' }
    ]
  }
]

function identifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Invalid SQL identifier: ${value}`)
  return Prisma.raw(`\`${value}\``)
}

function number(value) {
  return Number(value || 0)
}

async function sourceTotals(prisma, source) {
  const table = identifier(source.table)
  const waste = identifier(source.waste || 'waste')
  const slotStates = source.slots.map(slot => Prisma.sql`(
    ${identifier(slot.id)} IS NOT NULL OR
    (${identifier(slot.name)} IS NOT NULL AND TRIM(${identifier(slot.name)}) <> '')
  )`)
  const hasAssignment = Prisma.join(slotStates, ' OR ')
  const linked = Prisma.join(source.slots.map(slot => Prisma.sql`${identifier(slot.id)} IS NOT NULL`), ' OR ')
  const unresolved = Prisma.join(source.slots.map(slot => Prisma.sql`(
    ${identifier(slot.id)} IS NULL AND ${identifier(slot.name)} IS NOT NULL AND TRIM(${identifier(slot.name)}) <> ''
  )`), ' OR ')

  const [row] = await prisma.$queryRaw(Prisma.sql`
    SELECT
      COUNT(*) AS row_count,
      SUM(${linked}) AS linked_rows,
      SUM(${unresolved}) AS unresolved_rows,
      SUM(NOT (${hasAssignment})) AS unassigned_rows,
      COALESCE(SUM(act_prodn), 0) AS production_total,
      COALESCE(SUM(${waste}), 0) AS waste_total,
      COALESCE(SUM(CASE WHEN ${hasAssignment} THEN act_prodn ELSE 0 END), 0) AS assigned_production,
      COALESCE(SUM(CASE WHEN ${hasAssignment} THEN ${waste} ELSE 0 END), 0) AS assigned_waste,
      COALESCE(SUM(CASE WHEN NOT (${hasAssignment}) THEN act_prodn ELSE 0 END), 0) AS unassigned_production,
      COALESCE(SUM(CASE WHEN NOT (${hasAssignment}) THEN ${waste} ELSE 0 END), 0) AS unassigned_waste
    FROM ${table}
  `)

  const productionTotal = number(row.production_total)
  const wasteTotal = number(row.waste_total)
  const productionReconciled = number(row.assigned_production) + number(row.unassigned_production)
  const wasteReconciled = number(row.assigned_waste) + number(row.unassigned_waste)

  return {
    module: source.module,
    rows: number(row.row_count),
    linkedRows: number(row.linked_rows),
    unresolvedRows: number(row.unresolved_rows),
    unassignedRows: number(row.unassigned_rows),
    productionTotal: productionTotal.toFixed(4),
    productionDelta: (productionTotal - productionReconciled).toFixed(8),
    wasteTotal: wasteTotal.toFixed(4),
    wasteDelta: (wasteTotal - wasteReconciled).toFixed(8)
  }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const results = []
    for (const source of SOURCES) results.push(await sourceTotals(prisma, source))
    console.table(results)
    const failures = results.filter(result => Math.abs(Number(result.productionDelta)) > 0.000001 || Math.abs(Number(result.wasteDelta)) > 0.000001)
    if (failures.length) throw new Error(`Report identity reconciliation failed for: ${failures.map(result => result.module).join(', ')}`)
    console.log('Report identity reconciliation passed. Mapped, unresolved, and unassigned buckets preserve production and waste totals.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
