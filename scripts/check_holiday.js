const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const lists = await prisma.$queryRaw`SELECT id,name,companyId FROM holiday_lists LIMIT 10`
    console.log('holiday_lists:', lists)

    const companies = await prisma.$queryRaw`SELECT id,name FROM companies LIMIT 10`
    console.log('companies:', companies)
  } catch (e) {
    console.error('ERROR:', e.message || e)
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
})()
