import { prisma } from '../prisma'
import { parseStrictDate } from '../strictDate'

const TWC_SEARCH_FIELDS = new Set(['entry_id', 'entry_date', 'twc_value'])
const TWC_NUMERIC_FIELDS = new Set(['entry_id', 'twc_value'])

function requiredDate(value, label = 'Entry date') {
  return parseStrictDate(value, label)
}

function requiredNonNegativeNumber(value, label) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${label} is required`)
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative number`)
  }
  return number
}

function normalizeTWCEntry(entryData = {}) {
  const spinningCountId = String(entryData.spinning_count_id || '').trim()
  if (!spinningCountId) throw new Error('Count selection is required')

  const shift = entryData.shift == null || entryData.shift === ''
    ? null
    : String(entryData.shift).trim()

  return {
    entry_date: requiredDate(entryData.entry_date),
    spinning_count_id: spinningCountId,
    twc_value: requiredNonNegativeNumber(entryData.twc_value, 'TWC value'),
    shift,
    remarks: entryData.remarks == null || entryData.remarks === ''
      ? null
      : String(entryData.remarks).trim(),
  }
}

async function assertUsableCount(transaction, countId, unchangedCountId = null) {
  const count = await transaction.spinning_counts.findUnique({
    where: { id: countId },
    select: { id: true, is_active: true },
  })
  if (!count) throw new Error('The selected spinning count no longer exists')
  if (!count.is_active && countId !== unchangedCountId) {
    throw new Error('The selected spinning count is inactive')
  }
}

async function assertNoDuplicateEntry(transaction, data, excludeId = null) {
  const duplicate = await transaction.twc_entries.findFirst({
    where: {
      entry_date: data.entry_date,
      spinning_count_id: data.spinning_count_id,
      shift: data.shift,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (duplicate) {
    throw new Error('A TWC entry already exists for this date, count, and shift')
  }
}

async function attachCountNames(entries) {
  const countIds = [...new Set(entries.map(entry => entry.spinning_count_id).filter(Boolean))]
  const counts = countIds.length
    ? await prisma.spinning_counts.findMany({
        where: { id: { in: countIds } },
        select: { id: true, count_name: true },
      })
    : []
  const countMap = new Map(counts.map(count => [count.id, count]))

  return entries.map(entry => ({
    ...entry,
    spinning_counts: countMap.get(entry.spinning_count_id) || null,
  }))
}

export async function getTWCEntries() {
  const entries = await prisma.twc_entries.findMany({
    orderBy: { entry_id: 'asc' },
  })
  return attachCountNames(entries)
}

export async function getCountsForDropdown(includeCountId = null) {
  return prisma.spinning_counts.findMany({
    where: {
      OR: [
        { is_active: true },
        ...(includeCountId ? [{ id: includeCountId }] : []),
      ],
    },
    select: { id: true, count_name: true, is_active: true },
    orderBy: { count_name: 'asc' },
  })
}

export async function createTWCEntry(entryData) {
  const normalized = normalizeTWCEntry(entryData)

  return prisma.$transaction(async transaction => {
    await assertUsableCount(transaction, normalized.spinning_count_id)
    await assertNoDuplicateEntry(transaction, normalized)

    const latest = await transaction.twc_entries.findFirst({
      orderBy: { entry_id: 'desc' },
      select: { entry_id: true },
    })

    return transaction.twc_entries.create({
      data: {
        ...normalized,
        entry_id: (latest?.entry_id ?? 0) + 1,
      },
    })
  }, { isolationLevel: 'Serializable' })
}

export async function updateTWCEntry(id, entryData) {
  if (!id) throw new Error('TWC entry ID is required')
  const normalized = normalizeTWCEntry(entryData)

  return prisma.$transaction(async transaction => {
    const existing = await transaction.twc_entries.findUnique({
      where: { id },
      select: { id: true, spinning_count_id: true },
    })
    if (!existing) throw new Error('TWC entry not found')

    await assertUsableCount(transaction, normalized.spinning_count_id, existing.spinning_count_id)
    await assertNoDuplicateEntry(transaction, normalized, id)

    return transaction.twc_entries.update({
      where: { id },
      data: normalized,
    })
  })
}

export async function deleteTWCEntry(id) {
  if (!id) throw new Error('TWC entry ID is required')
  await prisma.twc_entries.delete({ where: { id } })
  return true
}

export async function searchTWCEntries(field, condition, value) {
  if (!TWC_SEARCH_FIELDS.has(field)) throw new Error('Unsupported TWC search field')
  const trimmedValue = String(value ?? '').trim()
  if (!trimmedValue) return getTWCEntries()

  let operand
  if (field === 'entry_date') {
    operand = requiredDate(trimmedValue, 'Search date')
  } else if (TWC_NUMERIC_FIELDS.has(field)) {
    operand = requiredNonNegativeNumber(trimmedValue, 'Search value')
    if (field === 'entry_id') operand = Math.trunc(operand)
  }

  let filter
  switch (condition) {
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

  const entries = await prisma.twc_entries.findMany({
    where: { [field]: filter },
    orderBy: { entry_id: 'asc' },
  })
  return attachCountNames(entries)
}
