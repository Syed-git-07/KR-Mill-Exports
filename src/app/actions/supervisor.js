'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/supervisorQueries'

export async function getSupervisorsAction() {
  await requireUser()
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createSupervisorAction(supervisorData) {
  await requireUser()
  try {
    const data = await queries.createSupervisor(supervisorData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateSupervisorAction(id, supervisorData) {
  await requireUser()
  try {
    const data = await queries.updateSupervisor(id, supervisorData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteSupervisorAction(id) {
  await requireUser()
  try {
    const data = await queries.deleteSupervisor(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchSupervisorsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await queries.searchSupervisors(field, condition, value)
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
