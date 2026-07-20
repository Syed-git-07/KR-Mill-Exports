'use server'

import { getDepartments, createDepartment, updateDepartment, deleteDepartment, searchDepartments } from '@/lib/queries/queries'
import { serializeData } from '@/lib/serialize'

export async function getDepartmentsAction() {
  try {
    const data = await getDepartments()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function createDepartmentAction(departmentData) {
  try {
    const data = await createDepartment(departmentData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function updateDepartmentAction(id, departmentData) {
  try {
    const data = await updateDepartment(id, departmentData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function deleteDepartmentAction(id) {
  try {
    const data = await deleteDepartment(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function searchDepartmentsAction(field, condition, value) {
  try {
    const data = await searchDepartments(field, condition, value)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
