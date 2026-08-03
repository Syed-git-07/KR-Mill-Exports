import { prisma } from '@/lib/prisma'

/**
 * Permanently removes an unused machine and its setup snapshots. Production
 * history is intentionally never cascaded from a master-data delete.
 */
export async function deleteUnusedMachine({
  id,
  machineModel,
  setupModel,
  productionDetailModel,
  label = 'machine'
}) {
  if (!id) throw new Error('Machine ID is required')

  return prisma.$transaction(async transaction => {
    const referencedRows = await transaction[productionDetailModel].count({
      where: { machine_id: id }
    })

    if (referencedRows > 0) {
      const error = new Error(
        `This ${label} is used by ${referencedRows} production entr${referencedRows === 1 ? 'y' : 'ies'} and cannot be permanently removed. Deactivate it instead.`
      )
      error.code = 'MACHINE_IN_USE'
      throw error
    }

    await transaction[setupModel].deleteMany({ where: { machine_id: id } })
    await transaction[machineModel].delete({ where: { id } })
    return true
  })
}
