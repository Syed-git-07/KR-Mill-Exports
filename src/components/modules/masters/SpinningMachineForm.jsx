'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

const spinningMachineSchema = z.object({
  frame_no: z.number().optional(),
  machine_no: z.string().min(1, 'Machine number is required'),
  mc_id: z.string().default('225'),
  description: z.string().min(1, 'Description is required'),
  make_name: z.string().default('LMW'),
  model: z.string().optional().nullable(),
  spindles: z.number().min(1, 'Spindles count is required').default(1104),
  group_no: z.number().default(0),
  installed_date: z.string().optional(),
  is_active: z.boolean().default(true),
  production_kgs_manual_entry: z.boolean().default(false),
  direct_hank_entry: z.boolean().default(true),
  remarks: z.string().optional().nullable()
});

export default function SpinningMachineForm({ initialData, onSubmit }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(spinningMachineSchema),
    defaultValues: initialData || {
      frame_no: null,
      machine_no: '',
      mc_id: '225',
      description: '',
      make_name: 'LMW',
      model: '',
      spindles: 1104,
      group_no: 0,
      installed_date: '2015-04-01',
      is_active: true,
      production_kgs_manual_entry: false,
      direct_hank_entry: true,
      remarks: ''
    }
  });

  const isActive = watch('is_active');
  const productionKgsManual = watch('production_kgs_manual_entry');
  const directHankEntry = watch('direct_hank_entry');

  const onFormSubmit = async (data) => {
    const formattedData = {
      ...data,
      frame_no: data.frame_no ? parseInt(data.frame_no) : null,
      spindles: parseInt(data.spindles),
      group_no: parseInt(data.group_no),
      model: data.model || null,
      remarks: data.remarks || null
    };
    
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Frame No */}
        <div className="space-y-2">
          <Label htmlFor="frame_no">Frame No.</Label>
          <Input
            id="frame_no"
            type="number"
            {...register('frame_no', { valueAsNumber: true })}
            className="bg-gray-100"
            readOnly={!!initialData}
          />
        </div>

        {/* M/c ID */}
        <div className="space-y-2">
          <Label htmlFor="mc_id">M/c ID *</Label>
          <Input
            id="mc_id"
            {...register('mc_id')}
            className={errors.mc_id ? 'border-red-500' : ''}
          />
        </div>

        {/* Description - Full Width */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Description *</Label>
          <Input
            id="description"
            {...register('description')}
            className={errors.description ? 'border-red-500' : ''}
          />
          {errors.description && (
            <p className="text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>

        {/* Make Name */}
        <div className="space-y-2">
          <Label htmlFor="make_name">Make Name *</Label>
          <Input
            id="make_name"
            {...register('make_name')}
            className={errors.make_name ? 'border-red-500' : ''}
          />
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            {...register('model')}
          />
        </div>

        {/* No. of Spindles */}
        <div className="space-y-2">
          <Label htmlFor="spindles">No. of Spindles *</Label>
          <Input
            id="spindles"
            type="number"
            {...register('spindles', { valueAsNumber: true })}
            className={errors.spindles ? 'border-red-500' : ''}
          />
          {errors.spindles && (
            <p className="text-xs text-red-500">{errors.spindles.message}</p>
          )}
        </div>

        {/* Group No */}
        <div className="space-y-2">
          <Label htmlFor="group_no">Group No *</Label>
          <Input
            id="group_no"
            type="number"
            {...register('group_no', { valueAsNumber: true })}
          />
        </div>

        {/* Installed Date */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="installed_date">Installed Date *</Label>
          <Input
            id="installed_date"
            type="date"
            {...register('installed_date')}
          />
        </div>

        {/* Active Checkbox */}
        <div className="space-y-2 flex items-center gap-2">
          <Checkbox
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue('is_active', checked)}
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            Active
          </Label>
        </div>

        {/* Production Kgs Manual Entry */}
        <div className="space-y-2 flex items-center gap-2">
          <Checkbox
            id="production_kgs_manual_entry"
            checked={productionKgsManual}
            onCheckedChange={(checked) => setValue('production_kgs_manual_entry', checked)}
          />
          <Label htmlFor="production_kgs_manual_entry" className="cursor-pointer text-sm">
            Production Kgs Manual Entry
          </Label>
        </div>

        {/* Direct Hank Entry */}
        <div className="space-y-2 flex items-center gap-2 col-span-2">
          <Checkbox
            id="direct_hank_entry"
            checked={directHankEntry}
            onCheckedChange={(checked) => setValue('direct_hank_entry', checked)}
          />
          <Label htmlFor="direct_hank_entry" className="cursor-pointer">
            Direct Hank Entry
          </Label>
        </div>
      </div>

      {/* Remarks - Full Width */}
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea
          id="remarks"
          {...register('remarks')}
          rows={3}
          className="resize-none"
        />
      </div>
    </form>
  );
}
