// Preview by default; --apply creates the three groups and moves supervisors.
// Existing departments and their HOK/stoppage references remain untouched.
const path = require('node:path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true, quiet: true })
const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const { PRODUCTION_DEPARTMENTS } = await import('../src/lib/productionDepartments.js')
  const aliases = {
    preparatory: ['PREPARATORY', 'PREP', 'PREPARATORY ENTRY DEPARTMENT', 'CARDING', 'BREAKER DRAWING', 'DRAWING', 'COMBER', 'FINISHER DRAWING', 'LAP FORMER', 'SIMPLEX', 'SIMPLEX SIDER'],
    autoconer: ['AUTOCONER'],
    spinning: ['SPINNING', 'SPG SIDER', 'SPINNING DOFFER']
  }
  await prisma.$transaction(async tx => {
    const departments = await tx.departments.findMany()
    const assignments = await tx.supervisors.findMany({ select: { id: true, department_id: true } })
    const plans = Object.entries(PRODUCTION_DEPARTMENTS).map(([scope, name]) => {
      const matches = departments.filter(dept => dept.dept_name.trim().toUpperCase() === name.toUpperCase())
      if (matches.length > 1) throw new Error(`Duplicate department: ${name}`)
      const sourceIds = departments.filter(dept => aliases[scope].includes(dept.dept_name.trim().toUpperCase())).map(dept => dept.id)
      return { name, existing: matches[0], sourceIds }
    })
    const knownIds = new Set(plans.flatMap(plan => [...plan.sourceIds, plan.existing?.id].filter(Boolean)))
    const unresolved = assignments.filter(item => item.department_id && !knownIds.has(item.department_id))
    if (unresolved.length) throw new Error(`${unresolved.length} supervisor departments need an explicit mapping before migration.`)
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'preview',
      departments: plans.map(plan => ({ name: plan.name, create: !plan.existing,
        supervisorsToMove: assignments.filter(item => plan.sourceIds.includes(item.department_id)).length }))
    }, null, 2))
    if (!apply) return
    let sequence = Math.max(0, ...departments.flatMap(dept => [dept.code, dept.sl_no]))
    for (const plan of plans) {
      const department = plan.existing
        ? await tx.departments.update({ where: { id: plan.existing.id }, data: { dept_name: plan.name, is_active: true } })
        : await tx.departments.create({ data: { dept_name: plan.name, code: ++sequence, sl_no: sequence, hok: 0, is_active: true } })
      await tx.supervisors.updateMany({ where: { department_id: { in: plan.sourceIds } }, data: { department_id: department.id } })
    }
  }, { isolationLevel: 'Serializable' })
}
main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
