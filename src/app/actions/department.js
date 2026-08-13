'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { getDepartments, createDepartment, updateDepartment, deleteDepartment, searchDepartments } from '@/lib/queries/queries'
import { serializeData } from '@/lib/serialize'

export async function getDepartmentsAction() {
  await requireUser()
  try {
    const data = await getDepartments()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function createDepartmentAction(departmentData) {
  await requireUser()
  try {
    const data = await createDepartment(departmentData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function updateDepartmentAction(id, departmentData) {
  await requireUser()
  try {
    const data = await updateDepartment(id, departmentData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function deleteDepartmentAction(id) {
  await requireUser()
  try {
    const data = await deleteDepartment(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

export async function searchDepartmentsAction(field, condition, value) {
  await requireUser()
  try {
    const data = await searchDepartments(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
