'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getComberProductionWithSetup,
  updateComberProductionDetail,
  calculateComberProductionValues,
  calculateRunMin,
  getComberMachineSetups
} from '@/lib/supabase/comberEntryQueries'

export default function ComberProductionTab({ headerId, totalTime = 510, onRefresh }) {
  const [productionData, setProductionData] = useState([])
  const [machineSetups, setMachineSetups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedRows, setEditedRows] = useState({})

  // Load production data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      const [details, setups] = await Promise.all([
        getComberProductionWithSetup(headerId),
        getComberMachineSetups()
      ])
      
      setProductionData(details || [])
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      setMachineSetups(setupMap)
    } catch (error) {
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle numeric input change
  const handleInputChange = (rowId, field, value) => {
    const numValue = parseFloat(value) || 0
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: numValue
      }
    }))

    // Update production data for display with recalculation
    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        
        // Get stoppage time from stoppage entry
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 30
        const setup = machineSetups[row.machine_id]
        
        // Get current values
        const actHank = field === 'act_hank' ? numValue : row.act_hank
        const runHrs = field === 'run_hrs' ? numValue : row.run_hrs
        const waste = field === 'waste' ? numValue : row.waste
        
        // Recalculate all values using Comber formula
        const calculated = calculateComberProductionValues(
          actHank,
          runHrs,
          waste,
          totalTime,
          stoppageTime,
          setup
        )
        
        return { 
          ...updatedRow,
          ...calculated,
          act_hank: actHank,
          run_hrs: runHrs,
          waste: waste
        }
      }
      return row
    }))
  }

  // Handle employee name change
  const handleEmployeeChange = (rowId, value) => {
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        employee_name: value
      }
    }))

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, employee_name: value } : row
    ))
  }

  // Handle text field change (prodn_mixing, etc.)
  const handleTextChange = (rowId, field, value) => {
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value
      }
    }))

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ))
  }

  // Save changes
  const handleSave = async () => {
    if (Object.keys(editedRows).length === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)
    try {
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => {
        // Get the full row data for recalculation
        const row = productionData.find(r => r.id === rowId)
        if (!row) return null

        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 30
        const setup = machineSetups[row.machine_id]
        
        const actHank = changes.act_hank ?? row.act_hank
        const runHrs = changes.run_hrs ?? row.run_hrs
        const waste = changes.waste ?? row.waste
        
        const calculated = calculateComberProductionValues(
          actHank,
          runHrs,
          waste,
          totalTime,
          stoppageTime,
          setup
        )

        return updateComberProductionDetail(rowId, {
          ...changes,
          ...calculated,
          act_hank: actHank,
          run_hrs: runHrs,
          waste: waste
        })
      }).filter(Boolean)

      await Promise.all(updatePromises)
      setEditedRows({})
      toast.success('Production data saved successfully')
      
      // Reload data
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error saving production data:', error)
      toast.error('Failed to save production data')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading production data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {productionData.length} machines | Shift Time: {totalTime} mins | MCEffi: 93%
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isSaving || Object.keys(editedRows).length === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Production Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">EmpName</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-28">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16">RunHrs</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">RunMin</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16">Waste</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Act.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">Uti</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Std.hrs</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">WorkTime</th>
              </tr>
            </thead>
            <tbody>
              {productionData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700">
                    {row.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      value={row.employee_name || ''}
                      onChange={(e) => handleEmployeeChange(row.id, e.target.value)}
                      className="h-6 text-xs border-gray-300 w-full min-w-[120px]"
                      placeholder="Employee name"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      value={row.prodn_mixing || ''}
                      onChange={(e) => handleTextChange(row.id, 'prodn_mixing', e.target.value)}
                      className="h-6 text-xs border-gray-300 w-full"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.act_hank || ''}
                      onChange={(e) => handleInputChange(row.id, 'act_hank', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.run_hrs || ''}
                      onChange={(e) => handleInputChange(row.id, 'run_hrs', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                      placeholder="HH.MM"
                      title="Enter in HH.MM format (e.g., 5.58 = 5hr 58min)"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-gray-600">
                    {row.run_min || 0}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.waste || ''}
                      onChange={(e) => handleInputChange(row.id, 'waste', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                      placeholder="0.96"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                    {row.act_prodn?.toFixed(2) || '0.00'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.waste_percent?.toFixed(2) || '0.00'}
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium ${
                    row.act_effi_percent >= 100 ? 'text-green-600' : 
                    row.act_effi_percent >= 90 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {row.act_effi_percent?.toFixed(2) || '0.00'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.uti_percent?.toFixed(2) || '0.00'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.std_hrs?.toFixed(1) || '0.0'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.work_time || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between text-sm text-gray-600 p-2 bg-gray-100 rounded">
        <span>
          {Object.keys(editedRows).length > 0 && (
            <span className="text-yellow-600 font-medium">
              {Object.keys(editedRows).length} row(s) modified
            </span>
          )}
        </span>
        <div className="flex gap-4">
          <span>
            Total Act.Prodn: <strong>{productionData.reduce((sum, r) => sum + (r.act_prodn || 0), 0).toFixed(2)}</strong> Kg
          </span>
          <span>
            Avg Effi: <strong>{productionData.length > 0 
              ? (productionData.reduce((sum, r) => sum + (r.act_effi_percent || 0), 0) / productionData.length).toFixed(2) 
              : 0}%</strong>
          </span>
        </div>
      </div>

      {/* Formula Reference */}
      <div className="text-xs text-gray-400 p-2 bg-gray-50 rounded">
        <strong>Formulas:</strong> RunMin = Hours×60 + (Decimal×100) | WorkTime = 510 - Stoppage | 
        Std.hrs = WorkTime × 0.93 | Act.Prodn = Act.Hank × 3.240 | Act.Effi = (RunMin/Std.hrs)×100
      </div>
    </div>
  )
}
