import { prisma } from '../prisma'
import { parseStrictDate } from '../strictDate'

const HOK_SEARCH_FIELDS = new Set(['hok_id', 'date'])

function normalizeDate(value, label = 'Date') {
  return parseStrictDate(value, label)
}

function normalizeHOKId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid HOK ID is required')
  return id
}

function normalizeShiftValue(value, label) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${label} is required`)
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative number`)
  }
  return number
}

function normalizeHOKData(hokData = {}) {
  const entries = Array.isArray(hokData.entries) ? hokData.entries : []
  if (entries.length === 0) throw new Error('At least one department entry is required')

  const seenDepartments = new Set()
  const normalizedEntries = entries.map((entry, index) => {
    const departmentId = String(entry?.department_id || '').trim()
    if (!departmentId) throw new Error(`Department is required for row ${index + 1}`)
    if (seenDepartments.has(departmentId)) {
      throw new Error('Each department can appear only once in an HOK entry')
    }
    seenDepartments.add(departmentId)

    return {
      department_id: departmentId,
      shift1: normalizeShiftValue(entry.shift1, 'Shift 1'),
      shift2: normalizeShiftValue(entry.shift2, 'Shift 2'),
      shift3: normalizeShiftValue(entry.shift3, 'Shift 3'),
    }
  })

  return {
    date: normalizeDate(hokData.date),
    entries: normalizedEntries,
  }
}

function totalsFor(entries) {
  return entries.reduce((totals, entry) => ({
    total_shift1: totals.total_shift1 + entry.shift1,
    total_shift2: totals.total_shift2 + entry.shift2,
    total_shift3: totals.total_shift3 + entry.shift3,
  }), { total_shift1: 0, total_shift2: 0, total_shift3: 0 })
}

async function assertDepartmentsExist(transaction, entries) {
  const departmentIds = entries.map(entry => entry.department_id)
  const departments = await transaction.departments.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true },
  })
  if (departments.length !== departmentIds.length) {
    throw new Error('One or more selected departments no longer exist')
  }
}

async function assertUniqueDate(transaction, date, excludeHokId = null) {
  const duplicate = await transaction.hok_strength_head.findFirst({
    where: {
      date,
      ...(excludeHokId ? { hok_id: { not: excludeHokId } } : {}),
    },
    select: { hok_id: true },
  })
  if (duplicate) throw new Error('An HOK strength entry already exists for this date')
}

async function createDetails(transaction, hokId, entries) {
  const latest = await transaction.hok_strength_detail.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  })
  let nextId = (latest?.id ?? 0) + 1

  const data = entries.map(entry => ({
    id: nextId++,
    hok_id: hokId,
    ...entry,
  }))
  await transaction.hok_strength_detail.createMany({ data })
}

export async function getHOKEntries() {
  return prisma.hok_strength_head.findMany({
    select: { hok_id: true, date: true },
    orderBy: { date: 'desc' },
  })
}

export async function getHOKEntryById(hokId) {
  const normalizedId = normalizeHOKId(hokId)
  const header = await prisma.hok_strength_head.findUnique({
    where: { hok_id: normalizedId },
  })
  if (!header) throw new Error('HOK strength entry not found')

  const details = await prisma.hok_strength_detail.findMany({
    where: { hok_id: normalizedId },
    orderBy: { id: 'asc' },
  })
  const departmentIds = [...new Set(details.map(detail => detail.department_id))]
  const departments = departmentIds.length
    ? await prisma.departments.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, dept_name: true, is_active: true, sl_no: true },
      })
    : []
  const departmentMap = new Map(departments.map(department => [department.id, department]))

  return {
    header,
    details: details.map(detail => ({
      ...detail,
      departments: departmentMap.get(detail.department_id) || null,
    })),
  }
}

export async function createHOKEntry(hokData) {
  const normalized = normalizeHOKData(hokData)
  const totals = totalsFor(normalized.entries)

  return prisma.$transaction(async transaction => {
    await assertDepartmentsExist(transaction, normalized.entries)
    await assertUniqueDate(transaction, normalized.date)

    const header = await transaction.hok_strength_head.create({
      data: { date: normalized.date, ...totals },
    })
    await createDetails(transaction, header.hok_id, normalized.entries)

    const details = await transaction.hok_strength_detail.findMany({
      where: { hok_id: header.hok_id },
      orderBy: { id: 'asc' },
    })
    return { header, details }
  }, { isolationLevel: 'Serializable' })
}

export async function createBulkHOKEntries(entriesData) {
  return createHOKEntry(entriesData)
}

export async function updateHOKEntry(hokId, hokData) {
  const normalizedId = normalizeHOKId(hokId)
  const normalized = normalizeHOKData(hokData)
  const totals = totalsFor(normalized.entries)

  return prisma.$transaction(async transaction => {
    const existing = await transaction.hok_strength_head.findUnique({
      where: { hok_id: normalizedId },
      select: { hok_id: true },
    })
    if (!existing) throw new Error('HOK strength entry not found')

    await assertDepartmentsExist(transaction, normalized.entries)
    await assertUniqueDate(transaction, normalized.date, normalizedId)

    const header = await transaction.hok_strength_head.update({
      where: { hok_id: normalizedId },
      data: { date: normalized.date, ...totals },
    })
    await transaction.hok_strength_detail.deleteMany({ where: { hok_id: normalizedId } })
    await createDetails(transaction, normalizedId, normalized.entries)

    const details = await transaction.hok_strength_detail.findMany({
      where: { hok_id: normalizedId },
      orderBy: { id: 'asc' },
    })
    return { header, details }
  }, { isolationLevel: 'Serializable' })
}

export async function deleteHOKEntry(hokId) {
  const normalizedId = normalizeHOKId(hokId)
  return prisma.$transaction(async transaction => {
    await transaction.hok_strength_detail.deleteMany({ where: { hok_id: normalizedId } })
    await transaction.hok_strength_head.delete({ where: { hok_id: normalizedId } })
    return true
  })
}

export async function deleteHOKEntriesByDate(date) {
  const normalizedDate = normalizeDate(date)
  return prisma.$transaction(async transaction => {
    const headers = await transaction.hok_strength_head.findMany({
      where: { date: normalizedDate },
      select: { hok_id: true },
    })
    const ids = headers.map(header => header.hok_id)
    if (ids.length) {
      await transaction.hok_strength_detail.deleteMany({ where: { hok_id: { in: ids } } })
      await transaction.hok_strength_head.deleteMany({ where: { hok_id: { in: ids } } })
    }
    return ids.length
  })
}

export async function getDepartmentsForDropdown() {
  return prisma.departments.findMany({
    where: { is_active: true },
    select: { id: true, dept_name: true, code: true, sl_no: true },
    orderBy: { sl_no: 'asc' },
  })
}

export async function searchHOKEntries(searchParams = {}) {
  const { field, operator, value } = searchParams
  if (!HOK_SEARCH_FIELDS.has(field)) throw new Error('Unsupported HOK search field')
  const trimmedValue = String(value ?? '').trim()
  if (!trimmedValue) return getHOKEntries()

  const operand = field === 'hok_id'
    ? normalizeHOKId(trimmedValue)
    : normalizeDate(trimmedValue, 'Search date')

  let filter
  switch (operator) {
    case 'Not Equal':
      filter = { not: operand }
      break
    case 'Greater':
      filter = { gt: operand }
      break
    case 'Less':
      filter = { lt: operand }
      break
    case 'Like':
    case 'Equal':
    case '=':
    default:
      filter = operand
      break
  }

  return prisma.hok_strength_head.findMany({
    where: { [field]: filter },
    select: { hok_id: true, date: true },
    orderBy: { date: 'desc' },
  })
}
