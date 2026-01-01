import { supabase } from '../supabase';

/**
 * Simplex Machine Master - CRUD Operations
 * Following the pattern from Department queries
 * NOTE: Simplex has 3 additional fields: mc_effi, tpi, no_of_spindles
 */

// Get all simplex machines
export async function getSimplexMachines() {
  const { data, error } = await supabase
    .from('simplex_machines')
    .select('*')
    .order('mc_id', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get a single simplex machine by ID
export async function getSimplexMachineById(id) {
  const { data, error } = await supabase
    .from('simplex_machines')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Create a new simplex machine
export async function createSimplexMachine(machineData) {
  const { data, error } = await supabase
    .from('simplex_machines')
    .insert([{
      machine_no: machineData.machine_no,
      mc_id: machineData.mc_id,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      mc_effi: machineData.mc_effi,              // Machine Efficiency
      tpi: machineData.tpi,                       // TPI value (NEW)
      no_of_spindles: machineData.no_of_spindles, // Number of Spindles (NEW)
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

// Update an existing simplex machine
export async function updateSimplexMachine(id, machineData) {
  const { data, error } = await supabase
    .from('simplex_machines')
    .update({
      machine_no: machineData.machine_no,
      mc_id: machineData.mc_id,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
      mc_effi: machineData.mc_effi,              // Machine Efficiency
      tpi: machineData.tpi,                       // TPI value (NEW)
      no_of_spindles: machineData.no_of_spindles, // Number of Spindles (NEW)
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

// Delete a simplex machine
export async function deleteSimplexMachine(id) {
  const { error } = await supabase
    .from('simplex_machines')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search simplex machines
export async function searchSimplexMachines(field, condition, value) {
  let query = supabase
    .from('simplex_machines')
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

  query = query.order('mc_id', { ascending: true });

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

// Get active simplex machines only
export async function getActiveSimplexMachines() {
  const { data, error } = await supabase
    .from('simplex_machines')
    .select('*')
    .eq('is_active', true)
    .order('mc_id', { ascending: true });

  if (error) throw error;
  return data || [];
}
