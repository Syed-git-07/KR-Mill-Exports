'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import EnterSelect from '@/components/ui/enter-select';
import { getSpinningCountsAction } from '@/app/actions/spinning-entry';

const spinningMachineSchema = z.object({
  machine_no: z.string().min(1, 'Machine number is required'),
  description: z.string().min(1, 'Description is required'),
  make_name: z.string().default('LMW'),
  model: z.string().optional().nullable(),
  allocated_spindles: z.number().min(1, 'Allocated Spindles count is required').default(1104),
  installed_date: z.string().optional(),
  is_active: z.boolean().default(true),
  production_kgs_manual_entry: z.boolean().default(false),
  direct_hank_entry: z.boolean().default(true),
  speed: z.union([z.number(), z.nan(), z.null()]).optional().transform(val => (isNaN(val) || val === null) ? null : val),
  count_name: z.string().optional().nullable(),
  act_count: z.union([z.number(), z.nan(), z.null()]).optional().transform(val => (isNaN(val) || val === null) ? null : val),
  tpi: z.union([z.number(), z.nan(), z.null()]).optional().transform(val => (isNaN(val) || val === null) ? null : val),
});

export default function SpinningMachineForm({ initialData, onSubmit }) {
  const [counts, setCounts] = useState([]);

  useEffect(() => {
    getSpinningCountsAction().then(result => {
      if (result.success) setCounts(result.data || []);
    });
  }, []);

  // Arrow Up/Down — navigate between inputs; also handles Enter to advance.
  // Prevents arrow keys from incrementing/decrementing number inputs.
  const handleNav = useCallback((e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter') return;
    e.preventDefault();
    const container = e.currentTarget.closest('[role="dialog"]') || e.currentTarget.closest('form');
    if (!container) return;
    const focusable = Array.from(
      container.querySelectorAll('input:not([readonly]):not([disabled]), button[role="combobox"]')
    ).filter(el => el.offsetParent !== null);
    const idx = focusable.indexOf(e.currentTarget);
    if (idx === -1) return;
    const next = focusable[e.key === 'ArrowUp' ? idx - 1 : idx + 1];
    if (next) { next.focus(); if (next.select) next.select(); }
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(spinningMachineSchema),
    defaultValues: initialData ? {
      ...initialData,
      // <input type="date"> needs "YYYY-MM-DD" — strip the time part if ISO string
      installed_date: initialData.installed_date
        ? String(initialData.installed_date).split('T')[0]
        : '',
    } : {
      machine_no: '',
      description: '',
      make_name: 'LMW',
      model: '',
      allocated_spindles: 1104,
      installed_date: '2015-04-01',
      is_active: true,
      production_kgs_manual_entry: false,
      direct_hank_entry: true,
      speed: null,
      count_name: null,
      act_count: null,
      tpi: null,
    }
  });

  const isActive = watch('is_active');
  const productionKgsManual = watch('production_kgs_manual_entry');
  const directHankEntry = watch('direct_hank_entry');
  const countName = watch('count_name');

  const handleCountSelect = (val) => {
    setValue('count_name', val);
    const selectedCount = counts.find(c => c.count_name === val);
    if (selectedCount) {
      // act_count is always present (NOT NULL in DB)
      setValue('act_count', parseFloat(selectedCount.act_count));
      // tpi and speed are VARCHAR — only set if value exists and is non-empty
      const tpiVal = selectedCount.tpi != null && selectedCount.tpi !== '' ? parseFloat(selectedCount.tpi) : null;
      const speedVal = selectedCount.speed != null && selectedCount.speed !== '' ? parseInt(selectedCount.speed) : null;
      if (tpiVal !== null) setValue('tpi', tpiVal);
      if (speedVal !== null) setValue('speed', speedVal);
    }
  };

  const onFormSubmit = async (data) => {
    const formattedData = {
      ...data,
      allocated_spindles: parseInt(data.allocated_spindles),
      model: data.model || null,
      speed: data.speed || null,
      count_name: data.count_name || null,
      act_count: data.act_count || null,
      tpi: data.tpi || null,
    };
    
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Machine No */}
        <div className="space-y-2">
          <Label htmlFor="machine_no">Machine No *</Label>
          <Input
            id="machine_no"
            {...register('machine_no')}
            onKeyDown={handleNav}
            readOnly={!!initialData}
            className={`${errors.machine_no ? 'border-red-500' : ''} ${initialData ? 'bg-gray-100' : ''}`}
          />
          {errors.machine_no && (
            <p className="text-xs text-red-500">{errors.machine_no.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Input
            id="description"
            {...register('description')}
            onKeyDown={handleNav}
            className={errors.description ? 'border-red-500' : ''}
          />
          {errors.description && (
            <p className="text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>

        {/* Make Name */}
        <div className="space-y-2">
          <Label htmlFor="make_name">Make Name</Label>
          <Input
            id="make_name"
            {...register('make_name')}
            onKeyDown={handleNav}
          />
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            {...register('model')}
            onKeyDown={handleNav}
          />
        </div>

        {/* Allocated Spindles */}
        <div className="space-y-2">
          <Label htmlFor="allocated_spindles">Allocated Spindles *</Label>
          <Input
            id="allocated_spindles"
            type="number"
            {...register('allocated_spindles', { valueAsNumber: true })}
            onKeyDown={handleNav}
            className={errors.allocated_spindles ? 'border-red-500' : ''}
          />
          {errors.allocated_spindles && (
            <p className="text-xs text-red-500">{errors.allocated_spindles.message}</p>
          )}
        </div>

        {/* Speed */}
        <div className="space-y-2">
          <Label htmlFor="speed">Speed</Label>
          <Input
            id="speed"
            type="number"
            {...register('speed', { valueAsNumber: true })}
            onKeyDown={handleNav}
          />
        </div>

        {/* Installed Date */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="installed_date">Installed Date</Label>
          <Input
            id="installed_date"
            type="date"
            {...register('installed_date')}
            onKeyDown={handleNav}
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

      {/* Setup Configuration */}
      <div className="border-t pt-4 space-y-4">
        <h4 className="font-semibold text-sm">Setup Configuration</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Count</Label>
            <EnterSelect
              value={countName || ''}
              options={counts.map(c => ({ value: c.count_name, label: c.count_name }))}
              onChange={handleCountSelect}
              placeholder="Select count..."
              searchable
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="act_count">Act. Count</Label>
            <Input
              id="act_count"
              type="number"
              step="0.1"
              {...register('act_count', { valueAsNumber: true })}
              onKeyDown={handleNav}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpi">TPI</Label>
            <Input
              id="tpi"
              type="number"
              step="0.01"
              {...register('tpi', { valueAsNumber: true })}
              onKeyDown={handleNav}
            />
          </div>
        </div>
        <p className="text-xs text-blue-600">
          Selecting a count auto-fills Act. Count, TPI, and Speed from the counts master.
        </p>
      </div>
    </form>
  );
}
