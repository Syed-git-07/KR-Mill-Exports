import { Prisma } from '@prisma/client'
import { payrollDb } from './client'
import { getPayrollCompanyId } from './config'

function cleanNamePart(value) {
  const part = String(value ?? '').trim().replace(/\s+/g, ' ')
  return part && part !== '-' ? part : ''
}

export function formatPayrollEmployeeName(employee) {
  if (!employee) return ''

  const usesCamelCaseFields = ['firstName', 'middleName', 'lastName']
    .some(field => Object.hasOwn(employee, field))
  const parts = usesCamelCaseFields
    ? [employee.firstName, employee.middleName, employee.lastName]
    : [employee.emp_name, employee.middle_name, employee.last_name]

  return parts.map(cleanNamePart).filter(Boolean).join(' ')
}

function withCanonicalEmployeeName(employee) {
  return {
    ...employee,
    emp_name: formatPayrollEmployeeName(employee)
  }
}

export async function searchPayrollEmployees(searchTerm = '', limit = 10) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(50, Number(limit))) : 10
  const term = String(searchTerm || '').trim()
  const companyId = getPayrollCompanyId()
  const nameClause = term
    ? Prisma.sql`AND (
        e.firstName LIKE ${`%${term}%`}
        OR NULLIF(TRIM(e.middleName), '-') LIKE ${`%${term}%`}
        OR NULLIF(TRIM(e.lastName), '-') LIKE ${`%${term}%`}
        OR CONCAT_WS(' ', e.firstName, NULLIF(TRIM(e.middleName), '-'), NULLIF(TRIM(e.lastName), '-')) LIKE ${`%${term}%`}
        OR e.biometricEnrollmentId LIKE ${`${term}%`}
      )`
    : Prisma.empty

  const employees = await payrollDb.$queryRaw`
    SELECT
      e.id,
      e.firstName,
      NULLIF(TRIM(e.middleName), '-') AS middleName,
      NULLIF(TRIM(e.lastName), '-') AS lastName,
      e.biometricEnrollmentId,
      d.departmentname
    FROM employees e
    LEFT JOIN departments d ON d.id = e.departmentId
    WHERE e.companyId = ${companyId}
      AND e.status = 'Active'
    ${nameClause}
    ORDER BY e.firstName ASC, e.middleName ASC, e.lastName ASC,
      e.biometricEnrollmentId ASC, e.id ASC
    LIMIT ${safeLimit}
  `

  return (employees || []).map(withCanonicalEmployeeName)
}

export async function getPayrollEmployeesByIds(ids) {
  const uniqueIds = [...new Set((ids || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]
  if (!uniqueIds.length) return []

  const companyId = getPayrollCompanyId()
  const employees = await payrollDb.$queryRaw`
    SELECT
      e.id,
      e.firstName AS emp_name,
      NULLIF(TRIM(e.middleName), '-') AS middle_name,
      NULLIF(TRIM(e.lastName), '-') AS last_name,
      CAST(e.biometricEnrollmentId AS CHAR) AS emp_code,
      e.dateOfJoining AS doj,
      d.departmentname AS department
    FROM employees e
    LEFT JOIN departments d ON d.id = e.departmentId
    WHERE e.companyId = ${companyId}
      AND e.id IN (${Prisma.join(uniqueIds)})
  `

  return (employees || []).map(withCanonicalEmployeeName)
}

async function findPayrollEmployeeById(id, { activeOnly }) {
  const employeeId = Number(id)
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return null

  const companyId = getPayrollCompanyId()
  const statusClause = activeOnly ? Prisma.sql`AND e.status = 'Active'` : Prisma.empty
  const rows = await payrollDb.$queryRaw`
    SELECT
      e.id,
      e.firstName AS emp_name,
      NULLIF(TRIM(e.middleName), '-') AS middle_name,
      NULLIF(TRIM(e.lastName), '-') AS last_name,
      CAST(e.biometricEnrollmentId AS CHAR) AS emp_code,
      e.dateOfJoining AS doj,
      d.departmentname AS department
    FROM employees e
    LEFT JOIN departments d ON d.id = e.departmentId
    WHERE e.companyId = ${companyId}
      AND e.id = ${employeeId}
      ${statusClause}
    LIMIT 1
  `

  return rows[0] ? withCanonicalEmployeeName(rows[0]) : null
}

export function findActivePayrollEmployeeById(id) {
  return findPayrollEmployeeById(id, { activeOnly: true })
}

export function getPayrollEmployeeById(id) {
  return findPayrollEmployeeById(id, { activeOnly: false })
}

export async function hydratePayrollEmployeeNames(rows, bindings) {
  const records = Array.isArray(rows) ? rows : []
  const employeeIds = records.flatMap(record => (bindings || []).map(({ idField }) => record?.[idField]))
  const employees = await getPayrollEmployeesByIds(employeeIds)
  const employeeById = new Map(employees.map(employee => [Number(employee.id), employee]))
  return records.map(record => {
    const hydrated = { ...record }
    for (const { nameField, idField } of bindings || []) {
      const employee = employeeById.get(Number(record?.[idField]))
      hydrated[nameField] = employee?.emp_name || ''
    }
    return hydrated
  })
}
