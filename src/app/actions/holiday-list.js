'use server'

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
  try {
    const data = await getCompanies()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getHolidayListsAction(companyId) {
  try {
    const data = await getHolidayLists(companyId ? Number(companyId) : null)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (message.includes("doesn't exist") || message.includes('does not exist') || message.includes('er_no_such_table') || message.includes('holiday_lists')) {
      return { success: true, data: [] }
    }
    return { success: false, error: error.message }
  }
}

export async function searchHolidayListsAction(field, condition, value, companyId) {
  try {
    const data = await searchHolidayLists(field, condition, value, companyId ? Number(companyId) : null)
    return { success: true, data: serializeData(data || []) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createHolidayListAction(listData) {
  try {
    const data = await createHolidayList(listData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateHolidayListAction(id, listData) {
  try {
    const data = await updateHolidayList(id, listData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteHolidayListAction(id) {
  try {
    const data = await deleteHolidayList(id)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getHolidaysByListIdAction(holidayListId) {
  try {
    const data = await getHolidaysByListId(Number(holidayListId))
    return { success: true, data: serializeData(data || []) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createHolidayAction(holidayData) {
  try {
    const data = await createHoliday(holidayData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateHolidayAction(id, holidayData) {
  try {
    const data = await updateHoliday(id, holidayData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteHolidayAction(id) {
  try {
    const data = await deleteHoliday(id)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function checkIsHolidayAction(dateString) {
  try {
    const data = await isHoliday(dateString)
    return { success: true, isHoliday: !!data, holiday: data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getAllHolidayDatesAction() {
  try {
    const data = await getAllHolidayDates()
    return { success: true, data: serializeData(data || []) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function bulkCreateHolidaysAction(holidayListId, records) {
  try {
    const insertedCount = await bulkCreateHolidays(holidayListId, records)
    return { success: true, count: insertedCount }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
