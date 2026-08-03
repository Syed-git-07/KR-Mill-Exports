'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDepartmentsAction } from '@/app/actions/supervisor';

const supervisorSchema = z.object({
  supervisor_name: z.string().min(2, 'Supervisor name must be at least 2 characters'),
  department_id: z.string().uuid('Please select a department').optional().nullable(),
  is_active: z.boolean().default(true),
});

export default function SupervisorForm({ initialData, onSubmit, isLoading }) {
  const [departments, setDepartments] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(supervisorSchema),
    defaultValues: initialData || {
      supervisor_name: '',
      department_id: '',
      is_active: true
    }
  });

  const departmentId = watch('department_id');

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (initialData) {
      setValue('supervisor_name', initialData.supervisor_name || '');
      setValue('department_id', initialData.department_id || '');
      setValue('is_active', initialData.is_active ?? true);
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
      supervisor_name: data.supervisor_name,
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

      {/* Supervisor Name */}
      <div className="space-y-2">
        <Label htmlFor="supervisor_name">Name *</Label>
        <Input
          id="supervisor_name"
          {...register('supervisor_name')}
          className={errors.supervisor_name ? 'border-red-500' : ''}
          placeholder="Enter supervisor name"
        />
        {errors.supervisor_name && (
          <p className="text-xs text-red-500">{errors.supervisor_name.message}</p>
        )}
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
              <SelectItem
                key={dept.id}
                value={dept.id}
                disabled={!dept.is_active && dept.id !== initialData?.department_id}
              >
                {dept.dept_name}{!dept.is_active ? ' (Inactive)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.department_id && (
          <p className="text-xs text-red-500">{errors.department_id.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_active"
          checked={watch('is_active')}
          onCheckedChange={(checked) => setValue('is_active', checked === true)}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>
    </form>
  );
}
