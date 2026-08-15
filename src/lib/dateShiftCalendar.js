export function normalizeCalendarShift(value) {
  const shift = Number(value)
  return Number.isInteger(shift) && [1, 2, 3].includes(shift) ? shift : null
}

export function getOccupiedDateKeys(entries, shiftValue) {
  const shift = normalizeCalendarShift(shiftValue)

  return [...new Set(
    (entries || [])
      .filter(entry => entry?.hasData)
      .filter(entry => shift === null || Number(entry.shift) === shift)
      .map(entry => String(entry.entry_date || '').split('T')[0])
      .filter(Boolean)
  )]
}
