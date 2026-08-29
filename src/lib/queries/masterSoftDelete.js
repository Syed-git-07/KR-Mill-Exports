import { machineRemovalDate } from '../machineLifecycle.js'

/**
 * Soft-delete a referenced Master row while preserving every historical
 * foreign-key relationship. Repeating the operation is intentionally
 * idempotent so bulk requests cannot change the original removal date.
 */
export async function softDeleteMasterRecord(model, id, {
  recordLabel = 'Master record',
  trackRemovalDate = false
} = {}) {
  const existing = await model.findUnique({
    where: { id },
    select: { id: true, is_active: true }
  })

  if (!existing) throw new Error(`${recordLabel} not found`)
  if (existing.is_active === false) return existing

  return model.update({
    where: { id },
    data: {
      is_active: false,
      ...(trackRemovalDate ? { deactivated_at: machineRemovalDate() } : {})
    }
  })
}
