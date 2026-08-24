import { Prisma } from '@prisma/client'
import { payrollDb } from './client'
import { getPayrollCompanyId } from './config'

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

  return payrollDb.$queryRaw`
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
}

export async function getPayrollEmployeesByIds(ids) {
  const uniqueIds = [...new Set((ids || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]
  if (!uniqueIds.length) return []

  const companyId = getPayrollCompanyId()
  return payrollDb.$queryRaw`
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

  return rows[0] || null
}

export function findActivePayrollEmployeeById(id) {
  return findPayrollEmployeeById(id, { activeOnly: true })
}

export function getPayrollEmployeeById(id) {
  return findPayrollEmployeeById(id, { activeOnly: false })
}
