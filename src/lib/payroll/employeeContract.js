function cleanNamePart(value) {
  const part = String(value ?? '').trim().replace(/\s+/g, ' ')
  return part && part !== '-' ? part : ''
}

function cleanReference(value) {
  const reference = String(value ?? '').trim()
  return reference || null
}

export function formatPayrollEmployeeName(employee) {
  if (!employee) return ''

  const parts = [
    employee.first_name ?? employee.firstName ?? employee.emp_name,
    employee.middle_name ?? employee.middleName,
    employee.last_name ?? employee.lastName
  ]
  return parts.map(cleanNamePart).filter(Boolean).join(' ')
}

/**
 * The single employee shape exposed by the payroll data-access layer.
 * `id`/`payroll_employee_id` are the payroll employee primary key. Employee code and
 * biometric token remain separate even when a payroll installation currently
 * assigns them the same value.
 */
export function toPayrollEmployeeResponse(employee) {
  if (!employee) return null

  const payrollEmployeeId = Number(employee.id ?? employee.payroll_employee_id)
  const employeeCode = cleanReference(employee.employee_code ?? employee.employeeCode)
  const tokenNo = cleanReference(
    employee.token_no ?? employee.biometricEnrollmentId ?? employee.emp_code
  )

  return {
    id: Number.isSafeInteger(payrollEmployeeId) && payrollEmployeeId > 0 ? payrollEmployeeId : null,
    payroll_employee_id: Number.isSafeInteger(payrollEmployeeId) && payrollEmployeeId > 0
      ? payrollEmployeeId
      : null,
    emp_name: formatPayrollEmployeeName(employee),
    first_name: cleanNamePart(employee.first_name ?? employee.firstName ?? employee.emp_name),
    middle_name: cleanNamePart(employee.middle_name ?? employee.middleName),
    last_name: cleanNamePart(employee.last_name ?? employee.lastName),
    employee_code: employeeCode,
    token_no: tokenNo,
    // Backward-compatible alias used by existing report layouts for token no.
    emp_code: tokenNo || employeeCode,
    doj: employee.doj ?? employee.dateOfJoining ?? null,
    department: employee.department ?? employee.departmentname ?? null,
    designation: employee.designation ?? null,
    status: employee.status ?? null
  }
}
