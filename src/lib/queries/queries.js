import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';

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
    const whereClause = buildTypedSearchWhere(field, condition, value, {
      dept_name: 'text', sl_no: 'number', code: 'number'
    });

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
