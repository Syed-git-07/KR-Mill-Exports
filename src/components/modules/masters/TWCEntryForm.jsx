                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCountsForDropdown } from '@/lib/supabase/twcEntryQueries';
import { format } from 'date-fns';

// VB6 Form: Date, Count (dropdown), TWC
const twcEntrySchema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  spinning_count_id: z.string().min(1, 'Count selection is required'),
  twc_value: z.number().min(0, 'TWC value must be positive'),
  shift: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export default function TWCEntryForm({ initialData, onSubmit, isLoading }) {
  const [counts, setCounts] = useState([]);
  const [selectedCount, setSelectedCount] = useState(initialData?.spinning_count_id || '');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(twcEntrySchema),
    defaultValues: initialData || {
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      spinning_count_id: '',
      twc_value: 0,
      shift: '',
      remarks: '',
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
      ...data,
      twc_value: parseFloat(data.twc_value),
    };
    await onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Entry Date */}
      <div className="space-y-2">
        <Label htmlFor="entry_date">Entry Date *</Label>
        <Input
          id="entry_date"
          type="date"
          {...register('entry_date')}
        />
        {errors.entry_date && (
          <p className="text-sm text-red-500">{errors.entry_date.message}</p>
        )}
      </div>

      {/* Count Selection */}
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

      {/* TWC Value */}
      <div className="space-y-2">
        <Label htmlFor="twc_value">TWC Value *</Label>
        <Input
          id="twc_value"
          type="number"
          step="0.01"
          {...register('twc_value', { valueAsNumber: true })}
          placeholder="0.00"
        />
        {errors.twc_value && (
          <p className="text-sm text-red-500">{errors.twc_value.message}</p>
        )}
      </div>

      {/* Shift */}
      <div className="space-y-2">
        <Label htmlFor="shift">Shift</Label>
        <Select onValueChange={(value) => setValue('shift', value)} defaultValue={initialData?.shift || ''}>
          <SelectTrigger>
            <SelectValue placeholder="Select shift (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">Shift A</SelectItem>
            <SelectItem value="B">Shift B</SelectItem>
            <SelectItem value="C">Shift C</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Remarks */}
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
