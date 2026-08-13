'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/spinningCountQueries'

export async function getSpinningCountsAction() {
  await requireUser()
  try {
    const data = await queries.getSpinningCounts()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createSpinningCountAction(countData) {
  await requireUser()
  try {
    const data = await queries.createSpinningCount(countData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSpinningCountAction(id, countData) {
  await requireUser()
  try {
    const data = await queries.updateSpinningCount(id, countData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSpinningCountAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteSpinningCount(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchSpinningCountsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchSpinningCounts(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
