'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getLapFormerProductionWithSetup,
  updateLapFormerDetail,
  calculateLapFormerValues,
  getLapFormerMachineSetups
} from '@/lib/supabase/lapFormerQueries'

export default function LapFormerProductionTab({ headerId, totalTime = 510, onRefresh }) {
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
        getLapFormerProductionWithSetup(headerId),
        getLapFormerMachineSetups()
      ])
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      setMachineSetups(setupMap)
      
      // Recalculate display values based on current stoppage times
      const recalculatedDetails = (details || []).map(row => {
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time ?? (totalTime - (row.work_time || totalTime))
        const setup = setupMap[row.machine_id]
        // Speed priority: machine.speed > setup.speed
        const machineSpeed = row.machine?.speed ?? setup?.speed ?? 90
        
        if (setup) {
          const workTime = row.stoppage?.[0] ? (totalTime - stoppageTime) : (row.work_time || totalTime)
          // LAP FORMER uses Hank constant 0.0082 (NOT 0.14)
          const hankConstant = setup.hank_constant || 0.0082
          const stdEffiFactor = setup.std_efficiency_factor || 0.85
          const delivery = setup.delivery || 1
          const divisor = setup.divisor_constant || 1693
          
          // Std Prodn = (Speed / 1693 / Hank) × Total Time × Std Effi × Delivery
          const stdProdn = (machineSpeed / divisor / hankConstant) * totalTime * stdEffiFactor * delivery
          // Exp Prodn = Std Prodn × (Work Time / Total Time)
          const expProdn = stdProdn * (workTime / totalTime)
          // Act Effi % = Actual Prodn / Exp Prodn × 100
          const effiPercent = expProdn > 0 ? (row.act_prodn / expProdn) * 100 : 0
          // UTI % = Work Time / Total Time × 100
          const utiPercent = (workTime / totalTime) * 100
          const wastePercent = row.act_prodn > 0 ? ((row.waste || 0.85) / row.act_prodn) * 100 : 0
          
          return {
            ...row,
            std_prodn: Math.round(stdProdn * 100) / 100,
            exp_prodn: Math.round(expProdn * 100) / 100,
            effi_percent: Math.round(effiPercent * 100) / 100,
            uti_percent: Math.round(utiPercent * 100) / 100,
            waste_percent: Math.round(wastePercent * 100) / 100,
            work_time: workTime,
            run_time: totalTime
          }
        }
        return row
      })
      
      setProductionData(recalculatedDetails)
    } catch (error) {
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, totalTime])

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
        
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 0
        const setup = machineSetups[row.machine_id]
        const machineSpeed = row.machine?.speed ?? setup?.speed ?? 90
        
        // Recalculate based on which field changed
        if (['act_hank', 'act_prodn', 'exp_prodn', 'waste', 'run_time', 'work_time'].includes(field)) {
          const actHank = field === 'act_hank' ? numValue : row.act_hank
          const actProdn = field === 'act_prodn' ? numValue : row.act_prodn
          const waste = field === 'waste' ? numValue : row.waste
          const runTime = field === 'run_time' ? numValue : row.run_time
          const workTime = field === 'work_time' ? numValue : row.work_time
          
          // If work_time changes, recalculate exp_prodn from std_prodn
          let expProdn = field === 'exp_prodn' ? numValue : row.exp_prodn
          if (field === 'work_time') {
            // LAP FORMER Hank = 0.0082
            const hankConstant = setup?.hank_constant || 0.0082
            const stdEffiFactor = setup?.std_efficiency_factor || 0.85
            const delivery = setup?.delivery || 1
            const divisor = setup?.divisor_constant || 1693
            const stdProdn = (machineSpeed / divisor / hankConstant) * totalTime * stdEffiFactor * delivery
            expProdn = stdProdn * (workTime / totalTime)
          }
          
          // Calculate efficiency
          const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
          
          // Calculate UTI
          const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0
          
          // Calculate Waste%
          const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0
          
          return { 
            ...updatedRow, 
            act_hank: actHank,
            act_prodn: actProdn,
            exp_prodn: Math.round(expProdn * 100) / 100,
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

  // Handle text field change
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
        const row = productionData.find(r => r.id === rowId)
        if (!row) return null

        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 0
        const setup = machineSetups[row.machine_id]
        const machineSpeed = row.machine?.speed ?? setup?.speed ?? 90
        
        const actHank = changes.act_hank ?? row.act_hank ?? 0
        const actProdn = changes.act_prodn ?? row.act_prodn ?? 0
        const waste = changes.waste ?? row.waste ?? 0.85
        
        // Use Lap Former specific calculations (Hank = 0.0082)
        const calculated = calculateLapFormerValues(
          actHank,
          actProdn,
          totalTime,
          stoppageTime,
          setup,
          machineSpeed
        )

        calculated.waste = waste
        calculated.waste_percent = actProdn > 0 ? Math.round((waste / actProdn) * 100 * 100) / 100 : 0

        return updateLapFormerDetail(rowId, {
          employee_name: changes.employee_name ?? row.employee_name,
          prodn_mixing: changes.prodn_mixing ?? row.prodn_mixing,
          act_hank: actHank,
          act_prodn: actProdn,
          ...calculated
        })
      }).filter(Boolean)

      await Promise.all(updatePromises)
      setEditedRows({})
      toast.success('Production data saved successfully')
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error saving production data:', error)
      toast.error(error.message || 'Failed to save production data')
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
          {productionData.length} machines | Shift Time: {totalTime} mins | Hank: 0.0082 | Std Effi: 85%
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
            className="bg-blue-600 hover:bg-blue-700"
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
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-28">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20">Exp.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Act.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">UTI</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16">Waste</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16">RunTime</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16">WorkTime</th>
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
                      value={row.run_time || ''}
                      onChange={(e) => handleInputChange(row.id, 'run_time', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <Input
                      type="number"
                      value={row.work_time || ''}
                      onChange={(e) => handleInputChange(row.id, 'work_time', e.target.value)}
                      className="h-6 text-xs text-left w-full border-gray-300"
                    />
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
            Avg Effi: {productionData.length > 0 
              ? (productionData.reduce((sum, r) => sum + (r.effi_percent || 0), 0) / productionData.length).toFixed(2) 
              : 0}%
          </span>
          <span>
            Total Prodn: {productionData.reduce((sum, r) => sum + (r.act_prodn || 0), 0).toFixed(2)} kg
          </span>
        </div>
      </div>

      {/* Formula Reference - LAP FORMER uses Hank = 0.0082 */}
      <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border border-blue-200">
        <strong>Lap Former Formulas (Hank=0.0082):</strong> Std Prodn = Speed/1693/0.0082 × TotalTime × StdEffi × Delivery | 
        Exp Prodn = Std Prodn × (WorkTime/TotalTime) | 
        Act.Effi% = ActProdn/ExpProdn × 100 | 
        UTI% = WorkTime/TotalTime × 100 | 
        WorkTime = TotalTime - Stoppage
      </div>
    </div>
  )
}
