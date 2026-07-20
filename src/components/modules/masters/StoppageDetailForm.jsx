'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getStoppageHeadsAction, getDepartmentsAction } from '@/app/actions/stoppage-detail'

const stoppageDetailSchema = z.object({
  code: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const parsed = typeof val === 'number' ? val : parseInt(String(val), 10);
    return isNaN(parsed) ? undefined : parsed;
  }),
  stoppage_name: z.string().min(1, 'Stoppage name is required'),
  description: z.string().nullable().optional(),
  short_code: z.string().max(10).nullable().optional(),
  department_id: z.string().min(1, 'Department is required'),
  stoppage_head_id: z.string().min(1, 'Stoppage head is required'),
  full_stoppage_name: z.string().nullable().optional(),
})

export default function StoppageDetailForm({ initialData, onSubmit }) {
  const [stoppageHeads, setStoppageHeads] = useState([])
  const [departments, setDepartments] = useState([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(stoppageDetailSchema),
    defaultValues: {
      code: initialData?.code || '',
      stoppage_name: initialData?.stoppage_name || '',
      description: initialData?.description || '',
      short_code: initialData?.short_code || '',
      department_id: initialData?.department_id || '',
      stoppage_head_id: initialData?.stoppage_head_id || '',
      full_stoppage_name: initialData?.full_stoppage_name || '',
    },
  })

  useEffect(() => {
    loadDropdownData()
  }, [])

  const loadDropdownData = async () => {
    try {
      const [headsResult, deptsResult] = await Promise.all([
        getStoppageHeadsAction(),
        getDepartmentsAction()
      ])
      
      if (headsResult.success) {
        setStoppageHeads(headsResult.data)
      }
      
      if (deptsResult.success) {
        setDepartments(deptsResult.data)
      }
    } catch (error) {
      console.error('Failed to load dropdown data:', error)
    }
  }

  const departmentId = watch('department_id')
  const stoppageHeadId = watch('stoppage_head_id')
  const stoppageName = watch('stoppage_name')
  const shortCode = watch('short_code')

  // Auto-generate full_stoppage_name from stoppage_name and short_code
  useEffect(() => {
    const name = stoppageName?.trim() || ''
    const code = shortCode?.trim() || ''
    
    if (name || code) {
      const fullName = code ? `${name} ${code}`.trim() : name
      setValue('full_stoppage_name', fullName)
    }
  }, [stoppageName, shortCode, setValue])

  const handleFormSubmit = (data) => {
    // Convert empty strings to null - code is already transformed by zod
    const formattedData = {
      ...data,
      description: data.description?.trim() || null,
      short_code: data.short_code?.trim() || null,
      full_stoppage_name: data.full_stoppage_name?.trim() || null,
    }
    onSubmit(formattedData)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Code - Read-only when editing */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            type="number"
            {...register('code')}
            readOnly={!!initialData}
            className={initialData ? 'bg-gray-100' : ''}
            placeholder="Auto-generated"
          />
          {errors.code && (
            <p className="text-sm text-red-500">{errors.code.message}</p>
          )}
        </div>

        {/* Short Code */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="short_code">Short Code</Label>
          <Input
            id="short_code"
            {...register('short_code')}
            placeholder="e.g., LW, SGP"
            maxLength={10}
          />
          {errors.short_code && (
            <p className="text-sm text-red-500">{errors.short_code.message}</p>
          )}
        </div>

        {/* Stoppage Name - Full Width */}
        <div className="flex flex-col gap-2 col-span-2">
          <Label htmlFor="stoppage_name">
            Stoppage Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="stoppage_name"
            {...register('stoppage_name')}
            placeholder="Enter stoppage name"
          />
          {errors.stoppage_name && (
            <p className="text-sm text-red-500">{errors.stoppage_name.message}</p>
          )}
        </div>

        {/* Description - Full Width */}
        <div className="flex flex-col gap-2 col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Enter detailed description"
            rows={3}
          />
          {errors.description && (
            <p className="text-sm text-red-500">{errors.description.message}</p>
          )}
        </div>

        {/* Department Dropdown */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="department_id">
            Department <span className="text-red-500">*</span>
          </Label>
          <Select
            value={departmentId}
            onValueChange={(value) => setValue('department_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.dept_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.department_id && (
            <p className="text-sm text-red-500">{errors.department_id.message}</p>
          )}
        </div>

        {/* Stoppage Head Dropdown */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="stoppage_head_id">
            Stoppage Head <span className="text-red-500">*</span>
          </Label>
          <Select
            value={stoppageHeadId}
            onValueChange={(value) => setValue('stoppage_head_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select stoppage head" />
            </SelectTrigger>
            <SelectContent>
              {stoppageHeads.map((head) => (
                <SelectItem key={head.id} value={head.id}>
                  {head.stoppage_head_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.stoppage_head_id && (
            <p className="text-sm text-red-500">{errors.stoppage_head_id.message}</p>
          )}
        </div>

        {/* Full Stoppage Name - Full Width (Auto-generated) */}
        <div className="flex flex-col gap-2 col-span-2">
          <Label htmlFor="full_stoppage_name">Full Stoppage Name (Auto-generated)</Label>
          <Input
            id="full_stoppage_name"
            {...register('full_stoppage_name')}
            placeholder="Auto-generated from Stoppage Name + Short Code"
            readOnly
            className="bg-gray-100"
          />
          {errors.full_stoppage_name && (
            <p className="text-sm text-red-500">{errors.full_stoppage_name.message}</p>
          )}
        </div>
      </div>
    </form>
  )
}
