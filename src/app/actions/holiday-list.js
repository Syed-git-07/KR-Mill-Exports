'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
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
  await requireUser()
  try {
    const data = await createHolidayList(listData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateHolidayListAction(id, listData) {
  await requireUser()
  try {
    const data = await updateHolidayList(id, listData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteHolidayListAction(id) {
  await requireUser()
  try {
    const data = await deleteHolidayList(id)
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
  await requireUser()
  try {
    const data = await createHoliday(holidayData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateHolidayAction(id, holidayData) {
  await requireUser()
  try {
    const data = await updateHoliday(id, holidayData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteHolidayAction(id) {
  await requireUser()
  try {
    const data = await deleteHoliday(id)
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
  await requireUser()
  try {
    const insertedCount = await bulkCreateHolidays(holidayListId, records)
    return { success: true, count: insertedCount }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
