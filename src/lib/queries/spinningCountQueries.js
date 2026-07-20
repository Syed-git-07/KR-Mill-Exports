import { prisma } from '../prisma'

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
  console.log('Create called with data:', countData)
  
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
  
  console.log('Clean data to insert:', cleanData)
  
  try {
    const data = await prisma.spinning_counts.create({
      data: cleanData
    });
    
    console.log('Create successful:', data)
    return data
  } catch (error) {
    console.error('Create error details:', error)
    throw error
  }
}

// Update spinning count
export async function updateSpinningCount(id, countData) {
  console.log('Update called with ID:', id)
  console.log('Update data:', countData)
  
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
    
    console.log('Existing record found:', existingRecord)
    
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
    
    console.log('Clean data to update:', cleanData)
    
    const data = await prisma.spinning_counts.update({
      where: { id },
      data: cleanData
    });
    
    console.log('Update successful:', data)
    return data
  } catch (error) {
    console.error('Update error details:', error)
    throw error
  }
}

// Delete spinning count
export async function deleteSpinningCount(id) {
  await prisma.spinning_counts.delete({
    where: { id }
  });

  return true
}

// Search spinning counts
export async function searchSpinningCounts(field, condition, value) {
  const numericFields = ['act_count', 'tpi', 'twist_multiplier'];
  let whereClause = { is_active: true };

  if (value && value.trim() !== '') {
    switch (condition) {
      case 'Like':
        // MySQL doesn't support mode: 'insensitive', string comparisons are case-insensitive by default
        whereClause[field] = { contains: value };
        break;
      case 'Equal':
        if (numericFields.includes(field)) {
          whereClause[field] = parseFloat(value);
        } else {
          whereClause[field] = value;
        }
        break;
      case 'Not Equal':
        if (numericFields.includes(field)) {
          whereClause[field] = { not: parseFloat(value) };
        } else {
          whereClause[field] = { not: value };
        }
        break;
      case 'Greater':
        if (numericFields.includes(field)) {
          whereClause[field] = { gt: parseFloat(value) };
        }
        break;
      case 'Less':
        if (numericFields.includes(field)) {
          whereClause[field] = { lt: parseFloat(value) };
        }
        break;
    }
  }

  const data = await prisma.spinning_counts.findMany({
    where: whereClause,
    orderBy: { count_name: 'asc' }
  });

  return data || []
}
