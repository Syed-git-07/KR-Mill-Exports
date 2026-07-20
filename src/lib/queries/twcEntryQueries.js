import { prisma } from '../prisma';

/**
 * TWC Entry CRUD Operations
 * VB6 Grid: id, sdate, countname, TWC
 * 
 * NOTE: Requires FK constraint on spinning_count_id -> spinning_counts(id)
 * Run schema/tpi-twc-fk-fix.sql if join fails
 */

// Get all TWC entries
export async function getTWCEntries() {
  try {
    // Get all TWC entries first
    const data = await prisma.twc_entries.findMany({
      orderBy: {
        entry_id: 'asc'
      }
    })

    // Get unique spinning count IDs
    const countIds = [...new Set(data.map(e => e.spinning_count_id).filter(Boolean))];
    
    // Fetch all related spinning counts
    const counts = await prisma.spinning_counts.findMany({
      where: {
        id: { in: countIds }
      },
      select: {
        id: true,
        count_name: true
      }
    });

    // Create lookup map
    const countMap = new Map(counts.map(c => [c.id, c]));

    // Add manual join for spinning_counts
    return data.map(entry => ({
      ...entry,
      spinning_counts: countMap.get(entry.spinning_count_id) || null
    }))
  } catch (error) {
    throw error
  }
}

// Get spinning counts for dropdown
export async function getCountsForDropdown() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: {
        id: true,
        count_name: true
      },
      orderBy: {
        count_name: 'asc'
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Create new TWC entry
export async function createTWCEntry(entryData) {
  try {
    // Convert entry_date string to Date object if needed
    let { entry_date, ...rest } = entryData;
    if (typeof entry_date === 'string') {
      entry_date = new Date(entry_date);
    }

    const data = await prisma.twc_entries.create({
      data: {
        entry_date,
        ...rest
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update TWC entry
export async function updateTWCEntry(id, entryData) {
  try {
    // Convert entry_date string to Date object if needed
    let { entry_date, ...rest } = entryData;
    if (entry_date && typeof entry_date === 'string') {
      entry_date = new Date(entry_date);
    }

    const data = await prisma.twc_entries.update({
      where: { id },
      data: {
        ...(entry_date && { entry_date }),
        ...rest
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Delete TWC entry
export async function deleteTWCEntry(id) {
  try {
    await prisma.twc_entries.delete({
      where: { id }
    })
    return true
  } catch (error) {
    throw error
  }
}

// Search TWC entries
export async function searchTWCEntries(field, condition, value) {
  try {
    let where = {}

    if (value && value.trim() !== '') {
      const numValue = parseFloat(value)
      const isNumber = !isNaN(numValue)

      switch (condition) {
        case 'Like':
          if (!isNumber) {
            where[field] = {
              contains: value
            }
          } else {
            where[field] = numValue
          }
          break
        case 'Equal':
        case '=':
          if (isNumber) {
            where[field] = numValue
          } else {
            where[field] = value
          }
          break
        case 'Not Equal':
          if (isNumber) {
            where[field] = {
              not: numValue
            }
          } else {
            where[field] = {
              not: value
            }
          }
          break
        case 'Greater':
          if (isNumber) {
            where[field] = {
              gt: numValue
            }
          }
          break
        case 'Less':
          if (isNumber) {
            where[field] = {
              lt: numValue
            }
          }
          break
        default:
          where[field] = {
            contains: value
          }
      }
    }

    const data = await prisma.twc_entries.findMany({
      where,
      orderBy: {
        entry_id: 'asc'
      }
    })
    
    // Get unique spinning count IDs
    const countIds = [...new Set(data.map(e => e.spinning_count_id).filter(Boolean))];
    
    // Fetch all related spinning counts
    const counts = await prisma.spinning_counts.findMany({
      where: {
        id: { in: countIds }
      },
      select: {
        id: true,
        count_name: true
      }
    });

    // Create lookup map
    const countMap = new Map(counts.map(c => [c.id, c]));
    
    // Add manual join for spinning_counts
    return data.map(entry => ({
      ...entry,
      spinning_counts: countMap.get(entry.spinning_count_id) || null
    }))
  } catch (error) {
    throw error
  }
}
