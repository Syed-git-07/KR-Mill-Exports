'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const departmentSchema = z.object({
  dept_name: z.string().min(2, 'Department name must be at least 2 characters'),
  hok: z.number().min(0, 'H.O.K must be positive')
});

export default function DepartmentForm({ initialData, onSubmit }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      dept_name: initialData?.dept_name || '',
      hok: initialData?.hok == null ? 0.2 : Number(initialData.hok)
    }
  });

  const onFormSubmit = async (data) => {
    const formattedData = {
      ...data,
      hok: parseFloat(data.hok)
    };
    
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Code and serial number are assigned automatically when the department is created.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Department Name */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="dept_name">Department *</Label>
          <Input
            id="dept_name"
            {...register('dept_name')}
            className={errors.dept_name ? 'border-red-500' : ''}
          />
          {errors.dept_name && (
            <p className="text-xs text-red-500">{errors.dept_name.message}</p>
          )}
        </div>

        {/* H.O.K */}
        <div className="space-y-2">
          <Label htmlFor="hok">H.O.K *</Label>
          <Input
            id="hok"
            type="number"
            step="0.1"
            {...register('hok', { valueAsNumber: true })}
            className={errors.hok ? 'border-red-500' : ''}
          />
          {errors.hok && (
            <p className="text-xs text-red-500">{errors.hok.message}</p>
          )}
        </div>
      </div>
    </form>
  );
}
