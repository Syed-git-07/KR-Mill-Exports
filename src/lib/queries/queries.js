import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';
import { softDeleteMasterRecord } from './masterSoftDelete';

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

const DEPARTMENT_SEQUENCE_RETRIES = 4;

function isDepartmentSequenceConflict(error) {
  return error?.code === 'P2002' || error?.code === 'P2034';
}

// Create a new department with a server-owned, monotonic display sequence.
export async function createDepartment(departmentData) {
  const mutableData = {
    dept_name: departmentData.dept_name,
    hok: departmentData.hok,
    is_active: departmentData.is_active ?? true
  };

  for (let attempt = 1; attempt <= DEPARTMENT_SEQUENCE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(async tx => {
        const [codeAggregate, serialAggregate] = await Promise.all([
          tx.departments.aggregate({ _max: { code: true } }),
          tx.departments.aggregate({ _max: { sl_no: true } })
        ]);
        const nextSequence = Math.max(
          codeAggregate._max.code ?? 0,
          serialAggregate._max.sl_no ?? 0
        ) + 1;

        return tx.departments.create({
          data: {
            ...mutableData,
            code: nextSequence,
            sl_no: nextSequence
          }
        });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (attempt === DEPARTMENT_SEQUENCE_RETRIES || !isDepartmentSequenceConflict(error)) {
        throw error;
      }
    }
  }

  throw new Error('Unable to allocate a department sequence');
}

// Update department
export async function updateDepartment(id, departmentData) {
  return prisma.departments.update({
    where: { id },
    data: {
      ...(departmentData.dept_name !== undefined && { dept_name: departmentData.dept_name }),
      ...(departmentData.hok !== undefined && { hok: departmentData.hok }),
      ...(departmentData.is_active !== undefined && { is_active: departmentData.is_active })
    }
  });
}

// Soft-delete a department while retaining historical references.
export async function deleteDepartment(id) {
  return softDeleteMasterRecord(prisma.departments, id, {
    recordLabel: 'Department'
  });
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
