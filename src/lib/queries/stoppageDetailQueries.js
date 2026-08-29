import { prisma } from '../prisma'
import { buildTypedSearchWhere } from '../masterSearch'
import { softDeleteMasterRecord } from './masterSoftDelete'

/**
 * Get all stoppage details with joined data
 */
export async function getStoppageDetails() {
  const data = await prisma.stoppage_details.findMany({
    orderBy: { code: 'asc' }
  });

  // Fetch related data manually since no relationships are defined in schema
  const stoppageHeadIds = [...new Set(data.map(item => item.stoppage_head_id).filter(Boolean))];
  const departmentIds = [...new Set(data.map(item => item.department_id).filter(Boolean))];

  const stoppageHeads = stoppageHeadIds.length > 0 ? await prisma.stoppage_heads.findMany({
    where: { id: { in: stoppageHeadIds } },
    select: { id: true, stoppage_head_name: true }
  }) : [];

  const departments = departmentIds.length > 0 ? await prisma.departments.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, dept_name: true }
  }) : [];

  const stoppageHeadMap = Object.fromEntries(stoppageHeads.map(h => [h.id, h.stoppage_head_name]));
  const departmentMap = Object.fromEntries(departments.map(d => [d.id, d.dept_name]));

  // Format data for display
  return (data || []).map(item => ({
    ...item,
    stoppage_head_name: stoppageHeadMap[item.stoppage_head_id] || '',
    dept_name: departmentMap[item.department_id] || ''
  }))
}

/**
 * Get stoppage detail by ID
 */
export async function getStoppageDetailById(id) {
  const data = await prisma.stoppage_details.findUnique({
    where: { id }
  });

  if (!data) return null;

  // Fetch related data manually
  let stoppageHead = null;
  let department = null;

  if (data.stoppage_head_id) {
    stoppageHead = await prisma.stoppage_heads.findUnique({
      where: { id: data.stoppage_head_id },
      select: { id: true, stoppage_head_name: true }
    });
  }

  if (data.department_id) {
    department = await prisma.departments.findUnique({
      where: { id: data.department_id },
      select: { id: true, dept_name: true }
    });
  }

  return {
    ...data,
    stoppage_head_name: stoppageHead?.stoppage_head_name || '',
    dept_name: department?.dept_name || ''
  };
}

/**
 * Create new stoppage detail
 */
export async function createStoppageDetail(stoppageDetailData) {
  // Auto-generate code if not provided
  let code = stoppageDetailData.code
  
  if (!code) {
    // Get max code and increment
    const maxData = await prisma.stoppage_details.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true }
    });
    
    code = maxData && maxData.code ? maxData.code + 1 : 1447;
  }

  // Ensure description is not null (MySQL requires NOT NULL)
  const processedData = {
    ...stoppageDetailData,
    code,
    description: stoppageDetailData.description || ''
  };

  const data = await prisma.stoppage_details.create({
    data: processedData
  });

  // Fetch related data manually
  let stoppageHead = null;
  let department = null;

  if (data.stoppage_head_id) {
    stoppageHead = await prisma.stoppage_heads.findUnique({
      where: { id: data.stoppage_head_id },
      select: { stoppage_head_name: true }
    });
  }

  if (data.department_id) {
    department = await prisma.departments.findUnique({
      where: { id: data.department_id },
      select: { dept_name: true }
    });
  }

  // Format data for display
  return {
    ...data,
    stoppage_head_name: stoppageHead?.stoppage_head_name || '',
    dept_name: department?.dept_name || ''
  }
}

/**
 * Update stoppage detail
 */
export async function updateStoppageDetail(id, stoppageDetailData) {
  // Ensure description is not null (MySQL requires NOT NULL)
  const processedData = {
    ...stoppageDetailData,
    description: stoppageDetailData.description || ''
  };

  const data = await prisma.stoppage_details.update({
    where: { id },
    data: processedData
  });

  // Fetch related data manually
  let stoppageHead = null;
  let department = null;

  if (data.stoppage_head_id) {
    stoppageHead = await prisma.stoppage_heads.findUnique({
      where: { id: data.stoppage_head_id },
      select: { stoppage_head_name: true }
    });
  }

  if (data.department_id) {
    department = await prisma.departments.findUnique({
      where: { id: data.department_id },
      select: { dept_name: true }
    });
  }

  // Format data for display
  return {
    ...data,
    stoppage_head_name: stoppageHead?.stoppage_head_name || '',
    dept_name: department?.dept_name || ''
  }
}

/**
 * Soft-delete a stoppage detail while retaining historical references.
 */
export async function deleteStoppageDetail(id) {
  return softDeleteMasterRecord(prisma.stoppage_details, id, {
    recordLabel: 'Stoppage detail'
  })
}

/**
 * Search stoppage details
 */
export async function searchStoppageDetails(field, condition, value) {
  let whereClause;

  if (field === 'stoppage_head_name') {
    const relatedCondition = condition === 'Not Equal' ? 'Equal' : condition;
    const relatedWhere = buildTypedSearchWhere('stoppage_head_name', relatedCondition, value, {
      stoppage_head_name: 'text'
    });
    const matches = await prisma.stoppage_heads.findMany({
      where: relatedWhere,
      select: { id: true }
    });
    if (matches.length === 0 && condition !== 'Not Equal') return [];
    whereClause = condition === 'Not Equal'
      ? { stoppage_head_id: { notIn: matches.map(item => item.id) } }
      : { stoppage_head_id: { in: matches.map(item => item.id) } };
  } else if (field === 'dept_name') {
    const relatedCondition = condition === 'Not Equal' ? 'Equal' : condition;
    const relatedWhere = buildTypedSearchWhere('dept_name', relatedCondition, value, { dept_name: 'text' });
    const matches = await prisma.departments.findMany({
      where: relatedWhere,
      select: { id: true }
    });
    if (matches.length === 0 && condition !== 'Not Equal') return [];
    whereClause = condition === 'Not Equal'
      ? { department_id: { notIn: matches.map(item => item.id) } }
      : { department_id: { in: matches.map(item => item.id) } };
  } else {
    whereClause = buildTypedSearchWhere(field, condition, value, {
      code: 'number', stoppage_name: 'text'
    });
  }

  const data = await prisma.stoppage_details.findMany({
    where: whereClause,
    orderBy: { code: 'asc' }
  });

  // Fetch related data manually
  const stoppageHeadIds = [...new Set(data.map(item => item.stoppage_head_id).filter(Boolean))];
  const departmentIds = [...new Set(data.map(item => item.department_id).filter(Boolean))];

  const stoppageHeads = stoppageHeadIds.length > 0 ? await prisma.stoppage_heads.findMany({
    where: { id: { in: stoppageHeadIds } },
    select: { id: true, stoppage_head_name: true }
  }) : [];

  const departments = departmentIds.length > 0 ? await prisma.departments.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, dept_name: true }
  }) : [];

  const stoppageHeadMap = Object.fromEntries(stoppageHeads.map(h => [h.id, h.stoppage_head_name]));
  const departmentMap = Object.fromEntries(departments.map(d => [d.id, d.dept_name]));

  // Format data for display
  return (data || []).map(item => ({
    ...item,
    stoppage_head_name: stoppageHeadMap[item.stoppage_head_id] || '',
    dept_name: departmentMap[item.department_id] || ''
  }))
}

/**
 * Get all stoppage heads for dropdown
 */
export async function getStoppageHeadsForDropdown() {
  const data = await prisma.stoppage_heads.findMany({
    select: {
      id: true,
      stoppage_head_name: true
    },
    orderBy: { stoppage_head_name: 'asc' }
  });

  return data;
}

/**
 * Get all departments for dropdown
 */
export async function getDepartmentsForDropdown() {
  const data = await prisma.departments.findMany({
    where: { is_active: true },
    select: {
      id: true,
      dept_name: true
    },
    orderBy: { dept_name: 'asc' }
  });

  return data;
}
