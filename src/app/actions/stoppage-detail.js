'use server'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/stoppageDetailQueries'

export async function getStoppageDetailsAction() {
  try {
    const data = await queries.getStoppageDetails()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createStoppageDetailAction(stoppageData) {
  try {
    const data = await queries.createStoppageDetail(stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateStoppageDetailAction(id, stoppageData) {
  try {
    const data = await queries.updateStoppageDetail(id, stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteStoppageDetailAction(id) {
  try {
    const data = await queries.deleteStoppageDetail(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchStoppageDetailsAction(field, condition, value) {
  try {
    const data = await queries.searchStoppageDetails(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getStoppageHeadsAction() {
  try {
    const data = await queries.getStoppageHeadsForDropdown()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function getDepartmentsAction() {
  try {
    const data = await queries.getDepartmentsForDropdown()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
