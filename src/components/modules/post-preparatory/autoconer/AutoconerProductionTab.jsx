'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Button } from "@/components/ui/button"
import EmployeeAutocomplete from "@/components/ui/employee-autocomplete"
import EnterSelect from "@/components/ui/enter-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAutoconerProductionDetailsAction,
  batchUpdateAutoconerProductionDetailsAction,
  getIdleReasonsAction,
  syncNewMachinesToAutoconerHeaderAction
} from '@/app/actions/autoconerEntryActions'
import { calculateAutoconerProductionValues } from '@/lib/queries/autoconerEntryQueries'

/**
 * Autoconer Production Formulas (from plan.md):
 * 
 * WASTE % = (Waste Kg / Act Prodn) × 100
 * IDLE DRUM % = (Idle Drum / Total Drum) × 100
 * DRUM EFFICIENCY = 100 - Idle Drum %
 * Util % = (Work Time / Total Time) × 100
 * Prodn Effi % = (Work Time / Total Time) × Drum Efficiency
 */

const AutoconerProductionTab = forwardRef(function AutoconerProductionTab({
  headerId,
  totalTime = 510,
  shiftNo = 1,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  stoppageDraftEdits,
  setupDraftEdits
}, ref) {
  const [productionData, setProductionData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = sharedDraftEdits ?? localEditedRows
  const [idleReasons, setIdleReasons] = useState([])
  const hasShownInitToast = useRef(false)
  const editedRowsRef = useRef(editedRows)

  useEffect(() => {
    editedRowsRef.current = editedRows || {}
  }, [editedRows])

  const setEditedRows = useCallback((updater) => {
    const applyUpdate = (current) => (typeof updater === 'function' ? updater(current) : updater)
    setLocalEditedRows(prev => applyUpdate(prev))
    if (onSharedDraftEditsChange) {
      onSharedDraftEditsChange(prev => applyUpdate(prev || {}))
    }
  }, [onSharedDraftEditsChange])

  // Table ref for Enter-to-next-row navigation
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
      if (inp) { inp.focus(); inp.select() } else { targetAuto.click() }
    }
  }, [])
  const focusNextRow = useCallback((rowIndex, colName) => focusRowByDelta(rowIndex, 1, colName), [focusRowByDelta])
  const handleEnterNavigation = useCallback((e, rowIndex, colName) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, colName) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, colName) }
  }, [focusRowByDelta])

  // Reset toast flag when headerId changes
  useEffect(() => {
    hasShownInitToast.current = false
  }, [headerId])

  // Load idle reasons on mount
  useEffect(() => {
    const loadIdleReasons = async () => {
      const result = await getIdleReasonsAction()
      if (result.success) {
        setIdleReasons(result.data)
      }
    }
    loadIdleReasons()
  }, [])

  const findSetupDraft = useCallback((row) => {
    const machineId = row?.machine_id ?? row?.machine?.id
    if (!machineId || !setupDraftEdits) return null
    return setupDraftEdits[machineId] || setupDraftEdits[String(machineId)] || null
  }, [setupDraftEdits])

  const getEffectiveTotalStoppageMins = useCallback((row) => {
    const stoppageRow = row?.stoppage?.[0]
    const stoppageRowId = stoppageRow?.id
    const stoppageDraft = (stoppageRowId && stoppageDraftEdits)
      ? stoppageDraftEdits[stoppageRowId]
      : null

    const stoppage1 = stoppageDraft?.stoppage1_time ?? stoppageRow?.stoppage1_time ?? 0
    const stoppage2 = stoppageDraft?.stoppage2_time ?? stoppageRow?.stoppage2_time ?? 0
    const stoppage3 = stoppageDraft?.stoppage3_time ?? stoppageRow?.stoppage3_time ?? 0
    const stoppage4 = stoppageDraft?.stoppage4_time ?? stoppageRow?.stoppage4_time ?? 0

    return parseInt(stoppage1 || 0) + parseInt(stoppage2 || 0) + parseInt(stoppage3 || 0) + parseInt(stoppage4 || 0)
  }, [stoppageDraftEdits])

  const recalculateRow = useCallback((row, changes = {}) => {
    const actProdn = changes.act_prodn ?? row.act_prodn ?? 0
    const wasteKg = changes.waste_kg ?? row.waste_kg ?? 0
    const setupDraft = findSetupDraft(row)
    const totalDrums =
      parseInt(setupDraft?.no_of_drums) ||
      parseInt(setupDraft?.total_drums) ||
      parseInt(row.machine?.no_of_drums) ||
      parseInt(row._totalDrums) ||
      0
    const idleDrum = changes.idle_drum ?? row.idle_drum ?? 0
    const totalStoppageMins = changes.total_stoppage_mins ?? row.total_stoppage_mins ?? 0

    const calculated = calculateAutoconerProductionValues(
      actProdn,
      wasteKg,
      idleDrum,
      totalDrums,
      totalStoppageMins,
      totalTime
    )
    const { prodn_effi, ...derivedWithoutEffi } = calculated

    return {
      ...derivedWithoutEffi,
      _totalDrums: totalDrums
    }
  }, [totalTime, findSetupDraft])

  const mergeServerRowsWithDrafts = useCallback((rows = []) => {
    const drafts = editedRowsRef.current || {}
    return rows.map((row) => {
      const draft = drafts[row.id] || drafts[String(row.id)]
      const merged = draft ? { ...row, ...draft } : row
      const effectiveTotalStoppage = getEffectiveTotalStoppageMins(merged)
      const calculated = recalculateRow(merged, { total_stoppage_mins: effectiveTotalStoppage })
      return {
        ...merged,
        total_stoppage_mins: effectiveTotalStoppage,
        ...calculated
      }
    })
  }, [getEffectiveTotalStoppageMins, recalculateRow])

  // Load production data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      // First, sync any new machines that were added after this header was created
      // This also initializes production details if header exists but has no details
      const syncResult = await syncNewMachinesToAutoconerHeaderAction(headerId, shiftNo)
      if (syncResult.success && syncResult.data && syncResult.data.length > 0 && !hasShownInitToast.current) {
        toast.info(`Initialized ${syncResult.data.length} machine(s) for this shift`)
        hasShownInitToast.current = true
      }

      const result = await getAutoconerProductionDetailsAction(headerId)
      if (!result.success) throw new Error(result.error)
      
      const details = result.data || []
      setProductionData(mergeServerRowsWithDrafts(details))
    } catch (error) {
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, mergeServerRowsWithDrafts, shiftNo])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!productionData.length) return
    setProductionData(prev => prev.map((row) => {
      const effectiveTotalStoppage = getEffectiveTotalStoppageMins(row)
      const calculated = recalculateRow(row, { total_stoppage_mins: effectiveTotalStoppage })
      return {
        ...row,
        total_stoppage_mins: effectiveTotalStoppage,
        ...calculated
      }
    }))
  }, [stoppageDraftEdits, totalTime, getEffectiveTotalStoppageMins, recalculateRow])

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

    // Update production data for display
    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        
        // Recalculate based on which field changed
        if (['act_prodn', 'waste_kg', 'idle_drum'].includes(field)) {
          const effectiveTotalStoppage = getEffectiveTotalStoppageMins(row)
          const calculated = recalculateRow(row, {
            ...editedRowsRef.current?.[rowId],
            [field]: numValue,
            total_stoppage_mins: effectiveTotalStoppage
          })
          return { ...updatedRow, ...calculated }
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
        emp_name: value
      }
    }))

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, emp_name: value } : row
    ))
  }

  // Handle text input change (for idle_reason, etc.)
  const handleTextChange = (rowId, field, value) => {
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value
      }
    }))

    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: value }
      }
      return row
    }))
  }

  // Save changes
  const handleSave = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    const draftRows = editedRowsRef.current || {}
    if (Object.keys(draftRows).length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const updates = Object.entries(draftRows).map(([rowId, changes]) => {
        const row = productionData.find(r => r.id === rowId)
        if (!row) return null

        // Get current or updated values
        const actProdn = changes.act_prodn ?? row.act_prodn ?? 0
        const wasteKg = changes.waste_kg ?? row.waste_kg ?? 0
        const idleDrum = changes.idle_drum ?? row.idle_drum ?? 0
        const totalStoppageMins = getEffectiveTotalStoppageMins(row)
        const totalDrums = parseInt(row.machine?.no_of_drums) || 0

        // Calculate all production values (like carding does)
        const calculated = calculateAutoconerProductionValues(
          actProdn,
          wasteKg,
          idleDrum,
          totalDrums,
          totalStoppageMins,
          totalTime
        )

        // Filter out underscore-prefixed fields (they're not in database schema)
        const { _idleDrumPercent, _drumEfficiency, uti_percent, prodn_effi, ...dbFields } = calculated
        const manualProdnEffi = changes.prodn_effi

        return {
          id: rowId,
          ...changes,
          ...dbFields, // Only include database fields (waste_percent, prodn_effi, work_time, etc.)
          ...(manualProdnEffi !== undefined ? { prodn_effi: parseFloat(manualProdnEffi) || 0 } : {}),
          act_prodn: actProdn,
          waste_kg: wasteKg,
          idle_drum: idleDrum,
          run_time: totalTime,
          total_stoppage_mins: totalStoppageMins
        }
      }).filter(Boolean)

      const result = await batchUpdateAutoconerProductionDetailsAction(updates)
      if (!result.success) throw new Error(result.error)
      
      const savedCount = updates.length
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
    if (Object.keys(editedRowsRef.current || {}).length > 0) {
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
    getEditedCount: () => Object.keys(editedRowsRef.current || {}).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, isSaving, discardChanges])

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
          {productionData.length} machines | Shift {shiftNo} | Time: {totalTime} mins
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshClick}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Production Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto max-h-125 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20 whitespace-nowrap">Mc No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Emp. Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Count Name</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">From</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">To</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Total</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20">Prodn Effi %</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Red Light</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Idle Drm</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Idle Reason</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Act Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Waste Kg</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Util %</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 bg-blue-500">RunTm</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 bg-orange-500">T.Stop</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 bg-green-500">WrkTm</th>
              </tr>
            </thead>
            <tbody>
              {productionData.map((row, index) => {
                // Color efficiency based on machine target (act_effi from machine master)
                const hasTargetEffi = row.machine?.act_effi !== null && row.machine?.act_effi !== undefined && row.machine?.act_effi !== ''
                const targetEffi = hasTargetEffi ? parseFloat(row.machine?.act_effi) : null
                const currentEffi = parseFloat(row.prodn_effi) || 0
                
                // Green if efficiency meets or exceeds target, red if below target
                const effiColor = !hasTargetEffi
                  ? 'text-amber-700 font-semibold'
                  : currentEffi >= targetEffi
                    ? 'text-green-600 font-semibold'
                    : 'text-red-600 font-semibold'
                
                return (
                  <tr 
                    key={row.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                  >
                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                      {row.machine?.machine_no}
                    </td>
                    {/* Employee Name */}
                    <td className="border border-gray-300 px-0 py-0">
                      <EmployeeAutocomplete
                        value={row.emp_name || ''}
                        onChange={(value) => handleEmployeeChange(row.id, value)}
                        placeholder="Type employee name..."
                        cleanCell
                        editingHighlight
                        className="h-9 rounded-none text-xs w-full min-w-35"
                        data-row={index}
                        data-col="emp_name"
                        onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                      />
                    </td>
                    {/* Count Name */}
                    <td className="border border-gray-300 px-2 py-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                      {row.count_name || row.count?.count_name || '-'}
                    </td>
                    {/* Drum From */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                      {row.machine?.from_drum ?? '-'}
                    </td>
                    {/* Drum To */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                      {row.machine?.to_drum ?? '-'}
                    </td>
                    {/* Drum Total */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs font-medium">
                      {row.machine?.no_of_drums ?? '-'}
                    </td>
                    {/* Actual Production */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.act_prodn ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'act_prodn', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'act_prodn')}
                        data-row={index}
                        data-col="act_prodn"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0.00"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Production Efficiency (Manual Entry) */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.prodn_effi ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'prodn_effi', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'prodn_effi')}
                        data-row={index}
                        data-col="prodn_effi"
                        className={`h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100 ${effiColor}`}
                        placeholder="0.00"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Red Light */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.red_light ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'red_light', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'red_light')}
                        data-row={index}
                        data-col="red_light"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Idle Drum */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="1"
                        value={row.idle_drum ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'idle_drum', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'idle_drum')}
                        data-row={index}
                        data-col="idle_drum"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Idle Reason */}
                    <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="idle_reason">
                      <EnterSelect
                        value={row.idle_reason || 'none'}
                        options={[
                          { value: 'none', label: '-' },
                          ...idleReasons.map(r => ({ value: r.id, label: r.name }))
                        ]}
                        onChange={(val) => handleTextChange(row.id, 'idle_reason', val === 'none' ? '' : val)}
                        onNextRow={() => {
                          const next = tableRef.current?.querySelector(`td[data-row="${index + 1}"][data-col="idle_reason"] button`)
                          if (next) next.focus()
                        }}
                        placeholder="-"
                        cleanCell
                        editingHighlight
                        className="h-9 rounded-none"
                        searchable
                      />
                    </td>
                    {/* Act Effi (from machine master) */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs bg-gray-100">
                      {row.machine?.act_effi ?? '-'}
                    </td>
                    {/* Waste Kg */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.0001"
                        value={row.waste_kg ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'waste_kg', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'waste_kg')}
                        data-row={index}
                        data-col="waste_kg"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Waste % (Calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                      {row.waste_percent != null ? Number(row.waste_percent).toFixed(2) : ''}
                    </td>
                    {/* Util % (Calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap text-indigo-600">
                      {row.uti_percent != null ? Number(row.uti_percent).toFixed(2) : '0.00'}
                    </td>
                    {/* Run Time (from shift config - updates when shift changes) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-blue-600 bg-blue-50 tabular-nums whitespace-nowrap">
                      {totalTime}
                    </td>
                    {/* Total Stoppage Mins */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-orange-600 bg-orange-50 tabular-nums whitespace-nowrap">
                      {row.total_stoppage_mins ?? 0}
                    </td>
                    {/* Work Time (Calculated = RunTime - TotalStoppage) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-green-600 bg-green-50 tabular-nums whitespace-nowrap">
                      {row.work_time ?? (totalTime - (row.total_stoppage_mins || 0))}
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
            Total Production: <strong>{productionData.reduce((sum, r) => sum + (parseFloat(r.act_prodn) || 0), 0).toFixed(2)} kg</strong>
          </span>
          <span>
            Total Waste: <strong>{productionData.reduce((sum, r) => sum + (parseFloat(r.waste_kg) || 0), 0).toFixed(4)} kg</strong>
          </span>
          <span>
            Avg Effi: <strong>{productionData.length > 0 
              ? (productionData.reduce((sum, r) => sum + (parseFloat(r.prodn_effi) || 0), 0) / productionData.filter(r => parseFloat(r.act_prodn) > 0).length || 0).toFixed(1) 
              : '0.0'}%</strong>
          </span>
        </div>
      </div>

    </div>
  )
})

export default AutoconerProductionTab
