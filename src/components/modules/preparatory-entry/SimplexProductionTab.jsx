'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  updateSimplexProductionDetail, 
  calculateSimplexProductionValues,
  parseRunHoursToMinutes
} from '@/lib/supabase/simplexEntryQueries'

export default function SimplexProductionTab({ 
  productionData, 
  productionHeader, 
  totalTime = 510,
  onDataRefresh,
  machineSetups = []
}) {
  const [editedRows, setEditedRows] = useState({})
  const [localData, setLocalData] = useState([])
  const [isSaving, setIsSaving] = useState(false)

  // Initialize local data when production data changes
  useEffect(() => {
    setLocalData(productionData)
    setEditedRows({})
  }, [productionData])

  // Create setup map for quick lookup
  const setupMap = {}
  machineSetups.forEach(s => {
    setupMap[s.machine_id] = s
  })

  // Handle input changes
  const handleInputChange = (rowId, field, value) => {
    setLocalData(prev => prev.map(row => {
      if (row.id !== rowId) return row

      const updatedRow = { ...row, [field]: value }
      
      // Get machine setup for calculations
      const setup = setupMap[row.machine_id] || {}
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

    // Track edited rows
    setEditedRows(prev => ({ ...prev, [rowId]: true }))
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
      const rowsToSave = localData.filter(row => editedRows[row.id])
      
      for (const row of rowsToSave) {
        await updateSimplexProductionDetail(row.id, {
          employee_name: row.employee_name,
          prodn_mixing: row.prodn_mixing,
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
      
      if (onDataRefresh) {
        await onDataRefresh()
      }
    } catch (error) {
      console.error('Error saving production data:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate totals
  const totals = localData.reduce((acc, row) => ({
    actProdn: acc.actProdn + (row.act_prodn || 0),
    waste: acc.waste + (row.waste || 0),
    efficiency: acc.efficiency + (row.act_effi_percent || 0),
    count: acc.count + 1
  }), { actProdn: 0, waste: 0, efficiency: 0, count: 0 })

  const avgEfficiency = totals.count > 0 ? totals.efficiency / totals.count : 0

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {Object.keys(editedRows).length > 0 && (
            <span className="text-yellow-600 font-medium">
              {Object.keys(editedRows).length} unsaved change(s)
            </span>
          )}
        </div>
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

      {/* Production Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-32">Employee</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Count/Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">
                  <span className="text-yellow-200">RunHrs</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">RunMin</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">
                  <span className="text-yellow-200">IdleSpdl</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">ActSpdl</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">
                  <span className="text-yellow-200">Waste</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Act.Effi%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">UTI%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Std.Hrs</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">R.Time</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Tot.Stop</th>
              </tr>
            </thead>
            <tbody>
              {localData.map((row, index) => {
                const machine = row.machine || {}
                const setup = setupMap[row.machine_id] || {}
                const isEdited = editedRows[row.id]

                return (
                  <tr 
                    key={row.id}
                    className={`
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                      ${isEdited ? 'bg-yellow-50' : ''} 
                      hover:bg-blue-50
                    `}
                  >
                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700">
                      {machine.machine_no || '-'}
                    </td>
                    
                    {/* Employee Name */}
                    <td className="border border-gray-300 px-1 py-1">
                      <Input
                        type="text"
                        value={row.employee_name || ''}
                        onChange={(e) => handleInputChange(row.id, 'employee_name', e.target.value)}
                        className="h-6 text-xs border-gray-300 w-28"
                        placeholder="Name"
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
                      {(machine.no_of_spindles || setup.spindles || 140) - (parseInt(row.idle_spindles) || 0)}
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
                      (row.act_effi_percent || 0) >= 90 ? 'text-green-600' :
                      (row.act_effi_percent || 0) >= 80 ? 'text-yellow-600' : 'text-red-600'
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
                    
                    {/* R.Time (Run Time - always 510) */}
                    <td className="border border-gray-300 px-2 py-1 text-right text-gray-500">
                      {totalTime}
                    </td>
                    
                    {/* Work Time (TotalTime - TotalStoppage) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-blue-600">
                      {row.work_time || totalTime}
                    </td>
                    
                    {/* Total Stoppage Time */}
                    <td className="border border-gray-300 px-2 py-1 text-right text-red-600">
                      {row.stoppage?.[0]?.total_stoppage_time || 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
              <tr>
                <td colSpan={7} className="border border-gray-300 px-2 py-2 text-right">
                  Totals:
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                  {totals.waste.toFixed(2)}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                  {totals.actProdn.toFixed(2)}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                  -
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                  {avgEfficiency.toFixed(2)}%
                </td>
                <td colSpan={5} className="border border-gray-300 px-2 py-2 text-right">
                  -
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Formula Reference */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
        <strong>Simplex Production Formula:</strong>
        <br />
        • Run Minutes = (Hours × 60) + Minutes from HH.MM format (e.g., 7.12 = 432 min)
        <br />
        • Active Spindles = Total Spindles - Idle Spindles
        <br />
        • Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
        <br />
        • Act.Effi% = (RunMin / Std.Hrs) × 100 | UTI% = (WorkTime / TotalTime) × 100
      </div>
    </div>
  )
}
