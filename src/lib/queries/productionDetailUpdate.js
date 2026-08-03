const PROTECTED_PRODUCTION_FIELDS = new Set([
  'id',
  'header_id',
  'machine_id',
  'created_at',
  'updated_at'
])

/** Prevents action payloads from moving a production row to another header or machine. */
export function sanitizeProductionDetailUpdate(updates = {}) {
  return Object.fromEntries(
    Object.entries(updates || {}).filter(([field]) => !PROTECTED_PRODUCTION_FIELDS.has(field))
  )
}
