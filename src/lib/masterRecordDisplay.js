/**
 * Keeps soft-deleted Master records available for audit without presenting
 * the internal is_active flag as a user-managed status.
 */
export function orderMasterRecords(records = []) {
  return [...records].sort((left, right) => {
    const leftDeleted = left?.is_active === false
    const rightDeleted = right?.is_active === false

    if (leftDeleted === rightDeleted) return 0
    return leftDeleted ? 1 : -1
  })
}

export function getMasterRecordRowClassName(record) {
  return record?.is_active === false
    ? '!bg-red-100 hover:!bg-red-200 text-red-700'
    : '!bg-white hover:!bg-yellow-100'
}
