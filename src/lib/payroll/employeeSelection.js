import { findActivePayrollEmployeeById, getPayrollEmployeeById } from './employees'

/**
 * Canonicalize employee fields before a production-detail update.
 * A non-empty employee value must identify one employee in the configured
 * payroll company by its payroll primary key. An unchanged historical payroll
 * ID may refer to an inactive employee; a newly selected ID must be active.
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
    const currentName = String(current?.[nameField] || '').trim()
    const currentId = current?.[idField] == null || current?.[idField] === ''
      ? null
      : Number(current[idField])

    if (nextId === null) {
      if (!nextName) {
        prepared[nameField] = null
        prepared[idField] = null
        continue
      }

      // Historical rows can be edited without forcing an identity change. An
      // unresolved snapshot is retained only when both its name and missing ID
      // are exactly unchanged; new or modified text still requires Payroll.
      const retainsUnchangedLegacySnapshot = currentId === null && currentName && nextName === currentName
      if (retainsUnchangedLegacySnapshot) {
        prepared[nameField] = currentName
        prepared[idField] = null
        continue
      }

      throw new Error('Select the employee from the payroll suggestions; a typed name alone cannot be saved.')
    }

    if (!Number.isSafeInteger(nextId) || nextId <= 0) {
      throw new Error('Invalid payroll employee ID.')
    }

    const isUnchangedEmployee = currentId === nextId
    const employee = isUnchangedEmployee
      ? await getPayrollEmployeeById(nextId)
      : await findActivePayrollEmployeeById(nextId)
    if (!employee) {
      throw new Error(isUnchangedEmployee
        ? 'The stored employee no longer exists in the configured payroll company.'
        : 'The selected employee is not active in the configured payroll company.')
    }

    prepared[idField] = Number(employee.id)
    prepared[nameField] = String(employee.emp_name || '').trim()
  }

  return prepared
}
