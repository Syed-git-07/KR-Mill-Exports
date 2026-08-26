'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDepartmentsAction } from '@/app/actions/supervisor';
import EmployeeAutocomplete from '@/components/ui/employee-autocomplete';
import { Checkbox } from '@/components/ui/checkbox';

const supervisorSchema = z.object({
  payroll_employee_id: z.union([z.coerce.number().int().positive(), z.null()]),
  department_id: z.string().uuid('Please select a department').optional().nullable(),
  is_active: z.boolean()
}).superRefine((data, context) => {
  if (data.is_active && !data.payroll_employee_id) {
    context.addIssue({
      code: 'custom',
      path: ['payroll_employee_id'],
      message: 'Select an employee from Payroll for an active role'
    })
  }
});

export default function SupervisorForm({ initialData, onSubmit, isLoading }) {
  const [departments, setDepartments] = useState([]);
  const [employeeName, setEmployeeName] = useState(
    initialData?.payroll_name || initialData?.supervisor_name_snapshot || ''
  );

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(supervisorSchema),
    defaultValues: {
      payroll_employee_id: initialData?.payroll_employee_id || null,
      department_id: '',
      is_active: initialData?.is_active ?? true
    }
  });

  const departmentId = watch('department_id');
  const payrollEmployeeId = watch('payroll_employee_id');
  const isActive = watch('is_active');

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (initialData) {
      setEmployeeName(initialData.payroll_name || initialData.supervisor_name_snapshot || '');
      setValue('payroll_employee_id', initialData.payroll_employee_id || null);
      setValue('department_id', initialData.department_id || '');
      setValue('is_active', initialData.is_active ?? true);
    } else {
      setEmployeeName('');
      setValue('payroll_employee_id', null);
      setValue('department_id', '');
      setValue('is_active', true);
    }
  }, [initialData, setValue]);

  const loadDepartments = async () => {
    try {
      const result = await getDepartmentsAction();
      if (result.success) {
        setDepartments(result.data);
      } else {
        console.error('Failed to load departments:', result.error);
      }
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  const onFormSubmit = async (data) => {
    const formattedData = {
      payroll_employee_id: data.payroll_employee_id,
      department_id: data.department_id || null,
      is_active: data.is_active
    };
    
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Code - Read-only when editing */}
      {initialData?.code && (
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            type="number"
            value={initialData.code}
            disabled
            className="bg-gray-50"
          />
        </div>
      )}

      {/* Payroll employee identity */}
      <div className="space-y-2">
        <Label>Payroll Employee *</Label>
        <EmployeeAutocomplete
          value={employeeName}
          employeeId={payrollEmployeeId}
          onChange={(name, employee) => {
            setEmployeeName(name)
            setValue('payroll_employee_id', employee?.payroll_employee_id ?? null, {
              shouldDirty: true,
              shouldValidate: true
            })
          }}
          placeholder="Search and select a payroll employee"
          disabled={isLoading}
        />
        {errors.payroll_employee_id && (
          <p className="text-xs text-red-500">{errors.payroll_employee_id.message}</p>
        )}
        <p className="text-xs text-muted-foreground">The local department is a production role; the person identity comes from Payroll.</p>
      </div>

      <div className="flex items-center gap-2 rounded-md border p-3">
        <Checkbox
          id="supervisor_is_active"
          checked={isActive}
          onCheckedChange={(checked) => setValue('is_active', checked === true, { shouldDirty: true, shouldValidate: true })}
        />
        <div>
          <Label htmlFor="supervisor_is_active">Active production role</Label>
          <p className="text-xs text-muted-foreground">Inactive roles remain available for historical reports but cannot be selected on new entries.</p>
        </div>
      </div>

      {/* Department */}
      <div className="space-y-2">
        <Label htmlFor="department_id">Department</Label>
        <Select
          value={departmentId || ''}
          onValueChange={(value) => setValue('department_id', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.dept_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.department_id && (
          <p className="text-xs text-red-500">{errors.department_id.message}</p>
        )}
      </div>
    </form>
  );
}
