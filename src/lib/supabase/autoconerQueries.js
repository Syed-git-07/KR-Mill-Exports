import { supabase } from '../supabase';

/**
 * Autoconer Machine Master CRUD Operations
 */

// Get all autoconer machines
export async function getAutoconerMachines() {
  const { data, error } = await supabase
    .from('autoconer_machines')
    .select('*')
    .order('mc_id', { ascending: true });

  if (error) throw error;
  return data;
}

// Get next available mc_id
export async function getNextMcId() {
  const { data, error } = await supabase
    .from('autoconer_machines')
    .select('mc_id')
    .order('mc_id', { ascending: false })
    .limit(1);

  if (error) throw error;
  
  // Return next available mc_id (max + 1, or 1 if no records)
  return data && data.length > 0 ? (data[0].mc_id || 0) + 1 : 1;
}

// Create new autoconer machine
export async function createAutoconerMachine(machineData) {
  // Auto-generate mc_id if not provided
  if (!machineData.mc_id) {
    machineData.mc_id = await getNextMcId();
  }

  const { data, error } = await supabase
    .from('autoconer_machines')
    .insert([machineData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update autoconer machine
export async function updateAutoconerMachine(id, machineData) {
  const { data, error } = await supabase
    .from('autoconer_machines')
    .update(machineData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete autoconer machine
export async function deleteAutoconerMachine(id) {
  const { error } = await supabase
    .from('autoconer_machines')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search autoconer machines
export async function searchAutoconerMachines(field, condition, value) {
  let query = supabase.from('autoconer_machines').select('*');

  // Define numeric fields for proper type conversion
  const numericFields = ['mc_id', 'group_id', 'from_drum', 'to_drum', 'no_of_drums', 'act_effi'];
  const decimalFields = ['speed'];
  const booleanFields = ['is_active', 'direct_prod_entry'];
  const dateFields = ['installed_date'];

  if (value && value.trim() !== '') {
    switch (condition) {
      case 'Like':
        query = query.ilike(field, `%${value}%`);
        break;
      case 'Equal':
        if (numericFields.includes(field)) {
          query = query.eq(field, parseInt(value));
        } else if (decimalFields.includes(field)) {
          query = query.eq(field, parseFloat(value));
        } else if (booleanFields.includes(field)) {
          query = query.eq(field, value.toLowerCase() === 'true' || value.toLowerCase() === 'yes');
        } else if (dateFields.includes(field)) {
          query = query.eq(field, value);
        } else {
          query = query.eq(field, value);
        }
        break;
      case 'Not Equal':
        if (numericFields.includes(field)) {
          query = query.neq(field, parseInt(value));
        } else if (decimalFields.includes(field)) {
          query = query.neq(field, parseFloat(value));
        } else if (booleanFields.includes(field)) {
          query = query.neq(field, value.toLowerCase() === 'true' || value.toLowerCase() === 'yes');
        } else {
          query = query.neq(field, value);
        }
        break;
      case 'Greater':
        if (numericFields.includes(field)) {
          query = query.gt(field, parseInt(value));
        } else if (decimalFields.includes(field)) {
          query = query.gt(field, parseFloat(value));
        } else if (dateFields.includes(field)) {
          query = query.gt(field, value);
        }
        break;
      case 'Less':
        if (numericFields.includes(field)) {
          query = query.lt(field, parseInt(value));
        } else if (decimalFields.includes(field)) {
          query = query.lt(field, parseFloat(value));
        } else if (dateFields.includes(field)) {
          query = query.lt(field, value);
        }
        break;
    }
  }

  query = query.order('machine_no', { ascending: true });
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
