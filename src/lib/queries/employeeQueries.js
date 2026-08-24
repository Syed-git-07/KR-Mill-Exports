import { searchPayrollEmployees } from '@/lib/payroll/employees'

export async function searchEmployees(searchTerm = '', limit = 10) {
  const rows = await searchPayrollEmployees(searchTerm, limit)

  return (rows || []).map((row, index) => ({
    id: String(row.id ?? row.biometricEnrollmentId ?? `${row.firstName}-${index}`),
    payroll_employee_id: Number(row.id),
    emp_name: row.firstName || '',
    middle_name: row.middleName || '',
    last_name: row.lastName || '',
    emp_code: row.biometricEnrollmentId ? String(row.biometricEnrollmentId) : null,
    department: row.departmentname || null,
    designation: null
  }))
}
