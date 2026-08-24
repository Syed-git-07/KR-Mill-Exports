import { prisma } from '../prisma'
import { getPayrollEmployeesByIds } from '../payroll/employees'
import { resolveHistoricalEmployeeIdentity } from '../payroll/historicalEmployeeIdentity'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requestedSupervisorIds(values) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(String))]
}

export async function validateProductionSupervisorIds(...values) {
  const ids = requestedSupervisorIds(values)
  if (!ids.length) return
  if (ids.some(id => !UUID_PATTERN.test(id))) throw new Error('Supervisor or maisitry selection is invalid.')

  const assignments = await prisma.supervisors.findMany({
    where: {
      id: { in: ids },
      is_active: true,
      payroll_employee_id: { not: null }
    },
    select: { id: true, payroll_employee_id: true }
  })
  if (assignments.length !== ids.length) {
    throw new Error('Select an active supervisor or maisitry that is linked to Payroll.')
  }

  const employees = await getPayrollEmployeesByIds(assignments.map(item => item.payroll_employee_id))
  const activePayrollIds = new Set(employees
    .filter(employee => employee.status === 'Active')
    .map(employee => Number(employee.id)))
  if (assignments.some(item => !activePayrollIds.has(Number(item.payroll_employee_id)))) {
    throw new Error('The selected supervisor or maisitry is not active in the configured payroll company.')
  }
}

export async function validateProductionSupervisorUpdate(updates) {
  await validateProductionSupervisorIds(updates?.supervisor_id, updates?.maisitry_id)
  return updates
}

export async function getActiveProductionSupervisors() {
  const assignments = await prisma.supervisors.findMany({
    where: {
      is_active: true,
      payroll_employee_id: { not: null }
    },
    select: {
      id: true,
      code: true,
      department_id: true,
      supervisor_name: true,
      payroll_employee_id: true
    }
  })
  const employees = await getPayrollEmployeesByIds(assignments.map(item => item.payroll_employee_id))
  const employeeById = new Map(employees
    .filter(employee => employee.status === 'Active')
    .map(employee => [Number(employee.id), employee]))

  return assignments.flatMap(assignment => {
    const employee = employeeById.get(Number(assignment.payroll_employee_id))
    if (!employee) return []
    const references = [...new Set([employee.token_no, employee.employee_code].filter(Boolean))].join(' / ')
    return [{
      ...assignment,
      supervisor_name_snapshot: assignment.supervisor_name,
      supervisor_name: employee.emp_name,
      token_no: employee.token_no,
      employee_code: employee.employee_code,
      payroll_status: employee.status,
      supervisor_label: `${employee.emp_name}${references ? ` — ${references}` : ''} [Role ${assignment.code}]`
    }]
  }).sort((a, b) => a.supervisor_name.localeCompare(b.supervisor_name, undefined, { numeric: true }))
}

export async function getProductionSupervisorDisplayMap(values) {
  const ids = requestedSupervisorIds(values)
  if (!ids.length) return new Map()
  const assignments = await prisma.supervisors.findMany({
    where: { id: { in: ids } },
    select: { id: true, supervisor_name: true, payroll_employee_id: true }
  })
  const employees = await getPayrollEmployeesByIds(assignments.map(item => item.payroll_employee_id))
  const employeeById = new Map(employees.map(employee => [Number(employee.id), employee]))

  return new Map(assignments.map(assignment => {
    const identity = resolveHistoricalEmployeeIdentity({
      payrollEmployeeId: assignment.payroll_employee_id,
      snapshotName: assignment.supervisor_name,
      employee: employeeById.get(Number(assignment.payroll_employee_id)) || null,
      assignmentKey: `supervisor:${assignment.id}`
    })
    return [assignment.id, identity.displayName]
  }))
}
