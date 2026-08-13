'use server'

import { requireUser } from '@/lib/security/auth'

import { safeActionError } from '@/lib/security/errors'

import { serializeData } from '@/lib/serialize'
import * as queries from '@/lib/queries/employeeQueries'

// ============================================
// EMPLOYEE MASTER ACTIONS
// ============================================

/**
 * Search employees by name (for autocomplete)
 * @param {string} searchTerm - Partial name to search
 * @param {number} limit - Max results
 */
export async function searchEmployeesAction(searchTerm = '', limit = 10) {
  await requireUser()
  try {
    const data = await queries.searchEmployees(searchTerm, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

/**
 * Get all active employees
 */
export async function getAllEmployeesAction() {
  await requireUser()
  try {
    const data = await queries.getAllEmployees()
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

/**
 * Add a new employee
 */
export async function addEmployeeAction(employeeData) {
  await requireUser()
  try {
    const data = await queries.addEmployee(employeeData)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

/**
 * Update employee details
 */
export async function updateEmployeeAction(id, updates) {
  await requireUser()
  try {
    const data = await queries.updateEmployee(id, updates)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

/**
 * Deactivate an employee
 */
export async function deactivateEmployeeAction(id) {
  await requireUser()
  try {
    const data = await queries.deactivateEmployee(id)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}

/**
 * Check if employee name exists
 */
export async function checkEmployeeExistsAction(empName, excludeId = null) {
  await requireUser()
  try {
    const exists = await queries.checkEmployeeExists(empName, excludeId)
    return { success: true, data: exists }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
