import { supabase } from '../supabase'

/**
 * Spinning Count Master CRUD Operations
 */

// Get all spinning counts
export async function getSpinningCounts() {
  const { data, error } = await supabase
    .from('spinning_counts')
    .select('*')
    .eq('is_active', true)
    .order('count_name', { ascending: true })

  if (error) throw error
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
  
  const { data, error } = await supabase
    .from('spinning_counts')
    .insert([cleanData])
    .select()
    .single()

  if (error) {
    console.error('Create error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw error
  }
  
  console.log('Create successful:', data)
  return data
}

// Update spinning count
export async function updateSpinningCount(id, countData) {
  console.log('Update called with ID:', id)
  console.log('Update data:', countData)
  
  if (!id) {
    throw new Error('No ID provided for update')
  }
  
  // First check if record exists
  const { data: existingRecord, error: checkError } = await supabase
    .from('spinning_counts')
    .select('*')
    .eq('id', id)
    .single()
  
  if (checkError) {
    console.error('Record check error:', checkError)
    throw new Error(`Record with ID ${id} not found: ${checkError.message}`)
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
  
  // Perform update WITHOUT .single() first
  const { data, error, count } = await supabase
    .from('spinning_counts')
    .update(cleanData)
    .eq('id', id)
    .select()
  
  console.log('Update response:', { data, error, count })

  if (error) {
    console.error('Update error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw error
  }
  
  if (!data || data.length === 0) {
    throw new Error('Update succeeded but no data returned')
  }
  
  console.log('Update successful:', data[0])
  return data[0]
}

// Delete spinning count
export async function deleteSpinningCount(id) {
  const { error } = await supabase
    .from('spinning_counts')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

// Search spinning counts
export async function searchSpinningCounts(field, condition, value) {
  let query = supabase
    .from('spinning_counts')
    .select('*')
    .eq('is_active', true)

  if (value && value.trim() !== '') {
    const trimmedValue = value.trim()
    const numValue = parseFloat(trimmedValue)
    const isNumber = !isNaN(numValue)

    switch (condition) {
      case 'Like':
        if (field === 'count_name') {
          query = query.ilike(field, `%${trimmedValue}%`)
        } else if (isNumber) {
          query = query.eq(field, numValue)
        }
        break
      case 'Equal':
        if (isNumber) {
          query = query.eq(field, numValue)
        } else {
          query = query.eq(field, trimmedValue)
        }
        break
      case 'Not Equal':
        if (isNumber) {
          query = query.neq(field, numValue)
        } else {
          query = query.neq(field, trimmedValue)
        }
        break
      case 'Greater':
        if (isNumber) {
          query = query.gt(field, numValue)
        }
        break
      case 'Less':
        if (isNumber) {
          query = query.lt(field, numValue)
        }
        break
      default:
        query = query.ilike(field, `%${trimmedValue}%`)
    }
  }

  const { data, error } = await query.order('count_name', { ascending: true })

  if (error) throw error
  return data || []
}
