'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Button } from "@/components/ui/button"
import EmployeeAutocomplete from "@/components/ui/employee-autocomplete"
import EnterSelect from "@/components/ui/enter-select"
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { resolveSpinningShiftFallbackTime } from '@/lib/spinningShiftFallback'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'
import {
  getSpinningEntryTabDataAction,
  batchUpdateSpinningProductionDetailsAction,
  calculateSpinningProductionAction
} from '@/app/actions/spinning-entry'
import {
  findDraftByKeys,
  getEffectiveStoppageTotal,
  mergeSetupDraft,
  selectRowsForDependentCommit
} from '@/lib/entryDraftSync'
import { calculateSpinningExpectedGps, resolveProductionTime } from '@/lib/productionFormulaMath'

/**
 * Spinning Production Entry Tab
 * 
 * FORMULAS:
 * CONSTANT = 1 / 2.20456 / ACL_Count × Total_Spl × Effi (0.985)
 * ACL_PROD (Kg) = ACL_Hank × Constant
 * WASTE % = (Waste / ACL_Prod) × 100
 * STOPPED_SPL = (Stoppage_Mins / Total_Mins) × Total_Spl
 * WORKED_SPL = Total_Spl - Stopped_Spl
 * GPS = (ACL_Prod / Worked_Spl) × 1000
 * EXP_GPS = Same calculation based on expected values
 */

const SpinningProductionTab = forwardRef(function SpinningProductionTab({
  headerId,
  totalTime,
  shiftNo = 1,
  onRefresh,
  setupDraftEdits,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  stoppageDraftEdits,
  counts = [],
  onMachineCountChange,
  onMachineSetupFieldChange
}, ref) {
  const effectiveTotalTime = totalTime ?? resolveSpinningShiftFallbackTime(shiftNo)
  const [productionData, setProductionData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
  const hasShownInitToast = useRef(false)

  const setEditedRows = useCallback((updater) => {
    if (onSharedDraftEditsChange) {
      const prev = editedRowsRef.current || {}
      const next = typeof updater === 'function' ? updater(prev) : (updater || {})
      if (next === prev) return
      editedRowsRef.current = next
      onSharedDraftEditsChange(next)
      return
    }
    setLocalEditedRows(prev => (typeof updater === 'function' ? updater(prev) : (updater || {})))
  }, [onSharedDraftEditsChange])

  useEffect(() => {
    editedRowsRef.current = editedRows
  }, [editedRows])

  // Reset toast flag when headerId changes
  useEffect(() => {
    hasShownInitToast.current = false
  }, [headerId])

  const formatWorkedSpindles = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '-'
    if (Number.isInteger(numeric)) return String(numeric)
    return numeric.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  const formatExpectedGps = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '-'
    return numeric.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
      useGrouping: false
    })
  }

  // Calculate production values based on formulas
  const getEffectiveSetup = useCallback((row, drafts = setupDraftEdits) => {
    const baseSetup = row.setup || {}
    return mergeSetupDraft(baseSetup, row.machine_id, drafts) || baseSetup
  }, [setupDraftEdits])

  const calculateValues = useCallback((row, updates = {}, effectiveSetupOverride = null) => {
    const setup = effectiveSetupOverride || row.setup || {}
    const actCount = Number.isFinite(Number(setup.act_count)) ? Number(setup.act_count) : 0
    const allocatedSpindles = setup.allocated_spindles != null && setup.allocated_spindles !== ''
      ? Number(setup.allocated_spindles)
      : (row.machine?.allocated_spindles ?? 1104)
    const requestedStoppageMins = parseInt(updates.total_stoppage_mins ?? row.total_stoppage_mins) || 0
    const rowRunTime = setup.run_time ?? row.run_time ?? effectiveTotalTime
    const productionTime = resolveProductionTime(rowRunTime, requestedStoppageMins)
    const stoppageMins = productionTime.stoppageTime
    const runTime = productionTime.totalTime

    // Get values needed for Exp GPS calculation (from machine setup, sourced from spinning_counts master)
    const speed = parseInt(setup.speed) || 0
    const tpi = parseFloat(setup.tpi) || 0
    // Use act_count from machine setup for Exp GPS calculation
    const count = actCount

    // Calculate No of Spindles based on shift
    // Shift 1 & 2: allocated / 8 * 8.5, Shift 3: allocated / 8 * 7
    const multiplier = shiftNo === 3 ? 7 : 8.5
    const totalSpindles = Math.round((allocatedSpindles / 8) * multiplier)

    // Calculate constant (uses fixed 0.985 efficiency, NOT the setup efficiency)
    const CONSTANT_EFFICIENCY = 0.985
    const constant = actCount > 0
      ? (1 / 2.20456 / actCount) * totalSpindles * CONSTANT_EFFICIENCY
      : 0

    const actHank = parseFloat(updates.act_hank ?? row.act_hank) || 0
    const actProdn = actHank * constant

    const waste = parseFloat(updates.waste ?? row.waste) || 0

    // Calculate waste percentage
    const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

    // Calculate stopped and worked spindles
    // STOPPED SPL = (total STOPPED MIN / TOTAL MIN) * TOTAL SPL (No of Spindle)
    const stoppedSpindles = runTime > 0 ? (stoppageMins / runTime) * totalSpindles : 0
    // WORKED SPL = TOTAL SPL (No of Spindle) - STOPPED SPL
    const workedSpindles = Math.max(totalSpindles - stoppedSpindles, 0)

    // Calculate GPS = (ACL_Prod / Worked_Spl) × 1000
    const gps = workedSpindles > 0 ? (actProdn / workedSpindles) * 1000 : 0

    // Calculate Expected GPS = 7.2 × Speed / TPI / Count × Effi
    const expGps = calculateSpinningExpectedGps({
      speed,
      tpi,
      count,
      twCon: setup.tw_con,
      doffLoss: setup.doff_loss,
      cWastePercent: setup.c_waste_percent
    })

    const result = {
      act_prodn: Math.round(actProdn * 100) / 100,
      waste_percent: Math.round(wastePercent * 100) / 100,
      stopped_spindles: Math.round(stoppedSpindles * 100) / 100,
      worked_spindles: workedSpindles,
      gps: Math.round(gps * 100) / 100,
      exp_gps: Math.round(expGps * 1000) / 1000,
      work_time: runTime - stoppageMins,
      _constant: Math.round(constant * 1000) / 1000,
      _totalSpindles: totalSpindles
    }
    return result
  }, [effectiveTotalTime, shiftNo])

  // Load production data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      const tabResult = await getSpinningEntryTabDataAction('production', {
        headerId,
        shift: shiftNo
      })
      if (!tabResult.success) throw new Error(tabResult.error)
      const { syncResult, detailsResult } = tabResult.data

      if (syncResult.success && syncResult.data?.added > 0 && !hasShownInitToast.current) {
        toast.info(`Initialized ${syncResult.data.added} machine(s) for this shift`)
        hasShownInitToast.current = true
      }

      const result = detailsResult
      if (!result.success) throw new Error(result.error)
      
      const details = result.data || []
      
      // Recalculate values for each row
      const recalculatedDetails = details.map(row => {
        const normalizedWaste =
          (parseFloat(row.waste) === 0.1 && (parseFloat(row.act_hank) || 0) === 0 && (parseFloat(row.act_prodn) || 0) === 0)
            ? null
            : row.waste

        const normalizedRow = {
          ...row,
          waste: normalizedWaste
        }

        const effectiveSetup = getEffectiveSetup(normalizedRow)
        const calculated = calculateValues(normalizedRow, {}, effectiveSetup)
        return {
          ...normalizedRow,
          run_time: normalizedRow.run_time ?? effectiveSetup?.run_time ?? effectiveTotalTime,
          ...calculated
        }
      })
      
      setProductionData(recalculatedDetails)
    } catch (error) {
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, shiftNo, effectiveTotalTime, calculateValues, getEffectiveSetup])

  useEffect(() => {
    if (!productionData.length) return
    setProductionData(prev => prev.map(row => {
      const effectiveSetup = getEffectiveSetup(row)
      const totalStoppageMins = getEffectiveStoppageTotal(row, stoppageDraftEdits)
      return {
        ...row,
        total_stoppage_mins: totalStoppageMins,
        ...calculateValues(row, { total_stoppage_mins: totalStoppageMins }, effectiveSetup)
      }
    }))
  }, [setupDraftEdits, stoppageDraftEdits, getEffectiveSetup, calculateValues, productionData.length])

  useServerDataLoader(loadData, [headerId, shiftNo, effectiveTotalTime])

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const numValue = parseFloat(value) || 0

    // Pre-calculate so we can keep editedRows and productionData in sync
    const currentRow = productionData.find(r => r.id === rowId)
    const calcUpdates = { [field]: numValue }
    const calculated = currentRow ? calculateValues(currentRow, calcUpdates, getEffectiveSetup(currentRow)) : {}

    // When act_prodn is directly edited, also store back-calculated act_hank in editedRows
    const editPayload = { [field]: numValue }
    if (field === 'act_prodn' && calculated.act_hank !== undefined) {
      editPayload.act_hank = calculated.act_hank
    }

    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        ...editPayload
      }
    }))

    // Update display data and recalculate
    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          [field]: numValue,
          ...calculated
        }
      }
      return row
    }))
  }

  // Handle Enter key to move to next row in same column
  const tableRef = useRef(null)
  const focusRowByDelta = useCallback((rowIndex, delta, colName) => {
    const targetRow = rowIndex + delta
    if (targetRow < 0 || !tableRef.current) return
    // Try plain input first
    const targetInput = tableRef.current.querySelector(
      `input[data-row="${targetRow}"][data-col="${colName}"]`
    )
    if (targetInput) {
      targetInput.focus()
      targetInput.select()
      return
    }
    // Try autocomplete container (employee or stoppage)
    const targetAuto = tableRef.current.querySelector(
      `[data-autocomplete][data-row="${targetRow}"][data-col="${colName}"]`
    )
    if (targetAuto) {
      const input = targetAuto.querySelector('input')
      if (input) {
        input.focus()
        input.select()
      } else {
        targetAuto.click()
      }
    }
  }, [])

  const focusNextRow = useCallback((rowIndex, colName) => focusRowByDelta(rowIndex, 1, colName), [focusRowByDelta])

  const handleEnterNavigation = useCallback((e, rowIndex, colName) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusRowByDelta(rowIndex, 1, colName)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusRowByDelta(rowIndex, -1, colName)
    }
  }, [focusRowByDelta])

  // Handle sider name change (text field)
  // When sider1 changes and sider2 is still empty, auto-fill sider2 with the same value
  const handleTextChange = (rowId, field, value) => {
    const currentRow = productionData.find(r => r.id === rowId)
    const currentSider1 = (currentRow?.sider1_name || '').trim()
    const currentSider2 = (currentRow?.sider2_name || '').trim()
    // Keep Sider 2 in sync with Sider 1 until user manually changes Sider 2.
    // This prevents partial text (like first letter) from getting stuck in Sider 2.
    const autoFillSider2 = field === 'sider1_name' && currentRow && (
      currentSider2 === '' || currentSider2.toLowerCase() === currentSider1.toLowerCase()
    )

    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value,
        ...(autoFillSider2 ? { sider2_name: value } : {})
      }
    }))

    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          [field]: value,
          ...(autoFillSider2 ? { sider2_name: value } : {})
        }
      }
      return row
    }))
  }

  // Save all changes
  const handleSave = async ({
    suppressNoChangesToast = false,
    suppressSuccessToast = false,
    skipParentRefresh = false,
    dependencyDrafts = null
  } = {}) => {
    const currentEdits = editedRowsRef.current || editedRows || {}
    const effectiveSetupDrafts = dependencyDrafts?.setup ?? setupDraftEdits
    const effectiveStoppageDrafts = dependencyDrafts?.stoppage ?? stoppageDraftEdits
    const rowsToSave = selectRowsForDependentCommit(
      productionData,
      currentEdits,
      {},
      effectiveSetupDrafts,
      effectiveStoppageDrafts
    )

    if (rowsToSave.length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const updates = rowsToSave.map(row => {
        const id = row.id
        const edits = findDraftByKeys(currentEdits, id) || {}
        const effectiveSetup = getEffectiveSetup(row, effectiveSetupDrafts)
        const totalStoppageMins = getEffectiveStoppageTotal(row, effectiveStoppageDrafts)
        
        // Calculate final values
        const calculated = calculateValues(
          row,
          { ...edits, total_stoppage_mins: totalStoppageMins },
          effectiveSetup
        )

        // Resolve act_hank: prefer explicitly edited value, then back-calculated (when act_prodn was edited),
        // then the row's stored value. Preserve 0 (don't use || null which would coerce 0 → null).
        const rawHank = edits.act_hank ?? calculated.act_hank ?? row.act_hank
        const savedHank = rawHank != null ? parseFloat(rawHank) : null
        
        return {
          id,
          act_hank: savedHank,
          waste: parseFloat(edits.waste ?? row.waste) ?? 0,
          act_prodn: calculated.act_prodn,
          waste_percent: calculated.waste_percent,
          stopped_spindles: calculated.stopped_spindles,
          worked_spindles: calculated.worked_spindles,
          gps: calculated.gps,
          exp_gps: calculated.exp_gps,
          work_time: calculated.work_time,
          sider1_name: edits.sider1_name ?? row.sider1_name,
          sider2_name: edits.sider2_name ?? row.sider2_name
        }
      })

      const result = await batchUpdateSpinningProductionDetailsAction(updates)
      
      if (result.success) {
        if (!suppressSuccessToast) {
          toast.success(`Saved ${updates.length} production record(s)`)
        }
        setEditedRows({})
        if (!skipParentRefresh) {
          if (onRefresh) await onRefresh()
          else await loadData()
        }
        return { success: true, saved: updates.length }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to update production')
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
    getEditedCount: () => Object.keys(editedRowsRef.current || editedRows || {}).length,
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
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total Machines: <span className="font-semibold">{productionData.length}</span>
          {Object.keys(editedRows).length > 0 && (
            <span className="ml-4 text-orange-600">
              Unsaved draft: {Object.keys(editedRows).length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Production Table */}
      <div className="border-2 border-gray-400 rounded overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto max-h-125 overflow-y-auto">
          <table className="w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-20 whitespace-nowrap">Machine</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-28 whitespace-nowrap">Frame No</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-32 whitespace-nowrap">Sider 1</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-32 whitespace-nowrap">Sider 2</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-32 whitespace-nowrap">Count Name</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24 whitespace-nowrap">Act Hank</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24 whitespace-nowrap">Act Prodn*</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20 whitespace-nowrap">Waste</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20 whitespace-nowrap">Waste %</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20 whitespace-nowrap">G.P.S</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20 whitespace-nowrap">W. Spls.</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20 whitespace-nowrap">Exp. GPS</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold w-20 whitespace-nowrap">ShiftTime</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20 whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody>
              {productionData.map((row, index) => {
                const isEdited = !!editedRows[row.id]
                const bgClass = isEdited ? 'bg-yellow-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')
                const effectiveSetup = getEffectiveSetup(row)
                const effectiveCountName = effectiveSetup?.count_name || row.count_name || row.setup?.count_name || ''
                const hasMultipleRuns = productionData.filter(item => String(item.machine_id) === String(row.machine_id)).length > 1
                const effectiveRunTime = effectiveSetup?.run_time ?? row.run_time ?? effectiveTotalTime
                
                return (
                  <tr key={row.id} className={`${bgClass} hover:bg-blue-50`}>
                    <td className="border border-gray-300 px-3 py-1 font-medium text-center whitespace-nowrap">
                      {row.machine?.machine_no || '-'}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {row.machine?.description || '-'}
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <EmployeeAutocomplete
                        value={row.sider1_name || ''}
                        onChange={(value) => handleTextChange(row.id, 'sider1_name', value)}
                        placeholder="Type employee name..."
                        cleanCell
                        editingHighlight
                        className="h-9 rounded-none text-sm w-full min-w-35"
                        data-row={index}
                        data-col="sider1_name"
                        onEnterNavigation={() => focusNextRow(index, 'sider1_name')}
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <EmployeeAutocomplete
                        value={row.sider2_name || ''}
                        onChange={(value) => handleTextChange(row.id, 'sider2_name', value)}
                        placeholder="Type employee name..."
                        cleanCell
                        editingHighlight
                        className="h-9 rounded-none text-sm w-full min-w-35"
                        data-row={index}
                        data-col="sider2_name"
                        onEnterNavigation={() => focusNextRow(index, 'sider2_name')}
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <EnterSelect
                        value={effectiveSetup?.count_id || ''}
                        options={counts.map(count => ({ value: count.id, label: count.count_name }))}
                        onChange={(countId) => onMachineCountChange?.(
                          row.setup?.id,
                          row.machine_id,
                          countId,
                          effectiveSetup?.speed ?? row.machine?.speed
                        )}
                        placeholder={effectiveCountName || 'Select count...'}
                        searchable
                        cleanCell
                        className="h-9 rounded-none text-xs"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.act_hank ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'act_hank', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'act_hank')}
                        data-row={index}
                        data-col="act_hank"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0.00"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-right text-sm font-medium text-blue-600 tabular-nums whitespace-nowrap">
                      {Number(row.act_prodn || 0).toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.waste ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'waste', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'waste')}
                        data-row={index}
                        data-col="waste"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0.00"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center tabular-nums whitespace-nowrap">
                      {row.waste_percent?.toFixed(2) || '-'}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center font-medium text-green-600 tabular-nums whitespace-nowrap">
                      {row.gps?.toFixed(2) || '-'}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center tabular-nums whitespace-nowrap">
                      {formatWorkedSpindles(row.worked_spindles ?? row._totalSpindles)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center text-purple-600 tabular-nums whitespace-nowrap">
                      {formatExpectedGps(row.exp_gps)}
                    </td>
                    <td className="border border-gray-300 px-0 py-0 text-right font-medium text-blue-600 tabular-nums whitespace-nowrap">
                      {hasMultipleRuns ? (
                        <NumberInput
                          type="number"
                          min="0"
                          value={effectiveRunTime}
                          onChange={(e) => onMachineSetupFieldChange?.(
                            row.setup?.id,
                            row.machine_id,
                            'run_time',
                            parseFloat(e.target.value) || 0
                          )}
                          className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-sm tabular-nums shadow-none focus-visible:ring-0"
                        />
                      ) : effectiveRunTime}
                    </td>
                    <td className="border border-gray-300 px-3 py-1 text-center font-medium text-orange-600 tabular-nums whitespace-nowrap">
                      {row.stoppage?.[0]?.total_stoppage_time ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
})

export default SpinningProductionTab
