'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

const spinningCountSchema = z.object({
  count_name: z.string().min(1, 'Count Name is required').max(100),
  short_desc: z.string().max(50).nullable().optional(),
  act_count: z.number().min(0, 'Act Count must be positive').or(z.string().transform(Number)),
  mixing_name: z.string().max(100).nullable().optional(),
  fibre: z.string().max(50).nullable().optional(),
  conv_40s_value: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  ukg: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  effi_exp_hank: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  effi_exp_prodn: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  is_running_now: z.boolean().optional(),
  autoconer_active: z.boolean().optional(),
  sitra_conv_value: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  cone_weight: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  effi_actual_prodn: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  tpi: z.string().max(50).nullable().optional(),
  speed: z.string().max(50).nullable().optional(),
  speed_autoconer: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  tw_con: z.string().max(50).nullable().optional(),
  waste_percent: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  doff_loss: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  auto_effi: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val))),
  hok_cons: z.number().min(0).nullable().optional().or(z.string().transform(val => val === '' ? null : Number(val)))
})

export default function SpinningCountForm({ initialData, onSubmit }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(spinningCountSchema),
    defaultValues: initialData || {
      count_name: '',
      short_desc: '',
      act_count: '',
      mixing_name: '',
      fibre: '',
      conv_40s_value: '',
      ukg: '',
      effi_exp_hank: '',
      effi_exp_prodn: '',
      is_running_now: false,
      autoconer_active: false,
      sitra_conv_value: '',
      cone_weight: '',
      effi_actual_prodn: '',
      tpi: '',
      speed: '',
      speed_autoconer: '',
      tw_con: '',
      waste_percent: '',
      doff_loss: '',
      auto_effi: '',
      hok_cons: ''
    }
  })

  const isRunningNow = watch('is_running_now')
  const autoconerActive = watch('autoconer_active')

  const handleFormSubmit = (data) => {
    console.log('Form submitted with raw data:', data)
    
    // Transform data to ensure correct types
    const transformedData = {
      count_name: data.count_name,
      short_desc: data.short_desc || null,
      act_count: Number(data.act_count),
      mixing_name: data.mixing_name || null,
      fibre: data.fibre || null,
      conv_40s_value: data.conv_40s_value ? Number(data.conv_40s_value) : null,
      ukg: data.ukg ? Number(data.ukg) : null,
      effi_exp_hank: data.effi_exp_hank ? Number(data.effi_exp_hank) : null,
      effi_exp_prodn: data.effi_exp_prodn ? Number(data.effi_exp_prodn) : null,
      is_running_now: Boolean(data.is_running_now),
      autoconer_active: Boolean(data.autoconer_active),
      sitra_conv_value: data.sitra_conv_value ? Number(data.sitra_conv_value) : null,
      cone_weight: data.cone_weight ? Number(data.cone_weight) : null,
      effi_actual_prodn: data.effi_actual_prodn ? Number(data.effi_actual_prodn) : null,
      tpi: data.tpi || null,
      speed: data.speed || null,
      speed_autoconer: data.speed_autoconer ? Number(data.speed_autoconer) : null,
      tw_con: data.tw_con || null,
      waste_percent: data.waste_percent ? Number(data.waste_percent) : null,
      doff_loss: data.doff_loss ? Number(data.doff_loss) : null,
      auto_effi: data.auto_effi ? Number(data.auto_effi) : null,
      hok_cons: data.hok_cons ? Number(data.hok_cons) : null
    }
    
    console.log('Transformed data:', transformedData)
    onSubmit(transformedData)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="count_name">Count Name <span className="text-red-500">*</span></Label>
            <Input id="count_name" {...register('count_name')} placeholder="Enter count name" />
            {errors.count_name && <p className="text-sm text-red-500 mt-1">{errors.count_name.message}</p>}
          </div>

          <div>
            <Label htmlFor="short_desc">Short Desc</Label>
            <Input id="short_desc" {...register('short_desc')} placeholder="Short description" />
          </div>

          <div>
            <Label htmlFor="act_count">Act Count <span className="text-red-500">*</span></Label>
            <Input id="act_count" type="number" step="0.01" {...register('act_count', { valueAsNumber: true })} placeholder="0.00" />
            {errors.act_count && <p className="text-sm text-red-500 mt-1">{errors.act_count.message}</p>}
          </div>

          <div>
            <Label htmlFor="mixing_name">Mixing Name</Label>
            <Input id="mixing_name" {...register('mixing_name')} placeholder="Mixing name" />
          </div>

          <div>
            <Label htmlFor="fibre">Fibre</Label>
            <Input id="fibre" {...register('fibre')} placeholder="Fibre type" />
          </div>

          <div>
            <Label htmlFor="conv_40s_value">40S.Conv.Value</Label>
            <Input id="conv_40s_value" type="number" step="0.01" {...register('conv_40s_value')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="ukg">U.K.G</Label>
            <Input id="ukg" type="number" step="0.01" {...register('ukg')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="effi_exp_hank">Effi. for Exp. Hank</Label>
            <Input id="effi_exp_hank" type="number" step="0.01" {...register('effi_exp_hank')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="effi_exp_prodn">Effi. for Exp. Prodn.</Label>
            <Input id="effi_exp_prodn" type="number" step="0.01" {...register('effi_exp_prodn')} placeholder="0.00" />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="is_running_now" checked={isRunningNow} onCheckedChange={(checked) => setValue('is_running_now', checked)} />
            <Label htmlFor="is_running_now" className="cursor-pointer">Is running now</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="autoconer_active" checked={autoconerActive} onCheckedChange={(checked) => setValue('autoconer_active', checked)} />
            <Label htmlFor="autoconer_active" className="cursor-pointer">Autoconer Active</Label>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="sitra_conv_value">Sitra.Conv.Value</Label>
            <Input id="sitra_conv_value" type="number" step="0.01" {...register('sitra_conv_value')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="cone_weight">Cone Weight</Label>
            <Input id="cone_weight" type="number" step="0.001" {...register('cone_weight')} placeholder="0.000" />
          </div>

          <div>
            <Label htmlFor="effi_actual_prodn">Effi. for Actual Prodn.</Label>
            <Input id="effi_actual_prodn" type="number" step="0.01" {...register('effi_actual_prodn')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="tpi">TPI</Label>
            <Input id="tpi" {...register('tpi')} placeholder="TPI value" />
          </div>

          <div>
            <Label htmlFor="speed">Speed</Label>
            <Input id="speed" {...register('speed')} placeholder="Speed value" />
          </div>

          <div>
            <Label htmlFor="speed_autoconer">Speed [Auto coner]</Label>
            <Input id="speed_autoconer" type="number" step="0.01" {...register('speed_autoconer')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="tw_con">TW.CON</Label>
            <Input id="tw_con" {...register('tw_con')} placeholder="TW.CON value" />
          </div>

          <div>
            <Label htmlFor="waste_percent">Waste %</Label>
            <Input id="waste_percent" type="number" step="0.01" {...register('waste_percent')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="doff_loss">Doff Loss</Label>
            <Input id="doff_loss" type="number" step="0.01" {...register('doff_loss')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="auto_effi">Auto.Effi</Label>
            <Input id="auto_effi" type="number" step="0.01" {...register('auto_effi')} placeholder="0.00" />
          </div>

          <div>
            <Label htmlFor="hok_cons">H.O.K Cons.</Label>
            <Input id="hok_cons" type="number" step="0.01" {...register('hok_cons')} placeholder="0.00" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
