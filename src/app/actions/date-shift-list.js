'use server'

import { serializeData } from '@/lib/serialize'
import * as dateShiftQueries from '@/lib/queries/dateShiftListQueries'

/**
 * Get the date/shift list for any production module.
 * 
 * @param {string} tableName - Prisma model name (e.g. 'carding_production_header')
 * @param {string} fromDate - Start date YYYY-MM-DD
 * @param {string} toDate - End date YYYY-MM-DD
 */
export async function getDateShiftListAction(tableName, fromDate, toDate) {
  try {
    // Whitelist allowed table names for security
    const allowedTables = [
      'carding_production_header',
      'breaker_drawing_production_header',
      'comber_production_header',
      'finisher_drawing_production_header',
      'lap_former_production_header',
      'simplex_production_header',
      'spinning_production_header',
      'autoconer_production_header'
    ]

    if (!allowedTables.includes(tableName)) {
      return { success: false, error: `Invalid table: ${tableName}` }
    }

    const data = await dateShiftQueries.getDateShiftList(tableName, fromDate, toDate)
    return { success: true, data: serializeData(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
