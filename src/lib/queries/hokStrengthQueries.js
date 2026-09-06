import { PRODUCTION_DEPARTMENT_NAMES } from '../productionDepartments'
import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';

const HOK_TRANSACTION_OPTIONS = { isolationLevel: 'Serializable' };

async function runHOKTransaction(operation) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, HOK_TRANSACTION_OPTIONS);
    } catch (error) {
      const isRetryable = error?.code === 'P2034' || error?.code === 'P2002';
      if (!isRetryable || attempt === 2) throw error;
    }
  }
}

function calculateHOKTotals(entries) {
  return {
    total_shift1: entries.reduce((sum, entry) => sum + Number(entry.shift1 || 0), 0),
    total_shift2: entries.reduce((sum, entry) => sum + Number(entry.shift2 || 0), 0),
    total_shift3: entries.reduce((sum, entry) => sum + Number(entry.shift3 || 0), 0)
  };
}

async function insertHOKDetails(tx, hokId, entries) {
  const maxDetail = await tx.hok_strength_detail.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true }
  });
  let nextId = (maxDetail?.id || 0) + 1;

  await tx.hok_strength_detail.createMany({
    data: entries.map(entry => ({
      id: nextId++,
      hok_id: hokId,
      department_id: entry.department_id,
      shift1: Number(entry.shift1),
      shift2: Number(entry.shift2),
      shift3: Number(entry.shift3)
    }))
  });
}

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
  const { date, entries } = hokData;
  const totals = calculateHOKTotals(entries);

  return runHOKTransaction(async (tx) => {
    const header = await tx.hok_strength_head.create({
      data: {
        date,
        ...totals
      }
    });

    await insertHOKDetails(tx, header.hok_id, entries);

    const details = await tx.hok_strength_detail.findMany({
      where: { hok_id: header.hok_id }
    });

    return { header, details };
  });
}

// Create multiple HOK strength entries (bulk insert for grid)
export async function createBulkHOKEntries(entriesData) {
  return createHOKEntry(entriesData);
}

// Update HOK strength entry
export async function updateHOKEntry(hokId, hokData) {
  const { date, entries } = hokData;
  const totals = calculateHOKTotals(entries);

  return runHOKTransaction(async (tx) => {
    const header = await tx.hok_strength_head.update({
      where: { hok_id: hokId },
      data: {
        date,
        ...totals
      }
    });

    await tx.hok_strength_detail.deleteMany({
      where: { hok_id: hokId }
    });

    await insertHOKDetails(tx, hokId, entries);

    const details = await tx.hok_strength_detail.findMany({
      where: { hok_id: hokId }
    });

    return { header, details };
  });
}
  
// Delete HOK strength entry (header and details cascade delete)
export async function deleteHOKEntry(hokId) {
  return prisma.$transaction(async (tx) => {
    await tx.hok_strength_detail.deleteMany({
      where: { hok_id: hokId }
    });
    await tx.hok_strength_head.delete({
      where: { hok_id: hokId }
    });
  });
}

// Delete all entries for a specific date
export async function deleteHOKEntriesByDate(date) {
  return prisma.$transaction(async (tx) => {
    const headers = await tx.hok_strength_head.findMany({
      where: { date },
      select: { hok_id: true }
    });
    const hokIds = headers.map(header => header.hok_id);

    if (hokIds.length) {
      await tx.hok_strength_detail.deleteMany({
        where: { hok_id: { in: hokIds } }
      });
    }
    await tx.hok_strength_head.deleteMany({
      where: { date }
    });
  });
}

// Get all departments for HOK grid (all departments from departments table)
export async function getDepartmentsForDropdown() {
  try {
    const data = await prisma.departments.findMany({
      where: { is_active: true, dept_name: { notIn: PRODUCTION_DEPARTMENT_NAMES } },
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
    const whereClause = buildTypedSearchWhere(
      searchParams.field,
      searchParams.operator,
      searchParams.value,
      { hok_id: 'number', date: 'date' }
    );

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
