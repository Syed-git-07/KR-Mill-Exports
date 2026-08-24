import { Prisma } from '@prisma/client'
import { payrollDb } from '../payroll/client'
import { getPayrollCompanyId } from '../payroll/config'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function normalizeDateForSQL(dateInput) {
  const rawValue = String(dateInput ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const parsed = new Date(`${rawValue}T00:00:00.000Z`)
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === rawValue) return rawValue
  }

  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(parsed.getTime())) throw new Error('A valid date is required.')
  return parsed.toISOString().slice(0, 10)
}

function positiveId(value, label) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} is invalid.`)
  return id
}

function parseWeekOffs(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeWeekOffs(value) {
  const parsed = parseWeekOffs(value)
  return Object.fromEntries(DAY_NAMES.map(day => [day, parsed[day] === true]))
}

function normalizeHolidayListPayload(payload) {
  const name = String(payload?.name || '').trim()
  if (!name) throw new Error('List Name is required.')

  const startDate = normalizeDateForSQL(payload?.startDate)
  const endDate = normalizeDateForSQL(payload?.endDate)
  if (startDate > endDate) throw new Error('Start Date must be less than or equal to End Date.')

  const status = payload?.status === 'Inactive' ? 'Inactive' : 'Active'
  return {
    name,
    startDate,
    endDate,
    status,
    weekOffs: normalizeWeekOffs(payload?.weekOffs),
    companyId: getPayrollCompanyId()
  }
}

function isWeekOff(dateKey, weekOffs) {
  const dayName = DAY_NAMES[new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()]
  return parseWeekOffs(weekOffs)[dayName] === true
}

function dateKeysBetween(startDate, endDate) {
  const dates = []
  const cursor = new Date(`${normalizeDateForSQL(startDate)}T00:00:00.000Z`)
  const end = new Date(`${normalizeDateForSQL(endDate)}T00:00:00.000Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export async function getCompanies() {
  const companyId = getPayrollCompanyId()
  return payrollDb.$queryRaw`
    SELECT id, name
    FROM companies
    WHERE id = ${companyId} AND status = 'Active'
    LIMIT 1
  `
}

export async function getHolidayLists() {
  const companyId = getPayrollCompanyId()
  return payrollDb.$queryRaw`
    SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
    FROM holiday_lists
    WHERE companyId = ${companyId}
    ORDER BY startDate DESC, id DESC
  `
}

export async function searchHolidayLists(field, condition, value) {
  const companyId = getPayrollCompanyId()
  const clauses = [Prisma.sql`companyId = ${companyId}`]
  const searchValue = String(value ?? '').trim()

  if (searchValue) {
    if (field === 'id') {
      const id = Number(searchValue)
      if (Number.isSafeInteger(id) && id > 0) clauses.push(Prisma.sql`id = ${id}`)
      else return []
    } else if (field === 'status') {
      clauses.push(Prisma.sql`status = ${searchValue}`)
    } else if (condition === 'Equals') {
      clauses.push(Prisma.sql`name = ${searchValue}`)
    } else {
      clauses.push(Prisma.sql`name LIKE ${`%${searchValue}%`}`)
    }
  }

  return payrollDb.$queryRaw`
    SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
    FROM holiday_lists
    WHERE ${Prisma.join(clauses, ' AND ')}
    ORDER BY startDate DESC, id DESC
  `
}

export async function getHolidayListById(id) {
  const listId = positiveId(id, 'Holiday list ID')
  const companyId = getPayrollCompanyId()
  const [list] = await payrollDb.$queryRaw`
    SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
    FROM holiday_lists
    WHERE id = ${listId} AND companyId = ${companyId}
    LIMIT 1
  `
  return list || null
}

export async function checkHolidayListNameUnique(name, _companyId, excludeId = null) {
  const companyId = getPayrollCompanyId()
  const exclude = excludeId ? Prisma.sql`AND id != ${positiveId(excludeId, 'Holiday list ID')}` : Prisma.empty
  const [existing] = await payrollDb.$queryRaw`
    SELECT id
    FROM holiday_lists
    WHERE name = ${String(name || '').trim()} AND companyId = ${companyId}
    ${exclude}
    LIMIT 1
  `
  return !existing
}

export async function checkHolidayListOverlap(startDate, endDate, _companyId, excludeId = null) {
  const companyId = getPayrollCompanyId()
  const normalizedStart = normalizeDateForSQL(startDate)
  const normalizedEnd = normalizeDateForSQL(endDate)
  const exclude = excludeId ? Prisma.sql`AND id != ${positiveId(excludeId, 'Holiday list ID')}` : Prisma.empty
  const [overlap] = await payrollDb.$queryRaw`
    SELECT id
    FROM holiday_lists
    WHERE companyId = ${companyId}
      AND status = 'Active'
      AND startDate <= ${normalizedEnd}
      AND endDate >= ${normalizedStart}
      ${exclude}
    LIMIT 1
  `
  return !overlap
}

export async function createHolidayList(payload) {
  const values = normalizeHolidayListPayload(payload)
  if (!await checkHolidayListNameUnique(values.name, values.companyId)) {
    throw new Error('List Name must be unique for the configured payroll company.')
  }
  if (values.status === 'Active' && !await checkHolidayListOverlap(values.startDate, values.endDate, values.companyId)) {
    throw new Error('An active holiday list overlaps with this period for the configured payroll company.')
  }

  return payrollDb.$transaction(async tx => {
    await tx.$executeRaw`
      INSERT INTO holiday_lists (name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt)
      VALUES (${values.name}, ${values.startDate}, ${values.endDate}, ${JSON.stringify(values.weekOffs)}, ${values.status}, ${values.companyId}, NOW(), NOW())
    `
    const [created] = await tx.$queryRaw`
      SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
      FROM holiday_lists
      WHERE id = LAST_INSERT_ID() AND companyId = ${values.companyId}
      LIMIT 1
    `
    return created
  })
}

export async function updateHolidayList(id, payload) {
  const listId = positiveId(id, 'Holiday list ID')
  const current = await getHolidayListById(listId)
  if (!current) throw new Error('Holiday list not found for the configured payroll company.')

  const values = normalizeHolidayListPayload(payload)
  if (!await checkHolidayListNameUnique(values.name, values.companyId, listId)) {
    throw new Error('List Name must be unique for the configured payroll company.')
  }
  if (values.status === 'Active' && !await checkHolidayListOverlap(values.startDate, values.endDate, values.companyId, listId)) {
    throw new Error('An active holiday list overlaps with this period for the configured payroll company.')
  }

  const [outsideRange] = await payrollDb.$queryRaw`
    SELECT id
    FROM holidays
    WHERE holidayListId = ${listId}
      AND (date < ${values.startDate} OR date > ${values.endDate})
    LIMIT 1
  `
  if (outsideRange) throw new Error('The new period excludes existing holidays. Move or delete those holidays first.')

  const affectedRows = await payrollDb.$executeRaw`
    UPDATE holiday_lists
    SET name = ${values.name}, startDate = ${values.startDate}, endDate = ${values.endDate},
        weekOffs = ${JSON.stringify(values.weekOffs)}, status = ${values.status}, updatedAt = NOW()
    WHERE id = ${listId} AND companyId = ${values.companyId}
  `
  if (!affectedRows) throw new Error('Holiday list not found for the configured payroll company.')
  return getHolidayListById(listId)
}

export async function hasHolidaysForList(id) {
  const listId = positiveId(id, 'Holiday list ID')
  const companyId = getPayrollCompanyId()
  const [result] = await payrollDb.$queryRaw`
    SELECT COUNT(*) AS count
    FROM holidays h
    INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
    WHERE h.holidayListId = ${listId} AND hl.companyId = ${companyId}
  `
  return Number(result?.count || 0) > 0
}

export async function deleteHolidayList(id) {
  const listId = positiveId(id, 'Holiday list ID')
  const companyId = getPayrollCompanyId()
  if (!await getHolidayListById(listId)) throw new Error('Holiday list not found for the configured payroll company.')
  if (await hasHolidaysForList(listId)) {
    throw new Error('This holiday list contains holidays and cannot be deleted until all holidays are removed.')
  }

  const affectedRows = await payrollDb.$executeRaw`
    DELETE FROM holiday_lists
    WHERE id = ${listId} AND companyId = ${companyId}
  `
  if (!affectedRows) throw new Error('Holiday list not found for the configured payroll company.')
  return true
}

export async function getHolidaysByListId(holidayListId) {
  const listId = positiveId(holidayListId, 'Holiday list ID')
  const companyId = getPayrollCompanyId()
  return payrollDb.$queryRaw`
    SELECT h.id, h.date, h.description, h.type, h.holidayListId, h.createdAt, h.updatedAt
    FROM holidays h
    INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
    WHERE h.holidayListId = ${listId} AND hl.companyId = ${companyId}
    ORDER BY h.date ASC
  `
}

export async function checkHolidayDuplicate(date, holidayListId, excludeId = null) {
  const dateKey = normalizeDateForSQL(date)
  const listId = positiveId(holidayListId, 'Holiday list ID')
  const companyId = getPayrollCompanyId()
  const exclude = excludeId ? Prisma.sql`AND h.id != ${positiveId(excludeId, 'Holiday ID')}` : Prisma.empty
  const [existing] = await payrollDb.$queryRaw`
    SELECT h.id
    FROM holidays h
    INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
    WHERE h.date = ${dateKey}
      AND h.holidayListId = ${listId}
      AND hl.companyId = ${companyId}
      ${exclude}
    LIMIT 1
  `
  return !existing
}

function validateHolidayDateWithinList(date, list) {
  const dateKey = normalizeDateForSQL(date)
  const startDate = normalizeDateForSQL(list.startDate)
  const endDate = normalizeDateForSQL(list.endDate)
  if (dateKey < startDate || dateKey > endDate) {
    throw new Error('Holiday date must be within the selected holiday list period.')
  }
  return dateKey
}

export async function createHoliday(payload) {
  const listId = positiveId(payload?.holidayListId, 'Holiday list ID')
  const list = await getHolidayListById(listId)
  if (!list) throw new Error('Holiday list not found for the configured payroll company.')

  const date = validateHolidayDateWithinList(payload?.date, list)
  const description = String(payload?.description || '').trim()
  if (!description) throw new Error('Holiday description is required.')
  if (!await checkHolidayDuplicate(date, listId)) throw new Error('A holiday already exists for this date in the selected list.')

  return payrollDb.$transaction(async tx => {
    await tx.$executeRaw`
      INSERT INTO holidays (date, description, type, holidayListId, createdAt, updatedAt)
      VALUES (${date}, ${description}, 'Holiday', ${listId}, NOW(), NOW())
    `
    const [created] = await tx.$queryRaw`
      SELECT id, date, description, type, holidayListId, createdAt, updatedAt
      FROM holidays
      WHERE id = LAST_INSERT_ID() AND holidayListId = ${listId}
      LIMIT 1
    `
    return created
  })
}

async function getHolidayById(id) {
  const holidayId = positiveId(id, 'Holiday ID')
  const companyId = getPayrollCompanyId()
  const [holiday] = await payrollDb.$queryRaw`
    SELECT h.id, h.date, h.description, h.type, h.holidayListId, h.createdAt, h.updatedAt
    FROM holidays h
    INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
    WHERE h.id = ${holidayId} AND hl.companyId = ${companyId}
    LIMIT 1
  `
  return holiday || null
}

export async function updateHoliday(id, payload) {
  const holidayId = positiveId(id, 'Holiday ID')
  const current = await getHolidayById(holidayId)
  if (!current) throw new Error('Holiday not found for the configured payroll company.')

  if (payload?.holidayListId != null && Number(payload.holidayListId) !== Number(current.holidayListId)) {
    throw new Error('A holiday cannot be moved to a different holiday list during update.')
  }
  const list = await getHolidayListById(current.holidayListId)
  if (!list) throw new Error('Holiday list not found for the configured payroll company.')

  const date = validateHolidayDateWithinList(payload?.date, list)
  const description = String(payload?.description || '').trim()
  if (!description) throw new Error('Holiday description is required.')
  if (!await checkHolidayDuplicate(date, current.holidayListId, holidayId)) {
    throw new Error('A holiday already exists for this date in the selected list.')
  }

  const companyId = getPayrollCompanyId()
  const affectedRows = await payrollDb.$executeRaw`
    UPDATE holidays h
    INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
    SET h.date = ${date}, h.description = ${description}, h.updatedAt = NOW()
    WHERE h.id = ${holidayId} AND hl.companyId = ${companyId}
  `
  if (!affectedRows) throw new Error('Holiday not found for the configured payroll company.')
  return getHolidayById(holidayId)
}

export async function deleteHoliday(id) {
  const holidayId = positiveId(id, 'Holiday ID')
  const companyId = getPayrollCompanyId()
  const affectedRows = await payrollDb.$executeRaw`
    DELETE h FROM holidays h
    INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
    WHERE h.id = ${holidayId} AND hl.companyId = ${companyId}
  `
  if (!affectedRows) throw new Error('Holiday not found for the configured payroll company.')
  return true
}

export async function isHoliday(dateInput) {
  const date = normalizeDateForSQL(dateInput)
  const companyId = getPayrollCompanyId()
  const [explicitHoliday] = await payrollDb.$queryRaw`
    SELECT h.id, h.description, h.type
    FROM holidays h
    INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
    WHERE h.date = ${date}
      AND hl.status = 'Active'
      AND hl.companyId = ${companyId}
      AND h.date BETWEEN hl.startDate AND hl.endDate
    LIMIT 1
  `
  if (explicitHoliday) return explicitHoliday

  const [activeList] = await payrollDb.$queryRaw`
    SELECT id, weekOffs
    FROM holiday_lists
    WHERE companyId = ${companyId}
      AND status = 'Active'
      AND ${date} BETWEEN startDate AND endDate
    LIMIT 1
  `
  if (!activeList || !isWeekOff(date, activeList.weekOffs)) return null

  const dayName = DAY_NAMES[new Date(`${date}T00:00:00.000Z`).getUTCDay()]
  return { id: null, description: `${dayName[0].toUpperCase()}${dayName.slice(1)} weekly off`, type: 'Week Off' }
}

export async function getAllHolidayDates() {
  const companyId = getPayrollCompanyId()
  const [holidayRows, activeLists] = await Promise.all([
    payrollDb.$queryRaw`
      SELECT h.date
      FROM holidays h
      INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
      WHERE hl.status = 'Active'
        AND hl.companyId = ${companyId}
        AND h.date BETWEEN hl.startDate AND hl.endDate
    `,
    payrollDb.$queryRaw`
      SELECT startDate, endDate, weekOffs
      FROM holiday_lists
      WHERE status = 'Active' AND companyId = ${companyId}
    `
  ])

  const dates = new Set((holidayRows || []).map(row => normalizeDateForSQL(row.date)))
  for (const list of activeLists || []) {
    for (const date of dateKeysBetween(list.startDate, list.endDate)) {
      if (isWeekOff(date, list.weekOffs)) dates.add(date)
    }
  }
  return [...dates].sort()
}

export async function bulkCreateHolidays(holidayListId, records) {
  const listId = positiveId(holidayListId, 'Holiday list ID')
  const list = await getHolidayListById(listId)
  if (!list) throw new Error('Holiday list not found for the configured payroll company.')

  const existing = await getHolidaysByListId(listId)
  const seenDates = new Set(existing.map(holiday => normalizeDateForSQL(holiday.date)))
  const listStart = normalizeDateForSQL(list.startDate)
  const listEnd = normalizeDateForSQL(list.endDate)
  const validRecords = []
  for (const record of Array.isArray(records) ? records : []) {
    const description = String(record?.description || '').trim()
    if (!record?.date || !description) continue
    const date = normalizeDateForSQL(record.date)
    if (date < listStart || date > listEnd || seenDates.has(date)) continue
    seenDates.add(date)
    validRecords.push({ date, description })
  }

  if (!validRecords.length) return 0
  await payrollDb.$transaction(async tx => {
    for (const record of validRecords) {
      await tx.$executeRaw`
        INSERT INTO holidays (date, description, type, holidayListId, createdAt, updatedAt)
        VALUES (${record.date}, ${record.description}, 'Holiday', ${listId}, NOW(), NOW())
      `
    }
  })
  return validRecords.length
}
