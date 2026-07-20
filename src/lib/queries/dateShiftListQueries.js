import { prisma } from '../prisma'

// ============================================
// GENERIC DATE/SHIFT LIST QUERIES
// ============================================

/**
 * Get all existing production headers (date + shift) for a given module.
 * Returns a Set-like structure for quick lookup.
 * 
 * @param {string} tableName - Prisma model name e.g. 'carding_production_header'
 * @returns {Array} - Array of { entry_date, shift, id }
 */
export async function getExistingHeaders(tableName) {
  try {
    const model = prisma[tableName]
    if (!model) {
      throw new Error(`Unknown table: ${tableName}`)
    }

    const headers = await model.findMany({
      select: {
        id: true,
        entry_date: true,
        shift: true,
      },
      orderBy: [
        { entry_date: 'asc' },
        { shift: 'asc' }
      ]
    })

    return headers.map(h => ({
      id: h.id,
      entry_date: h.entry_date instanceof Date 
        ? h.entry_date.toISOString().split('T')[0] 
        : String(h.entry_date).split('T')[0],
      shift: h.shift
    }))
  } catch (error) {
    console.error(`Error fetching headers for ${tableName}:`, error)
    throw error
  }
}

/**
 * Build a complete date/shift list for a given date range.
 * Each date gets 3 entries (shift 1, 2, 3).
 * Marks which ones already have data (existing header).
 * 
 * @param {string} tableName - Prisma model name
 * @param {string} fromDate - Start date YYYY-MM-DD
 * @param {string} toDate - End date YYYY-MM-DD
 * @returns {Object} - { entries: Array, totalCount, existingCount }
 */
export async function getDateShiftList(tableName, fromDate, toDate) {
  try {
    const model = prisma[tableName]
    if (!model) {
      throw new Error(`Unknown table: ${tableName}`)
    }

    const start = new Date(fromDate + 'T00:00:00')
    const end = new Date(toDate + 'T23:59:59')

    const headers = await model.findMany({
      where: {
        entry_date: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        entry_date: true,
        shift: true,
      },
      orderBy: [
        { entry_date: 'asc' },
        { shift: 'asc' }
      ]
    })

    const entries = headers.map(h => {
      const dateStr = h.entry_date instanceof Date 
        ? h.entry_date.toISOString().split('T')[0] 
        : String(h.entry_date).split('T')[0]
      return {
        entry_date: dateStr,
        shift: h.shift,
        headerId: h.id,
        hasData: true
      }
    })

    return {
      entries,
      totalCount: entries.length,
      existingCount: entries.length
    }
  } catch (error) {
    console.error(`Error building date/shift list for ${tableName}:`, error)
    throw error
  }
}
