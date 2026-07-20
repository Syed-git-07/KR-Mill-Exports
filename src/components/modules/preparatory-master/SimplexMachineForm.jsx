'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

// VB6 Form Fields: M/C No., M/c ID, Description, Make Name, Model, 
// ProdnMixing, Speed, Prodn Effi., M/c Effi., TPI, No. of Spindles,
// Installed Date, Active, Direct Hank Entry, Direct Prod Kgs
// NOTE: Simplex has 3 additional fields: mc_effi, tpi, no_of_spindles

// Helper function to format Date to YYYY-MM-DD for input
const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
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
  count_name: z.string()
    .max(50, 'Count Name must be 50 characters or less')
    .optional()
    .or(z.literal('')),
  speed: z.coerce.number()
    .min(0, 'Speed must be 0 or greater')
    .optional()
    .or(z.literal('')),
  prodn_effi: z.coerce.number()
    .min(0, 'Std Efficiency must be 0 or greater')
    .max(100, 'Std Efficiency must be 100 or less')
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

function parseCountTpi(tpiValue) {
  if (tpiValue == null) return null;
  const match = String(tpiValue).match(/\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeCountKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCountKeyLoose(value) {
  return normalizeCountKey(value).replace(/combed/g, 'comber');
}

function buildSimplexDescription(machineNo) {
  const raw = String(machineNo || '').trim().toUpperCase();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return `SIMPLEX${digits || raw}`;
}

export default function SimplexMachineForm({ initialData, onSubmit, isLoading, countOptions = [] }) {
  const [countSearch, setCountSearch] = useState('');
  const [showCountDrop, setShowCountDrop] = useState(false);
  const [activeCountIndex, setActiveCountIndex] = useState(-1);
  const countRef = useRef(null);
  const dropdownRef = useRef(null);

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
    if (next) {
      next.focus();
      if (next.select) next.select();
    }
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
      tpi: initialData?.tpi || '',               // NEW
      no_of_spindles: initialData?.no_of_spindles || '',  // NEW
      installed_date: formatDateForInput(initialData?.installed_date),
      is_active: initialData?.is_active ?? true,
      direct_hank_entry: initialData?.direct_hank_entry ?? false,
      direct_kgs_entry: initialData?.direct_kgs_entry ?? false,
    },
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = form;
  const autoDescriptionRef = useRef('');

  // Watch boolean values for Checkbox components
  const isActive = watch('is_active');
  const directHankEntry = watch('direct_hank_entry');
  const directKgsEntry = watch('direct_kgs_entry');
  const machineNo = watch('machine_no');
  const description = watch('description');

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
        tpi: initialData.tpi || '',               // NEW
        no_of_spindles: initialData.no_of_spindles || '',  // NEW
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
        tpi: '',               // NEW
        no_of_spindles: '',    // NEW
        installed_date: '',
        is_active: true,
        direct_hank_entry: false,
        direct_kgs_entry: false,
      });
      setCountSearch('');
    }
  }, [initialData, reset]);

  const countName = watch('count_name');
  const countOptionMap = useMemo(() => {
    const map = {};
    (countOptions || []).forEach((opt) => {
      if (opt?.count_name) {
        map[normalizeCountKey(opt.count_name)] = opt;
      }
    });
    return map;
  }, [countOptions]);

  const resolveCountOption = useCallback((value) => {
    const normalized = normalizeCountKey(value);
    if (!normalized) return null;
    const exact = countOptionMap[normalized];
    if (exact) return exact;

    const looseInput = normalizeCountKeyLoose(value);
    const candidates = (countOptions || [])
      .filter(opt => opt?.count_name)
      .map(opt => {
        const strict = normalizeCountKey(opt.count_name);
        const loose = normalizeCountKeyLoose(opt.count_name);
        const strictCompact = strict.replace(/\s+/g, '');
        const looseCompact = loose.replace(/\s+/g, '');
        const hasTpi = parseCountTpi(opt.tpi ?? opt.count_tpi ?? null) != null;
        let score = 0;

        if (strict === normalized) score += 120;
        if (loose === looseInput) score += 100;
        if (strict.startsWith(normalized)) score += 60;
        if (loose.startsWith(looseInput)) score += 55;
        if (strict.includes(normalized)) score += 35;
        if (loose.includes(looseInput)) score += 30;
        if (normalized.startsWith(strict)) score += 20;
        if (looseInput.startsWith(loose)) score += 18;
        if (strictCompact.includes(normalized.replace(/\s+/g, ''))) score += 12;
        if (looseCompact.includes(looseInput.replace(/\s+/g, ''))) score += 10;
        if (hasTpi) score += 25;
        if (strict.length > normalized.length) score += 5;

        return { opt, score };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.opt || null;
  }, [countOptionMap, countOptions]);

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

  useEffect(() => {
    if (dropdownRef.current && activeCountIndex >= 0) {
      const items = dropdownRef.current.querySelectorAll('[data-count-item]');
      if (items[activeCountIndex]) {
        items[activeCountIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeCountIndex]);

  const filteredCounts = countSearch.trim()
    ? countOptions.filter(c => String(c.count_name || '').toLowerCase().includes(countSearch.toLowerCase()))
    : countOptions;

  const resolveCountTpi = (opt) => {
    if (!opt) return null;
    return parseCountTpi(opt.tpi ?? opt.count_tpi ?? null);
  };

  useEffect(() => {
    if (initialData) return;
    const nextAuto = buildSimplexDescription(machineNo);
    if (!nextAuto) return;

    // Keep auto-updating until user types a custom description.
    if (!description || description === autoDescriptionRef.current) {
      setValue('description', nextAuto, { shouldValidate: true });
    }

    autoDescriptionRef.current = nextAuto;
  }, [initialData, machineNo, description, setValue]);

  const handleCountSelect = (option) => {
    setValue('count_name', option.count_name, { shouldValidate: true });
    setCountSearch(option.count_name);
    setShowCountDrop(false);
    setActiveCountIndex(-1);
    const tpi = resolveCountTpi(option);
    if (tpi != null) setValue('tpi', tpi, { shouldValidate: true });
  };

  const handleCountInputChange = (e) => {
    const value = e.target.value;
    setCountSearch(value);
    setValue('count_name', value, { shouldValidate: true });
    setShowCountDrop(true);
    setActiveCountIndex(-1);

    const selected = resolveCountOption(value);
    const tpi = resolveCountTpi(selected);
    if (tpi != null) setValue('tpi', tpi, { shouldValidate: true });
  };

  const handleClearCount = () => {
    setValue('count_name', '', { shouldValidate: true });
    setCountSearch('');
    setActiveCountIndex(-1);
    setShowCountDrop(false);
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
      const resolved = resolveCountOption(countSearch || countName);
      if (resolved) {
        e.preventDefault();
        handleCountSelect(resolved);
        return;
      }
      setShowCountDrop(false);
      setActiveCountIndex(-1);
      return;
    }
    if (e.key === 'Escape') {
      setShowCountDrop(false);
      setActiveCountIndex(-1);
      return;
    }
    handleNav(e);
  };

  useEffect(() => {
    if (!countName) return;
    const selected = resolveCountOption(countName);
    if (!selected) return;
    const tpi = resolveCountTpi(selected);
    if (tpi != null) {
      setValue('tpi', tpi, { shouldValidate: true });
    }
  }, [countName, resolveCountOption, setValue]);

  const handleFormSubmit = (data) => {
    // Clean up the data - convert empty strings to null for numeric fields
    const cleanedData = {
      ...data,
      speed: data.speed === '' ? null : Number(data.speed),
      prodn_effi: data.prodn_effi === '' ? null : Number(data.prodn_effi),
      tpi: data.tpi === '' ? null : Number(data.tpi),                        // NEW
      no_of_spindles: data.no_of_spindles === '' ? null : Number(data.no_of_spindles),  // NEW
      installed_date: data.installed_date || null,
      make_name: data.make_name || null,
      model: data.model || null,
      prodn_mixing: data.count_name || null,
      count_tpi: resolveCountOption(data.count_name)?.tpi || null,
    };
    onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Row 1: Machine No, Description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Row 2: Make Name, Model, Count Name */}
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

        <div className="space-y-2" ref={countRef}>
          <Label htmlFor="count_search">Count Name</Label>
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
              className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pl-8 pr-8 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${errors.count_name ? 'border-red-500' : ''}`}
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
                    key={opt.id}
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
          {errors.count_name && (
            <p className="text-xs text-red-500">{errors.count_name.message}</p>
          )}
        </div>
      </div>

      {/* Row 3: Speed, Std Effi, TPI */}
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
          <Label htmlFor="prodn_effi">Std Effi. (%)</Label>
          <Input
            id="prodn_effi"
            type="number"
            placeholder="Enter std efficiency"
            {...register('prodn_effi')}
            className={errors.prodn_effi ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {errors.prodn_effi && (
            <p className="text-xs text-red-500">{errors.prodn_effi.message}</p>
          )}
        </div>

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
      </div>

      {/* Row 4: No. of Spindles, Installed Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

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
