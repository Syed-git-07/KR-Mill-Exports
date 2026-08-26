const cleanSnapshotName = value => String(value || '').trim()

export function resolveHistoricalEmployeeIdentity({
  payrollEmployeeId,
  snapshotName,
  employee = null,
  assignmentKey
}) {
  const id = Number(payrollEmployeeId)
  const hasPayrollId = Number.isSafeInteger(id) && id > 0
  const snapshot = cleanSnapshotName(snapshotName)

  if (hasPayrollId) {
    const displayName = snapshot || employee?.emp_name || `Payroll #${id}`
    return {
      groupKey: `payroll:${id}`,
      identityStatus: employee ? 'MAPPED' : 'PAYROLL_RECORD_UNAVAILABLE',
      payrollEmployeeId: id,
      employee,
      // The production value is the historical display snapshot. Payroll is
      // only used to fill records created before snapshots were populated.
      displayName: employee ? displayName : `Payroll record unavailable: ${displayName}`
    }
  }

  if (snapshot) {
    if (!assignmentKey) {
      throw new Error('An assignment key is required for an unresolved legacy employee')
    }
    return {
      groupKey: `legacy:${assignmentKey}`,
      identityStatus: 'UNRESOLVED_LEGACY',
      payrollEmployeeId: null,
      employee: null,
      displayName: `Unmapped legacy: ${snapshot}`
    }
  }

  return {
    groupKey: assignmentKey ? `unassigned:${assignmentKey}` : null,
    identityStatus: 'UNASSIGNED',
    payrollEmployeeId: null,
    employee: null,
    displayName: 'NIL'
  }
}
