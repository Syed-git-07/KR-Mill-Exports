export function createLatestRequestGate() {
  let currentRequest = 0

  return {
    begin() {
      currentRequest += 1
      return currentRequest
    },
    isLatest(requestId) {
      return requestId === currentRequest
    },
    invalidate() {
      currentRequest += 1
    }
  }
}

export function rowIdentity(rowOrId, idKey = 'id') {
  if (rowOrId == null) return null
  if (typeof rowOrId === 'object') return rowOrId[idKey] ?? null
  return rowOrId
}

export function getCurrentRowsByIdentity(rows, candidates, idKey = 'id') {
  const currentRows = Array.isArray(rows) ? rows : []
  const requestedIds = new Set(
    (Array.isArray(candidates) ? candidates : [candidates])
      .map(candidate => rowIdentity(candidate, idKey))
      .filter(id => id != null)
  )

  return currentRows.filter(row => requestedIds.has(rowIdentity(row, idKey)))
}

export function getCurrentRowByIdentity(rows, candidate, idKey = 'id') {
  const candidateId = rowIdentity(candidate, idKey)
  if (candidateId == null) return null
  return (Array.isArray(rows) ? rows : []).find(
    row => rowIdentity(row, idKey) === candidateId
  ) || null
}

export function reconcileVisibleRowState({
  rows,
  selectedId = null,
  selectedRows = [],
  selectedItem = null,
  editingItem = null,
  idKey = 'id'
}) {
  const visibleRows = Array.isArray(rows) ? rows : []
  const selectedRow = getCurrentRowByIdentity(visibleRows, selectedId, idKey)
  const currentSelectedItem = getCurrentRowByIdentity(visibleRows, selectedItem, idKey)
  const currentEditingItem = getCurrentRowByIdentity(visibleRows, editingItem, idKey)

  return {
    selectedId: selectedRow ? rowIdentity(selectedRow, idKey) : null,
    selectedRows: getCurrentRowsByIdentity(visibleRows, selectedRows, idKey),
    selectedItem: currentSelectedItem,
    editingItem: currentEditingItem && editingItem
      ? { ...editingItem, ...currentEditingItem }
      : null,
    selectedItemBecameStale: selectedItem != null && currentSelectedItem == null,
    editingItemBecameStale: editingItem != null && currentEditingItem == null
  }
}
