'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import EmployeeAutocomplete from '@/components/ui/employee-autocomplete'
import { resolveComberShiftFallbackTime } from '@/lib/comberShiftFallback'
import {
  getComberProductionWithSetupAction,
  updateComberProductionDetailAction,
  getComberMachineSetupsAction,
  syncNewMachinesToComberHeaderAction
} from '@/app/actions/comber-entry'
import {
  calculateComberProductionValues
} from '@/lib/queries/comberEntryQueries'
import { NumberInput } from '@/components/ui/number-input'

// Helper function to safely convert Prisma Decimal to number
const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  // Handle Prisma Decimal objects that might have toString
  if (typeof value === 'object' && value.toString) return parseFloat(value.toString()) || 0
  return 0
}

// Helper function to format number with fixed decimals
const formatNumber = (value, decimals = 2) => {
  return toNumber(value).toFixed(decimals)
}

const ComberProductionTab = forwardRef(function ComberProductionTab({
  headerId,
  totalTime = resolveComberShiftFallbackTime(1),
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  setupDraftEdits,
  stoppageDraftEdits
}, ref) {
  const [productionData, setProductionData] = useState([])
  const [machineSetups, setMachineSetups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})

  const setEditedRows = useCallback((updater) => {
    if (onSharedDraftEditsChange) {
      const prev = editedRowsRef.current || {}
      const next = typeof updater === 'function' ? updater(prev) : (updater || {})
      editedRowsRef.current = next
      onSharedDraftEditsChange(next)
      return
    }
    setLocalEditedRows(prev => (typeof updater === 'function' ? updater(prev) : (updater || {})))
  }, [onSharedDraftEditsChange])

  useEffect(() => {
    editedRowsRef.current = editedRows
  }, [editedRows])

  const tableRef = useRef(null)
  const focusRowByDelta = useCallback((rowIndex, delta, colName) => {
    const targetRow = rowIndex + delta
    if (targetRow < 0 || !tableRef.current) return
    const targetInput = tableRef.current.querySelector(
      `input[data-row="${targetRow}"][data-col="${colName}"]`
    )
    if (targetInput) { targetInput.focus(); targetInput.select(); return }
    const targetAuto = tableRef.current.querySelector(
      `[data-autocomplete][data-row="${targetRow}"][data-col="${colName}"]`
    )
    if (targetAuto) {
      const inp = targetAuto.querySelector('input')
      if (inp) { inp.focus(); inp.select() } else { targetAuto.querySelector('button')?.click() }
    }
  }, [])
  const focusNextRow = useCallback((rowIndex, colName) => focusRowByDelta(rowIndex, 1, colName), [focusRowByDelta])
  const handleEnterNavigation = useCallback((e, rowIndex, colName) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, colName) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, colName) }
  }, [focusRowByDelta])

  const getEffectiveTotalStoppageMins = useCallback((row) => {
    const stoppageEntry = row?.stoppage?.[0]
    const baseTotal = toNumber(row?.total_stoppage_mins ?? stoppageEntry?.total_stoppage_time ?? 0)
    if (!stoppageEntry?.id) return baseTotal

    const stoppageDraft = stoppageDraftEdits?.[stoppageEntry.id] || stoppageDraftEdits?.[String(stoppageEntry.id)]
    if (!stoppageDraft) return baseTotal

    const t1 = toNumber(stoppageDraft.stoppage1_time ?? stoppageEntry.stoppage1_time ?? 0)
    const t2 = toNumber(stoppageDraft.stoppage2_time ?? stoppageEntry.stoppage2_time ?? 0)
    const t3 = toNumber(stoppageDraft.stoppage3_time ?? stoppageEntry.stoppage3_time ?? 0)
    const t4 = toNumber(stoppageDraft.stoppage4_time ?? stoppageEntry.stoppage4_time ?? 0)
    return t1 + t2 + t3 + t4
  }, [stoppageDraftEdits])

  const findSetupDraftForMachine = useCallback((machineId) => {
    if (!machineId) return null
    const drafts = setupDraftEdits || {}
    const direct = drafts[machineId] || drafts[String(machineId)]
    if (direct && direct.machine_id) return direct
    return Object.values(drafts).find(draft => String(draft?.machine_id) === String(machineId)) || null
  }, [setupDraftEdits])

  const resolveEffectiveSetup = useCallback((setup, machineId) => {
    const setupDraft = findSetupDraftForMachine(machineId)
    return setupDraft ? { ...setup, ...setupDraft } : setup
  }, [findSetupDraftForMachine])

  const mergeServerRowsWithDrafts = useCallback((rows, setupMap) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))

    // Drop drafts for rows no longer present in refreshed server payload.
    setEditedRows(prev => {
      const next = {}
      for (const [id, value] of Object.entries(prev)) {
        if (rowIds.has(String(id))) {
          next[id] = value
        }
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })

    return (rows || []).map(row => {
      const draft = drafts[row.id] || drafts[String(row.id)]
      const mergedRow = draft ? { ...row, ...draft } : { ...row }
      const stoppageTime = getEffectiveTotalStoppageMins(mergedRow)
      const setup = resolveEffectiveSetup(setupMap[mergedRow.machine_id], mergedRow.machine_id)
      const actHank = draft?.act_hank ?? mergedRow.act_hank
      const runHrs = draft?.run_hrs ?? mergedRow.run_hrs
      const waste = draft?.waste ?? mergedRow.waste

      const calculated = calculateComberProductionValues(
        actHank,
        runHrs,
        waste,
        totalTime,
        stoppageTime,
        setup
      )

      return {
        ...mergedRow,
        ...calculated,
        act_hank: actHank,
        run_hrs: runHrs,
        waste,
        total_stoppage_mins: stoppageTime,
        stoppage: [
          {
            ...(mergedRow.stoppage?.[0] || {}),
            total_stoppage_time: stoppageTime
          }
        ]
      }
    })
  }, [totalTime, getEffectiveTotalStoppageMins])

  useEffect(() => {
    if (!productionData.length) return

    setProductionData(prev => prev.map(row => {
      const draft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const setup = resolveEffectiveSetup(machineSetups[row.machine_id], row.machine_id)
      const stoppageTime = getEffectiveTotalStoppageMins(row)
      const actHank = draft?.act_hank ?? row.act_hank
      const runHrs = draft?.run_hrs ?? row.run_hrs
      const waste = draft?.waste ?? row.waste

      const calculated = calculateComberProductionValues(
        actHank,
        runHrs,
        waste,
        totalTime,
        stoppageTime,
        setup
      )

      return {
        ...row,
        ...calculated,
        act_hank: actHank,
        run_hrs: runHrs,
        waste,
        total_stoppage_mins: stoppageTime,
        stoppage: [
          {
            ...(row.stoppage?.[0] || {}),
            total_stoppage_time: stoppageTime
          }
        ]
      }
    }))
  }, [stoppageDraftEdits, machineSetups, totalTime, getEffectiveTotalStoppageMins, productionData.length, resolveEffectiveSetup])

  // Load production data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      // Sync new/removed machines before loading
      await syncNewMachinesToComberHeaderAction(headerId)

      const [detailsResult, setupsResult] = await Promise.all([
        getComberProductionWithSetupAction(headerId),
        getComberMachineSetupsAction()
      ])
      
      if (!detailsResult.success || !setupsResult.success) {
        throw new Error(detailsResult.error || setupsResult.error)
      }
      
      const details = detailsResult.data
      const setups = setupsResult.data
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      setMachineSetups(setupMap)
      
      // Recalculate display values with proper stoppage time
      const recalculatedDetails = (details || []).map(row => {
        // Get stoppage time from stoppage entry OR from total_stoppage_mins
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time ?? row.total_stoppage_mins ?? 0
        const setup = setupMap[row.machine_id]
        
        // If prodn_mixing is empty, populate from setup
        const prodnMixing = row.prodn_mixing || setup?.prodn_mixing || ''
        
        return {
          ...row,
          prodn_mixing: prodnMixing,
          total_stoppage_mins: stoppageTime
        }
      })
      
      const mergedRows = mergeServerRowsWithDrafts(recalculatedDetails, setupMap)
      setProductionData(mergedRows)
    } catch (error) {
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, mergeServerRowsWithDrafts])

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
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time ?? 0
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
  const handleSave = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    if (Object.keys(editedRows).length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => {
        // Get the full row data for recalculation
        const row = productionData.find(r => r.id === rowId)
        if (!row) return null

        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time ?? 0
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

        return updateComberProductionDetailAction(rowId, {
          ...changes,
          ...calculated,
          act_hank: actHank,
          run_hrs: runHrs,
          waste: waste
        })
      }).filter(Boolean)

      const results = await Promise.all(updatePromises)
      
      // Check if any failed
      const failed = results.filter(r => !r.success)
      if (failed.length > 0) {
        throw new Error(failed[0].error || 'Failed to save')
      }
      
      const savedCount = Object.keys(editedRows).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Production data saved successfully')
      }
      
      // Reload data
      await loadData()
      if (!skipParentRefresh) {
        onRefresh?.()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving production data:', error)
      toast.error('Failed to save production data')
      return { success: false, saved: 0, error: error.message }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshClick = async () => {
    if (Object.keys(editedRows).length > 0) {
      const shouldDiscard = window.confirm('You have unsaved changes in Production. Refresh will discard them. Continue?')
      if (!shouldDiscard) return
    }
    setEditedRows({})
    await loadData()
  }

  const discardChanges = async () => {
    setEditedRows({})
    await loadData()
    return { success: true }
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRows).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, editedRows, isSaving, discardChanges])

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
          {productionData.length} machines | Shift Time: {totalTime} mins | MCEffi: setup-based
          {Object.keys(editedRows).length > 0 && (
            <span className="ml-4 text-orange-600 font-medium">
              Unsaved changes: {Object.keys(editedRows).length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshClick}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Production Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-125 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-44 whitespace-nowrap">EmpName</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-64 whitespace-nowrap">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">RunHrs</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">RunMin</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Waste</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 whitespace-nowrap">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Act.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Uti%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Std.hrs</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {productionData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    {row.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="emp_name">
                    <EmployeeAutocomplete
                      value={row.employee_name || ''}
                      onChange={(value) => handleEmployeeChange(row.id, value)}
                      className="h-9 rounded-none text-sm w-full min-w-44"
                      cleanCell
                      editingHighlight
                      data-row={index}
                      data-col="emp_name"
                      onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <Input
                      value={row.prodn_mixing || ''}
                      onChange={(e) => handleTextChange(row.id, 'prodn_mixing', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-2 text-left text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      title={row.prodn_mixing || ''}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="act_hank">
                    <NumberInput
                      type="number"
                      value={row.act_hank ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_hank', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="act_hank"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_hank')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="run_hrs">
                    <NumberInput
                      type="number"
                      value={row.run_hrs ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'run_hrs', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      placeholder="HH.MM"
                      title="Enter in HH.MM format (e.g., 5.58 = 5hr 58min)"
                      data-row={index}
                      data-col="run_hrs"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'run_hrs')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-gray-600 tabular-nums whitespace-nowrap">
                    {toNumber(row.run_min) === 0 ? '' : row.run_min}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="waste">
                    <NumberInput
                      type="number"
                      value={row.waste ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'waste', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="waste"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'waste')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatNumber(row.act_prodn)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.waste_percent)}
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium ${
                    toNumber(row.act_effi_percent) >= 100 ? 'text-green-600' : 
                    toNumber(row.act_effi_percent) >= 90 ? 'text-yellow-600' : 'text-red-600'
                  } tabular-nums whitespace-nowrap`}>
                    {formatNumber(row.act_effi_percent)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.uti_percent)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.std_hrs, 1)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {toNumber(row.work_time) === 0 ? '' : row.work_time}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-orange-600 font-medium tabular-nums whitespace-nowrap">
                    {toNumber(getEffectiveTotalStoppageMins(row)) === 0
                      ? ''
                      : getEffectiveTotalStoppageMins(row)}
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
            Total Act.Prodn: <strong>{formatNumber(productionData.reduce((sum, r) => sum + toNumber(r.act_prodn), 0))}</strong> Kg
          </span>
          <span>
            Avg Effi: <strong>{productionData.length > 0 
              ? formatNumber(productionData.reduce((sum, r) => sum + toNumber(r.act_effi_percent), 0) / productionData.length) 
              : '0.00'}%</strong>
          </span>
        </div>
      </div>

    </div>
  )
})

export default ComberProductionTab
