import { PrismaClient } from '@prisma/client'
import { getPayrollDatabaseUrl } from './config'

const globalForPayroll = global

function createPayrollClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: getPayrollDatabaseUrl()
      }
    },
    // Payroll query parameters contain employee data. Never log them.
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  })
}

export function getPayrollDb() {
  if (!globalForPayroll.payrollPrisma) {
    globalForPayroll.payrollPrisma = createPayrollClient()
  }

  return globalForPayroll.payrollPrisma
}

// A lazy facade keeps build-time module loading safe while still ensuring a
// missing PAYROLL_DATABASE_URL can never fall back to DATABASE_URL.
export const payrollDb = {
  $queryRaw(...args) {
    return getPayrollDb().$queryRaw(...args)
  },
  $executeRaw(...args) {
    return getPayrollDb().$executeRaw(...args)
  },
  $transaction(...args) {
    return getPayrollDb().$transaction(...args)
  }
}
