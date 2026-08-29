import { prisma } from '../prisma'
import { buildTypedSearchWhere } from '../masterSearch'
import { softDeleteMasterRecord } from './masterSoftDelete'

/**
 * Spinning Count Master CRUD Operations
 */

// Get all spinning counts
export async function getSpinningCounts() {
  const data = await prisma.spinning_counts.findMany({
    where: { is_active: true },
    orderBy: { count_name: 'asc' }
  });

  return data || []
}

// Create new spinning count
export async function createSpinningCount(countData) {
  // Remove any undefined or empty values, system fields, and set proper nulls
  const cleanData = {}
  for (const [key, value] of Object.entries(countData)) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') {
      // Skip system fields
      continue
    }
    if (value !== undefined && value !== '') {
      cleanData[key] = value
    } else if (value === '' || value === null) {
      // Set null for empty optional fields
      cleanData[key] = null
    }
  }
  
  // Ensure required fields are present
  if (!cleanData.count_name) {
    throw new Error('Count Name is required')
  }
  if (!cleanData.act_count && cleanData.act_count !== 0) {
    throw new Error('Act Count is required')
  }
  
  cleanData.is_active = true
  
  try {
    const data = await prisma.spinning_counts.create({
      data: cleanData
    });
    
    return data
  } catch (error) {
    console.error('Create error details:', error)
    throw error
  }
}

// Update spinning count
export async function updateSpinningCount(id, countData) {
  if (!id) {
    throw new Error('No ID provided for update')
  }
  
  // First check if record exists
  try {
    const existingRecord = await prisma.spinning_counts.findUnique({
      where: { id }
    });
    
    if (!existingRecord) {
      throw new Error(`Record with ID ${id} not found`)
    }
    
    // Remove system fields and prepare clean data
    const cleanData = {}
    for (const [key, value] of Object.entries(countData)) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at' || key === 'is_active') {
        // Skip system fields
        continue
      }
      if (value !== undefined && value !== null && value !== '') {
        cleanData[key] = value
      } else if (value === null || value === '') {
        // Explicitly set null for empty values
        cleanData[key] = null
      }
    }
    
    // Dated machine setups are entry snapshots. Count Master changes are used
    // only when a future setup is initialized or an entry count is changed.
    const data = await prisma.spinning_counts.update({
      where: { id },
      data: cleanData
    })
    
    return data
  } catch (error) {
    console.error('Update error details:', error)
    throw error
  }
}

// Soft-delete a spinning count while retaining machine and entry snapshots.
export async function deleteSpinningCount(id) {
  return softDeleteMasterRecord(prisma.spinning_counts, id, {
    recordLabel: 'Spinning count'
  })
}

// Search spinning counts
export async function searchSpinningCounts(field, condition, value) {
  const whereClause = {
    is_active: true,
    ...buildTypedSearchWhere(field, condition, value, { count_name: 'text' })
  };

  const data = await prisma.spinning_counts.findMany({
    where: whereClause,
    orderBy: { count_name: 'asc' }
  });

  return data || []
}
