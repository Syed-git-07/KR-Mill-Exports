const PROTECTED_PRODUCTION_FIELDS = new Set([
  'id',
  'header_id',
  'machine_id',
  'created_at',
  'updated_at',
  'is_verified',
  'verified_at',
  'is_locked',
  'machine',
  'stoppage',
  'speed'
])

/**
 * Production rows may be edited, but a client payload must never be able to
 * move an existing row to another header or machine or overwrite audit fields.
 */
export function sanitizeProductionDetailUpdate(updates = {}) {
  return Object.fromEntries(
    Object.entries(updates || {}).filter(
      ([field]) => !PROTECTED_PRODUCTION_FIELDS.has(field)
    )
  )
}
