import { searchPayrollEmployees } from '@/lib/payroll/employees'

export async function searchEmployees(searchTerm = '', limit = 10, departmentScope = null) {
  return searchPayrollEmployees(searchTerm, limit, departmentScope)
}
