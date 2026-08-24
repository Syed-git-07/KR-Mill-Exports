import { findActivePayrollEmployeeById } from './employees'

function normalizedName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN')
}

/**
 * Canonicalize employee fields before a production-detail update.
 * Existing unresolved legacy names may remain unchanged, but every new or
 * changed non-empty value must identify one employee in the configured payroll
 * company by its payroll primary key.
 */
export async function preparePayrollEmployeeUpdate(updates, current, bindings) {
  const prepared = { ...(updates || {}) }

  for (const { nameField, idField } of bindings) {
    const touchesName = Object.hasOwn(prepared, nameField)
    const touchesId = Object.hasOwn(prepared, idField)
    if (!touchesName && !touchesId) continue

    const nextName = String(touchesName ? prepared[nameField] || '' : current?.[nameField] || '').trim()
    const rawId = touchesId ? prepared[idField] : current?.[idField]
    const nextId = rawId === null || rawId === undefined || rawId === '' ? null : Number(rawId)

    if (nextId === null) {
      if (!nextName) {
        prepared[nameField] = null
        prepared[idField] = null
        continue
      }

      const unchangedLegacyName = current?.[idField] == null &&
        normalizedName(current?.[nameField]) === normalizedName(nextName)
      if (unchangedLegacyName) {
        prepared[nameField] = String(current[nameField]).trim()
        prepared[idField] = null
        continue
      }

      throw new Error('Select the employee from the payroll suggestions; a typed name alone cannot be saved.')
    }

    if (!Number.isSafeInteger(nextId) || nextId <= 0) {
      throw new Error('Invalid payroll employee ID.')
    }

    const employee = await findActivePayrollEmployeeById(nextId)
    if (!employee) {
      throw new Error('The selected employee is not active in the configured payroll company.')
    }

    prepared[idField] = Number(employee.id)
    prepared[nameField] = String(employee.emp_name || '').trim()
  }

  return prepared
}
