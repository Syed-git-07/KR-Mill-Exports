import { prisma } from '../prisma';

// Get all HOK strength headers (for list view)
export async function getHOKEntries() {
  try {
    const data = await prisma.hok_strength_head.findMany({
      select: {
        hok_id: true,
        date: true
      },
      orderBy: { date: 'desc' }
    });
    return data;
  } catch (error) {
    throw error;
  }
}

// Get HOK header with all detail entries for a specific hok_id
export async function getHOKEntryById(hokId) {
  try {
    // Get header
    const header = await prisma.hok_strength_head.findUnique({
      where: { hok_id: hokId }
    });

    // Get details
    const details = await prisma.hok_strength_detail.findMany({
      where: { hok_id: hokId },
      orderBy: {
        id: 'asc'
      }
    });

    // Get unique department IDs
    const deptIds = [...new Set(details.map(d => d.department_id).filter(Boolean))];

    // Fetch all related departments
    const departments = await prisma.departments.findMany({
      where: {
        id: { in: deptIds }
      },
      select: {
        id: true,
        dept_name: true
      }
    });

    // Create lookup map
    const deptMap = new Map(departments.map(d => [d.id, d]));

    // Add department info to details
    const detailsWithDepts = details.map(detail => ({
      ...detail,
      departments: deptMap.get(detail.department_id) || null
    }));

    return { header, details: detailsWithDepts };
  } catch (error) {
    throw error;
  }
}

// Create HOK strength entry (header + details)
export async function createHOKEntry(hokData) {
  try {
    let { date, entries } = hokData;
    
    // Convert date string to Date object if needed
    if (typeof date === 'string') {
      date = new Date(date);
    }

    // Calculate totals
    const total_shift1 = entries.reduce((sum, e) => sum + (parseFloat(e.shift1) || 0), 0);
    const total_shift2 = entries.reduce((sum, e) => sum + (parseFloat(e.shift2) || 0), 0);
    const total_shift3 = entries.reduce((sum, e) => sum + (parseFloat(e.shift3) || 0), 0);

    // Insert header
    const header = await prisma.hok_strength_head.create({
      data: {
        date,
        total_shift1,
        total_shift2,
        total_shift3
      }
    });

    // Get max id from hok_strength_detail to generate new IDs
    const maxDetail = await prisma.hok_strength_detail.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    
    let nextId = (maxDetail?.id || 0) + 1;

    // Insert details with generated IDs
    const detailsToInsert = entries.map(entry => ({
      id: nextId++,
      hok_id: header.hok_id,
      department_id: entry.department_id,
      shift1: parseFloat(entry.shift1) || 0,
      shift2: parseFloat(entry.shift2) || 0,
      shift3: parseFloat(entry.shift3) || 0
    }));

    await prisma.hok_strength_detail.createMany({
      data: detailsToInsert
    });

    const details = await prisma.hok_strength_detail.findMany({
      where: { hok_id: header.hok_id }
    });

    return { header, details };
  } catch (error) {
    throw error;
  }
}

// Create multiple HOK strength entries (bulk insert for grid)
export async function createBulkHOKEntries(entriesData) {
  return createHOKEntry(entriesData);
}

// Update HOK strength entry
export async function updateHOKEntry(hokId, hokData) {
  try {
    let { date, entries } = hokData;
    
    // Convert date string to Date object if needed
    if (date && typeof date === 'string') {
      date = new Date(date);
    }

    // Calculate totals
    const total_shift1 = entries.reduce((sum, e) => sum + (parseFloat(e.shift1) || 0), 0);
    const total_shift2 = entries.reduce((sum, e) => sum + (parseFloat(e.shift2) || 0), 0);
    const total_shift3 = entries.reduce((sum, e) => sum + (parseFloat(e.shift3) || 0), 0);

    // Update header
    const header = await prisma.hok_strength_head.update({
      where: { hok_id: hokId },
      data: {
        date,
        total_shift1,
        total_shift2,
        total_shift3
      }
    });

    // Delete existing details
    await prisma.hok_strength_detail.deleteMany({
      where: { hok_id: hokId }
    });

    // Get max id from hok_strength_detail to generate new IDs
    const maxDetail = await prisma.hok_strength_detail.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    
    let nextId = (maxDetail?.id || 0) + 1;

    // Insert new details with generated IDs
    const detailsToInsert = entries.map(entry => ({
      id: nextId++,
      hok_id: hokId,
      department_id: entry.department_id,
      shift1: parseFloat(entry.shift1) || 0,
      shift2: parseFloat(entry.shift2) || 0,
      shift3: parseFloat(entry.shift3) || 0
    }));

    await prisma.hok_strength_detail.createMany({
      data: detailsToInsert
    });

    const details = await prisma.hok_strength_detail.findMany({
      where: { hok_id: hokId }
    });

    return { header, details };
  } catch (error) {
    throw error;
  }
}
  
// Delete HOK strength entry (header and details cascade delete)
export async function deleteHOKEntry(hokId) {
  try {
    await prisma.hok_strength_head.delete({
      where: { hok_id: hokId }
    });
  } catch (error) {
    throw error;
  }
}

// Delete all entries for a specific date
export async function deleteHOKEntriesByDate(date) {
  try {
    await prisma.hok_strength_head.deleteMany({
      where: { date }
    });
  } catch (error) {
    throw error;
  }
}

// Get all departments for HOK grid (all departments from departments table)
export async function getDepartmentsForDropdown() {
  try {
    const data = await prisma.departments.findMany({
      where: { is_active: true },
      select: {
        id: true,
        dept_name: true,
        code: true,
        sl_no: true
      },
      orderBy: { sl_no: 'asc' }
    });
    return data;
  } catch (error) {
    throw error;
  }
}

// Search HOK entries
export async function searchHOKEntries(searchParams) {
  try {
    let whereClause = {};

    if (searchParams.field && searchParams.value) {
      const { field, operator, value } = searchParams;
      
      // hok_id is INT - handle numeric operations
      if (field === 'hok_id') {
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          return []; // Return empty if invalid number
        }
        
        switch (operator) {
          case 'Like':
          case 'Equal':
          case '=':
            whereClause[field] = numValue;
            break;
          case 'Not Equal':
            whereClause[field] = { not: numValue };
            break;
          case 'Greater':
            whereClause[field] = { gt: numValue };
            break;
          case 'Less':
            whereClause[field] = { lt: numValue };
            break;
          default:
            whereClause[field] = numValue;
        }
      } else {
        // For other fields (like date)
        switch (operator) {
          case 'Like':
            whereClause[field] = { contains: value };
            break;
          case 'Equal':
          case '=':
            whereClause[field] = value;
            break;
          case 'Not Equal':
            whereClause[field] = { not: value };
            break;
          case 'Greater':
            whereClause[field] = { gt: value };
            break;
          case 'Less':
            whereClause[field] = { lt: value };
            break;
          default:
            whereClause[field] = value;
        }
      }
    }

    const data = await prisma.hok_strength_head.findMany({
      where: whereClause,
      select: {
        hok_id: true,
        date: true
      },
      orderBy: { date: 'desc' }
    });

    return data;
  } catch (error) {
    throw error;
  }
}
