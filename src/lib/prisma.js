import { PrismaClient } from '@prisma/client'

const globalForPrisma = global

export const prisma = globalForPrisma.prisma || new PrismaClient({
  // Query parameters can contain business data, so production logs intentionally
  // include only database warnings and errors.
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
