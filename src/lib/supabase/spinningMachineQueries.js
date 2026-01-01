import { supabase } from '../supabase';

/**
 * Spinning Machine Master CRUD Operations
 */

// Get all spinning machines
export async function getSpinningMachines() {
  const { data, error } = await supabase
    .from('spinning_machines')
    .select('*')
    .order('machine_no', { ascending: true });

  if (error) throw error;
  return data;
}

// Create new spinning machine
export async function createSpinningMachine(machineData) {
  const { data, error } = await supabase
    .from('spinning_machines')
    .insert([machineData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update spinning machine
export async function updateSpinningMachine(id, machineData) {
  const { data, error } = await supabase
    .from('spinning_machines')
    .update(machineData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete spinning machine
export async function deleteSpinningMachine(id) {
  const { error } = await supabase
    .from('spinning_machines')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search spinning machines
export async function searchSpinningMachines(field, condition, value) {
  let query = supabase.from('spinning_machines').select('*');

  if (value && value.trim() !== '') {
    switch (condition) {
      case 'Like':
        query = query.ilike(field, `%${value}%`);
        break;
      case 'Equal':
        if (field === 'spindles') {
          query = query.eq(field, parseInt(value));
        } else if (field === 'is_active') {
          query = query.eq(field, value.toLowerCase() === 'true');
        } else {
          query = query.eq(field, value);
        }
        break;
      case 'Not Equal':
        if (field === 'spindles') {
          query = query.neq(field, parseInt(value));
        } else {
          query = query.neq(field, value);
        }
        break;
      case 'Greater':
        if (field === 'spindles') {
          query = query.gt(field, parseInt(value));
        }
        break;
      case 'Less':
        if (field === 'spindles') {
          query = query.lt(field, parseInt(value));
        }
        break;
    }
  }

  query = query.order('machine_no', { ascending: true });
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
