// Machine identity is shared by all three entry tabs. Spinning can have
// multiple count runs for one machine, so those runs must remain distinct.
export function getEntryRowKey(row) {
  const detail = row?.production_detail
  const machineId = row?.machine_id ?? row?.machine?.id ?? detail?.machine_id ?? detail?.machine?.id
  if (machineId == null || machineId === '') return null
  const run = row?.run_sequence ?? row?.setup?.run_sequence ?? detail?.run_sequence ?? detail?.setup?.run_sequence ?? 1
  return JSON.stringify([String(machineId), String(run)])
}

export function selectEntryRow(previous, key) {
  if (!key || previous.includes(key)) return previous
  return [key]
}

export function getEntrySelectionId(row, idType) {
  return idType === 'machine' ? (row.machine_id ?? row.machine?.id) : row.id
}

export function getSelectedEntryIds(rows, keys, idType) {
  const selected = new Set(keys)
  return [...new Set(rows.filter(row => selected.has(getEntryRowKey(row)))
    .map(row => getEntrySelectionId(row, idType)).filter(id => id != null))]
}

export function getEntryKeysForIds(rows, ids, idType) {
  const selected = new Set(ids.map(String))
  return [...new Set(rows.filter(row => selected.has(String(getEntrySelectionId(row, idType))))
    .map(getEntryRowKey).filter(Boolean))]
}
