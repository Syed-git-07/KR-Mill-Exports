'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/stoppageDetailQueries'

export async function getStoppageDetailsAction() {
  await requireUser()
  try {
    const data = await queries.getStoppageDetails()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createStoppageDetailAction(stoppageData) {
  await requireUser()
  try {
    const data = await queries.createStoppageDetail(stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateStoppageDetailAction(id, stoppageData) {
  await requireUser()
  try {
    const data = await queries.updateStoppageDetail(id, stoppageData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteStoppageDetailAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteStoppageDetail(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchStoppageDetailsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchStoppageDetails(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getStoppageHeadsAction() {
  await requireUser()
  try {
    const data = await queries.getStoppageHeadsForDropdown()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function getDepartmentsAction() {
  await requireUser()
  try {
    const data = await queries.getDepartmentsForDropdown()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
