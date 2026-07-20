'use server'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/stoppageHeadQueries'

export async function getStoppageHeadsAction() {
  try {
    const data = await queries.getStoppageHeads()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createStoppageHeadAction(stoppageData) {
  try {
    const data = await queries.createStoppageHead(stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateStoppageHeadAction(id, stoppageData) {
  try {
    const data = await queries.updateStoppageHead(id, stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteStoppageHeadAction(id) {
  try {
    const data = await queries.deleteStoppageHead(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchStoppageHeadsAction(field, condition, value) {
  try {
    const data = await queries.searchStoppageHeads(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function generateStoppageCodeAction(deptId) {
  try {
    const data = await queries.generateStoppageCode(deptId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
