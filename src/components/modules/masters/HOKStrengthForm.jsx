'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDepartmentsForDropdown, getHOKEntryById } from '@/lib/supabase/hokStrengthQueries';

const hokStrengthSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  entries: z.array(z.object({
    department_id: z.string(),
    shift1: z.number().min(0),
    shift2: z.number().min(0),
    shift3: z.number().min(0),
  })),
});

export default function HOKStrengthForm({ initialData, onSubmit, onCancel }) {
  const [departments, setDepartments] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    initialData?.date || format(new Date(), 'yyyy-MM-dd')
  );
  const [hokId, setHokId] = useState(initialData?.hok_id || null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(hokStrengthSchema),
    defaultValues: {
      date: selectedDate,
      entries: [],
    },
  });

  useEffect(() => {
    loadDepartmentsAndData();
  }, [initialData]);

  const loadDepartmentsAndData = async () => {
    try {
      setLoading(true);
      console.log('🔵 HOKStrengthForm - Loading data, initialData:', initialData);
      
      const deptData = await getDepartmentsForDropdown();
      console.log('🔵 Loaded', deptData.length, 'departments:', deptData.map(d => d.dept_name));
      setDepartments(deptData);
      
      // Initialize grid with one row per department
      const initialGrid = deptData.map(dept => ({
        department_id: dept.id,
        dept_name: dept.dept_name,
        shift1: 0,
        shift2: 0,
        shift3: 0,
      }));
      
      // If editing, load the edit data
      if (initialData?.hok_id) {
        console.log('🟡 EDIT MODE - Loading data for HOK ID:', initialData.hok_id);
        const editData = await getHOKEntryById(initialData.hok_id);
        console.log('🟡 Loaded edit data - Header:', editData.header);
        console.log('🟡 Loaded edit data - Details:', editData.details);
        
        if (editData) {
          setHokId(editData.header.hok_id);
          setSelectedDate(editData.header.date);
          
          // Populate grid with existing detail values
          const populatedGrid = initialGrid.map(row => {
            const detail = editData.details.find(d => d.department_id === row.department_id);
            if (detail) {
              console.log('  ✓ Found data for', row.dept_name, ':', detail);
              return {
                ...row,
                shift1: detail.shift1 || 0,
                shift2: detail.shift2 || 0,
                shift3: detail.shift3 || 0,
              };
            }
            console.log('  ⚠ No data for', row.dept_name);
            return row;
          });
          console.log('🟢 Grid populated with', populatedGrid.length, 'rows');
          setGridData(populatedGrid);
        }
      } else {
        console.log('🟢 CREATE MODE - Initializing empty grid with', initialGrid.length, 'departments');
        setGridData(initialGrid);
      }
    } catch (error) {
      console.error('❌ Error loading departments and data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGridChange = (deptId, field, value) => {
    setGridData(prev => prev.map(row => {
      if (row.department_id === deptId) {
        return { ...row, [field]: parseFloat(value) || 0 };
      }
      return row;
    }));
  };

  const calculateTotals = (field) => {
    return gridData.reduce((sum, row) => sum + (row[field] || 0), 0);
  };

  const handleFormSubmit = async (formData) => {
    const submissionData = {
      date: selectedDate,
      hok_id: hokId,
      entries: gridData.map(row => ({
        department_id: row.department_id,
        shift1: row.shift1,
        shift2: row.shift2,
        shift3: row.shift3,
      })),
    };
    await onSubmit(submissionData);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* HOK ID and Date */}
      <div className="grid grid-cols-2 gap-4">
        {hokId && (
          <div className="space-y-2">
            <Label>HOK ID</Label>
            <Input value={hokId} disabled className="bg-gray-50" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="date">Entry Date *</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          {errors.date && (
            <p className="text-sm text-red-500">{errors.date.message}</p>
          )}
        </div>
      </div>

      {/* Department Grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left border-r border-blue-500 w-48">Dept</th>
                <th className="px-4 py-3 text-center border-r border-blue-500">Shift1</th>
                <th className="px-4 py-3 text-center border-r border-blue-500">Shift2</th>
                <th className="px-4 py-3 text-center">Shift3</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {gridData.map((row, index) => (
                <tr key={row.department_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium border-r border-gray-200 bg-gray-50">
                    {row.dept_name}
                  </td>
                  <td className="px-4 py-2 border-r border-gray-200">
                    <Input
                      type="number"
                      step="0.1"
                      value={row.shift1}
                      onChange={(e) =>
                        handleGridChange(row.department_id, 'shift1', e.target.value)
                      }
                      className="w-full text-center"
                    />
                  </td>
                  <td className="px-4 py-2 border-r border-gray-200">
                    <Input
                      type="number"
                      step="0.1"
                      value={row.shift2}
                      onChange={(e) =>
                        handleGridChange(row.department_id, 'shift2', e.target.value)
                      }
                      className="w-full text-center"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={row.shift3}
                      onChange={(e) =>
                        handleGridChange(row.department_id, 'shift3', e.target.value)
                      }
                      className="w-full text-center"
                    />
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-blue-600 text-white font-bold">
                <td className="px-4 py-3 border-r border-blue-500">
                  TOTAL
                </td>
                <td className="px-4 py-3 text-center border-r border-blue-500">
                  {calculateTotals('shift1').toFixed(1)}
                </td>
                <td className="px-4 py-3 text-center border-r border-blue-500">
                  {calculateTotals('shift2').toFixed(1)}
                </td>
                <td className="px-4 py-3 text-center">
                  {calculateTotals('shift3').toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
          {isSubmitting ? 'Saving...' : hokId ? 'Update' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
