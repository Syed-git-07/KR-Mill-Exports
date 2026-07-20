'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

const holidaySchema = z.object({
  date: z.string().min(1, 'Holiday Date is required'),
  description: z.string().min(1, 'Description is required'),
})

export default function HolidayForm({ formId, initialData, onSubmit, onCancel, isSubmitting, minDate, maxDate }) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      date: initialData?.date ? String(initialData.date).split('T')[0] : '',
      description: initialData?.description ?? '',
    },
  })

  const selectedDate = watch('date')
  const dayOfWeek = selectedDate ? format(new Date(`${selectedDate}T00:00:00`), 'EEE') : ''

  useEffect(() => {
    reset({
      date: initialData?.date ? String(initialData.date).split('T')[0] : '',
      description: initialData?.description ?? '',
    })
  }, [initialData, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button type="submit" className="hidden" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="date">Holiday Date *</Label>
          <Input
            id="date"
            type="date"
            {...register('date')}
            min={minDate}
            max={maxDate}
          />
          {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Day</Label>
          <Input value={dayOfWeek} readOnly />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description *</Label>
        <Input id="description" {...register('description')} placeholder="Good Friday" />
        {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
      </div>

    </form>
  )
}
