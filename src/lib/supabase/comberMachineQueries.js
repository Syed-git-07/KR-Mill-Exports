import { supabase } from '../supabase';

/**
 * Comber Machine Master - CRUD Operations
 * Following the pattern from Department queries
 * NOTE: Comber has additional mc_effi field (Machine Efficiency)
 */

// Get all comber machines
export async function getComberMachines() {
  const { data, error } = await supabase
    .from('comber_machines')
    .select('*')
    .order('machine_no', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get a single comber machine by ID
export async function getComberMachineById(id) {
  const { data, error } = await supabase
    .from('comber_machines')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Create a new comber machine
export async function createComberMachine(machineData) {
  const { data, error } = await supabase
    .from('comber_machines')
    .insert([{
      machine_no: machineData.machine_no,
      mc_id: machineData.mc_id,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      mc_effi: machineData.mc_effi,  // NEW: Machine Efficiency (unique to Comber)
      installed_date: machineData.installed_date,
      is_active: machineData.is_active ?? true,
      direct_hank_entry: machineData.direct_hank_entry ?? false,
      direct_kgs_entry: machineData.direct_kgs_entry ?? false,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update an existing comber machine
export async function updateComberMachine(id, machineData) {
  const { data, error } = await supabase
    .from('comber_machines')
    .update({
      machine_no: machineData.machine_no,
      mc_id: machineData.mc_id,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      mc_effi: machineData.mc_effi,  // NEW: Machine Efficiency (unique to Comber)
      installed_date: machineData.installed_date,
      is_active: machineData.is_active,
      direct_hank_entry: machineData.direct_hank_entry,
      direct_kgs_entry: machineData.direct_kgs_entry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a comber machine
export async function deleteComberMachine(id) {
  const { error } = await supabase
    .from('comber_machines')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search comber machines
export async function searchComberMachines(field, condition, value) {
  let query = supabase
    .from('comber_machines')
    .select('*');

  // Apply search condition based on field and condition type
  switch (condition) {
    case 'contains':
      query = query.ilike(field, `%${value}%`);
      break;
    case 'equals':
      query = query.eq(field, value);
      break;
    case 'startsWith':
      query = query.ilike(field, `${value}%`);
      break;
    case 'endsWith':
      query = query.ilike(field, `%${value}`);
      break;
    default:
      query = query.ilike(field, `%${value}%`);
  }

  query = query.order('machine_no', { ascending: true });

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

// Get active comber machines only
export async function getActiveComberMachines() {
  const { data, error } = await supabase
    .from('comber_machines')
    .select('*')
    .eq('is_active', true)
    .order('machine_no', { ascending: true });

  if (error) throw error;
  return data || [];
}
