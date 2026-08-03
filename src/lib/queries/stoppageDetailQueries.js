import { prisma } from '../prisma'
import { deleteUnusedStoppageDetail } from './masterDeletion'

const DETAIL_FIELDS = new Set([
  'code', 'description', 'stoppage_name', 'short_code', 'full_stoppage_name',
  'department_id', 'stoppage_head_id', 'is_active'
])

function cleanStoppageDetailData(detailData = {}) {
  const data = {}
  for (const [key, value] of Object.entries(detailData)) {
    if (!DETAIL_FIELDS.has(key) || value === undefined) continue
    if (key === 'code') {
      if (value == null || value === '') data.code = null
      else {
        const code = Number(value)
        if (!Number.isInteger(code) || code <= 0) throw new Error('Code must be a positive whole number')
        data.code = code
      }
    } else if (key === 'is_active') {
      if (typeof value !== 'boolean') throw new Error('Active status must be true or false')
      data.is_active = value
    } else if (key === 'department_id' || key === 'stoppage_head_id') {
      data[key] = value || null
    } else {
      data[key] = value == null || value === '' ? null : String(value).trim()
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'stoppage_name') && !data.stoppage_name) {
    throw new Error('Stoppage name is required')
  }
  return data
}

async function validateStoppageDetail(transaction, data, excludeId = null, existing = null) {
  const departmentChanged = data.department_id && data.department_id !== existing?.department_id
  const headChanged = data.stoppage_head_id && data.stoppage_head_id !== existing?.stoppage_head_id
  if (departmentChanged || (!existing && data.department_id)) {
    const department = await transaction.departments.findUnique({
      where: { id: data.department_id },
      select: { is_active: true }
    })
    if (!department) throw new Error('Selected department no longer exists')
    if (!department.is_active) throw new Error('Selected department is inactive')
  }
  if (headChanged || (!existing && data.stoppage_head_id)) {
    const head = await transaction.stoppage_heads.findUnique({
      where: { id: data.stoppage_head_id },
      select: { is_active: true }
    })
    if (!head) throw new Error('Selected stoppage head no longer exists')
    if (!head.is_active) throw new Error('Selected stoppage head is inactive')
  }

  if (data.code != null) {
    const duplicateCode = await transaction.stoppage_details.findFirst({
      where: { code: data.code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true }
    })
    if (duplicateCode) throw new Error(`Stoppage detail code ${data.code} already exists`)
  }

  const departmentId = data.department_id ?? existing?.department_id
  const headId = data.stoppage_head_id ?? existing?.stoppage_head_id
  const stoppageName = data.stoppage_name ?? existing?.stoppage_name
  if (departmentId && headId && stoppageName && (data.stoppage_name || departmentChanged || headChanged || !existing)) {
    const duplicateName = await transaction.stoppage_details.findFirst({
      where: {
        department_id: departmentId,
        stoppage_head_id: headId,
        stoppage_name: { equals: stoppageName },
        ...(excludeId ? { id: { not: excludeId } } : {})
      },
      select: { id: true }
    })
    if (duplicateName) throw new Error('This stoppage reason already exists in the selected department and head')
  }
}

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
  const processedData = cleanStoppageDetailData(stoppageDetailData)
  if (!processedData.stoppage_name) throw new Error('Stoppage name is required')
  if (!processedData.department_id) throw new Error('Department is required')
  if (!processedData.stoppage_head_id) throw new Error('Stoppage head is required')
  processedData.description = processedData.description || ''
  if (processedData.is_active === undefined) processedData.is_active = true

  const data = await prisma.$transaction(async transaction => {
    if (!processedData.code) {
      const maxData = await transaction.stoppage_details.findFirst({
        orderBy: { code: 'desc' },
        select: { code: true }
      })
      processedData.code = (maxData?.code ?? 1446) + 1
    }
    await validateStoppageDetail(transaction, processedData)
    return transaction.stoppage_details.create({ data: processedData })
  }, { isolationLevel: 'Serializable' })

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
  if (!id) throw new Error('Stoppage detail ID is required')
  const processedData = cleanStoppageDetailData(stoppageDetailData)
  if (Object.prototype.hasOwnProperty.call(processedData, 'description')) {
    processedData.description = processedData.description || ''
  }

  const data = await prisma.$transaction(async transaction => {
    const existing = await transaction.stoppage_details.findUnique({ where: { id } })
    if (!existing) throw new Error('Stoppage detail not found')
    await validateStoppageDetail(transaction, processedData, id, existing)
    return transaction.stoppage_details.update({ where: { id }, data: processedData })
  })

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
  return deleteUnusedStoppageDetail(id)
}

/**
 * Search stoppage details
 */
export async function searchStoppageDetails(field, condition, value) {
  let whereClause = {};

  const allowedFields = new Set(['code', 'stoppage_name', 'short_code', 'description', 'stoppage_head_name', 'dept_name', 'is_active'])
  if (!allowedFields.has(field)) throw new Error('Unsupported stoppage detail search field')
  const trimmedValue = String(value ?? '').trim()

  if (field === 'stoppage_head_name' || field === 'dept_name') {
    const model = field === 'stoppage_head_name' ? prisma.stoppage_heads : prisma.departments
    const nameField = field === 'stoppage_head_name' ? 'stoppage_head_name' : 'dept_name'
    const idField = field === 'stoppage_head_name' ? 'stoppage_head_id' : 'department_id'
    const nameFilter = condition === 'Equal'
      ? trimmedValue
      : condition === 'Not Equal'
        ? { not: trimmedValue }
        : { contains: trimmedValue }
    const matches = await model.findMany({ where: { [nameField]: nameFilter }, select: { id: true } })
    whereClause[idField] = { in: matches.map(item => item.id) }
  }

  // Handle numeric fields
  const numericFields = ['code']
  const isNumericField = numericFields.includes(field)

  if (field === 'stoppage_head_name' || field === 'dept_name') {
    // Relationship filter was resolved above.
  } else if (field === 'is_active') {
    const active = ['true', 'yes', 'active', '1'].includes(trimmedValue.toLowerCase())
    whereClause.is_active = condition === 'Not Equal' ? { not: active } : active
  } else if (condition === 'Like') {
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
      stoppage_head_name: true,
      is_active: true
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
    select: {
      id: true,
      dept_name: true,
      is_active: true
    },
    orderBy: { dept_name: 'asc' }
  });

  return data;
}
