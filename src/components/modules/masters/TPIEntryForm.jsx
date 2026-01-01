'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCountsForDropdown } from '@/lib/supabase/tpiEntryQueries';
import { format } from 'date-fns';

// VB6 Form: Date, Count (dropdown), TPI
const tpiEntrySchema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  spinning_count_id: z.string().min(1, 'Count selection is required'),
  tpi_value: z.number().min(0, 'TPI value must be positive'),
  shift: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export default function TPIEntryForm({ initialData, onSubmit, isLoading }) {
  const [counts, setCounts] = useState([]);
  const [selectedCount, setSelectedCount] = useState(initialData?.spinning_count_id || '');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(tpiEntrySchema),
    defaultValues: initialData || {
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      spinning_count_id: '',
      tpi_value: 0,
      shift: null,
      remarks: null,
    },
  });

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    try {
      const data = await getCountsForDropdown();
      setCounts(data);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

  const handleCountChange = (value) => {
    setSelectedCount(value);
    setValue('spinning_count_id', value);
  };

  const onFormSubmit = async (data) => {
    const formattedData = {
      entry_date: data.entry_date,
      spinning_count_id: data.spinning_count_id,
      tpi_value: parseFloat(data.tpi_value),
      shift: data.shift || null,
      remarks: data.remarks || null,
    };
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Header matching VB6 */}
      <div className="bg-blue-50 p-3 rounded-lg mb-4">
        <p className="text-sm text-blue-700">Despatch : To Add, Modify daily TPI details.</p>
      </div>

      {/* Entry Date - VB6: "Date" */}
      <div className="space-y-2">
        <Label htmlFor="entry_date">Date *</Label>
        <Input
          id="entry_date"
          type="date"
          {...register('entry_date')}
        />
        {errors.entry_date && (
          <p className="text-sm text-red-500">{errors.entry_date.message}</p>
        )}
      </div>

      {/* Count Selection - VB6: "Count" dropdown */}
      <div className="space-y-2">
        <Label htmlFor="spinning_count_id">Count *</Label>
        <Select value={selectedCount} onValueChange={handleCountChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a count" />
          </SelectTrigger>
          <SelectContent>
            {counts.map((count) => (
              <SelectItem key={count.id} value={count.id}>
                {count.count_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.spinning_count_id && (
          <p className="text-sm text-red-500">{errors.spinning_count_id.message}</p>
        )}
      </div>

      {/* TPI Value - VB6: "TPI" */}
      <div className="space-y-2">
        <Label htmlFor="tpi_value">TPI *</Label>
        <Input
          id="tpi_value"
          type="number"
          step="0.01"
          {...register('tpi_value', { valueAsNumber: true })}
          placeholder="0.00"
        />
        {errors.tpi_value && (
          <p className="text-sm text-red-500">{errors.tpi_value.message}</p>
        )}
      </div>

      {/* Optional: Shift (not in VB6 form but useful) */}
      <div className="space-y-2">
        <Label htmlFor="shift">Shift (Optional)</Label>
        <Select onValueChange={(value) => setValue('shift', value)} defaultValue={initialData?.shift || ''}>
          <SelectTrigger>
            <SelectValue placeholder="Select shift" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">Shift A</SelectItem>
            <SelectItem value="B">Shift B</SelectItem>
            <SelectItem value="C">Shift C</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Optional: Remarks (not in VB6 form but useful) */}
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks (Optional)</Label>
        <Textarea
          id="remarks"
          {...register('remarks')}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>
    </form>
  );
}
