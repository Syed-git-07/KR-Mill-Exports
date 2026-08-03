const hasValue = (value) => value !== null && value !== undefined && value !== ''

export function idsEqual(left, right) {
  if (!hasValue(left) || !hasValue(right)) return false
  return String(left) === String(right)
}

export function findDraftByKeys(drafts, ...keys) {
  if (!drafts) return null

  for (const key of keys) {
    if (!hasValue(key)) continue
    const direct = drafts[key] ?? drafts[String(key)]
    if (direct) return direct
  }

  return null
}

export function findSetupDraft(drafts, setupId, machineId) {
  const direct = findDraftByKeys(drafts, setupId, machineId)
  if (direct) return direct

  return Object.values(drafts || {}).find((draft) =>
    idsEqual(draft?.machine_id, machineId) ||
    idsEqual(draft?.setup_id, setupId)
  ) || null
}

export function mergeSetupDraft(baseSetup, machineId, drafts) {
  const resolvedMachineId = machineId ?? baseSetup?.machine_id
  const draft = findSetupDraft(drafts, baseSetup?.id, resolvedMachineId)

  // Setup loading and draft editing can cross during the first render or a
  // keyed refresh. The machine-keyed draft is still valid without its base.
  if (!baseSetup) {
    return draft
      ? { ...draft, ...(resolvedMachineId ? { machine_id: resolvedMachineId } : {}) }
      : undefined
  }

  return draft ? { ...baseSetup, ...draft } : baseSetup
}

/**
 * Resolve the authoritative draft collection for an overall Update. Parent
 * state wins when supplied because a newly mounted child ref is temporarily
 * empty even though the UI already owns non-empty shared drafts.
 */
export function resolveCommitDrafts({ dependencyDrafts, tabKey, refDrafts, propDrafts }) {
  if (dependencyDrafts && Object.prototype.hasOwnProperty.call(dependencyDrafts, tabKey)) {
    return dependencyDrafts[tabKey] || {}
  }

  const localDrafts = refDrafts || {}
  return Object.keys(localDrafts).length > 0 ? localDrafts : (propDrafts || {})
}

export function getStoppageRow(row) {
  return Array.isArray(row?.stoppage) ? row.stoppage[0] : row?.stoppage
}

export function findStoppageDraft(drafts, row) {
  const stoppage = getStoppageRow(row)
  // Most modules key shared stoppage drafts by the stoppage-entry id. Spinning
  // intentionally keys them by production-detail id (row.id), so support both.
  const direct = findDraftByKeys(drafts, stoppage?.id, row?.id)
  if (direct) return direct

  return Object.values(drafts || {}).find((draft) =>
    idsEqual(draft?.production_detail_id, row?.id) ||
    idsEqual(draft?.stoppage_entry_id, stoppage?.id)
  ) || null
}

const toNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getEffectiveStoppageTotal(row, drafts) {
  const stoppage = getStoppageRow(row)
  const draft = findStoppageDraft(drafts, row)
  const baseTotal = toNumber(
    stoppage?.total_stoppage_time ?? row?.total_stoppage_mins ?? 0
  )

  if (!draft) return baseTotal

  return [1, 2, 3, 4].reduce((sum, slot) => (
    sum + toNumber(
      draft[`stoppage${slot}_time`] ??
      stoppage?.[`stoppage${slot}_time`] ??
      0
    )
  ), 0)
}

export function rowHasDependencyDraft(row, setupMap, setupDrafts, stoppageDrafts) {
  const setup = setupMap?.[row?.machine_id] || row?.setup
  return Boolean(
    findSetupDraft(setupDrafts, setup?.id, row?.machine_id) ||
    findStoppageDraft(stoppageDrafts, row)
  )
}

export function selectRowsForDependentCommit(
  rows,
  directDrafts,
  setupMap,
  setupDrafts,
  stoppageDrafts
) {
  return (rows || []).filter((row) => (
    Boolean(findDraftByKeys(directDrafts, row.id)) ||
    rowHasDependencyDraft(row, setupMap, setupDrafts, stoppageDrafts)
  ))
}
