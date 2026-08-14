import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';

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
  // Auto-generate code if not provided
  let code = supervisorData.code;
  
  if (!code) {
    // Get max code and increment
    const maxData = await prisma.supervisors.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true }
    });
    
    code = maxData && maxData.code ? maxData.code + 1 : 1;
  }

  const data = await prisma.supervisors.create({
    data: { ...supervisorData, code }
  });

  return data;
}

// Update supervisor
export async function updateSupervisor(id, supervisorData) {
  const data = await prisma.supervisors.update({
    where: { id },
    data: supervisorData
  });

  return data;
}

// Delete supervisor
export async function deleteSupervisor(id) {
  await prisma.supervisors.delete({
    where: { id }
  });

  return true;
}

// Search supervisors
export async function searchSupervisors(field, condition, value) {
  let whereClause;

  if (field === 'department_name') {
    const relatedCondition = condition === 'Not Equal' ? 'Equal' : condition;
    const matchingDepts = await prisma.departments.findMany({
      where: buildTypedSearchWhere('dept_name', relatedCondition, value, { dept_name: 'text' }),
      select: { id: true }
    });
    if (matchingDepts.length === 0 && condition !== 'Not Equal') return [];
    whereClause = condition === 'Not Equal'
      ? { department_id: { notIn: matchingDepts.map(department => department.id) } }
      : { department_id: { in: matchingDepts.map(department => department.id) } };
  } else {
    whereClause = buildTypedSearchWhere(field, condition, value, {
      code: 'number', supervisor_name: 'text'
    });
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
  // MySQL stores boolean as TINYINT, so is_active = true works correctly
  const data = await prisma.departments.findMany({
    where: { 
      is_active: true 
    },
    select: {
      id: true,
      dept_name: true
    },
    orderBy: { dept_name: 'asc' }
  });

  return data;
}
