import { prisma } from '@/lib/prisma'

const STOPPAGE_ENTRY_MODELS = [
  'autoconer_stoppage_entry',
  'breaker_drawing_stoppage_entry',
  'carding_stoppage_entry',
  'comber_stoppage_entry',
  'finisher_drawing_stoppage_entry',
  'lap_former_stoppage_entry',
  'simplex_stoppage_entry',
  'spinning_stoppage_entry'
]

const PRODUCTION_HEADER_MODELS = [
  ['autoconer_production_header', false],
  ['breaker_drawing_production_header', true],
  ['carding_production_header', true],
  ['comber_production_header', true],
  ['finisher_drawing_production_header', true],
  ['lap_former_production_header', true],
  ['simplex_production_header', true],
  ['spinning_production_header', true]
]

function referencedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export async function deleteUnusedStoppageDetail(id) {
  if (!id) throw new Error('Stoppage detail ID is required')

  return prisma.$transaction(async transaction => {
    const references = await Promise.all(
      STOPPAGE_ENTRY_MODELS.map(model => transaction[model].findFirst({
        where: {
          OR: [1, 2, 3, 4].map(slot => ({ [`stoppage${slot}_id`]: id }))
        },
        select: { id: true }
      }))
    )

    if (references.some(Boolean)) {
      throw referencedError(
        'STOPPAGE_IN_USE',
        'This stoppage reason is used by production history and cannot be permanently removed. Deactivate it instead.'
      )
    }

    await transaction.stoppage_details.delete({ where: { id } })
    return true
  })
}

export async function deleteUnusedSupervisor(id) {
  if (!id) throw new Error('Supervisor ID is required')

  return prisma.$transaction(async transaction => {
    const references = await Promise.all(
      PRODUCTION_HEADER_MODELS.map(([model, hasMaisitry]) => transaction[model].findFirst({
        where: hasMaisitry
          ? { OR: [{ supervisor_id: id }, { maisitry_id: id }] }
          : { supervisor_id: id },
        select: { id: true }
      }))
    )

    if (references.some(Boolean)) {
      throw referencedError(
        'SUPERVISOR_IN_USE',
        'This supervisor is used by production history and cannot be permanently removed. Deactivate the supervisor instead.'
      )
    }

    await transaction.supervisors.delete({ where: { id } })
    return true
  })
}

export async function deleteUnusedDepartment(id) {
  if (!id) throw new Error('Department ID is required')

  return prisma.$transaction(async transaction => {
    const department = await transaction.departments.findUnique({
      where: { id },
      select: { dept_name: true }
    })
    if (!department) throw new Error('Department not found')

    const [supervisor, stoppage, hok, employee] = await Promise.all([
      transaction.supervisors.findFirst({ where: { department_id: id }, select: { id: true } }),
      transaction.stoppage_details.findFirst({ where: { department_id: id }, select: { id: true } }),
      transaction.hok_strength_detail.findFirst({ where: { department_id: id }, select: { id: true } }),
      transaction.employee_master.findFirst({
        where: { department: department.dept_name },
        select: { id: true }
      })
    ])

    if (supervisor || stoppage || hok || employee) {
      throw referencedError(
        'DEPARTMENT_IN_USE',
        'This department is used by supervisors, stoppages, or HOK history and cannot be permanently removed. Deactivate it instead.'
      )
    }

    await transaction.departments.delete({ where: { id } })
    return true
  })
}

export async function deleteUnusedStoppageHead(id) {
  if (!id) throw new Error('Stoppage head ID is required')

  return prisma.$transaction(async transaction => {
    const reference = await transaction.stoppage_details.findFirst({
      where: { stoppage_head_id: id },
      select: { id: true }
    })

    if (reference) {
      throw referencedError(
        'STOPPAGE_HEAD_IN_USE',
        'This stoppage head still has detail reasons and cannot be permanently removed. Deactivate it instead.'
      )
    }

    await transaction.stoppage_heads.delete({ where: { id } })
    return true
  })
}

export async function deleteUnusedSpinningCount(id) {
  if (!id) throw new Error('Spinning count ID is required')

  return prisma.$transaction(async transaction => {
    const count = await transaction.spinning_counts.findUnique({
      where: { id },
      select: { count_name: true }
    })
    if (!count) throw new Error('Spinning count not found')

    const [autoconerSetup, autoconerDetail, autoconerMachine, spinningSetup, spinningDetail, tpiEntry, twcEntry] = await Promise.all([
      transaction.autoconer_machine_setup.findFirst({
        where: { OR: [{ count_id: id }, { count_name: count.count_name }] },
        select: { id: true }
      }),
      transaction.autoconer_production_detail.findFirst({
        where: { OR: [{ count_id: id }, { count_name: count.count_name }] },
        select: { id: true }
      }),
      transaction.autoconer_machines.findFirst({ where: { count: count.count_name }, select: { id: true } }),
      transaction.spinning_machine_setup.findFirst({ where: { count_name: count.count_name }, select: { id: true } }),
      transaction.spinning_production_detail.findFirst({ where: { count_name: count.count_name }, select: { id: true } }),
      transaction.tpi_entries.findFirst({ where: { spinning_count_id: id }, select: { id: true } }),
      transaction.twc_entries.findFirst({ where: { spinning_count_id: id }, select: { id: true } })
    ])

    if (autoconerSetup || autoconerDetail || autoconerMachine || spinningSetup || spinningDetail || tpiEntry || twcEntry) {
      throw referencedError(
        'SPINNING_COUNT_IN_USE',
        'This spinning count is used by production setup or historical entries and cannot be permanently removed. Deactivate it instead.'
      )
    }

    await transaction.spinning_counts.delete({ where: { id } })
    return true
  })
}
