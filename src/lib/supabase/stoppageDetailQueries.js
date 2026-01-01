import { supabase } from '../supabase'

/**
 * Get all stoppage details with joined data
 */
export async function getStoppageDetails() {
  const { data, error } = await supabase
    .from('stoppage_details')
    .select(`
      *,
      stoppage_heads!inner(stoppage_head_name),
      departments!inner(dept_name)
    `)
    .order('code', { ascending: true })

  if (error) throw error
  
  // Format data for display
  return (data || []).map(item => ({
    ...item,
    stoppage_head_name: item.stoppage_heads?.stoppage_head_name || '',
    dept_name: item.departments?.dept_name || ''
  }))
}

/**
 * Get stoppage detail by ID
 */
export async function getStoppageDetailById(id) {
  const { data, error } = await supabase
    .from('stoppage_details')
    .select(`
      *,
      stoppage_head:stoppage_heads(id, stoppage_head_name),
      department:departments(id, dept_name)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Create new stoppage detail
 */
export async function createStoppageDetail(stoppageDetailData) {
  // Auto-generate code if not provided
  let code = stoppageDetailData.code
  
  if (!code) {
    // Try to get next value from sequence
    const { data: seqData, error: seqError } = await supabase
      .rpc('nextval', { sequence_name: 'stoppage_details_code_seq' })
    
    if (!seqError && seqData) {
      code = seqData
    } else {
      // Fallback: get max code and increment
      const { data: maxData } = await supabase
        .from('stoppage_details')
        .select('code')
        .order('code', { ascending: false })
        .limit(1)
        .single()
      
      code = maxData ? maxData.code + 1 : 1447
    }
  }

  const { data, error } = await supabase
    .from('stoppage_details')
    .insert([{ ...stoppageDetailData, code }])
    .select(`
      *,
      stoppage_heads!inner(stoppage_head_name),
      departments!inner(dept_name)
    `)
    .single()

  if (error) throw error
  
  // Format data for display
  return {
    ...data,
    stoppage_head_name: data.stoppage_heads?.stoppage_head_name || '',
    dept_name: data.departments?.dept_name || ''
  }
}

/**
 * Update stoppage detail
 */
export async function updateStoppageDetail(id, stoppageDetailData) {
  const { data, error } = await supabase
    .from('stoppage_details')
    .update(stoppageDetailData)
    .eq('id', id)
    .select(`
      *,
      stoppage_heads!inner(stoppage_head_name),
      departments!inner(dept_name)
    `)
    .single()

  if (error) throw error
  
  // Format data for display
  return {
    ...data,
    stoppage_head_name: data.stoppage_heads?.stoppage_head_name || '',
    dept_name: data.departments?.dept_name || ''
  }
}

/**
 * Delete stoppage detail
 */
export async function deleteStoppageDetail(id) {
  const { error } = await supabase
    .from('stoppage_details')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

/**
 * Search stoppage details
 */
export async function searchStoppageDetails(field, condition, value) {
  let query = supabase
    .from('stoppage_details')
    .select(`
      *,
      stoppage_heads!inner(stoppage_head_name),
      departments!inner(dept_name)
    `)

  const trimmedValue = value.trim()

  // Handle numeric fields
  const numericFields = ['code']
  const isNumericField = numericFields.includes(field)

  if (condition === 'Like') {
    if (isNumericField) {
      // For numeric fields, use exact match with Like
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        query = query.eq(field, numValue)
      }
    } else if (field === 'stoppage_head_name') {
      // Search in joined stoppage_heads table
      query = query.ilike('stoppage_heads.stoppage_head_name', `%${trimmedValue}%`)
    } else if (field === 'dept_name') {
      // Search in joined departments table
      query = query.ilike('departments.dept_name', `%${trimmedValue}%`)
    } else {
      query = query.ilike(field, `%${trimmedValue}%`)
    }
  } else if (condition === 'Equal') {
    if (isNumericField) {
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        query = query.eq(field, numValue)
      }
    } else if (field === 'stoppage_head_name') {
      query = query.ilike('stoppage_heads.stoppage_head_name', trimmedValue)
    } else if (field === 'dept_name') {
      query = query.ilike('departments.dept_name', trimmedValue)
    } else {
      query = query.eq(field, trimmedValue)
    }
  } else if (condition === 'Not Equal') {
    if (isNumericField) {
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        query = query.neq(field, numValue)
      }
    } else {
      query = query.neq(field, trimmedValue)
    }
  } else if (condition === 'Greater') {
    if (isNumericField) {
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        query = query.gt(field, numValue)
      }
    }
  } else if (condition === 'Less') {
    if (isNumericField) {
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        query = query.lt(field, numValue)
      }
    }
  }

  query = query.order('code', { ascending: true })

  const { data, error } = await query

  if (error) throw error
  
  // Format data for display
  return (data || []).map(item => ({
    ...item,
    stoppage_head_name: item.stoppage_heads?.stoppage_head_name || '',
    dept_name: item.departments?.dept_name || ''
  }))
}

/**
 * Get all stoppage heads for dropdown
 */
export async function getStoppageHeads() {
  const { data, error } = await supabase
    .from('stoppage_heads')
    .select('id, stoppage_head_name')
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Get all departments for dropdown
 */
export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, dept_name')
    .eq('is_active', true)
    .order('sl_no', { ascending: true })

  if (error) throw error
  return data || []
}
