import { supabase } from '../supabase';

/**
 * Department Master CRUD Operations
 */

// Get all departments
export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, code, dept_name, sl_no, hok, is_active')
    .order('sl_no', { ascending: true });

  if (error) throw error;
  return data;
}

// Create new department
export async function createDepartment(departmentData) {
  const { data, error } = await supabase
    .from('departments')
    .insert([departmentData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update department
export async function updateDepartment(id, departmentData) {
  const { data, error } = await supabase
    .from('departments')
    .update(departmentData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete department
export async function deleteDepartment(id) {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search departments
export async function searchDepartments(field, condition, value) {
  let query = supabase.from('departments').select('id, code, dept_name, sl_no, hok, is_active');

  if (value && value.trim() !== '') {
    // Clean the value
    const trimmedValue = value.trim();
    
    switch (condition) {
      case 'Like':
        // For numeric fields with Like, convert to string search
        if (field === 'sl_no' || field === 'code') {
          query = query.or(`sl_no.eq.${trimmedValue},code.eq.${trimmedValue}`);
        } else {
          query = query.ilike(field, `%${trimmedValue}%`);
        }
        break;
      case 'Equal':
        if (field === 'sl_no' || field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.eq(field, numValue);
          }
        } else {
          query = query.eq(field, trimmedValue);
        }
        break;
      case 'Not Equal':
        if (field === 'sl_no' || field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.neq(field, numValue);
          }
        } else {
          query = query.neq(field, trimmedValue);
        }
        break;
      case 'Greater':
        if (field === 'sl_no' || field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.gt(field, numValue);
          }
        }
        break;
      case 'Less':
        if (field === 'sl_no' || field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            query = query.lt(field, numValue);
          }
        }
        break;
    }
  }

  query = query.order('sl_no', { ascending: true });
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
