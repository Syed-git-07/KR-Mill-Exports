'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  getSimplexProductionWithSetup,
  getSimplexMachineSetups,
  updateSimplexProductionDetail, 
  calculateSimplexProductionValues
} from '@/lib/supabase/simplexEntryQueries'

export default function SimplexProductionTab({ 
  headerId, 
  totalTime = 510,
  onRefresh
}) {
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
        getSimplexProductionWithSetup(headerId),
        getSimplexMachineSetups()
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

  // Handle input changes
  const handleInputChange = (rowId, field, value) => {
    const numValue = field === 'idle_spindles' ? (parseInt(value) || 0) : (parseFloat(value) || 0)
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: numValue
      }
    }))

    setProductionData(prev => prev.map(row => {
      if (row.id !== rowId) return row

      const updatedRow = { ...row, [field]: numValue }
      
      // Get machine setup for calculations
      const setup = machineSetups[row.machine_id] || {}
      const machine = row.machine || {}
      
      // Get stoppage data (stoppage is an array from Supabase relation)
      const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 0

      // If RunHrs changed, recalculate everything
      if (field === 'run_hrs' || field === 'idle_spindles' || field === 'waste') {
        const runHrs = field === 'run_hrs' ? parseFloat(value) || 0 : parseFloat(updatedRow.run_hrs) || 0
        const idleSpindles = field === 'idle_spindles' ? parseInt(value) || 0 : parseInt(updatedRow.idle_spindles) || 0
        const waste = field === 'waste' ? parseFloat(value) || 0 : parseFloat(updatedRow.waste) || 0

        // Get machine parameters
        const speed = machine.speed || setup.speed || 960
        const tpi = machine.tpi || setup.tpi || 1.73
        const mcEffi = machine.mc_effi || setup.mc_effi || 92
        const totalSpindles = machine.no_of_spindles || setup.spindles || 140
        const hank = setup.sl_hank || 1.4

        // Calculate production values using Simplex formula
        const calculated = calculateSimplexProductionValues({
          runHrs: runHrs,
          speed: speed,
          tpi: tpi,
          hank: hank,
          mcEffi: mcEffi,
          totalSpindles: totalSpindles,
          idleSpindles: idleSpindles,
          waste: waste,
          totalTime: totalTime,
          stoppageTime: stoppageTime
        })

        updatedRow.run_min = calculated.run_min
        updatedRow.work_time = calculated.work_time
        updatedRow.std_hrs = calculated.std_hrs
        updatedRow.act_prodn = calculated.act_prodn
        updatedRow.act_effi_percent = calculated.act_effi_percent
        updatedRow.waste_percent = calculated.waste_percent
        updatedRow.uti_percent = calculated.uti_percent
      }

      return updatedRow
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

  // Handle save
  const handleSave = async () => {
    const editedRowIds = Object.keys(editedRows)
    if (editedRowIds.length === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)
    try {
      const rowsToSave = productionData.filter(row => editedRows[row.id])
      
      for (const row of rowsToSave) {
        const setup = machineSetups[row.machine_id] || {}
        const machine = row.machine || {}
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 0

        // Get machine parameters
        const speed = machine.speed || setup.speed || 960
        const tpi = machine.tpi || setup.tpi || 1.73
        const mcEffi = machine.mc_effi || setup.mc_effi || 92
        const totalSpindles = machine.no_of_spindles || setup.spindles || 140
        const hank = setup.sl_hank || 1.4

        // Calculate production values
        const calculated = calculateSimplexProductionValues({
          runHrs: parseFloat(row.run_hrs) || 0,
          speed,
          tpi,
          hank,
          mcEffi,
          totalSpindles,
          idleSpindles: parseInt(row.idle_spindles) || 0,
          waste: parseFloat(row.waste) || 0,
          totalTime,
          stoppageTime
        })

        await updateSimplexProductionDetail(row.id, {
          employee_name: row.employee_name,
          run_hrs: row.run_hrs,
          run_min: row.run_min,
          idle_spindles: row.idle_spindles,
          waste: row.waste,
          act_prodn: row.act_prodn,
          waste_percent: row.waste_percent,
          act_effi_percent: row.act_effi_percent,
          uti_percent: row.uti_percent,
          std_hrs: row.std_hrs,
          work_time: row.work_time
        })
      }

      toast.success(`${rowsToSave.length} row(s) saved successfully`)
      setEditedRows({})
      
      // Reload data
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error saving production data:', error)
      toast.error('Failed to save changes')
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
          {productionData.length} machines | Shift Time: {totalTime} mins | MCEffi: 92%
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
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-36">EmpName</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-28">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">
                  <span className="text-yellow-200">RunHrs</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">RunMin</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">
                  <span className="text-yellow-200">IdleSpdl</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">ActSpdl</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">
                  <span className="text-yellow-200">Waste</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Act.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Uti%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Std.hrs</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Total Stopp</th>
              </tr>
            </thead>
            <tbody>
              {productionData.map((row, index) => {
                const machine = row.machine || {}
                const setup = machineSetups[row.machine_id] || {}
                const isEdited = editedRows[row.id]
                const totalSpindles = machine.no_of_spindles || setup.spindles || 140
                const activeSpindles = totalSpindles - (parseInt(row.idle_spindles) || 0)

                return (
                  <tr 
                    key={row.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isEdited ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                  >
                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700">
                      {machine.machine_no || '-'}
                    </td>
                    
                    {/* Employee Name */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        value={row.employee_name || ''}
                        onChange={(e) => handleEmployeeChange(row.id, e.target.value)}
                        className="h-6 text-xs border-gray-300 w-full min-w-[120px]"
                        placeholder="Employee name"
                      />
                    </td>
                    
                    {/* Count/Mixing */}
                    <td className="border border-gray-300 px-2 py-1 text-sm">
                      {row.prodn_mixing || machine.prodn_mixing || '64COMBED GOLD'}
                    </td>
                    
                    {/* Run Hours (HH.MM) - EDITABLE */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.run_hrs || ''}
                        onChange={(e) => handleInputChange(row.id, 'run_hrs', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-16 bg-yellow-50"
                        placeholder="0.00"
                      />
                    </td>
                    
                    {/* Run Minutes (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right text-gray-600">
                      {row.run_min || 0}
                    </td>
                    
                    {/* Idle Spindles - EDITABLE */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        value={row.idle_spindles || ''}
                        onChange={(e) => handleInputChange(row.id, 'idle_spindles', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-12 bg-yellow-50"
                        placeholder="0"
                      />
                    </td>
                    
                    {/* Active Spindles (calculated: Total - Idle) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-green-700">
                      {activeSpindles}
                    </td>
                    
                    {/* Waste - EDITABLE */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="number"
                        step="0.1"
                        value={row.waste || ''}
                        onChange={(e) => handleInputChange(row.id, 'waste', e.target.value)}
                        className="h-6 text-xs text-right border-gray-300 w-16 bg-yellow-50"
                        placeholder="0.0"
                      />
                    </td>
                    
                    {/* Actual Production (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                      {(row.act_prodn || 0).toFixed(2)}
                    </td>
                    
                    {/* Waste % (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {(row.waste_percent || 0).toFixed(2)}
                    </td>
                    
                    {/* Actual Efficiency % (calculated) */}
                    <td className={`border border-gray-300 px-2 py-1 text-right font-medium ${
                      (row.act_effi_percent || 0) >= 100 ? 'text-green-600' : 
                      (row.act_effi_percent || 0) >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(row.act_effi_percent || 0).toFixed(2)}
                    </td>
                    
                    {/* UTI % (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {(row.uti_percent || 0).toFixed(2)}
                    </td>
                    
                    {/* Std.Hrs (Standard Hours) */}
                    <td className="border border-gray-300 px-2 py-1 text-right text-gray-600">
                      {(row.std_hrs || 0).toFixed(1)}
                    </td>
                    
                    {/* Work Time (TotalTime - TotalStoppage) */}
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {row.work_time || 0}
                    </td>
                    
                    {/* Total Stoppage Time */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-orange-600 font-medium">
                      {row.stoppage?.[0]?.total_stoppage_time || 0}
                    </td>
                  </tr>
                )
              })}
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
        Act.Prodn = (Speed/TPI/39.3/1693/Hank)×RunMin×ActSpdl | Uti% = (WorkTime/TotalTime)×100
      </div>
    </div>
  )
}
