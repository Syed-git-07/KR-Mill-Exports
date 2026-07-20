import { prisma } from '../prisma'

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
 * Delete stoppage detail
 */
export async function deleteStoppageDetail(id) {
  await prisma.stoppage_details.delete({
    where: { id }
  });

  return true
}

/**
 * Search stoppage details
 */
export async function searchStoppageDetails(field, condition, value) {
  let whereClause = {};

  const trimmedValue = value.trim()

  // Handle numeric fields
  const numericFields = ['code']
  const isNumericField = numericFields.includes(field)

  if (condition === 'Like') {
    if (isNumericField) {
      // For numeric fields, use exact match with Like
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        whereClause[field] = numValue;
      }
    } else {
      // MySQL doesn't support mode: 'insensitive', but string comparisons are case-insensitive by default
      whereClause[field] = { contains: trimmedValue };
    }
  } else if (condition === 'Equal') {
    if (isNumericField) {
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        whereClause[field] = numValue;
      }
    } else {
      whereClause[field] = trimmedValue;
    }
  } else if (condition === 'Not Equal') {
    if (isNumericField) {
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        whereClause[field] = { not: numValue };
      }
    } else {
      whereClause[field] = { not: trimmedValue };
    }
  } else if (condition === 'Greater' && isNumericField) {
    const numValue = parseInt(trimmedValue, 10)
    if (!isNaN(numValue)) {
      whereClause[field] = { gt: numValue };
    }
  } else if (condition === 'Less' && isNumericField) {
    const numValue = parseInt(trimmedValue, 10)
    if (!isNaN(numValue)) {
      whereClause[field] = { lt: numValue };
    }
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
