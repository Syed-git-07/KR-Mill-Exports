'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/stoppageHeadQueries'

export async function getStoppageHeadsAction() {
  await requireUser()
  try {
    const data = await queries.getStoppageHeads()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createStoppageHeadAction(stoppageData) {
  await requireUser()
  try {
    const data = await queries.createStoppageHead(stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateStoppageHeadAction(id, stoppageData) {
  await requireUser()
  try {
    const data = await queries.updateStoppageHead(id, stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteStoppageHeadAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteStoppageHead(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchStoppageHeadsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchStoppageHeads(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function generateStoppageCodeAction(deptId) {
  await requireUser()
  try {
    const data = await queries.generateStoppageCode(deptId)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
