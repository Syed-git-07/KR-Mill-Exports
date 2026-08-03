function isPrismaDecimal(value) {
  return value &&
    typeof value === 'object' &&
    Array.isArray(value.d) &&
    typeof value.e === 'number' &&
    typeof value.s === 'number' &&
    typeof value.toString === 'function'
}

function toActionValue(value) {
  if (value === null || value === undefined) return value

  if (isPrismaDecimal(value)) {
    return Number(value.toString())
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null
  }

  if (Array.isArray(value)) {
    return value.map(item => {
      const serialized = toActionValue(item)
      return serialized === undefined ? null : serialized
    })
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const serialized = toActionValue(item)
        return serialized === undefined ? [] : [[key, serialized]]
      })
    )
  }

  return value
}

/**
 * Converts Prisma results into plain values supported by Server Actions.
 * Decimal is normalized before its own `toJSON()` can turn it into a string.
 */
export function serializeData(data) {
  return toActionValue(data)
}

