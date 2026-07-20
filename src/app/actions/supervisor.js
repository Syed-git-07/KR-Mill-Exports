'use server'

import { serializeData } from '@/lib/serialize'

import * as queries from '@/lib/queries/supervisorQueries'

export async function getSupervisorsAction() {
  try {
    const data = await queries.getSupervisors()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createSupervisorAction(supervisorData) {
  try {
    const data = await queries.createSupervisor(supervisorData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateSupervisorAction(id, supervisorData) {
  try {
    const data = await queries.updateSupervisor(id, supervisorData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteSupervisorAction(id) {
  try {
    const data = await queries.deleteSupervisor(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchSupervisorsAction(field, condition, value) {
  try {
    const data = await queries.searchSupervisors(field, condition, value)
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
