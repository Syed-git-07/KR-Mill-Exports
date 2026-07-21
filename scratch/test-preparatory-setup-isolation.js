const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const cases = [
  ['breaker_drawing_machine_setup', 'speed'],
  ['comber_machine_setup', 'session_no'],
  ['finisher_drawing_machine_setup', 'speed'],
  ['lap_former_machine_setup', 'speed'],
  ['simplex_machine_setup', 'speed']
]
const ignored = new Set(['id', 'created_at', 'updated_at', 'entry_date', 'shift'])

async function run() {
  try {
    await prisma.$transaction(async tx => {
      for (const [modelName, field] of cases) {
        const model = tx[modelName]
        const baseline = await model.findFirst({
          where: { entry_date: new Date('1970-01-01T00:00:00.000Z'), shift: 1 }
        })
        if (!baseline) throw new Error(`${modelName}: baseline setup missing`)

        const base = Object.fromEntries(Object.entries(baseline).filter(([key]) => !ignored.has(key)))
        const first = await model.create({
          data: { ...base, entry_date: new Date('2099-01-01T00:00:00.000Z'), shift: 1 }
        })
        const second = await model.create({
          data: { ...base, entry_date: new Date('2099-01-02T00:00:00.000Z'), shift: 1 }
        })
        const originalSecond = String(second[field])
        const changed = Number(first[field] || 1) + 7
        await model.update({ where: { id: first.id }, data: { [field]: changed } })
        const unchangedSecond = await model.findUnique({ where: { id: second.id } })
        if (String(unchangedSecond[field]) !== originalSecond) {
          throw new Error(`${modelName}: edit leaked into another date`)
        }
        console.log(`${modelName}: isolated`)
      }
      throw new Error('__ROLLBACK_SUCCESSFUL_TEST__')
    })
  } catch (error) {
    if (error.message !== '__ROLLBACK_SUCCESSFUL_TEST__') throw error
  }
}

run()
  .then(() => console.log('All five preparatory setup modules passed isolation checks.'))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
