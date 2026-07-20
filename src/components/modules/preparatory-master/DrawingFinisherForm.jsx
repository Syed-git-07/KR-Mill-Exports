'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

// Helper function to format date for input
const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formSchema = z.object({
  machine_no: z.string()
    .min(1, 'Machine No. is required')
    .max(20, 'Machine No. must be 20 characters or less'),
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
  count_name: z.string().max(100).optional().or(z.literal('')),
  speed: z.coerce.number()
    .min(0, 'Speed must be 0 or greater')
    .optional()
    .or(z.literal('')),
  prodn_effi: z.coerce.number()
    .min(0, 'Std Efficiency must be 0 or greater')
    .max(100, 'Std Efficiency must be 100 or less')
    .optional()
    .or(z.literal('')),
  installed_date: z.string()
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(true),
  direct_hank_entry: z.boolean().default(false),
  direct_kgs_entry: z.boolean().default(false),
});

export default function DrawingFinisherForm({ initialData, onSubmit, isLoading, countOptions = [] }) {
  const [countSearch, setCountSearch] = useState('');
  const [showCountDrop, setShowCountDrop] = useState(false);
  const [activeCountIndex, setActiveCountIndex] = useState(-1);
  const countRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleNav = useCallback((e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const container = e.currentTarget.closest('[role="dialog"]') || e.currentTarget.closest('form');
    if (!container) return;
    const focusable = Array.from(
      container.querySelectorAll('input:not([readonly]):not([disabled])')
    ).filter(el => el.offsetParent !== null);
    const idx = focusable.indexOf(e.currentTarget);
    if (idx === -1) return;
    const next = focusable[e.key === 'ArrowUp' ? idx - 1 : idx + 1];
    if (next) { next.focus(); if (next.select) next.select(); }
  }, []);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      machine_no: initialData?.machine_no || '',
      description: initialData?.description || '',
      make_name: initialData?.make_name || '',
      model: initialData?.model || '',
      count_name: initialData?.prodn_mixing || '',
      speed: initialData?.speed || '',
      prodn_effi: initialData?.prodn_efficiency || '',
      installed_date: formatDateForInput(initialData?.installed_date),
      is_active: initialData?.is_active ?? true,
      direct_hank_entry: initialData?.direct_hank_entry ?? false,
      direct_kgs_entry: initialData?.direct_kgs_entry ?? false,
    },
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

  const isActive = watch('is_active');
  const directHankEntry = watch('direct_hank_entry');
  const directKgsEntry = watch('direct_kgs_entry');
  const machineNo = watch('machine_no');

  // Auto-fill description = machine_no when adding a new machine
  useEffect(() => {
    if (!initialData) {
      setValue('description', machineNo);
    }
  }, [machineNo, initialData, setValue]);

  useEffect(() => {
    if (initialData) {
      const countVal = initialData.prodn_mixing || '';
      reset({
        machine_no: initialData.machine_no || '',
        description: initialData.description || '',
        make_name: initialData.make_name || '',
        model: initialData.model || '',
        count_name: countVal,
        speed: initialData.speed || '',
        prodn_effi: initialData.prodn_efficiency || '',
        installed_date: formatDateForInput(initialData.installed_date),
        is_active: initialData.is_active ?? true,
        direct_hank_entry: initialData.direct_hank_entry ?? false,
        direct_kgs_entry: initialData.direct_kgs_entry ?? false,
      });
      setCountSearch(countVal);
    } else {
      reset({
        machine_no: '',
        description: '',
        make_name: '',
        model: '',
        count_name: '',
        speed: '',
        prodn_effi: '',
        installed_date: '',
        is_active: true,
        direct_hank_entry: false,
        direct_kgs_entry: false,
      });
      setCountSearch('');
    }
  }, [initialData, reset]);

  // Close count dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (countRef.current && !countRef.current.contains(e.target)) {
        setShowCountDrop(false);
        setActiveCountIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted dropdown item into view
  useEffect(() => {
    if (dropdownRef.current && activeCountIndex >= 0) {
      const items = dropdownRef.current.querySelectorAll('[data-count-item]');
      if (items[activeCountIndex]) {
        items[activeCountIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeCountIndex]);

  const filteredCounts = countSearch.trim()
    ? countOptions.filter(c => c.count_name.toLowerCase().includes(countSearch.toLowerCase()))
    : countOptions;

  const handleCountSelect = (option) => {
    setValue('count_name', option.count_name);
    setCountSearch(option.count_name);
    setShowCountDrop(false);
    setActiveCountIndex(-1);
  };

  const handleCountInputChange = (e) => {
    setCountSearch(e.target.value);
    setValue('count_name', e.target.value);
    setShowCountDrop(true);
    setActiveCountIndex(-1);
  };

  const handleClearCount = () => {
    setValue('count_name', '');
    setCountSearch('');
    setActiveCountIndex(-1);
  };

  const handleCountKeyDown = (e) => {
    const visible = filteredCounts.slice(0, 40);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showCountDrop) setShowCountDrop(true);
      setActiveCountIndex(i => Math.min(i + 1, visible.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveCountIndex(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      if (showCountDrop && activeCountIndex >= 0 && visible[activeCountIndex]) {
        e.preventDefault();
        handleCountSelect(visible[activeCountIndex]);
        return;
      }
      setShowCountDrop(false);
      setActiveCountIndex(-1);
    }
    if (e.key === 'Escape') {
      setShowCountDrop(false);
      setActiveCountIndex(-1);
      return;
    }
  };

  const handleFormSubmit = (data) => {
    const cleanedData = {
      machine_no: data.machine_no,
      description: data.description,
      make_name: data.make_name || null,
      model: data.model || null,
      prodn_mixing: data.count_name || null,
      speed: data.speed === '' ? null : Number(data.speed),
      prodn_effi: data.prodn_effi === '' ? null : Number(data.prodn_effi),
      installed_date: data.installed_date || null,
      is_active: data.is_active,
      direct_hank_entry: data.direct_hank_entry,
      direct_kgs_entry: data.direct_kgs_entry,
    };
    onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">

      {/* Deactivation date info */}
      {!isActive && initialData?.deactivated_at && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
          Deactivated on {formatDateForInput(initialData.deactivated_at)}
        </div>
      )}

      {/* Row 1: Machine No, Description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="machine_no">M/C No. <span className="text-red-500">*</span></Label>
          <Input
            id="machine_no"
            placeholder="e.g. FD11"
            {...register('machine_no')}
            onKeyDown={handleNav}
            className={errors.machine_no ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.machine_no && (
            <p className="text-xs text-red-500">{errors.machine_no.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
          <Input
            id="description"
            placeholder="Auto-filled from M/C No."
            {...register('description')}
            onKeyDown={handleNav}
            className={errors.description ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.description && (
            <p className="text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>
      </div>

      {/* Row 2: Make Name, Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="make_name">Make Name</Label>
          <Input
            id="make_name"
            placeholder="e.g. LMW"
            {...register('make_name')}
            onKeyDown={handleNav}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            placeholder="Enter model"
            {...register('model')}
            onKeyDown={handleNav}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Row 3: Count (searchable), Installed Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2" ref={countRef}>
          <Label htmlFor="count_search">Count</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              id="count_search"
              type="text"
              value={countSearch}
              onChange={handleCountInputChange}
              onFocus={() => setShowCountDrop(true)}
              onKeyDown={handleCountKeyDown}
              placeholder="Search count..."
              disabled={isLoading}
              autoComplete="off"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pl-8 pr-8 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            {countSearch && (
              <button
                type="button"
                onClick={handleClearCount}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {showCountDrop && filteredCounts.length > 0 && (
              <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredCounts.slice(0, 40).map((opt, idx) => (
                  <div
                    key={opt.id || opt.count_name}
                    data-count-item=""
                    className={`px-3 py-1.5 text-sm cursor-pointer ${idx === activeCountIndex ? 'bg-blue-100 text-blue-900' : 'hover:bg-blue-50'}`}
                    onMouseDown={() => handleCountSelect(opt)}
                    onMouseEnter={() => setActiveCountIndex(idx)}
                  >
                    {opt.count_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="installed_date">Installed Date</Label>
          <Input
            id="installed_date"
            type="date"
            {...register('installed_date')}
            onKeyDown={handleNav}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Row 4: Speed, Std Effi % */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="speed">Speed (m/min)</Label>
          <Input
            id="speed"
            type="number"
            step="1"
            placeholder="Enter speed"
            {...register('speed')}
            onKeyDown={handleNav}
            className={errors.speed ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.speed && (
            <p className="text-xs text-red-500">{errors.speed.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prodn_effi">Std Effi %</Label>
          <Input
            id="prodn_effi"
            type="number"
            step="0.01"
            placeholder="e.g. 90.00"
            {...register('prodn_effi')}
            onKeyDown={handleNav}
            className={errors.prodn_effi ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.prodn_effi && (
            <p className="text-xs text-red-500">{errors.prodn_effi.message}</p>
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
          <Label htmlFor="direct_kgs_entry" className="cursor-pointer">Direct Kgs Entry</Label>
        </div>
      </div>
    </form>
  );
}
