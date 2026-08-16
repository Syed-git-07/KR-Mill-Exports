'use server'

import { requireUser } from '@/lib/security/auth'
import { safeActionError } from '@/lib/security/errors'
import { serializeData } from '@/lib/serialize'
import { changeEntryMachineCountRun } from '@/lib/queries/entryMachineSnapshot'
import { prisma } from '@/lib/prisma'

export async function changeEntryMachineCountRunAction(moduleName, headerId, setupId, values) {
  await requireUser()
  try {
    if (moduleName !== 'spinning') throw new Error('Count Change is supported only for Spinning entries')
    const data = await changeEntryMachineCountRun(moduleName, headerId, setupId, values)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getEntryCountRunOptionsAction() {
  await requireUser()
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: { id: true, count_name: true },
      orderBy: { count_name: 'asc' }
    })
    return { success: true, data }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
