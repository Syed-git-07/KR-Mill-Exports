import { supabase } from '../supabase';

/**
 * TPI Entry CRUD Operations
 * 
 * VB6 Grid Columns: id (entry_id), sdate (DD-Mon-YY), countname, TPI
 * VB6 Form Fields: Date, Count (dropdown), TPI
 * 
 * NOTE: Requires FK constraint on spinning_count_id -> spinning_counts(id)
 * Run schema/tpi-twc-fk-fix.sql if join fails
 */

// Get all TPI entries with count name join
export async function getTPIEntries() {
  // Try using the view first (has the join built-in)
  let { data, error } = await supabase
    .from('tpi_entries_view')
    .select('*')
    .order('entry_id', { ascending: false });

  // If view works, transform to expected format
  // View returns 'tpi' column, page expects 'tpi_value'
  if (!error && data) {
    return data.map(entry => ({
      ...entry,
      tpi_value: entry.tpi, // Map view column 'tpi' to 'tpi_value'
      spinning_counts: { count_name: entry.countname }
    }));
  }

  // Fallback: Try direct table with FK join
  const result = await supabase
    .from('tpi_entries')
    .select(`
      *,
      spinning_counts (
        id,
        count_name
      )
    `)
    .order('entry_id', { ascending: false });

  if (result.error) throw result.error;
  return result.data;
}

// Get spinning counts for dropdown
export async function getCountsForDropdown() {
  const { data, error } = await supabase
    .from('spinning_counts')
    .select('id, count_name')
    .eq('is_active', true)
    .order('count_name', { ascending: true });

  if (error) throw error;
  return data;
}

// Create new TPI entry
export async function createTPIEntry(entryData) {
  const { data, error } = await supabase
    .from('tpi_entries')
    .insert([entryData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update TPI entry
export async function updateTPIEntry(id, entryData) {
  const { data, error } = await supabase
    .from('tpi_entries')
    .update(entryData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete TPI entry
export async function deleteTPIEntry(id) {
  const { error } = await supabase
    .from('tpi_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search TPI entries by entry_id (VB6 style - search by id)
export async function searchTPIEntries(field, condition, value) {
  // Try view first
  let query = supabase.from('tpi_entries_view').select('*');

  if (value && value.trim() !== '') {
    const numValue = parseFloat(value);
    const isNumber = !isNaN(numValue);

    switch (condition) {
      case 'Like':
        if (!isNumber) {
          query = query.ilike(field, `%${value}%`);
        } else {
          query = query.eq(field, numValue);
        }
        break;
      case 'Equal':
      case '=':
        if (isNumber) {
          query = query.eq(field, numValue);
        } else {
          query = query.eq(field, value);
        }
        break;
      case 'Not Equal':
        if (isNumber) {
          query = query.neq(field, numValue);
        } else {
          query = query.neq(field, value);
        }
        break;
      case 'Greater':
        if (isNumber) {
          query = query.gt(field, numValue);
        }
        break;
      case 'Less':
        if (isNumber) {
          query = query.lt(field, numValue);
        }
        break;
      default:
        query = query.ilike(field, `%${value}%`);
    }
  }

  const { data, error } = await query.order('entry_id', { ascending: false });

  if (error) throw error;
  
  // Transform view data to expected format
  // View returns 'tpi' column, page expects 'tpi_value'
  return data.map(entry => ({
    ...entry,
    tpi_value: entry.tpi, // Map view column 'tpi' to 'tpi_value'
    spinning_counts: { count_name: entry.countname }
  }));
}
