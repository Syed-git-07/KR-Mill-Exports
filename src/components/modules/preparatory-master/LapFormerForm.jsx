'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect } from 'react';

// VB6 Form Fields: M/C No., M/c ID, Description, Make Name, Model, 
// ProdnMixing, Speed, Prodn Effi., Installed Date, Active, Hank Entry, Actual Kgs
// NOTE: Same as Drawing Breaker/Finisher - NO mc_effi, tpi, spindles

const formSchema = z.object({
  machine_no: z.string()
    .min(1, 'Machine No. is required')
    .max(20, 'Machine No. must be 20 characters or less'),
  mc_id: z.string()
    .max(20, 'M/c ID must be 20 characters or less')
    .optional()
    .or(z.literal('')),
  description: z.string()
    .min(1, 'Description is required')
    .max(100, 'Description must be 100 characters or less'),
  make_name: z.string()
    .max(50, 'Make Name must be 50 characters or less')
    .optional()
    .or(z.literal('')),
  model: z.string()
    .max(50, 'Model must be 50 characters or less')
    .optional()
    .or(z.literal('')),
  prodn_mixing: z.string()
    .max(50, 'Prodn Mixing must be 50 characters or less')
    .optional()
    .or(z.literal('')),
  speed: z.coerce.number()
    .min(0, 'Speed must be 0 or greater')
    .optional()
    .or(z.literal('')),
  prodn_effi: z.coerce.number()
    .min(0, 'Prodn Efficiency must be 0 or greater')
    .max(100, 'Prodn Efficiency must be 100 or less')
    .optional()
    .or(z.literal('')),
  installed_date: z.string()
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(true),
  direct_hank_entry: z.boolean().default(false),
  direct_kgs_entry: z.boolean().default(false),
});

export default function LapFormerForm({ initialData, onSubmit, isLoading }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      machine_no: initialData?.machine_no || '',
      mc_id: initialData?.mc_id != null ? String(initialData.mc_id) : '',
      description: initialData?.description || '',
      make_name: initialData?.make_name || '',
      model: initialData?.model || '',
      prodn_mixing: initialData?.prodn_mixing || '',
      speed: initialData?.speed || '',
      prodn_effi: initialData?.prodn_efficiency || '',
      installed_date: initialData?.installed_date || '',
      is_active: initialData?.is_active ?? true,
      direct_hank_entry: initialData?.direct_hank_entry ?? false,
      direct_kgs_entry: initialData?.direct_kgs_entry ?? false,
    },
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

  // Watch boolean values for Checkbox components
  const isActive = watch('is_active');
  const directHankEntry = watch('direct_hank_entry');
  const directKgsEntry = watch('direct_kgs_entry');

  useEffect(() => {
    if (initialData) {
      reset({
        machine_no: initialData.machine_no || '',
        mc_id: initialData.mc_id != null ? String(initialData.mc_id) : '',
        description: initialData.description || '',
        make_name: initialData.make_name || '',
        model: initialData.model || '',
        prodn_mixing: initialData.prodn_mixing || '',
        speed: initialData.speed || '',
        prodn_effi: initialData.prodn_efficiency || '',
        installed_date: initialData.installed_date || '',
        is_active: initialData.is_active ?? true,
        direct_hank_entry: initialData.direct_hank_entry ?? false,
        direct_kgs_entry: initialData.direct_kgs_entry ?? false,
      });
    } else {
      reset({
        machine_no: '',
        mc_id: '',
        description: '',
        make_name: '',
        model: '',
        prodn_mixing: '',
        speed: '',
        prodn_effi: '',
        installed_date: '',
        is_active: true,
        direct_hank_entry: false,
        direct_kgs_entry: false,
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = (data) => {
    // Clean up the data - convert empty strings to null for numeric fields
    const cleanedData = {
      ...data,
      speed: data.speed === '' ? null : Number(data.speed),
      prodn_effi: data.prodn_effi === '' ? null : Number(data.prodn_effi),
      installed_date: data.installed_date || null,
      mc_id: data.mc_id ? Number(data.mc_id) : null,
      make_name: data.make_name || null,
      model: data.model || null,
      prodn_mixing: data.prodn_mixing || null,
    };
    onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Row 1: Machine No, M/c ID, Description */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="machine_no">M/C No. <span className="text-red-500">*</span></Label>
          <Input
            id="machine_no"
            placeholder="Enter machine number"
            {...register('machine_no')}
            className={errors.machine_no ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.machine_no && (
            <p className="text-xs text-red-500">{errors.machine_no.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="mc_id">M/c ID</Label>
          <Input
            id="mc_id"
            placeholder="Enter M/c ID"
            {...register('mc_id')}
            className={errors.mc_id ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.mc_id && (
            <p className="text-xs text-red-500">{errors.mc_id.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
          <Input
            id="description"
            placeholder="Enter description"
            {...register('description')}
            className={errors.description ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.description && (
            <p className="text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>
      </div>

      {/* Row 2: Make Name, Model, Prodn Mixing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="make_name">Make Name</Label>
          <Input
            id="make_name"
            placeholder="Enter make name"
            {...register('make_name')}
            className={errors.make_name ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.make_name && (
            <p className="text-xs text-red-500">{errors.make_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            placeholder="Enter model"
            {...register('model')}
            className={errors.model ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.model && (
            <p className="text-xs text-red-500">{errors.model.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prodn_mixing">Prodn Mixing</Label>
          <Input
            id="prodn_mixing"
            placeholder="Enter production mixing"
            {...register('prodn_mixing')}
            className={errors.prodn_mixing ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.prodn_mixing && (
            <p className="text-xs text-red-500">{errors.prodn_mixing.message}</p>
          )}
        </div>
      </div>

      {/* Row 3: Speed, Prodn Effi, Installed Date */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="speed">Speed</Label>
          <Input
            id="speed"
            type="number"
            placeholder="Enter speed"
            {...register('speed')}
            className={errors.speed ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.speed && (
            <p className="text-xs text-red-500">{errors.speed.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prodn_effi">Prodn Effi. (%)</Label>
          <Input
            id="prodn_effi"
            type="number"
            placeholder="Enter production efficiency"
            {...register('prodn_effi')}
            className={errors.prodn_effi ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.prodn_effi && (
            <p className="text-xs text-red-500">{errors.prodn_effi.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="installed_date">Installed Date</Label>
          <Input
            id="installed_date"
            type="date"
            {...register('installed_date')}
            className={errors.installed_date ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.installed_date && (
            <p className="text-xs text-red-500">{errors.installed_date.message}</p>
          )}
        </div>
      </div>

      {/* Row 4: Checkboxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue('is_active', checked)}
            disabled={isLoading}
          />
          <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="direct_hank_entry"
            checked={directHankEntry}
            onCheckedChange={(checked) => setValue('direct_hank_entry', checked)}
            disabled={isLoading}
          />
          <Label htmlFor="direct_hank_entry" className="cursor-pointer">Hank Entry</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="direct_kgs_entry"
            checked={directKgsEntry}
            onCheckedChange={(checked) => setValue('direct_kgs_entry', checked)}
            disabled={isLoading}
          />
          <Label htmlFor="direct_kgs_entry" className="cursor-pointer">Actual Kgs</Label>
        </div>
      </div>
    </form>
  );
}
