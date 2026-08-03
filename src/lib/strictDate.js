/**
 * Parse a database date without allowing JavaScript's rollover behaviour
 * (for example, `2026-02-30` becoming March 2).
 */
function invalidDate(message) {
  const error = new Error(message)
  error.code = 'INVALID_DATE'
  return error
}

export function parseStrictDate(value, label = 'Date') {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw invalidDate(`${label} is required and must be a real calendar date`)
    }
    return new Date(value.getTime())
  }

  const raw = String(value ?? '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw)
  if (!match) {
    throw invalidDate(`${label} is required and must use YYYY-MM-DD`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw invalidDate(`${label} must be a real calendar date`)
  }

  return parsed
}
