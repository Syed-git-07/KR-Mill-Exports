import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';

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
  try {
    const data = await prisma.tpi_entries.findMany({
      orderBy: {
        entry_id: 'asc'
      }
    })

    // Manually fetch spinning count names since no relationship is defined
    const countIds = [...new Set(data.map(e => e.spinning_count_id).filter(Boolean))];
    const counts = countIds.length > 0 ? await prisma.spinning_counts.findMany({
      where: { id: { in: countIds } },
      select: { id: true, count_name: true }
    }) : [];

    const countMap = Object.fromEntries(counts.map(c => [c.id, c]));

    // Transform to expected format (map to tpi_value and add spinning_counts)
    return data.map(entry => ({
      ...entry,
      tpi_value: entry.tpi_value, // Use tpi_value from database
      spinning_counts: countMap[entry.spinning_count_id] || null
    }))
  } catch (error) {
    throw error
  }
}

// Get spinning counts for dropdown
export async function getCountsForDropdown() {
  try {
    const data = await prisma.spinning_counts.findMany({
      where: { is_active: true },
      select: {
        id: true,
        count_name: true
      },
      orderBy: {
        count_name: 'asc'
      }
    })
    return data
  } catch (error) {
    throw error
  }
}

// Create new TPI entry
export async function createTPIEntry(entryData) {
  try {
    // Convert entry_date string to Date object if needed
    const processedData = { ...entryData };
    if (processedData.entry_date && typeof processedData.entry_date === 'string') {
      processedData.entry_date = new Date(processedData.entry_date);
    }

    const data = await prisma.tpi_entries.create({
      data: processedData
    })
    return data
  } catch (error) {
    throw error
  }
}

// Update TPI entry
export async function updateTPIEntry(id, entryData) {
  try {
    // Convert entry_date string to Date object if needed
    const processedData = { ...entryData };
    if (processedData.entry_date && typeof processedData.entry_date === 'string') {
      processedData.entry_date = new Date(processedData.entry_date);
    }

    const data = await prisma.tpi_entries.update({
      where: { id },
      data: processedData
    })
    return data
  } catch (error) {
    throw error
  }
}

// Delete TPI entry
export async function deleteTPIEntry(id) {
  try {
    await prisma.tpi_entries.delete({
      where: { id }
    })
    return true
  } catch (error) {
    throw error
  }
}

// Search TPI entries by entry_id (VB6 style - search by id)
export async function searchTPIEntries(field, condition, value) {
  try {
    const where = buildTypedSearchWhere(field, condition, value, {
      entry_id: 'number',
      entry_date: 'date',
      tpi_value: 'number'
    })

    const data = await prisma.tpi_entries.findMany({
      where,
      orderBy: {
        entry_id: 'asc'
      }
    })
    
    // Manually fetch spinning count names since no relationship is defined
    const countIds = [...new Set(data.map(e => e.spinning_count_id).filter(Boolean))];
    const counts = countIds.length > 0 ? await prisma.spinning_counts.findMany({
      where: { id: { in: countIds } },
      select: { id: true, count_name: true }
    }) : [];

    const countMap = Object.fromEntries(counts.map(c => [c.id, c]));
    
    // Transform to expected format
    return data.map(entry => ({
      ...entry,
      tpi_value: entry.tpi_value, // Use tpi_value from database
      spinning_counts: countMap[entry.spinning_count_id] || null
    }))
  } catch (error) {
    throw error
  }
}
