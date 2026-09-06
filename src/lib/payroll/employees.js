import { Prisma } from '@prisma/client'
import { payrollDb } from './client'
import { getPayrollCompanyId } from './config'
import { formatPayrollEmployeeName, toPayrollEmployeeResponse } from './employeeContract'

export { formatPayrollEmployeeName, toPayrollEmployeeResponse } from './employeeContract'

const ENTRY_DEPARTMENTS = {
  preparatory: [
    'CARDING', 'BREAKER DRAWING', 'COMBER', 'FINISHER DRAWING', 'LAP FORMER', 'SIMPLEX',
    'TCARDING', 'TLFORMERBD', 'TCOMBER', 'TFDRG', 'TSIMPLEX'
  ],
  autoconer: ['AUTOCONER', 'TAUTOCONER', 'AUTOCONER MAISTRY/WORKER TEACHER'],
  spinning: [
    'SPINNING', 'SPG SIDER', 'SPG DOFFER', 'SPINNING MAISTRY', 'SPINNING RELIVER',
    'TSPINNING', 'TSPG SIDER', 'TSPG DOFFER'
  ]
}

export async function searchPayrollEmployees(searchTerm = '', limit = 10, departmentScope = null) {
  if (departmentScope !== null && !Object.hasOwn(ENTRY_DEPARTMENTS, departmentScope)) {
    throw new Error('Invalid employee department scope.')
  }
  const departmentClause = departmentScope === null
    ? Prisma.empty
    : Prisma.sql`AND d.departmentname IN (${Prisma.join(ENTRY_DEPARTMENTS[departmentScope])})`
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(50, Number(limit))) : 10
  const term = String(searchTerm || '').trim()
  const companyId = getPayrollCompanyId()
  const containsTerm = `%${term}%`
  const prefixTerm = `${term}%`
  const nameClause = term
    ? Prisma.sql`AND (
        e.firstName LIKE ${containsTerm}
        OR NULLIF(TRIM(e.middleName), '-') LIKE ${containsTerm}
        OR NULLIF(TRIM(e.lastName), '-') LIKE ${containsTerm}
        OR CONCAT_WS(' ', e.firstName, NULLIF(TRIM(e.middleName), '-'), NULLIF(TRIM(e.lastName), '-')) LIKE ${containsTerm}
        OR e.employeeCode LIKE ${prefixTerm}
        OR e.biometricEnrollmentId LIKE ${prefixTerm}
      )`
    : Prisma.empty
  const priorityClause = term
    ? Prisma.sql`
        CASE
          WHEN CONCAT_WS(' ', e.firstName, NULLIF(TRIM(e.middleName), '-'), NULLIF(TRIM(e.lastName), '-')) = ${term}
            OR e.employeeCode = ${term}
            OR e.biometricEnrollmentId = ${term} THEN 0
          WHEN e.firstName LIKE ${prefixTerm}
            OR CONCAT_WS(' ', e.firstName, NULLIF(TRIM(e.middleName), '-'), NULLIF(TRIM(e.lastName), '-')) LIKE ${prefixTerm} THEN 1
          WHEN NULLIF(TRIM(e.middleName), '-') LIKE ${prefixTerm}
            OR NULLIF(TRIM(e.lastName), '-') LIKE ${prefixTerm} THEN 2
          WHEN e.employeeCode LIKE ${prefixTerm}
            OR e.biometricEnrollmentId LIKE ${prefixTerm} THEN 3
          ELSE 4
        END ASC,`
    : Prisma.empty

  const employees = await payrollDb.$queryRaw`
    SELECT
      e.id,
      e.firstName AS first_name,
      NULLIF(TRIM(e.middleName), '-') AS middle_name,
      NULLIF(TRIM(e.lastName), '-') AS last_name,
      CAST(e.employeeCode AS CHAR) AS employee_code,
      CAST(e.biometricEnrollmentId AS CHAR) AS token_no,
      e.dateOfJoining AS doj,
      d.departmentname AS department,
      dg.name AS designation,
      e.status
    FROM employees e
    LEFT JOIN departments d ON d.id = e.departmentId
    LEFT JOIN designations dg ON dg.id = e.designationId
    WHERE e.companyId = ${companyId}
      AND e.status = 'Active'
    ${departmentClause}
    ${nameClause}
    ORDER BY ${priorityClause} e.firstName ASC, e.middleName ASC, e.lastName ASC,
      e.employeeCode ASC, e.biometricEnrollmentId ASC, e.id ASC
    LIMIT ${safeLimit}
  `

  return (employees || []).map(employee => {
    const result = toPayrollEmployeeResponse(employee)
    // The eight production entry screens use scoped employee searches.
    if (departmentScope !== null) result.emp_name = result.first_name
    return result
  })
}

export async function getPayrollEmployeesByIds(ids) {
  const uniqueIds = [...new Set((ids || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]
  if (!uniqueIds.length) return []

  const companyId = getPayrollCompanyId()
  const employees = await payrollDb.$queryRaw`
    SELECT
      e.id,
      e.firstName AS first_name,
      NULLIF(TRIM(e.middleName), '-') AS middle_name,
      NULLIF(TRIM(e.lastName), '-') AS last_name,
      CAST(e.employeeCode AS CHAR) AS employee_code,
      CAST(e.biometricEnrollmentId AS CHAR) AS token_no,
      e.dateOfJoining AS doj,
      d.departmentname AS department,
      dg.name AS designation,
      e.status
    FROM employees e
    LEFT JOIN departments d ON d.id = e.departmentId
    LEFT JOIN designations dg ON dg.id = e.designationId
    WHERE e.companyId = ${companyId}
      AND e.id IN (${Prisma.join(uniqueIds)})
  `

  return (employees || []).map(toPayrollEmployeeResponse)
}

async function findPayrollEmployeeById(id, { activeOnly }) {
  const employeeId = Number(id)
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return null

  const companyId = getPayrollCompanyId()
  const statusClause = activeOnly ? Prisma.sql`AND e.status = 'Active'` : Prisma.empty
  const rows = await payrollDb.$queryRaw`
    SELECT
      e.id,
      e.firstName AS first_name,
      NULLIF(TRIM(e.middleName), '-') AS middle_name,
      NULLIF(TRIM(e.lastName), '-') AS last_name,
      CAST(e.employeeCode AS CHAR) AS employee_code,
      CAST(e.biometricEnrollmentId AS CHAR) AS token_no,
      e.dateOfJoining AS doj,
      d.departmentname AS department,
      dg.name AS designation,
      e.status
    FROM employees e
    LEFT JOIN departments d ON d.id = e.departmentId
    LEFT JOIN designations dg ON dg.id = e.designationId
    WHERE e.companyId = ${companyId}
      AND e.id = ${employeeId}
      ${statusClause}
    LIMIT 1
  `

  return rows[0] ? toPayrollEmployeeResponse(rows[0]) : null
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
      const snapshotName = String(record?.[nameField] || '').trim()
      // Keep the production snapshot stable. Payroll fills only an absent
      // snapshot; it must not rewrite history when a current name changes.
      hydrated[nameField] = snapshotName || employee?.emp_name || ''
    }
    return hydrated
  })
}
