import { supabase } from '../supabase';

/**
 * Supervisor Master CRUD Operations
 */

// Get all supervisors with department info
export async function getSupervisors() {
  const { data, error } = await supabase
    .from('supervisors')
    .select(`
      *,
      departments:departments(id, dept_name)
    `)
    .order('code', { ascending: true });

  if (error) throw error;
  return data;
}

// Create new supervisor
export async function createSupervisor(supervisorData) {
  const { data, error } = await supabase
    .from('supervisors')
    .insert([supervisorData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update supervisor
export async function updateSupervisor(id, supervisorData) {
  const { data, error } = await supabase
    .from('supervisors')
    .update(supervisorData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete supervisor
export async function deleteSupervisor(id) {
  const { error } = await supabase
    .from('supervisors')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search supervisors
export async function searchSupervisors(field, condition, value) {
  let query = supabase.from('supervisors').select(`
    *,
    departments:departments(id, dept_name)
  `);

  if (value && value.trim() !== '') {
    switch (condition) {
      case 'Like':
        query = query.ilike(field, `%${value}%`);
        break;
      case 'Equal':
        if (field === 'code') {
          query = query.eq(field, parseInt(value));
        } else {
          query = query.eq(field, value);
        }
        break;
      case 'Not Equal':
        query = query.neq(field, value);
        break;
      case 'Greater':
        if (field === 'code') {
          query = query.gt(field, parseInt(value));
        }
        break;
      case 'Less':
        if (field === 'code') {
          query = query.lt(field, parseInt(value));
        }
        break;
    }
  }

  query = query.order('code', { ascending: true });
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Get all departments for dropdown
export async function getDepartmentsForDropdown() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, dept_name')
    .eq('is_active', true)
    .order('dept_name', { ascending: true });

  if (error) throw error;
  return data;
}
