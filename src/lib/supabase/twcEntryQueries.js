import { supabase } from '../supabase';

/**
 * TWC Entry CRUD Operations
 * VB6 Grid: id, sdate, countname, TWC
 * 
 * NOTE: Requires FK constraint on spinning_count_id -> spinning_counts(id)
 * Run schema/tpi-twc-fk-fix.sql if join fails
 */

// Get all TWC entries
export async function getTWCEntries() {
  // Try using the view first (has the join built-in)
  let { data, error } = await supabase
    .from('twc_entries_view')
    .select('*')
    .order('entry_id', { ascending: false });

  // If view works, transform to expected format
  // View returns 'twc' column, page expects 'twc_value'
  if (!error && data) {
    return data.map(entry => ({
      ...entry,
      twc_value: entry.twc, // Map view column 'twc' to 'twc_value'
      spinning_counts: { count_name: entry.countname }
    }));
  }

  // Fallback: Try direct table with FK join
  const result = await supabase
    .from('twc_entries')
    .select(`
      *,
      spinning_counts (count_name)
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

// Create new TWC entry
export async function createTWCEntry(entryData) {
  const { data, error } = await supabase
    .from('twc_entries')
    .insert([entryData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update TWC entry
export async function updateTWCEntry(id, entryData) {
  const { data, error } = await supabase
    .from('twc_entries')
    .update(entryData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete TWC entry
export async function deleteTWCEntry(id) {
  const { error } = await supabase
    .from('twc_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Search TWC entries
export async function searchTWCEntries(field, condition, value) {
  // Try view first
  let query = supabase.from('twc_entries_view').select('*');

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
  // View returns 'twc' column, page expects 'twc_value'
  return data.map(entry => ({
    ...entry,
    twc_value: entry.twc, // Map view column 'twc' to 'twc_value'
    spinning_counts: { count_name: entry.countname }
  }));
}
