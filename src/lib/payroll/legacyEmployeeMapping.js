import 'server-only'

import { prisma } from '@/lib/prisma'
import { findActivePayrollEmployeeById } from '@/lib/payroll/employees'

const SOURCE_CONFIGS = [
  { key: 'autoconer', module: 'Autoconer', detail: 'autoconer_production_detail', header: 'autoconer_production_header', machine: 'autoconer_machines', nameField: 'emp_name', idField: 'payroll_employee_id' },
  { key: 'breaker', module: 'Breaker Drawing', detail: 'breaker_drawing_production_detail', header: 'breaker_drawing_production_header', machine: 'drawing_breaker_machines', nameField: 'employee_name', idField: 'payroll_employee_id' },
  { key: 'carding', module: 'Carding', detail: 'carding_production_detail', header: 'carding_production_header', machine: 'carding_machines', nameField: 'employee_name', idField: 'payroll_employee_id' },
  { key: 'comber', module: 'Comber', detail: 'comber_production_detail', header: 'comber_production_header', machine: 'comber_machines', nameField: 'employee_name', idField: 'payroll_employee_id' },
  { key: 'finisher', module: 'Finisher Drawing', detail: 'finisher_drawing_production_detail', header: 'finisher_drawing_production_header', machine: 'drawing_finisher_machines', nameField: 'employee_name', idField: 'payroll_employee_id' },
  { key: 'lap_former', module: 'Lap Former', detail: 'lap_former_production_detail', header: 'lap_former_production_header', machine: 'lap_former_machines', nameField: 'employee_name', idField: 'payroll_employee_id' },
  { key: 'simplex', module: 'Simplex', detail: 'simplex_production_detail', header: 'simplex_production_header', machine: 'simplex_machines', nameField: 'employee_name', idField: 'payroll_employee_id' },
  { key: 'spinning_sider1', module: 'Spinning — Sider 1', detail: 'spinning_production_detail', header: 'spinning_production_header', machine: 'spinning_machines', nameField: 'sider1_name', idField: 'sider1_payroll_employee_id' },
  { key: 'spinning_sider2', module: 'Spinning — Sider 2', detail: 'spinning_production_detail', header: 'spinning_production_header', machine: 'spinning_machines', nameField: 'sider2_name', idField: 'sider2_payroll_employee_id' }
]

const CONFIG_BY_KEY = new Map(SOURCE_CONFIGS.map(config => [config.key, config]))
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function positivePage(value, fallback) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function dateKey(value) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

async function unresolvedAssignmentsFor(config) {
  const details = await prisma[config.detail].findMany({
    where: {
      [config.idField]: null,
      [config.nameField]: { not: null }
    },
    select: {
      id: true,
      header_id: true,
      machine_id: true,
      [config.nameField]: true
    }
  })
  const unresolved = details.filter(detail => String(detail[config.nameField] || '').trim())
  if (!unresolved.length) return []

  const [headers, machines] = await Promise.all([
    prisma[config.header].findMany({
      where: { id: { in: [...new Set(unresolved.map(detail => detail.header_id))] } },
      select: { id: true, entry_date: true, shift: true }
    }),
    prisma[config.machine].findMany({
      where: { id: { in: [...new Set(unresolved.map(detail => detail.machine_id))] } },
      select: { id: true, machine_no: true }
    })
  ])
  const headerById = new Map(headers.map(header => [header.id, header]))
  const machineById = new Map(machines.map(machine => [machine.id, machine]))

  return unresolved.map(detail => {
    const header = headerById.get(detail.header_id)
    return {
      assignment_key: `${config.key}:${detail.id}`,
      source: config.key,
      detail_id: detail.id,
      module: config.module,
      snapshot_name: String(detail[config.nameField]).trim(),
      identity_status: 'UNRESOLVED_LEGACY',
      entry_date: dateKey(header?.entry_date),
      shift: header?.shift ?? null,
      machine_no: machineById.get(detail.machine_id)?.machine_no || '-'
    }
  })
}

export async function getLegacyEmployeeMappingQueue({ query = '', page = 1, pageSize = 50 } = {}) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('en-IN')
  const safePageSize = Math.min(100, positivePage(pageSize, 50))
  const assignments = (await Promise.all(SOURCE_CONFIGS.map(unresolvedAssignmentsFor)))
    .flat()
    .filter(assignment => !normalizedQuery || [
      assignment.snapshot_name,
      assignment.module,
      assignment.machine_no,
      assignment.entry_date,
      String(assignment.shift || '')
    ].some(value => String(value).toLocaleLowerCase('en-IN').includes(normalizedQuery)))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) ||
      a.module.localeCompare(b.module) || a.machine_no.localeCompare(b.machine_no) ||
      a.snapshot_name.localeCompare(b.snapshot_name))

  const total = assignments.length
  const pages = Math.max(1, Math.ceil(total / safePageSize))
  const safePage = Math.min(positivePage(page, 1), pages)
  return {
    assignments: assignments.slice((safePage - 1) * safePageSize, safePage * safePageSize),
    total,
    page: safePage,
    pages,
    pageSize: safePageSize,
    query: String(query || '').trim()
  }
}

export async function mapLegacyEmployeeAssignment({ source, detailId, payrollEmployeeId }) {
  const config = CONFIG_BY_KEY.get(String(source || ''))
  if (!config) throw new Error('Unknown production employee source.')
  if (!UUID_PATTERN.test(String(detailId || ''))) throw new Error('Invalid production detail ID.')

  const employee = await findActivePayrollEmployeeById(payrollEmployeeId)
  if (!employee) throw new Error('Select an active employee from the configured payroll company.')

  const current = await prisma[config.detail].findUnique({
    where: { id: detailId },
    select: { id: true, [config.nameField]: true, [config.idField]: true }
  })
  if (!current) throw new Error('Production detail not found.')
  if (current[config.idField] != null) throw new Error('This assignment has already been mapped.')
  const snapshotName = String(current[config.nameField] || '').trim()
  if (!snapshotName) throw new Error('This production detail has no legacy employee snapshot to map.')

  const result = await prisma[config.detail].updateMany({
    where: { id: detailId, [config.idField]: null },
    data: { [config.idField]: employee.payroll_employee_id }
  })
  if (result.count !== 1) throw new Error('The assignment changed while it was being mapped. Refresh and try again.')

  return {
    source: config.key,
    detail_id: detailId,
    module: config.module,
    snapshot_name: snapshotName,
    payroll_employee_id: employee.payroll_employee_id,
    payroll_employee_name: employee.emp_name,
    employee_code: employee.employee_code,
    token_no: employee.token_no
  }
}

export const LEGACY_EMPLOYEE_SOURCE_COUNT = SOURCE_CONFIGS.length
