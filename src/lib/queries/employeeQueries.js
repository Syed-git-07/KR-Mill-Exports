import { PrismaClient } from '@prisma/client'
import mysql from 'mysql2/promise'

const prisma = new PrismaClient()

let payrollPool

function getPayrollPool() {
  if (payrollPool) return payrollPool

  // Hardcoded payroll DB connection (as requested).
  payrollPool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Alan@2005',
    database: 'payroll',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  })

  return payrollPool
}

async function searchEmployeesFromPayroll(searchTerm = '', limit = 10) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(50, Number(limit))) : 10
  const term = String(searchTerm || '').trim()

  const baseSql = `
    SELECT
      e.firstName,
      e.biometricEnrollmentId,
      d.departmentname
    FROM employees e
    JOIN departments d ON d.id = e.departmentId
  `

  const sql = term
    ? `${baseSql} WHERE e.firstName LIKE ? ORDER BY e.firstName ASC LIMIT ?`
    : `${baseSql} ORDER BY e.firstName ASC LIMIT ?`

  // Prefix-only search: "ABI" => ABINAYA, ABINATH (not KABIN)
  const params = term ? [`${term}%`, safeLimit] : [safeLimit]
  const [rows] = await getPayrollPool().query(sql, params)

  return (rows || []).map((row, index) => ({
    id: String(row.biometricEnrollmentId ?? `${row.firstName}-${index}`),
    emp_name: row.firstName || '',
    emp_code: row.biometricEnrollmentId ? String(row.biometricEnrollmentId) : null,
    department: row.departmentname || null,
    designation: null
  }))
}

// ============================================
// EMPLOYEE MASTER QUERIES
// ============================================

/**
 * Search employees by name (autocomplete/typeahead)
 * @param {string} searchTerm - Partial name to search for
 * @param {number} limit - Maximum number of results (default: 10)
 * @returns {Promise<Array>} List of matching employees
 */
export async function searchEmployees(searchTerm = '', limit = 10) {
  try {
    return await searchEmployeesFromPayroll(searchTerm, limit)
  } catch (payrollError) {
    console.error('Payroll DB employee search failed, falling back to employee_master:', payrollError)
  }

  try {
    if (!searchTerm || searchTerm.trim().length === 0) {
      // If no search term, return recent/all active employees
      return await prisma.employee_master.findMany({
        where: { is_active: true },
        select: {
          id: true,
          emp_name: true,
          emp_code: true,
          department: true,
          designation: true
        },
        orderBy: { emp_name: 'asc' },
        take: limit
      })
    }

    // Prefix-only search (case-insensitive by DB collation)
    const data = await prisma.employee_master.findMany({
      where: {
        is_active: true,
        emp_name: {
          startsWith: searchTerm.trim()
        }
      },
      select: {
        id: true,
        emp_name: true,
        emp_code: true,
        department: true,
        designation: true
      },
      orderBy: { emp_name: 'asc' },
      take: limit
    })

    return data
  } catch (error) {
    console.error('Error searching employees:', error)
    throw error
  }
}

/**
 * Get all active employees
 * @returns {Promise<Array>} List of all active employees
 */
export async function getAllEmployees() {
  try {
    const data = await prisma.employee_master.findMany({
      where: { is_active: true },
      select: {
        id: true,
        emp_name: true,
        emp_code: true,
        department: true,
        designation: true
      },
      orderBy: { emp_name: 'asc' }
    })
    return data
  } catch (error) {
    console.error('Error fetching all employees:', error)
    throw error
  }
}

/**
 * Add a new employee
 * @param {Object} employeeData - Employee information
 * @returns {Promise<Object>} Created employee
 */
export async function addEmployee(employeeData) {
  try {
    const data = await prisma.employee_master.create({
      data: {
        emp_name: employeeData.emp_name.trim(),
        emp_code: employeeData.emp_code?.trim() || null,
        department: employeeData.department?.trim() || null,
        designation: employeeData.designation?.trim() || null,
        is_active: employeeData.is_active !== undefined ? employeeData.is_active : true
      }
    })
    return data
  } catch (error) {
    console.error('Error adding employee:', error)
    throw error
  }
}

/**
 * Update employee details
 * @param {string} id - Employee ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated employee
 */
export async function updateEmployee(id, updates) {
  try {
    const data = await prisma.employee_master.update({
      where: { id },
      data: updates
    })
    return data
  } catch (error) {
    console.error('Error updating employee:', error)
    throw error
  }
}

/**
 * Deactivate an employee (soft delete)
 * @param {string} id - Employee ID
 * @returns {Promise<Object>} Updated employee
 */
export async function deactivateEmployee(id) {
  try {
    const data = await prisma.employee_master.update({
      where: { id },
      data: { is_active: false }
    })
    return data
  } catch (error) {
    console.error('Error deactivating employee:', error)
    throw error
  }
}

/**
 * Check if employee name already exists
 * @param {string} empName - Employee name to check
 * @param {string} excludeId - Employee ID to exclude (for updates)
 * @returns {Promise<boolean>} True if exists
 */
export async function checkEmployeeExists(empName, excludeId = null) {
  try {
    const existing = await prisma.employee_master.findFirst({
      where: {
        emp_name: empName.trim(),
        ...(excludeId && { id: { not: excludeId } })
      }
    })
    return !!existing
  } catch (error) {
    console.error('Error checking employee existence:', error)
    throw error
  }
}
