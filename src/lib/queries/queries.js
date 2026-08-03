import { prisma } from '../prisma';
import { deleteUnusedDepartment } from './masterDeletion';

const DEPARTMENT_FIELDS = new Set(['code', 'dept_name', 'sl_no', 'hok', 'is_active']);
const OPERATIONAL_DEPARTMENT_NAMES = new Set([
  'AUTOCONER',
  'BREAKER DRAWING',
  'CARDING',
  'COMBER',
  'FINISHER DRAWING',
  'LAP FORMER',
  'SIMPLEX',
  'SPINNING',
]);

const normalizeDepartmentName = value => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

function cleanDepartmentData(departmentData = {}, { creating = false } = {}) {
  const data = {};
  for (const [key, value] of Object.entries(departmentData)) {
    if (!DEPARTMENT_FIELDS.has(key) || value === undefined) continue;
    if (key === 'dept_name') {
      data.dept_name = String(value ?? '').trim();
    } else if (key === 'is_active') {
      if (typeof value !== 'boolean') throw new Error('Active status must be true or false');
      data.is_active = value;
    } else {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new Error(`${key} must be a non-negative number`);
      data[key] = key === 'hok' ? number : Math.trunc(number);
    }
  }

  if ((creating || Object.prototype.hasOwnProperty.call(data, 'dept_name')) && (data.dept_name?.length ?? 0) < 2) {
    throw new Error('Department name must be at least 2 characters');
  }
  if (creating && data.sl_no == null) throw new Error('SL.NO is required');
  if (creating && data.is_active === undefined) data.is_active = true;
  return data;
}

async function assertUniqueDepartment(transaction, data, excludeId = null) {
  const checks = [];
  if (data.dept_name) checks.push({ dept_name: { equals: data.dept_name } });
  if (data.code != null) checks.push({ code: data.code });
  if (data.sl_no != null) checks.push({ sl_no: data.sl_no });
  if (!checks.length) return;

  const duplicate = await transaction.departments.findFirst({
    where: {
      OR: checks,
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { dept_name: true, code: true, sl_no: true }
  });
  if (!duplicate) return;
  if (data.dept_name && duplicate.dept_name.toLowerCase() === data.dept_name.toLowerCase()) {
    throw new Error(`Department "${data.dept_name}" already exists`);
  }
  if (data.code != null && duplicate.code === data.code) throw new Error(`Department code ${data.code} already exists`);
  throw new Error(`Department SL.NO ${data.sl_no} already exists`);
}

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
  const cleanData = cleanDepartmentData(departmentData, { creating: true });
  return prisma.$transaction(async transaction => {
    await assertUniqueDepartment(transaction, cleanData);
    return transaction.departments.create({ data: cleanData });
  });
}

// Update department
export async function updateDepartment(id, departmentData) {
  if (!id) throw new Error('Department ID is required');
  const cleanData = cleanDepartmentData(departmentData);
  return prisma.$transaction(async transaction => {
    const existing = await transaction.departments.findUnique({ where: { id } });
    if (!existing) throw new Error('Department not found');
    if (
      cleanData.dept_name &&
      OPERATIONAL_DEPARTMENT_NAMES.has(normalizeDepartmentName(existing.dept_name)) &&
      normalizeDepartmentName(cleanData.dept_name) !== normalizeDepartmentName(existing.dept_name)
    ) {
      const error = new Error(
        `Department "${existing.dept_name}" is an operational system key and cannot be renamed. ` +
        'Its other attributes can still be updated.'
      );
      error.code = 'OPERATIONAL_DEPARTMENT_RENAME';
      throw error;
    }
    await assertUniqueDepartment(transaction, cleanData, id);

    const updated = await transaction.departments.update({ where: { id }, data: cleanData });
    if (cleanData.dept_name && cleanData.dept_name !== existing.dept_name) {
      await transaction.employee_master.updateMany({
        where: { department: existing.dept_name },
        data: { department: cleanData.dept_name }
      });
    }
    return updated;
  });
}

// Delete department
export async function deleteDepartment(id) {
  return deleteUnusedDepartment(id);
}

// Search departments
export async function searchDepartments(field, condition, value) {
  try {
    const allowedFields = new Set(['dept_name', 'sl_no', 'code', 'hok', 'is_active']);
    if (!allowedFields.has(field)) throw new Error('Unsupported department search field');
    let whereClause = {};

    const trimmedValue = String(value ?? '').trim();
    if (trimmedValue !== '') {
      const numericFields = new Set(['sl_no', 'code', 'hok']);
      const parseSearchValue = () => {
        if (numericFields.has(field)) {
          const parsed = Number(trimmedValue);
          if (!Number.isFinite(parsed) || (field !== 'hok' && !Number.isInteger(parsed))) {
            throw new Error(`${field} must be a valid ${field === 'hok' ? 'number' : 'whole number'}`);
          }
          return parsed;
        }
        if (field === 'is_active') {
          const normalized = trimmedValue.toLowerCase();
          if (['true', 'active', '1', 'yes'].includes(normalized)) return true;
          if (['false', 'inactive', '0', 'no'].includes(normalized)) return false;
          throw new Error('Active status must be true/false or active/inactive');
        }
        return trimmedValue;
      };

      const parsedValue = parseSearchValue();
      
      switch (condition) {
        case 'Like':
          if (numericFields.has(field) || field === 'is_active') {
            // Prisma/MySQL cannot apply substring matching to numeric/boolean columns.
            whereClause[field] = parsedValue;
          } else {
            // MySQL doesn't support mode: 'insensitive', but string comparisons are case-insensitive by default
            whereClause[field] = { contains: parsedValue };
          }
          break;
        case 'Equal':
          whereClause[field] = parsedValue;
          break;
        case 'Not Equal':
          whereClause[field] = { not: parsedValue };
          break;
        case 'Greater':
          if (!numericFields.has(field)) throw new Error('Greater is only supported for numeric fields');
          whereClause[field] = { gt: parsedValue };
          break;
        case 'Less':
          if (!numericFields.has(field)) throw new Error('Less is only supported for numeric fields');
          whereClause[field] = { lt: parsedValue };
          break;
        default:
          throw new Error('Unsupported department search condition');
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
