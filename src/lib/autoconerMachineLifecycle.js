import { parseStrictDate } from './strictDate.js'

const toValidDate = (value, label = 'Autoconer entry date') => parseStrictDate(value, label)

export function getAutoconerEntryDateWindow(entryDate) {
  const date = toValidDate(entryDate)
  const start = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

// A machine activated at any time during an entry date belongs to that date's
// snapshot. A deactivation is effective from its calendar date onward.
export function isAutoconerMachineVisibleOnDate(machine, entryDate) {
  if (!machine) return false
  const { start, end } = getAutoconerEntryDateWindow(entryDate)
  const activatedAt = machine.activated_at ? toValidDate(machine.activated_at, 'Machine activation date') : null
  const deactivatedAt = machine.deactivated_at ? toValidDate(machine.deactivated_at, 'Machine deactivation date') : null

  if (activatedAt && activatedAt >= end) return false
  if (deactivatedAt) return deactivatedAt > start
  return machine.is_active !== false
}

export function buildAutoconerMachineVisibilityWhere(entryDate) {
  const { start, end } = getAutoconerEntryDateWindow(entryDate)
  return {
    AND: [
      {
        OR: [
          { activated_at: null },
          { activated_at: { lt: end } }
        ]
      },
      {
        OR: [
          { deactivated_at: { gt: start } },
          { deactivated_at: null, is_active: true }
        ]
      }
    ]
  }
}
