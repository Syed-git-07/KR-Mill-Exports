'use server'

import { requireRole, requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import { executeAuditedHolidayMutation } from '@/lib/security/holidayAudit'
import {
  getCompanies,
  getHolidayLists,
  searchHolidayLists,
  createHolidayList,
  updateHolidayList,
  deleteHolidayList,
  getHolidaysByListId,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  isHoliday,
  getAllHolidayDates,
  bulkCreateHolidays,
} from '@/lib/queries/holidayListQueries'

export async function getCompaniesAction() {
  await requireUser()
  try {
    const data = await getCompanies()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getHolidayListsAction() {
  await requireUser()
  try {
    const data = await getHolidayLists()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchHolidayListsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await searchHolidayLists(field, condition, value)
    return { success: true, data: serializeData(data || []) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createHolidayListAction(listData) {
  const user = await requireRole('ADMIN')
  try {
    const data = await executeAuditedHolidayMutation({
      user, action: 'CREATE', resource: 'payroll.holiday-list', changes: listData
    }, () => createHolidayList(listData))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateHolidayListAction(id, listData) {
  const user = await requireRole('ADMIN')
  try {
    const data = await executeAuditedHolidayMutation({
      user, action: 'UPDATE', resource: 'payroll.holiday-list', targetId: id, changes: listData
    }, () => updateHolidayList(id, listData))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteHolidayListAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const data = await executeAuditedHolidayMutation({
      user, action: 'DELETE', resource: 'payroll.holiday-list', targetId: id
    }, () => deleteHolidayList(id))
    return { success: true, data }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getHolidaysByListIdAction(holidayListId) {
  await requireUser()
  try {
    const data = await getHolidaysByListId(Number(holidayListId))
    return { success: true, data: serializeData(data || []) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createHolidayAction(holidayData) {
  const user = await requireRole('ADMIN')
  try {
    const data = await executeAuditedHolidayMutation({
      user, action: 'CREATE', resource: 'payroll.holiday', changes: holidayData
    }, () => createHoliday(holidayData))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateHolidayAction(id, holidayData) {
  const user = await requireRole('ADMIN')
  try {
    const data = await executeAuditedHolidayMutation({
      user, action: 'UPDATE', resource: 'payroll.holiday', targetId: id, changes: holidayData
    }, () => updateHoliday(id, holidayData))
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteHolidayAction(id) {
  const user = await requireRole('ADMIN')
  try {
    const data = await executeAuditedHolidayMutation({
      user, action: 'DELETE', resource: 'payroll.holiday', targetId: id
    }, () => deleteHoliday(id))
    return { success: true, data }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function checkIsHolidayAction(dateString) {
  await requireUser()
  try {
    const data = await isHoliday(dateString)
    return { success: true, isHoliday: !!data, holiday: data }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getAllHolidayDatesAction() {
  await requireUser()
  try {
    const data = await getAllHolidayDates()
    return { success: true, data: serializeData(data || []) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function bulkCreateHolidaysAction(holidayListId, records) {
  const user = await requireRole('ADMIN')
  try {
    const insertedCount = await executeAuditedHolidayMutation({
      user,
      action: 'BULK_CREATE',
      resource: 'payroll.holiday',
      targetId: holidayListId,
      changes: { submittedCount: Array.isArray(records) ? records.length : 0 }
    }, () => bulkCreateHolidays(holidayListId, records))
    return { success: true, count: insertedCount }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
