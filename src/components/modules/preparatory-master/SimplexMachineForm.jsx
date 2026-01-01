'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect } from 'react';

// VB6 Form Fields: M/C No., M/c ID, Description, Make Name, Model, 
// ProdnMixing, Speed, Prodn Effi., M/c Effi., TPI, No. of Spindles,
// Installed Date, Active, Direct Hank Entry, Direct Prod Kgs
// NOTE: Simplex has 3 additional fields: mc_effi, tpi, no_of_spindles

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
  mc_effi: z.coerce.number()
    .min(0, 'M/C Efficiency must be 0 or greater')
    .max(100, 'M/C Efficiency must be 100 or less')
    .optional()
    .or(z.literal('')),
  tpi: z.coerce.number()           // NEW: TPI value
    .min(0, 'TPI must be 0 or greater')
    .optional()
    .or(z.literal('')),
  no_of_spindles: z.coerce.number()  // NEW: Number of Spindles
    .min(0, 'No. of Spindles must be 0 or greater')
    .optional()
    .or(z.literal('')),
  installed_date: z.string()
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(true),
  direct_hank_entry: z.boolean().default(false),
  direct_kgs_entry: z.boolean().default(false),
});

export default function SimplexMachineForm({ initialData, onSubmit, isLoading }) {
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
      mc_effi: initialData?.mc_effi || '',
      tpi: initialData?.tpi || '',               // NEW
      no_of_spindles: initialData?.no_of_spindles || '',  // NEW
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
        mc_effi: initialData.mc_effi || '',
        tpi: initialData.tpi || '',               // NEW
        no_of_spindles: initialData.no_of_spindles || '',  // NEW
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
        mc_effi: '',
        tpi: '',               // NEW
        no_of_spindles: '',    // NEW
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
      mc_effi: data.mc_effi === '' ? null : Number(data.mc_effi),
      tpi: data.tpi === '' ? null : Number(data.tpi),                        // NEW
      no_of_spindles: data.no_of_spindles === '' ? null : Number(data.no_of_spindles),  // NEW
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

      {/* Row 3: Speed, Prodn Effi, M/C Effi */}
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
          <Label htmlFor="mc_effi">M/C Effi. (%)</Label>
          <Input
            id="mc_effi"
            type="number"
            placeholder="Enter M/C efficiency"
            {...register('mc_effi')}
            className={errors.mc_effi ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.mc_effi && (
            <p className="text-xs text-red-500">{errors.mc_effi.message}</p>
          )}
        </div>
      </div>

      {/* Row 4: TPI, No. of Spindles, Installed Date (NEW ROW) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tpi">TPI</Label>
          <Input
            id="tpi"
            type="number"
            step="0.01"
            placeholder="Enter TPI value"
            {...register('tpi')}
            className={errors.tpi ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.tpi && (
            <p className="text-xs text-red-500">{errors.tpi.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="no_of_spindles">No. of Spindles</Label>
          <Input
            id="no_of_spindles"
            type="number"
            placeholder="Enter number of spindles"
            {...register('no_of_spindles')}
            className={errors.no_of_spindles ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.no_of_spindles && (
            <p className="text-xs text-red-500">{errors.no_of_spindles.message}</p>
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

      {/* Row 5: Checkboxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue('is_active', checked)}
            disabled={isLoading}
          />
          <Label htmlFor="is_active" className="cursor-pointer">Is Active</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="direct_hank_entry"
            checked={directHankEntry}
            onCheckedChange={(checked) => setValue('direct_hank_entry', checked)}
            disabled={isLoading}
          />
          <Label htmlFor="direct_hank_entry" className="cursor-pointer">Direct Hank Entry</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="direct_kgs_entry"
            checked={directKgsEntry}
            onCheckedChange={(checked) => setValue('direct_kgs_entry', checked)}
            disabled={isLoading}
          />
          <Label htmlFor="direct_kgs_entry" className="cursor-pointer">Direct Prod Kgs</Label>
        </div>
      </div>
    </form>
  );
}
