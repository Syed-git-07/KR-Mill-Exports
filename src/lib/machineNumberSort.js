const machineNumberCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
})

function numericPart(value) {
  const match = String(value || '').match(/\d+/)
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY
}

export function compareMachineNumbers(a, b) {
  const aValue = String(a || '').trim()
  const bValue = String(b || '').trim()
  const aNumber = numericPart(aValue)
  const bNumber = numericPart(bValue)

  if (aNumber !== bNumber) {
    return aNumber < bNumber ? -1 : 1
  }

  return machineNumberCollator.compare(aValue, bValue)
}
