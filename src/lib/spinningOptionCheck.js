export const SPINNING_OPTION_CHECK_ERROR_CODE = 'SPINNING_OPTION_CHECK_ERROR'

export function createSpinningOptionCheckError(message) {
  const error = new Error(message)
  error.code = SPINNING_OPTION_CHECK_ERROR_CODE
  return error
}

export function normalizeSpinningEntryDate(value, label = 'Entry date') {
  const dateKey = String(value || '').split('T')[0]

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw createSpinningOptionCheckError(`${label} is not valid`)
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw createSpinningOptionCheckError(`${label} is not valid`)
  }

  return { date, dateKey }
}

export function normalizeSpinningEntryContext(dateValue, shiftValue, label = 'Entry') {
  const { date, dateKey } = normalizeSpinningEntryDate(dateValue, `${label} date`)
  const shift = Number(shiftValue)

  if (!Number.isInteger(shift) || ![1, 2, 3].includes(shift)) {
    throw createSpinningOptionCheckError(`${label} shift is not valid`)
  }

  return { date, dateKey, shift }
}

export function isEarlierSpinningEntry(source, target) {
  return source.dateKey < target.dateKey || (
    source.dateKey === target.dateKey && source.shift < target.shift
  )
}

export function validateSpinningOptionCheckSource({
  targetDate,
  targetShift,
  sourceDate,
  sourceShift
}) {
  const target = normalizeSpinningEntryContext(targetDate, targetShift, 'Current entry')
  const source = normalizeSpinningEntryContext(sourceDate, sourceShift, 'Source entry')

  if (!isEarlierSpinningEntry(source, target)) {
    throw createSpinningOptionCheckError(
      'Source must be an earlier date and shift than the current entry'
    )
  }

  return { source, target }
}
