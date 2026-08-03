export function findFirstFreeStoppageSlot(entry) {
  for (let slot = 1; slot <= 4; slot += 1) {
    const value = entry?.[`stoppage${slot}_id`]
    if (value === null || value === undefined || value === '') {
      return slot
    }
  }

  return null
}

export function getStoppageTotal(entry) {
  return [1, 2, 3, 4].reduce(
    (total, slot) => total + (Number(entry?.[`stoppage${slot}_time`]) || 0),
    0
  )
}

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

function invalidStoppage(message) {
  const error = new Error(message)
  error.code = 'INVALID_STOPPAGE'
  return error
}

/**
 * Whitelists and normalizes a stoppage-row update. In particular, this avoids
 * string concatenation in totals and prevents a crafted server-action payload
 * from changing production_detail_id or other protected columns.
 */
export function buildStoppageUpdate(existing = {}, updates = {}) {
  const data = {}

  for (let slot = 1; slot <= 4; slot += 1) {
    const idField = `stoppage${slot}_id`
    const timeField = `stoppage${slot}_time`

    if (hasOwn(updates, idField)) {
      const rawId = updates[idField]
      data[idField] = rawId === '' || rawId === 'NONE' || rawId == null
        ? null
        : String(rawId)
    }

    const reasonWasCleared = hasOwn(data, idField) && data[idField] === null
    const rawTime = reasonWasCleared
      ? 0
      : (hasOwn(updates, timeField) ? updates[timeField] : existing[timeField])
    const time = rawTime === '' || rawTime == null ? 0 : Number(rawTime)

    if (!Number.isFinite(time) || !Number.isInteger(time) || time < 0) {
      throw invalidStoppage(`Stoppage ${slot} time must be a non-negative whole number of minutes.`)
    }
    data[timeField] = time
  }

  if (hasOwn(updates, 'is_full_stoppage')) {
    const rawValue = updates.is_full_stoppage
    data.is_full_stoppage = rawValue === true || rawValue === 1 || rawValue === '1' || rawValue === 'true'
  }

  data.total_stoppage_time = getStoppageTotal(data)
  return data
}

/**
 * Applies a full/partial stoppage to local row drafts only.
 * Nothing is persisted until the entry page's final Update action saves the drafts.
 */
export function applyBulkStoppageDraft({
  rows = [],
  drafts = {},
  reasonId,
  reason = null,
  minutes,
  maxMinutes = Number.POSITIVE_INFINITY,
  additionalChanges = {},
  shouldApply = () => true
}) {
  const nextDrafts = { ...(drafts || {}) }
  let updatedCount = 0
  let skippedCount = 0
  let overflowCount = 0

  const nextRows = rows.map(row => {
    if (!row?.id || !shouldApply(row)) return row

    const existingDraft = nextDrafts[row.id] || nextDrafts[String(row.id)] || {}
    const effectiveRow = { ...row, ...existingDraft }
    const slot = findFirstFreeStoppageSlot(effectiveRow)

    if (!slot) {
      skippedCount += 1
      return row
    }

    const total = getStoppageTotal(effectiveRow)
    if (total + minutes > maxMinutes) {
      overflowCount += 1
      return row
    }

    const idField = `stoppage${slot}_id`
    const timeField = `stoppage${slot}_time`
    const relationField = `stoppage${slot}`
    const totalStoppage = total + minutes
    const changes = {
      [idField]: reasonId,
      [timeField]: minutes,
      total_stoppage_time: totalStoppage,
      ...additionalChanges
    }

    nextDrafts[row.id] = {
      ...existingDraft,
      ...changes
    }
    updatedCount += 1

    return {
      ...effectiveRow,
      ...changes,
      ...(reason ? { [relationField]: reason } : {})
    }
  })

  return {
    rows: nextRows,
    drafts: nextDrafts,
    updatedCount,
    skippedCount,
    overflowCount
  }
}
