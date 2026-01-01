'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDepartmentsForDropdown } from '@/lib/supabase/supervisorQueries';

const supervisorSchema = z.object({
  supervisor_name: z.string().min(2, 'Supervisor name must be at least 2 characters'),
  department_id: z.string().uuid('Please select a department').optional().nullable(),
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
      department_id: ''
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
    }
  }, [initialData, setValue]);

  const loadDepartments = async () => {
    try {
      const data = await getDepartmentsForDropdown();
      setDepartments(data);
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  const onFormSubmit = async (data) => {
    const formattedData = {
      supervisor_name: data.supervisor_name,
      department_id: data.department_id || null
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
