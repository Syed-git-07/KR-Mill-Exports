import { prisma } from '../prisma'

export async function getSpinningMasterEfficiency(db = prisma) {
  const defaults = await db.spinning_machine_defaults.findUnique({ where: { id: 1 } })
  return Number(defaults?.efficiency ?? 0.95)
}

export async function setSpinningMasterEfficiency(percent, db = prisma) {
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Efficiency must be between 0 and 100')
  }
  const efficiency = percent / 100
  return db.spinning_machine_defaults.upsert({
    where: { id: 1 },
    create: { id: 1, efficiency },
    update: { efficiency }
  })
}
