import { prisma } from '../prisma';
import { deleteUnusedSupervisor } from './masterDeletion';

function cleanSupervisorData(supervisorData = {}) {
  const data = {};
  if (Object.prototype.hasOwnProperty.call(supervisorData, 'code')) {
    const code = Number(supervisorData.code);
    if (!Number.isInteger(code) || code <= 0) throw new Error('Code must be a positive whole number');
    data.code = code;
  }
  if (Object.prototype.hasOwnProperty.call(supervisorData, 'supervisor_name')) {
    data.supervisor_name = String(supervisorData.supervisor_name ?? '').trim();
    if (!data.supervisor_name) throw new Error('Supervisor name is required');
  }
  if (Object.prototype.hasOwnProperty.call(supervisorData, 'department_id')) {
    data.department_id = supervisorData.department_id || null;
  }
  if (Object.prototype.hasOwnProperty.call(supervisorData, 'is_active')) {
    if (typeof supervisorData.is_active !== 'boolean') throw new Error('Active status must be true or false');
    data.is_active = supervisorData.is_active;
  }
  return data;
}

async function validateSupervisor(transaction, data, excludeId = null) {
  if (data.department_id) {
    const department = await transaction.departments.findUnique({
      where: { id: data.department_id },
      select: { is_active: true }
    });
    if (!department) throw new Error('Selected department no longer exists');
    if (!department.is_active) throw new Error('Selected department is inactive');
  }

  const checks = [];
  if (data.code != null) checks.push({ code: data.code });
  if (data.supervisor_name) checks.push({ supervisor_name: { equals: data.supervisor_name } });
  if (!checks.length) return;
  const duplicate = await transaction.supervisors.findFirst({
    where: { OR: checks, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { code: true, supervisor_name: true }
  });
  if (!duplicate) return;
  if (data.code != null && duplicate.code === data.code) throw new Error(`Supervisor code ${data.code} already exists`);
  throw new Error(`Supervisor "${data.supervisor_name}" already exists`);
}

/**
 * Supervisor Master CRUD Operations
 */

// Get all supervisors with department info
export async function getSupervisors() {
  const data = await prisma.supervisors.findMany({
    orderBy: { code: 'asc' }
  });

  // Fetch department names manually since no relationship is defined
  const departmentIds = [...new Set(data.map(s => s.department_id).filter(Boolean))];
  const departments = departmentIds.length > 0 ? await prisma.departments.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, dept_name: true }
  }) : [];

  const departmentMap = Object.fromEntries(departments.map(d => [d.id, d.dept_name]));

  return data.map(supervisor => ({
    ...supervisor,
    dept_name: departmentMap[supervisor.department_id] || ''
  }));
}

// Create new supervisor
export async function createSupervisor(supervisorData) {
  const cleanData = cleanSupervisorData(supervisorData);
  if (!cleanData.supervisor_name) throw new Error('Supervisor name is required');
  // Auto-generate code if not provided
  return prisma.$transaction(async transaction => {
    if (!cleanData.code) {
      const maxData = await transaction.supervisors.findFirst({
        orderBy: { code: 'desc' },
        select: { code: true }
      });
      cleanData.code = (maxData?.code ?? 0) + 1;
    }
    if (cleanData.is_active === undefined) cleanData.is_active = true;
    await validateSupervisor(transaction, cleanData);
    return transaction.supervisors.create({ data: cleanData });
  }, { isolationLevel: 'Serializable' });
}

// Update supervisor
export async function updateSupervisor(id, supervisorData) {
  if (!id) throw new Error('Supervisor ID is required');
  const cleanData = cleanSupervisorData(supervisorData);
  return prisma.$transaction(async transaction => {
    const existing = await transaction.supervisors.findUnique({ where: { id } });
    if (!existing) throw new Error('Supervisor not found');
    const validationData = {
      ...cleanData,
      // Re-selecting the same inactive department while changing only the
      // supervisor name is allowed; assigning a different inactive one is not.
      ...(cleanData.department_id === existing.department_id ? { department_id: null } : {})
    };
    await validateSupervisor(transaction, validationData, id);
    return transaction.supervisors.update({ where: { id }, data: cleanData });
  });
}

// Delete supervisor
export async function deleteSupervisor(id) {
  return deleteUnusedSupervisor(id);
}

// Search supervisors
export async function searchSupervisors(field, condition, value) {
  if (!new Set(['code', 'supervisor_name', 'department_name', 'is_active']).has(field)) {
    throw new Error('Unsupported supervisor search field');
  }
  let whereClause = {};

  if (value && value.trim() !== '') {
    // Handle department_name search separately (need to search departments first)
    if (field === 'department_name') {
      // Find matching departments first
      const departmentFilter = condition === 'Not Equal'
        ? { not: value }
        : condition === 'Equal'
          ? value
          : { contains: value };
      const matchingDepts = await prisma.departments.findMany({
        where: { dept_name: departmentFilter },
        select: { id: true }
      });
      
      if (matchingDepts.length > 0) {
        whereClause.department_id = { in: matchingDepts.map(d => d.id) };
      } else {
        // No matching departments, return empty array
        return [];
      }
    } else {
      switch (condition) {
        case 'Like':
          // For numeric code field, use equality instead of contains
          if (field === 'code') {
            const numValue = parseInt(value);
            if (!isNaN(numValue)) {
              whereClause[field] = numValue;
            }
          } else {
            // MySQL doesn't support mode: 'insensitive', string comparisons are case-insensitive by default
            whereClause[field] = { contains: value };
          }
          break;
        case 'Equal':
          if (field === 'code') {
            whereClause[field] = parseInt(value);
          } else {
            whereClause[field] = value;
          }
          break;
        case 'Not Equal':
          whereClause[field] = { not: value };
          break;
        case 'Greater':
          if (field === 'code') {
            whereClause[field] = { gt: parseInt(value) };
          }
          break;
        case 'Less':
          if (field === 'code') {
            whereClause[field] = { lt: parseInt(value) };
          }
          break;
      }
    }
  }

  const data = await prisma.supervisors.findMany({
    where: whereClause,
    orderBy: { code: 'asc' }
  });

  // Fetch department names manually
  const departmentIds = [...new Set(data.map(s => s.department_id).filter(Boolean))];
  const departments = departmentIds.length > 0 ? await prisma.departments.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, dept_name: true }
  }) : [];

  const departmentMap = Object.fromEntries(departments.map(d => [d.id, d.dept_name]));

  return data.map(supervisor => ({
    ...supervisor,
    dept_name: departmentMap[supervisor.department_id] || ''
  }));
}

// Get all departments for dropdown
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
