'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const holidayListSchema = z.object({
  name: z.string().min(1, 'List Name is required'),
  startDate: z.string().min(1, 'Start Date is required'),
  endDate: z.string().min(1, 'End Date is required'),
  weekOffs: z.object({
    sunday: z.boolean().default(false),
    saturday: z.boolean().default(false),
    friday: z.boolean().default(false),
  }),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

export default function HolidayListForm({ formId, initialData, onSubmit, onCancel, isSubmitting }) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(holidayListSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      startDate: initialData?.startDate ? String(initialData.startDate).split('T')[0] : '',
      endDate: initialData?.endDate ? String(initialData.endDate).split('T')[0] : '',
      weekOffs: initialData?.weekOffs
        ? typeof initialData.weekOffs === 'string'
          ? JSON.parse(initialData.weekOffs)
          : initialData.weekOffs
        : { sunday: false, saturday: false, friday: false },
      status: initialData?.status ?? 'Active',
    },
  })

  const weekOffs = watch('weekOffs')

  useEffect(() => {
    // Reset form values when editing an existing list so defaults update
    if (initialData) {
      const wd = initialData.weekOffs
        ? typeof initialData.weekOffs === 'string'
          ? JSON.parse(initialData.weekOffs)
          : initialData.weekOffs
        : { sunday: false, saturday: false, friday: false }
      reset({
        name: initialData.name ?? '',
        startDate: initialData.startDate ? String(initialData.startDate).split('T')[0] : '',
        endDate: initialData.endDate ? String(initialData.endDate).split('T')[0] : '',
        weekOffs: wd,
        status: initialData.status ?? 'Active',
      })
    }
  }, [initialData, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button type="submit" className="hidden" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
          <Label htmlFor="name">List Name *</Label>
          <Input id="name" {...register('name')} placeholder="2026 Holiday Calendar" />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="startDate">Start Date *</Label>
          <Input id="startDate" type="date" {...register('startDate')} />
          {errors.startDate && <p className="text-xs text-red-500">{errors.startDate.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="endDate">End Date *</Label>
          <Input id="endDate" type="date" {...register('endDate')} />
          {errors.endDate && <p className="text-xs text-red-500">{errors.endDate.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Week Offs</Label>
        <div className="flex flex-wrap gap-4">
          {['sunday', 'saturday', 'friday'].map((day) => (
            <label key={day} className="inline-flex items-center gap-2">
              <Checkbox
                checked={weekOffs?.[day] ?? false}
                onCheckedChange={(value) => setValue(`weekOffs.${day}`, Boolean(value))}
              />
              <span className="text-sm capitalize">{day}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Status</Label>
        <div className="flex flex-wrap gap-4">
          {['Active', 'Inactive'].map((option) => (
            <label key={option} className="inline-flex items-center gap-2">
              <input
                type="radio"
                value={option}
                {...register('status')}
                checked={watch('status') === option}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {errors.status && <p className="text-xs text-red-500">{errors.status.message}</p>}
      </div>

    </form>
  )
}
