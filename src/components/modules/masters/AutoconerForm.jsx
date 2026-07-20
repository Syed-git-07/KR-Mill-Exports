'use client'

import { useCallback, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { NumberInput } from '@/components/ui/number-input'
import EnterSelect from '@/components/ui/enter-select'
import { getSpinningCountsAction } from '@/app/actions/spinning-entry'

const autoconerSchema = z.object({
  group_id: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val))) ? null : Number(val),
    z.number().optional().nullable()
  ),
  machine_no: z.string().min(1, 'Machine number is required'),
  description: z.string().min(1, 'Description is required'),
  make_name: z.string().optional().default('MURT'),
  model: z.string().optional().nullable(),
  from_drum: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val))) ? null : Number(val),
    z.number().optional().nullable()
  ),
  to_drum: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val))) ? null : Number(val),
    z.number().optional().nullable()
  ),
  no_of_drums: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val))) ? 0 : Number(val),
    z.number().optional().default(0)
  ),
  speed: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val))) ? null : Number(val),
    z.number().optional().nullable()
  ),
  count: z.string().optional().nullable(),
  act_effi: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val))) ? 0 : Number(val),
    z.number().optional().default(0)
  ),
  installed_date: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  direct_prod_entry: z.boolean().default(false),
})

export default function AutoconerForm({ initialData, onSubmit, onCancel, machines = [] }) {
  const isEditing = !!initialData?.id
  const [counts, setCounts] = useState([])

  useEffect(() => {
    getSpinningCountsAction().then(result => {
      if (result.success) setCounts(result.data || [])
    })
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(autoconerSchema),
    defaultValues: {
      group_id: initialData?.group_id ?? null,
      machine_no: initialData?.machine_no ?? '',
      description: initialData?.description ?? '',
      make_name: initialData?.make_name ?? 'MURT',
      model: initialData?.model ?? '',
      from_drum: initialData?.from_drum ?? null,
      to_drum: initialData?.to_drum ?? null,
      no_of_drums: initialData?.no_of_drums ?? 0,
      speed: initialData?.speed ?? null,
      count: initialData?.count ?? '',
      act_effi: initialData?.act_effi ?? 0,
      installed_date: initialData?.installed_date
        ? String(initialData.installed_date).split('T')[0]
        : new Date().toISOString().split('T')[0],
      is_active: initialData?.is_active ?? true,
      direct_prod_entry: initialData?.direct_prod_entry ?? false,
    },
  })

  const groupId      = watch('group_id')
  const machineNo    = watch('machine_no')
  const description  = watch('description')
  const fromDrum     = watch('from_drum')
  const toDrum       = watch('to_drum')
  const noDrums      = watch('no_of_drums')
  const speed        = watch('speed')
  const actEffi      = watch('act_effi')
  const isActive     = watch('is_active')
  const directProdEntry = watch('direct_prod_entry')

  // Auto-fill dependent values from selected spinning count
  const handleCountChange = (val) => {
    setValue('count', val || '')
    const selectedCount = counts.find(c => c.count_name === val)
    if (!selectedCount) return

    // Prefer the new spinning count field; keep fallbacks for old datasets
    const derivedActEffi = selectedCount.effi_actual_prodn ?? selectedCount.auto_effi
    if (derivedActEffi !== null && derivedActEffi !== undefined && derivedActEffi !== '') {
      setValue('act_effi', Number(derivedActEffi))
    }

    const derivedSpeed = selectedCount.speed_autoconer
    if (derivedSpeed !== null && derivedSpeed !== undefined && derivedSpeed !== '') {
      setValue('speed', Number(derivedSpeed))
    }
  }

  // Navigate to next / previous visible input (Enter / ArrowDown = next, ArrowUp = prev)
  const handleKeyNav = useCallback((e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter') return
    e.preventDefault()
    const form = e.currentTarget.closest('form')
    if (!form) return
    const focusable = Array.from(
      form.querySelectorAll('input:not([readonly]):not([disabled]), button[role="combobox"]')
    ).filter(el => el.offsetParent !== null)
    const idx = focusable.indexOf(e.currentTarget)
    if (idx === -1) return
    const next = focusable[(e.key === 'ArrowDown' || e.key === 'Enter') ? idx + 1 : idx - 1]
    if (next) { next.focus(); if (next.select) next.select() }
  }, [])

  // Build next machine number for a given group (Add mode only)
  const getNextMachineNoForGroup = useCallback((gId) => {
    if (!gId) return ''
    const groupMachines = machines.filter(m => m.group_id === parseInt(gId))
    if (groupMachines.length === 0) return `AC${gId}-1`
    let maxSubNum = 0
    groupMachines.forEach(m => {
      const match = m.machine_no?.match(/^AC(\d+)-(\d+)$/i)
      if (match && parseInt(match[1]) === parseInt(gId)) {
        const sub = parseInt(match[2])
        if (sub > maxSubNum) maxSubNum = sub
      }
    })
    return `AC${gId}-${maxSubNum + 1}`
  }, [machines])

  // Auto-recalculate no_of_drums whenever from or to drum changes
  const calcDrums = (from, to) => {
    const f = parseInt(from), t = parseInt(to)
    if (!isNaN(f) && !isNaN(t) && t >= f) setValue('no_of_drums', t - f + 1)
  }

  const onFormSubmit = async (data) => {
    await onSubmit({
      ...data,
      mc_id: initialData?.mc_id ?? null,
      group_id: data.group_id ?? null,
      no_of_drums: parseInt(data.no_of_drums) || 0,
      from_drum: data.from_drum != null ? parseInt(data.from_drum) : null,
      to_drum: data.to_drum != null ? parseInt(data.to_drum) : null,
      speed: data.speed != null ? parseInt(data.speed) : null,
      act_effi: parseInt(data.act_effi) || 0,
      make_name: data.make_name || 'MURT',
      model: data.model || null,
      count: data.count || null,
      installed_date: data.installed_date || null,
    })
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="bg-blue-50 p-3 rounded-lg mb-4">
        <h3 className="text-sm font-medium text-blue-800">
          Machine Make Screen : To {isEditing ? 'Modify' : 'Add'} Machine Make Details
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Row 1: Group ID & M/c No. */}
        <div className="space-y-1">
          <Label htmlFor="group_id">Group ID</Label>
          <NumberInput
            id="group_id"
            type="number"
            min="1"
            placeholder="e.g. 5"
            value={groupId ?? ''}
            onChange={(e) => {
              const val = e.target.value
              const gId = val ? parseInt(val) : null
              setValue('group_id', gId)
              if (!isEditing && val) {
                const next = getNextMachineNoForGroup(val)
                setValue('machine_no', next)
                setValue('description', next)
              }
            }}
            onKeyDown={handleKeyNav}
            zeroAsEmpty
          />
          {!isEditing && (
            <p className="text-xs text-blue-600">↳ M/c No. &amp; Description auto-generated</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="machine_no">M/c No. *</Label>
          <Input
            id="machine_no"
            value={machineNo}
            onChange={(e) => {
              setValue('machine_no', e.target.value)
              setValue('description', e.target.value)
            }}
            onKeyDown={handleKeyNav}
            className={errors.machine_no ? 'border-red-500' : ''}
          />
          {errors.machine_no && (
            <p className="text-xs text-red-500">{errors.machine_no.message}</p>
          )}
        </div>

        {/* Row 2: Description & Make Name */}
        <div className="space-y-1">
          <Label htmlFor="description">Description *</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setValue('description', e.target.value)}
            onKeyDown={handleKeyNav}
            className={errors.description ? 'border-red-500' : ''}
          />
          {errors.description && (
            <p className="text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="make_name">Make Name</Label>
          <Input
            id="make_name"
            {...register('make_name')}
            placeholder="MURT"
            onKeyDown={handleKeyNav}
          />
        </div>

        {/* Row 3: Model & Installed Date */}
        <div className="space-y-1">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            {...register('model')}
            onKeyDown={handleKeyNav}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="installed_date">Installed Date</Label>
          <Input
            id="installed_date"
            type="date"
            {...register('installed_date')}
            onKeyDown={handleKeyNav}
          />
        </div>

        {/* Row 4: From Drum & To Drum */}
        <div className="space-y-1">
          <Label htmlFor="from_drum">From Drum</Label>
          <NumberInput
            id="from_drum"
            type="number"
            value={fromDrum ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : null
              setValue('from_drum', val)
              calcDrums(e.target.value, toDrum)
            }}
            onKeyDown={handleKeyNav}
            zeroAsEmpty
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="to_drum">To Drum</Label>
          <NumberInput
            id="to_drum"
            type="number"
            value={toDrum ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : null
              setValue('to_drum', val)
              calcDrums(fromDrum, e.target.value)
            }}
            onKeyDown={handleKeyNav}
            zeroAsEmpty
          />
        </div>

        {/* Row 5: No. of Drums (auto) & Speed */}
        <div className="space-y-1">
          <Label htmlFor="no_of_drums">No. of Drums</Label>
          <NumberInput
            id="no_of_drums"
            type="number"
            value={noDrums ?? ''}
            readOnly
            className="bg-gray-50"
            onKeyDown={handleKeyNav}
            zeroAsEmpty
          />
          <p className="text-xs text-muted-foreground">Auto-calculated from drum range</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="speed">Speed</Label>
          <NumberInput
            id="speed"
            type="number"
            value={speed ?? ''}
            onChange={(e) => setValue('speed', e.target.value ? parseInt(e.target.value) : null)}
            onKeyDown={handleKeyNav}
            zeroAsEmpty
          />
        </div>

        {/* Row 6: Count & Act Effi */}
        <div className="space-y-1">
          <Label htmlFor="count">Count</Label>
          <EnterSelect
            value={watch('count') || ''}
            options={counts.map(c => ({ value: c.count_name, label: c.count_name }))}
            onChange={handleCountChange}

            placeholder="Select count..."
            searchable
            className="w-full"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="act_effi">Act Effi (%)</Label>
          <NumberInput
            id="act_effi"
            type="number"
            min="0"
            max="100"
            value={actEffi ?? ''}
            onChange={(e) => setValue('act_effi', e.target.value ? parseInt(e.target.value) : 0)}
            onKeyDown={handleKeyNav}
            zeroAsEmpty
            className={errors.act_effi ? 'border-red-500' : ''}
          />
          {errors.act_effi && (
            <p className="text-xs text-red-500">{errors.act_effi.message}</p>
          )}
        </div>

        {/* Row 7: Checkboxes */}
        <div className="flex items-center gap-2 pt-4">
          <Checkbox
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue('is_active', checked)}
          />
          <Label htmlFor="is_active" className="cursor-pointer text-sm">
            Active (Yes / No)
          </Label>
        </div>

        <div className="flex items-center gap-2 pt-4">
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
  )
}
