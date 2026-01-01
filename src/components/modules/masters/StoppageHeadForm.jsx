'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const stoppageHeadSchema = z.object({
  code: z.number().optional(),
  stoppage_head_name: z.string().min(1, 'Stoppage Head Name is required'),
  description: z.string().optional().nullable()
});

export default function StoppageHeadForm({ initialData, onSubmit }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(stoppageHeadSchema),
    defaultValues: initialData || {
      code: null,
      stoppage_head_name: '',
      description: ''
    }
  });

  const onFormSubmit = async (data) => {
    const formattedData = {
      ...data,
      code: data.code ? parseInt(data.code) : null,
      description: data.description || null
    };
    
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Code */}
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            type="number"
            {...register('code', { valueAsNumber: true })}
            className="bg-gray-100"
            readOnly={!!initialData}
          />
        </div>

        {/* Stoppage Head Master - Full Width */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="stoppage_head_name">Stoppage Head Master *</Label>
          <Input
            id="stoppage_head_name"
            {...register('stoppage_head_name')}
            className={errors.stoppage_head_name ? 'border-red-500' : ''}
          />
          {errors.stoppage_head_name && (
            <p className="text-xs text-red-500">{errors.stoppage_head_name.message}</p>
          )}
        </div>
      </div>

      {/* Description - Full Width */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          rows={3}
          className="resize-none"
        />
      </div>
    </form>
  );
}
