import { prisma } from '../prisma';

/**
 * Department Master CRUD Operations
 */

// Get all departments
export async function getDepartments() {
  try {
    const data = await prisma.departments.findMany({
      select: {
        id: true,
        code: true,
        dept_name: true,
        sl_no: true,
        hok: true,
        is_active: true
      },
      orderBy: { sl_no: 'asc' }
    });
    return data;
  } catch (error) {
    throw error;
  }
}

// Create new department
export async function createDepartment(departmentData) {
  try {
    const data = await prisma.departments.create({
      data: departmentData
    });
    return data;
  } catch (error) {
    throw error;
  }
}

// Update department
export async function updateDepartment(id, departmentData) {
  try {
    const data = await prisma.departments.update({
      where: { id },
      data: departmentData
    });
    return data;
  } catch (error) {
    throw error;
  }
}

// Delete department
export async function deleteDepartment(id) {
  try {
    await prisma.departments.delete({
      where: { id }
    });
    return true;
  } catch (error) {
    throw error;
  }
}

// Search departments
export async function searchDepartments(field, condition, value) {
  try {
    let whereClause = {};

    if (value && value.trim() !== '') {
      // Clean the value
      const trimmedValue = value.trim();
      
      switch (condition) {
        case 'Like':
          // For numeric fields with Like, convert to string search
          if (field === 'sl_no' || field === 'code') {
            const numValue = parseInt(trimmedValue);
            if (!isNaN(numValue)) {
              whereClause = {
                OR: [
                  { sl_no: numValue },
                  { code: numValue }
                ]
              };
            }
          } else {
            // MySQL doesn't support mode: 'insensitive', but string comparisons are case-insensitive by default
            whereClause[field] = { contains: trimmedValue };
          }
          break;
        case 'Equal':
          if (field === 'sl_no' || field === 'code') {
            const numValue = parseInt(trimmedValue);
            if (!isNaN(numValue)) {
              whereClause[field] = numValue;
            }
          } else {
            whereClause[field] = trimmedValue;
          }
          break;
        case 'Not Equal':
          if (field === 'sl_no' || field === 'code') {
            const numValue = parseInt(trimmedValue);
            if (!isNaN(numValue)) {
              whereClause[field] = { not: numValue };
            }
          } else {
            whereClause[field] = { not: trimmedValue };
          }
          break;
        case 'Greater':
          if (field === 'sl_no' || field === 'code') {
            const numValue = parseInt(trimmedValue);
            if (!isNaN(numValue)) {
              whereClause[field] = { gt: numValue };
            }
          }
          break;
        case 'Less':
          if (field === 'sl_no' || field === 'code') {
            const numValue = parseInt(trimmedValue);
            if (!isNaN(numValue)) {
              whereClause[field] = { lt: numValue };
            }
          }
          break;
      }
    }

    const data = await prisma.departments.findMany({
      where: whereClause,
      select: {
        id: true,
        code: true,
        dept_name: true,
        sl_no: true,
        hok: true,
        is_active: true
      },
      orderBy: { sl_no: 'asc' }
    });

    return data;
  } catch (error) {
    throw error;
  }
}
