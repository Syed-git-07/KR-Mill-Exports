'use server'

import { requireUser } from '@/lib/security/auth'
import { safeActionError } from '@/lib/security/errors'
import { serializeData } from '@/lib/serialize'
import { searchEmployees } from '@/lib/queries/employeeQueries'

export async function searchEmployeesAction(searchTerm = '', limit = 10) {
  await requireUser()
  try {
    const data = await searchEmployees(searchTerm, limit)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: safeActionError(error) }
  }
}
