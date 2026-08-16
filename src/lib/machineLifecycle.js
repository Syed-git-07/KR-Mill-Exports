const BUSINESS_TIME_ZONE = 'Asia/Kolkata'

const startOfBusinessDay = value => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).map(part => [part.type, part.value])
  )
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)))
}

export function machineRemovalDate(value = new Date()) {
  return startOfBusinessDay(value)
}

export function machineAvailableOnDateWhere(entryDate) {
  const date = startOfBusinessDay(entryDate)
  if (!date) throw new Error('A valid entry date is required')

  return {
    AND: [
      { OR: [{ installed_date: null }, { installed_date: { lte: date } }] },
      { OR: [{ deactivated_at: null }, { deactivated_at: { gt: date } }] }
    ]
  }
}

/**
 * Match the identifiers operators use in entry screens. Machine Master often
 * stores a short number in `machine_no` and a floor name such as FT1/RF1 in
 * `description`, so either exact value identifies the same Master row.
 */
export function machineIdentifierWhere(identifier, variants = []) {
  const values = [...new Set(
    [identifier, ...(variants || [])]
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )]
  if (values.length === 0) throw new Error('Machine number or name is required')

  return {
    OR: values.flatMap(value => [
      { machine_no: { equals: value } },
      { description: { equals: value } },
      { active_machine_no: { equals: value } }
    ])
  }
}

export function machineLookupWhere(identifier, entryDate = null, variants = []) {
  return {
    ...machineIdentifierWhere(identifier, variants),
    ...(entryDate ? machineAvailableOnDateWhere(entryDate) : {})
  }
}

export function assertMachineCannotBeRestored(existing, changes) {
  if (existing?.is_active === false && changes?.is_active === true) {
    throw new Error('A removed machine cannot be restored. Add a new machine record instead.')
  }
}

export function applyPermanentRemoval(existing, changes, now = new Date()) {
  assertMachineCannotBeRestored(existing, changes)
  if (changes?.is_active === false && existing?.is_active !== false) {
    return { ...changes, is_active: false, deactivated_at: machineRemovalDate(now) }
  }
  return changes
}
