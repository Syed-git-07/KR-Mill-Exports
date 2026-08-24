import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';
import { findActivePayrollEmployeeById, getPayrollEmployeesByIds } from '../payroll/employees';
import { resolveHistoricalEmployeeIdentity } from '../payroll/historicalEmployeeIdentity';

/**
 * Supervisor Master CRUD Operations
 */

async function hydrateSupervisors(data) {
  const departmentIds = [...new Set(data.map(s => s.department_id).filter(Boolean))];
  const payrollIds = [...new Set(data.map(s => s.payroll_employee_id).filter(Boolean))];
  const [departments, employees] = await Promise.all([
    departmentIds.length > 0 ? prisma.departments.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, dept_name: true }
    }) : [],
    getPayrollEmployeesByIds(payrollIds)
  ]);

  const departmentMap = Object.fromEntries(departments.map(d => [d.id, d.dept_name]));
  const employeeById = new Map(employees.map(employee => [Number(employee.id), employee]));

  return data.map(supervisor => {
    const employee = employeeById.get(Number(supervisor.payroll_employee_id)) || null;
    const identity = resolveHistoricalEmployeeIdentity({
      payrollEmployeeId: supervisor.payroll_employee_id,
      snapshotName: supervisor.supervisor_name,
      employee,
      assignmentKey: `supervisor:${supervisor.id}`
    });
    return {
      ...supervisor,
      supervisor_name_snapshot: supervisor.supervisor_name,
      supervisor_name: identity.displayName,
      identity_status: identity.identityStatus,
      payroll_name: employee?.emp_name || '',
      token_no: employee?.token_no || '',
      employee_code: employee?.employee_code || '',
      payroll_status: employee?.status || (identity.identityStatus === 'UNRESOLVED_LEGACY' ? 'Unmapped' : 'Unavailable'),
      dept_name: departmentMap[supervisor.department_id] || ''
    };
  });
}

// Get all local supervisor/maisitry role assignments with payroll identity.
export async function getSupervisors() {
  const data = await prisma.supervisors.findMany({ orderBy: { code: 'asc' } });
  return hydrateSupervisors(data);
}

// Create new supervisor
export async function createSupervisor(supervisorData) {
  const employee = await findActivePayrollEmployeeById(supervisorData.payroll_employee_id);
  if (!employee) throw new Error('Select an active employee from the configured payroll company.');

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
    data: {
      ...supervisorData,
      payroll_employee_id: employee.payroll_employee_id,
      supervisor_name: employee.emp_name,
      code
    }
  });

  return data;
}

// Update supervisor
export async function updateSupervisor(id, supervisorData) {
  const current = await prisma.supervisors.findUnique({ where: { id } });
  if (!current) throw new Error('Supervisor role not found.');
  const nextActive = supervisorData.is_active ?? current.is_active ?? true;
  const requestedPayrollId = supervisorData.payroll_employee_id ?? current.payroll_employee_id;
  const employee = requestedPayrollId ? await findActivePayrollEmployeeById(requestedPayrollId) : null;
  const changedPayrollId = supervisorData.payroll_employee_id != null && Number(supervisorData.payroll_employee_id) !== Number(current.payroll_employee_id);
  if (nextActive && !employee) throw new Error('An active supervisor role must use an active employee from the configured payroll company.');
  if (changedPayrollId && !employee) throw new Error('Select an active employee from the configured payroll company.');

  const updates = { ...supervisorData };
  if (employee) {
    updates.payroll_employee_id = employee.payroll_employee_id;
    updates.supervisor_name = employee.emp_name;
  } else {
    // Deactivation of an unresolved or now-inactive legacy assignment is valid;
    // preserve its historical identity fields rather than replacing them.
    delete updates.payroll_employee_id;
  }
  const data = await prisma.supervisors.update({
    where: { id },
    data: updates
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

  return hydrateSupervisors(data);
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
