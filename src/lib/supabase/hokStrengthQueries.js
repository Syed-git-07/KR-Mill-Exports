import { supabase } from '../supabase';

// Get all HOK strength headers (for list view)
export async function getHOKEntries() {
  const { data, error } = await supabase
    .from('hok_strength_head')
    .select('hok_id, date')
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

// Get HOK header with all detail entries for a specific hok_id
export async function getHOKEntryById(hokId) {
  // Get header
  const { data: header, error: headerError } = await supabase
    .from('hok_strength_head')
    .select('*')
    .eq('hok_id', hokId)
    .single();

  if (headerError) throw headerError;

  // Get details with department names
  const { data: details, error: detailsError } = await supabase
    .from('hok_strength_detail')
    .select(`
      *,
      departments (dept_name)
    `)
    .eq('hok_id', hokId)
    .order('departments(dept_name)', { ascending: true });

  if (detailsError) throw detailsError;

  return { header, details };
}

// Create HOK strength entry (header + details)
export async function createHOKEntry(hokData) {
  const { date, entries } = hokData;

  // Calculate totals
  const total_shift1 = entries.reduce((sum, e) => sum + (parseFloat(e.shift1) || 0), 0);
  const total_shift2 = entries.reduce((sum, e) => sum + (parseFloat(e.shift2) || 0), 0);
  const total_shift3 = entries.reduce((sum, e) => sum + (parseFloat(e.shift3) || 0), 0);

  // Insert header
  const { data: header, error: headerError } = await supabase
    .from('hok_strength_head')
    .insert({
      date,
      total_shift1,
      total_shift2,
      total_shift3
    })
    .select()
    .single();

  if (headerError) throw headerError;

  // Insert details
  const detailsToInsert = entries.map(entry => ({
    hok_id: header.hok_id,
    department_id: entry.department_id,
    shift1: parseFloat(entry.shift1) || 0,
    shift2: parseFloat(entry.shift2) || 0,
    shift3: parseFloat(entry.shift3) || 0
  }));

  const { data: details, error: detailsError } = await supabase
    .from('hok_strength_detail')
    .insert(detailsToInsert)
    .select();

  if (detailsError) throw detailsError;

  return { header, details };
}

// Create multiple HOK strength entries (bulk insert for grid)
export async function createBulkHOKEntries(entriesData) {
  return createHOKEntry(entriesData);
}

// Update HOK strength entry
export async function updateHOKEntry(hokId, hokData) {
  const { date, entries } = hokData;

  // Calculate totals
  const total_shift1 = entries.reduce((sum, e) => sum + (parseFloat(e.shift1) || 0), 0);
  const total_shift2 = entries.reduce((sum, e) => sum + (parseFloat(e.shift2) || 0), 0);
  const total_shift3 = entries.reduce((sum, e) => sum + (parseFloat(e.shift3) || 0), 0);

  // Update header
  const { data: header, error: headerError } = await supabase
    .from('hok_strength_head')
    .update({
      date,
      total_shift1,
      total_shift2,
      total_shift3
    })
    .eq('hok_id', hokId)
    .select()
    .single();

  if (headerError) throw headerError;

  // Delete existing details
  await supabase
    .from('hok_strength_detail')
    .delete()
    .eq('hok_id', hokId);

  // Insert new details
  const detailsToInsert = entries.map(entry => ({
    hok_id: hokId,
    department_id: entry.department_id,
    shift1: parseFloat(entry.shift1) || 0,
    shift2: parseFloat(entry.shift2) || 0,
    shift3: parseFloat(entry.shift3) || 0
  }));

  const { data: details, error: detailsError } = await supabase
    .from('hok_strength_detail')
    .insert(detailsToInsert)
    .select();

  if (detailsError) throw detailsError;

  return { header, details };
}
  
// Delete HOK strength entry (header and details cascade delete)
export async function deleteHOKEntry(hokId) {
  const { error } = await supabase
    .from('hok_strength_head')
    .delete()
    .eq('hok_id', hokId);

  if (error) throw error;
}

// Delete all entries for a specific date
export async function deleteHOKEntriesByDate(date) {
  const { error } = await supabase
    .from('hok_strength_head')
    .delete()
    .eq('date', date);

  if (error) throw error;
}

// Get all departments for HOK grid (all departments from departments table)
export async function getDepartmentsForDropdown() {
  const { data, error } = await supabase
    .from('departments')  // Use departments table to show ALL departments
    .select('id, dept_name, code, sl_no')
    .eq('is_active', true)  // Only active departments
    .order('sl_no', { ascending: true });  // Order by sl_no

  if (error) throw error;
  return data;
}

// Search HOK entries
export async function searchHOKEntries(searchParams) {
  let query = supabase.from('hok_strength_head').select('hok_id, date');

  if (searchParams.field && searchParams.value) {
    const { field, operator, value } = searchParams;
    
    switch (operator) {
      case 'Like':
        query = query.ilike(field, `%${value}%`);
        break;
      case 'Equal':
        if (field === 'hok_id') {
          query = query.eq(field, parseInt(value));
        } else {
          query = query.eq(field, value);
        }
        break;
      case 'Not Equal':
        query = query.neq(field, value);
        break;
      case 'Greater':
        query = query.gt(field, value);
        break;
      case 'Less':
        query = query.lt(field, value);
        break;
      default:
        query = query.eq(field, value);
    }
  }

  query = query.order('date', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
