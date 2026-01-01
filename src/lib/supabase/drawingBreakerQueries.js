import { supabase } from '../supabase';

/**
 * Drawing Breaker Machine Master - CRUD Operations
 * Following the pattern from Department queries
 */

// Get all drawing breaker machines
export async function getDrawingBreakerMachines() {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .select('*')
    .order('machine_no', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get a single drawing breaker machine by ID
export async function getDrawingBreakerMachineById(id) {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Create a new drawing breaker machine
export async function createDrawingBreakerMachine(machineData) {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .insert([{
      machine_no: machineData.machine_no,
      mc_id: machineData.mc_id,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
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

// Update an existing drawing breaker machine
export async function updateDrawingBreakerMachine(id, machineData) {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .update({
      machine_no: machineData.machine_no,
      mc_id: machineData.mc_id,
      description: machineData.description,
      make_name: machineData.make_name,
      model: machineData.model,
      prodn_mixing: machineData.prodn_mixing,
      speed: machineData.speed,
      prodn_efficiency: machineData.prodn_effi,
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

// Delete a drawing breaker machine
export async function deleteDrawingBreakerMachine(id) {
  const { error } = await supabase
    .from('drawing_breaker_machines')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search drawing breaker machines
export async function searchDrawingBreakerMachines(field, condition, value) {
  let query = supabase
    .from('drawing_breaker_machines')
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

// Get active drawing breaker machines only
export async function getActiveDrawingBreakerMachines() {
  const { data, error } = await supabase
    .from('drawing_breaker_machines')
    .select('*')
    .eq('is_active', true)
    .order('machine_no', { ascending: true });

  if (error) throw error;
  return data || [];
}
