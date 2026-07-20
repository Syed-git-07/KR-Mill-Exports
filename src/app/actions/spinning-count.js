'use server'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/spinningCountQueries'

export async function getSpinningCountsAction() {
  try {
    const data = await queries.getSpinningCounts()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createSpinningCountAction(countData) {
  try {
    const data = await queries.createSpinningCount(countData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSpinningCountAction(id, countData) {
  try {
    const data = await queries.updateSpinningCount(id, countData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteSpinningCountAction(id) {
  try {
    const data = await queries.deleteSpinningCount(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchSpinningCountsAction(field, condition, value) {
  try {
    const data = await queries.searchSpinningCounts(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
