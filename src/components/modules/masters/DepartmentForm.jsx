'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const departmentSchema = z.object({
  code: z.number().min(0, 'Code must be positive'),
  dept_name: z.string().min(2, 'Department name must be at least 2 characters'),
  sl_no: z.number().min(0, 'SL.NO must be positive'),
  hok: z.number().min(0, 'H.O.K must be positive')
});

export default function DepartmentForm({ initialData, onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(departmentSchema),
    defaultValues: initialData || {
      code: '',
      dept_name: '',
      sl_no: '',
      hok: 0.2
    }
  });

  const onFormSubmit = async (data) => {
    const formattedData = {
      ...data,
      code: parseInt(data.code),
      sl_no: parseInt(data.sl_no),
      hok: parseFloat(data.hok)
    };
    
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Code */}
        <div className="space-y-2">
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            type="number"
            {...register('code', { valueAsNumber: true })}
            className={errors.code ? 'border-red-500' : ''}
            readOnly={!!initialData}
          />
          {errors.code && (
            <p className="text-xs text-red-500">{errors.code.message}</p>
          )}
        </div>

        {/* SL.NO */}
        <div className="space-y-2">
          <Label htmlFor="sl_no">SL.NO *</Label>
          <Input
            id="sl_no"
            type="number"
            {...register('sl_no', { valueAsNumber: true })}
            className={errors.sl_no ? 'border-red-500' : ''}
          />
          {errors.sl_no && (
            <p className="text-xs text-red-500">{errors.sl_no.message}</p>
          )}
        </div>

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
