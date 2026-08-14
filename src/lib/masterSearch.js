const SUPPORTED_CONDITIONS = new Set([
  'Like',
  'Equal',
  '=',
  'Not Equal',
  'Greater',
  'Less'
])

function parseFiniteNumber(value) {
  const normalized = String(value).trim()
  if (!normalized) throw new Error('A numeric search value is required')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric search value: ${value}`)
  return parsed
}

function parseDateOnly(value) {
  const normalized = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Date searches must use YYYY-MM-DD')
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`Invalid date search value: ${value}`)
  }
  return parsed
}

function conditionFilter(condition, value) {
  switch (condition) {
    case 'Like':
    case 'Equal':
    case '=':
      return value
    case 'Not Equal':
      return { not: value }
    case 'Greater':
      return { gt: value }
    case 'Less':
      return { lt: value }
    default:
      throw new Error(`Unsupported search condition: ${condition}`)
  }
}

export function buildTypedSearchWhere(field, condition, value, fieldTypes) {
  if (!Object.hasOwn(fieldTypes, field)) {
    throw new Error(`Unsupported search field: ${field}`)
  }
  if (!SUPPORTED_CONDITIONS.has(condition)) {
    throw new Error(`Unsupported search condition: ${condition}`)
  }

  const type = fieldTypes[field]
  if (type === 'number') {
    return { [field]: conditionFilter(condition, parseFiniteNumber(value)) }
  }
  if (type === 'date') {
    return { [field]: conditionFilter(condition, parseDateOnly(value)) }
  }
  if (type === 'text') {
    const normalized = String(value).trim()
    if (!normalized) throw new Error('A search value is required')
    if (condition === 'Like') return { [field]: { contains: normalized } }
    return { [field]: conditionFilter(condition, normalized) }
  }

  throw new Error(`Unsupported search type for field: ${field}`)
}
