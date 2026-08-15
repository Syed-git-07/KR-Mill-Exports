import 'server-only'

import { headers } from 'next/headers'
import { writeAuditLog } from '@/lib/security/audit'
import { getRequestContext } from '@/lib/security/request'

function getResultId(result, fallback) {
  if (!result || typeof result !== 'object') return fallback || null
  return result.id ?? result.hok_id ?? result.header?.hok_id ?? fallback ?? null
}

export async function executeAuditedMasterMutation({
  user,
  action,
  resource,
  targetId = null,
  changes = null
}, operation) {
  const context = getRequestContext(await headers())

  try {
    const result = await operation()
    await writeAuditLog({
      eventType: 'MASTER_MUTATION',
      outcome: 'SUCCESS',
      action,
      resource,
      user,
      context,
      details: {
        targetId,
        resultId: getResultId(result, targetId),
        changes
      }
    })
    return result
  } catch (error) {
    await writeAuditLog({
      eventType: 'MASTER_MUTATION',
      outcome: 'FAILURE',
      action,
      resource,
      user,
      context,
      details: {
        targetId,
        changes,
        errorCode: error?.code || null,
        errorName: error?.name || 'Error'
      }
    })
    throw error
  }
}
