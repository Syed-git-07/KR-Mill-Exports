import { prisma } from '../prisma';

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
  let whereClause = {};

  if (value && value.trim() !== '') {
    // Handle department_name search separately (need to search departments first)
    if (field === 'department_name') {
      // Find matching departments first
      const matchingDepts = await prisma.departments.findMany({
        where: { dept_name: { contains: value } },
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

  console.log('Departments query result:', data);
  return data;
}
