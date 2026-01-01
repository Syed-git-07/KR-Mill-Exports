import { supabase } from '../supabase';

/**
 * Stoppage Head Master CRUD Operations
 */

// Get all stoppage heads
export async function getStoppageHeads() {
  const { data, error } = await supabase
    .from('stoppage_heads')
    .select('*')
    .order('code', { ascending: true });

  if (error) throw error;
  return data;
}

// Create new stoppage head
export async function createStoppageHead(stoppageData) {
  // If code is not provided, get next value from sequence
  if (!stoppageData.code) {
    const { data: seqData, error: seqError } = await supabase.rpc('nextval', { 
      sequence_name: 'stoppage_heads_code_seq' 
    });
    
    if (seqError) {
      // Fallback: get max code + 1
      const { data: maxData } = await supabase
        .from('stoppage_heads')
        .select('code')
        .order('code', { ascending: false })
        .limit(1);
      
      stoppageData.code = maxData && maxData[0] ? maxData[0].code + 1 : 1;
    } else {
      stoppageData.code = seqData;
    }
  }

  const { data, error } = await supabase
    .from('stoppage_heads')
    .insert([stoppageData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update stoppage head
export async function updateStoppageHead(id, stoppageData) {
  const { data, error } = await supabase
    .from('stoppage_heads')
    .update(stoppageData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete stoppage head
export async function deleteStoppageHead(id) {
  const { error } = await supabase
    .from('stoppage_heads')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search stoppage heads
export async function searchStoppageHeads(field, condition, value) {
  let query = supabase.from('stoppage_heads').select('*');

  if (value && value.trim() !== '') {
    const trimmedValue = value.trim();
    
    switch (condition) {
      case 'Like':
        if (field === 'code') {
          // For code field, use exact match
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.eq(field, numValue);
          }
        } else {
          query = query.ilike(field, `%${trimmedValue}%`);
        }
        break;
      case 'Equal':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.eq(field, numValue);
          }
        } else {
          query = query.eq(field, trimmedValue);
        }
        break;
      case 'Not Equal':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.neq(field, numValue);
          }
        } else {
          query = query.neq(field, trimmedValue);
        }
        break;
      case 'Greater':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.gt(field, numValue);
          }
        }
        break;
      case 'Less':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.lt(field, numValue);
          }
        }
        break;
    }
  }

  query = query.order('code', { ascending: true });
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

