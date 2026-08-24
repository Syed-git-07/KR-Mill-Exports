import { searchPayrollEmployees } from '@/lib/payroll/employees'

export async function searchEmployees(searchTerm = '', limit = 10) {
  return searchPayrollEmployees(searchTerm, limit)
}
