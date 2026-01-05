'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCardingProductionWithSetup,
  updateProductionDetail,
  calculateProductionValues,
  getCardingMachineSetups,
  syncNewMachinesToHeader
} from '@/lib/supabase/cardingEntryQueries'

export default function CardingProductionTab({ headerId, totalTime = 510, onRefresh }) {
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
      // First, sync any new machines that were added after this header was created
      const syncResult = await syncNewMachinesToHeader(headerId)
      if (syncResult.added > 0) {
        toast.info(`Added ${syncResult.added} new machine(s): ${syncResult.machines.join(', ')}`)
      }

      const [details, setups] = await Promise.all([
        getCardingProductionWithSetup(headerId),
        getCardingMachineSetups()
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

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const numValue = parseFloat(value) || 0
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: numValue
      }
    }))

    // Update production data for display
    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        
        // Get stoppage time from stoppage entry
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 135
        const setup = machineSetups[row.machine_id]
        
        // Recalculate based on which field changed
        if (['act_hank', 'act_prodn', 'exp_prodn', 'waste', 'run_time', 'work_time'].includes(field)) {
          const actHank = field === 'act_hank' ? numValue : row.act_hank
          const actProdn = field === 'act_prodn' ? numValue : row.act_prodn
          const expProdn = field === 'exp_prodn' ? numValue : row.exp_prodn
          const waste = field === 'waste' ? numValue : row.waste
          const runTime = field === 'run_time' ? numValue : row.run_time
          const workTime = field === 'work_time' ? numValue : row.work_time
          
          // Calculate efficiency (Performance %)
          const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
          
          // Calculate UTI% = WorkTime / TotalTime × 100 (based on actual working time)
          const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0
          
          // Calculate Waste%
          const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0
          
          return { 
            ...updatedRow, 
            act_hank: actHank,
            act_prodn: actProdn,
            exp_prodn: expProdn,
            waste: waste,
            run_time: runTime,
            work_time: workTime,
            effi_percent: Math.round(effiPercent * 100) / 100,
            uti_percent: Math.round(utiPercent * 100) / 100,
            waste_percent: Math.round(wastePercent * 100) / 100
          }
        }
        
        return updatedRow
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

  // Handle text field change (count_mixing, etc.)
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

        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 135
        const setup = machineSetups[row.machine_id]
        
        const actHank = changes.act_hank ?? row.act_hank
        const actProdn = changes.act_prodn ?? row.act_prodn
        
        const calculated = calculateProductionValues(
          actHank,
          actProdn,
          totalTime,
          stoppageTime,
          setup
        )

        return updateProductionDetail(rowId, {
          ...changes,
          ...calculated,
          act_hank: actHank,
          act_prodn: actProdn
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
          {productionData.length} machines | Shift Time: {totalTime} mins
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
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40">Emp.Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-28">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Exp.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Effi%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">UTI%</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16">Waste</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">RunTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20">Total Stopp</th>
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
                      className="h-6 text-xs border-gray-300 w-full min-w-[140px]"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      value={row.count_mixing || ''}
                      onChange={(e) => handleTextChange(row.id, 'count_mixing', e.target.value)}
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
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.act_prodn || ''}
                      onChange={(e) => handleInputChange(row.id, 'act_prodn', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.exp_prodn || ''}
                      onChange={(e) => handleInputChange(row.id, 'exp_prodn', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                    />
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium ${
                    row.effi_percent >= 100 ? 'text-green-600' : 
                    row.effi_percent >= 90 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {row.effi_percent?.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.uti_percent?.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.waste || ''}
                      onChange={(e) => handleInputChange(row.id, 'waste', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.waste_percent?.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.run_time || 510}
                      onChange={(e) => handleInputChange(row.id, 'run_time', e.target.value)}
                      className="h-6 text-xs text-center w-full border-gray-300"
                      readOnly
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.work_time || ''}
                      onChange={(e) => handleInputChange(row.id, 'work_time', e.target.value)}
                      className="h-6 text-xs text-center w-full border-gray-300"
                      readOnly
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium text-orange-600">
                    {row.total_stoppage_mins ?? row.stoppage?.[0]?.total_stoppage_time ?? 0}
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
        <span>
          Avg Effi: {productionData.length > 0 
            ? (productionData.reduce((sum, r) => sum + (r.effi_percent || 0), 0) / productionData.length).toFixed(2) 
            : 0}%
        </span>
      </div>
    </div>
  )
}
