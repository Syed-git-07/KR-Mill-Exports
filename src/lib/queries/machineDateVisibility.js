function toValidDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Prisma predicate for the machine lifecycle at a historical entry date.
 * `is_active` is intentionally not used: it describes the machine today and
 * must not make a deactivated machine disappear from an older entry snapshot.
 */
export function buildMachineVisibilityWhere(entryDate) {
  const date = toValidDate(entryDate)
  if (!date) throw new TypeError('A valid entry date is required for machine visibility')

  return {
    OR: [
      {
        AND: [
          { OR: [{ activated_at: { not: null } }, { deactivated_at: { not: null } }] },
          { OR: [{ activated_at: null }, { activated_at: { lte: date } }] },
          { OR: [{ deactivated_at: null }, { deactivated_at: { gt: date } }] }
        ]
      },
      {
        activated_at: null,
        deactivated_at: null,
        is_active: true
      }
    ]
  }
}

export function isMachineVisibleOnDate(machine, entryDate) {
  if (!machine) return false
  const date = toValidDate(entryDate)
  if (!date) return false

  const activatedAt = toValidDate(machine.activated_at)
  const deactivatedAt = toValidDate(machine.deactivated_at)
  if (activatedAt && activatedAt > date) return false
  if (deactivatedAt && deactivatedAt <= date) return false

  // Lifecycle dates are the historical source of truth. For legacy rows with
  // neither date, retain current active-state behavior.
  if (!activatedAt && !deactivatedAt) return machine.is_active !== false
  return true
}
