'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/security/auth'
import { writeAuditLog } from '@/lib/security/audit'
import { getRequestContext } from '@/lib/security/request'
import { safeActionError } from '@/lib/security/errors'
import { mapLegacyEmployeeAssignment } from '@/lib/payroll/legacyEmployeeMapping'

export async function mapLegacyEmployeeAssignmentAction(input) {
  const user = await requireRole('ADMIN')
  const context = getRequestContext(await headers())
  try {
    const result = await mapLegacyEmployeeAssignment(input)
    await writeAuditLog({
      eventType: 'PAYROLL_IDENTITY_MAPPING',
      outcome: 'SUCCESS',
      action: 'mapLegacyEmployeeAssignmentAction',
      resource: `${result.source}:${result.detail_id}`,
      user,
      context,
      details: result
    })
    revalidatePath('/admin/payroll-mapping')
    return { success: true, data: result }
  } catch (error) {
    await writeAuditLog({
      eventType: 'PAYROLL_IDENTITY_MAPPING',
      outcome: 'FAILURE',
      action: 'mapLegacyEmployeeAssignmentAction',
      resource: `${input?.source || 'unknown'}:${input?.detailId || 'unknown'}`,
      user,
      context,
      details: { errorName: error?.name || 'Error' }
    })
    return { success: false, error: safeActionError(error) }
  }
}
