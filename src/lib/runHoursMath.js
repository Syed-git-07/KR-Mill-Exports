const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value?.toString?.() ?? value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Convert the entry screens' HH.MM notation to minutes.
 *
 * HH.MM is not a decimal-hour value: 7.45 means 7 hours 45 minutes. Invalid
 * minute fragments are bounded to 59 so malformed/partial numeric input can
 * never create negative, NaN, or more than one extra hour.
 */
export function parseRunHoursToMinutes(value) {
  const runHours = Math.max(toFiniteNumber(value), 0)
  if (runHours === 0) return 0

  const hours = Math.floor(runHours)
  const rawMinutes = Math.round((runHours - hours) * 100)
  const minutes = Math.min(Math.max(rawMinutes, 0), 59)
  const totalMinutes = (hours * 60) + minutes

  return Number.isSafeInteger(totalMinutes) ? totalMinutes : 0
}

export function minutesToRunHours(value) {
  const totalMinutes = Math.floor(Math.max(toFiniteNumber(value), 0))
  if (totalMinutes === 0) return 0

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return Number(`${hours}.${String(minutes).padStart(2, '0')}`)
}
