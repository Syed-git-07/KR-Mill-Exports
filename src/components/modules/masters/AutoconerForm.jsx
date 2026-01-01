'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Schema - mc_id is optional for new records (auto-generated)
const autoconerSchema = z.object({
  mc_id: z.number().optional().nullable(),
  group_id: z.number().min(1, 'Group ID is required'),
  machine_no: z.string().min(1, 'Machine number is required'),
  description: z.string().min(1, 'Description is required'),
  make_name: z.string().default('MURT'),
  model: z.string().optional().nullable(),
  from_drum: z.number().optional().nullable(),
  to_drum: z.number().optional().nullable(),
  no_of_drums: z.number().min(0).default(0),
  speed: z.number().optional().nullable(),
  count: z.string().optional().nullable(),
  act_effi: z.number().min(0).max(100).default(0),
  installed_date: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  direct_prod_entry: z.boolean().default(false)
});

// Group ID options based on actual machine groups (AC2A=2, AC4=4, AC5=5, etc.)
const groupIdOptions = [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export default function AutoconerForm({ initialData, onSubmit, onCancel }) {
  const isEditing = !!initialData?.id;
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(autoconerSchema),
    defaultValues: initialData || {
      mc_id: null,
      group_id: 5,
      machine_no: '',
      description: '',
      make_name: 'MURT',
      model: '',
      from_drum: null,
      to_drum: null,
      no_of_drums: 0,
      speed: null,
      count: '',
      act_effi: 0,
      installed_date: new Date().toISOString().split('T')[0],
      is_active: true,
      direct_prod_entry: false
    }
  });

  const isActive = watch('is_active');
  const directProdEntry = watch('direct_prod_entry');
  const mcId = watch('mc_id');
  const groupId = watch('group_id');

  const onFormSubmit = async (data) => {
    const formattedData = {
      ...data,
      // mc_id: For new records, let the backend generate it; for edit, keep existing
      mc_id: isEditing ? (parseInt(data.mc_id) || initialData.mc_id) : null,
      group_id: parseInt(data.group_id) || 5,
      act_effi: parseInt(data.act_effi) || 0,
      no_of_drums: parseInt(data.no_of_drums) || 0,
      from_drum: data.from_drum ? parseInt(data.from_drum) : null,
      to_drum: data.to_drum ? parseInt(data.to_drum) : null,
      speed: data.speed ? parseInt(data.speed) : null,
      model: data.model || null,
      count: data.count || null,
      installed_date: data.installed_date || null
    };
    
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Header Section */}
      <div className="bg-blue-50 p-3 rounded-lg mb-4">
        <h3 className="text-sm font-medium text-blue-800">Machine Make Screen : To Add, Modify Machine Make Details</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Row 1: Mc ID (read-only/auto) & Group ID */}
        <div className="space-y-2">
          <Label htmlFor="mc_id">Mc ID {isEditing ? '' : '(Auto)'}</Label>
          <Input
            id="mc_id"
            type="number"
            value={mcId || ''}
            onChange={(e) => setValue('mc_id', e.target.value ? parseInt(e.target.value) : null)}
            disabled={!isEditing}
            placeholder={isEditing ? '' : 'Auto-generated'}
            className="bg-gray-50"
          />
          <p className="text-xs text-muted-foreground">
            {isEditing ? 'Machine serial number' : 'Will be auto-assigned'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group_id">Group ID *</Label>
          <Select
            value={groupId?.toString() || '5'}
            onValueChange={(value) => setValue('group_id', parseInt(value))}
          >
            <SelectTrigger className={errors.group_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select Group" />
            </SelectTrigger>
            <SelectContent>
              {groupIdOptions.map((id) => (
                <SelectItem key={id} value={id.toString()}>
                  Group {id} (AC{id === 2 ? '2A' : id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.group_id && (
            <p className="text-xs text-red-500">{errors.group_id.message}</p>
          )}
        </div>

        {/* Row 2: M/c No. & Description */}
        <div className="space-y-2">
          <Label htmlFor="machine_no">M/c No. *</Label>
          <Input
            id="machine_no"
            {...register('machine_no')}
            className={errors.machine_no ? 'border-red-500' : ''}
          />
          {errors.machine_no && (
            <p className="text-xs text-red-500">{errors.machine_no.message}</p>
          )}
        </div>

        <div className="space-y-2">
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

        {/* Row 3: Make Name & Model */}
        <div className="space-y-2">
          <Label htmlFor="make_name">Make Name *</Label>
          <Input
            id="make_name"
            {...register('make_name')}
            className={errors.make_name ? 'border-red-500' : ''}
          />
          {errors.make_name && (
            <p className="text-xs text-red-500">{errors.make_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            {...register('model')}
          />
        </div>

        {/* Row 4: From Drum & To Drum */}
        <div className="space-y-2">
          <Label htmlFor="from_drum">From Drum</Label>
          <Input
            id="from_drum"
            type="number"
            {...register('from_drum', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to_drum">To Drum</Label>
          <Input
            id="to_drum"
            type="number"
            {...register('to_drum', { valueAsNumber: true })}
          />
        </div>

        {/* Row 5: No. of Drums & Speed */}
        <div className="space-y-2">
          <Label htmlFor="no_of_drums">No. of Drums</Label>
          <Input
            id="no_of_drums"
            type="number"
            {...register('no_of_drums', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="speed">Speed</Label>
          <Input
            id="speed"
            type="number"
            {...register('speed', { valueAsNumber: true })}
          />
        </div>

        {/* Row 6: Count & Act Effi */}
        <div className="space-y-2">
          <Label htmlFor="count">Count</Label>
          <Input
            id="count"
            {...register('count')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="act_effi">Act Effi (%)</Label>
          <Input
            id="act_effi"
            type="number"
            min="0"
            max="100"
            {...register('act_effi', { valueAsNumber: true })}
            className={errors.act_effi ? 'border-red-500' : ''}
          />
          {errors.act_effi && (
            <p className="text-xs text-red-500">{errors.act_effi.message}</p>
          )}
        </div>

        {/* Row 7: Installed Date */}
        <div className="space-y-2">
          <Label htmlFor="installed_date">Installed Date</Label>
          <Input
            id="installed_date"
            type="date"
            {...register('installed_date')}
          />
        </div>

        {/* Empty cell for alignment */}
        <div></div>

        {/* Row 8: Checkboxes */}
        <div className="space-y-2 flex items-center gap-2 pt-2">
          <Checkbox
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue('is_active', checked)}
          />
          <Label htmlFor="is_active" className="cursor-pointer text-sm">
            Active (Yes / No)
          </Label>
        </div>

        <div className="space-y-2 flex items-center gap-2 pt-2">
          <Checkbox
            id="direct_prod_entry"
            checked={directProdEntry}
            onCheckedChange={(checked) => setValue('direct_prod_entry', checked)}
          />
          <Label htmlFor="direct_prod_entry" className="cursor-pointer text-sm">
            Direct Prod Entry (Yes/No)
          </Label>
        </div>
      </div>
    </form>
  );
}
