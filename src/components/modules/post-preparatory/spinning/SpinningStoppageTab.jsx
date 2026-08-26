'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import StoppageAutocomplete from '@/components/ui/stoppage-autocomplete'
import EnterSelect from '@/components/ui/enter-select'
import { resolveSpinningShiftFallbackTime } from '@/lib/spinningShiftFallback'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'
import {
  getSpinningEntryTabDataAction,
  runSpinningEntryBatchAction,
} from '@/app/actions/spinning-entry'
import { applyBulkStoppageDraft } from '@/lib/stoppageSlotUtils'
import { calculateSpinningExpectedGps, calculateSpinningLossEfficiency } from '@/lib/productionFormulaMath'

/**
 * Spinning Stoppage Entry Tab
 * 
 * FORMULAS:
 * STOPPED_SPL = (Stoppage_Mins / Total_Mins) × Total_Spl
 * WORKED_SPL = Total_Spl - Stopped_Spl
 * EXP_GPS = 7.2 × Speed / TPI / Count × Effi
 */

const SpinningStoppageTab = forwardRef(function SpinningStoppageTab({
  headerId,
  totalTime,
  shiftNo = 1,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  productionDraftEdits,
  setupDraftEdits,
  counts = [],
  onMachineCountChange,
  onMachineSetupFieldChange
}, ref) {
  const effectiveTotalTime = totalTime ?? resolveSpinningShiftFallbackTime(shiftNo)
  const [stoppageData, setStoppageData] = useState([])
  const [stoppageReasons, setStoppageReasons] = useState([])
  const [machines, setMachines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
  const shiftTimeVal = effectiveTotalTime
  const hasExceededError = stoppageData.some(row => ((Number(row.stoppage1_time) || 0) + (Number(row.stoppage2_time) || 0) + (Number(row.stoppage3_time) || 0) + (Number(row.stoppage4_time) || 0)) > Number(row.run_time ?? shiftTimeVal))

  const formatExpectedGps = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '-'
    return numeric.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
      useGrouping: false
    })
  }

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

  // Ref for table container (Enter-to-next-row navigation)
  const tableRef = useRef(null)

  // Focus a row offset by `delta` for a given column (supports plain inputs and autocompletes)
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
    // Try autocomplete container
    const targetAuto = tableRef.current.querySelector(
      `[data-autocomplete][data-row="${targetRow}"][data-col="${colName}"]`
    )
    if (targetAuto) {
      const input = targetAuto.querySelector('input')
      if (input) {
        input.focus()
        input.select()
      } else {
        targetAuto.querySelector('button')?.click()
      }
    }
  }, [])

  const focusNextRow = useCallback((rowIndex, colName) => focusRowByDelta(rowIndex, 1, colName), [focusRowByDelta])

  // Handle Enter / ArrowDown (next row) and ArrowUp (previous row)
  const handleEnterNavigation = useCallback((e, rowIndex, colName) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusRowByDelta(rowIndex, 1, colName)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusRowByDelta(rowIndex, -1, colName)
    }
  }, [focusRowByDelta])

  // Full stoppage form
  const [fullStoppage, setFullStoppage] = useState({
    reason: '',
    time: ''
  })

  // Partial stoppage form
  const [partialStoppage, setPartialStoppage] = useState({
    reason: '',
    fromMachine: '',
    toMachine: '',
    time: ''
  })

  // Calculate values
  const findSetupDraftForMachine = useCallback((machineId, setupId = null) => {
    if (!setupDraftEdits) return null
    const direct = setupDraftEdits[setupId] || setupDraftEdits[String(setupId)]
    if (direct) return direct
    const drafts = Object.values(setupDraftEdits)
    const exactSetup = drafts.find(draft => String(draft?.setup_id) === String(setupId))
    if (exactSetup) return exactSetup
    for (const draft of drafts) {
      if (!draft?.setup_id && draft?.machine_id && String(draft.machine_id) === String(machineId)) {
        return draft
      }
    }
    return null
  }, [setupDraftEdits])

  const calculateStoppageValues = useCallback((row, totalStoppageTime) => {
    const setupDraft = findSetupDraftForMachine(row.machine_id, row.setup_id)
    const allocatedSpindles = setupDraft?.allocated_spindles ?? row.total_spindles ?? 1104
    const runTime = Number(setupDraft?.run_time ?? row.run_time ?? effectiveTotalTime)
    const actCount = setupDraft?.act_count ?? row.act_count ?? 0
    const productionDraft = productionDraftEdits?.[row.id] || productionDraftEdits?.[String(row.id)]
    const actHank = productionDraft?.act_hank ?? row.act_hank ?? 0

    // Get values needed for Exp GPS calculation (from machine setup, sourced from spinning_counts master)
    const speed = parseInt(setupDraft?.speed ?? row.speed) || 0
    const tpi = parseFloat(setupDraft?.tpi ?? row.tpi) || 0
    // Use act_count from machine setup for Exp GPS calculation
    const count = actCount

    // Calculate No of Spindles based on shift
    // Shift 1 & 2: allocated / 8 * 8.5, Shift 3: allocated / 8 * 7
    const multiplier = shiftNo === 3 ? 7 : 8.5
    const totalSpindles = Math.round((allocatedSpindles / 8) * multiplier)

    // STOPPED SPL = (total STOPPED MIN / TOTAL MIN) * TOTAL SPL (No of Spindle)
    const stoppedSpindles = runTime > 0 ? (totalStoppageTime / runTime) * totalSpindles : 0
    // WORKED SPL = TOTAL SPL (No of Spindle) - STOPPED SPL
    const workedSpindles = totalSpindles - stoppedSpindles

    const lossEfficiency = calculateSpinningLossEfficiency({
      twCon: setupDraft?.tw_con ?? row.tw_con,
      doffLoss: setupDraft?.doff_loss ?? row.doff_loss,
      cWastePercent: setupDraft?.c_waste_percent ?? row.c_waste_percent
    })
    const constant = actCount > 0
      ? (1 / 2.20456 / actCount) * totalSpindles * lossEfficiency
      : 0

    // GPS = (Act Prodn / Worked Spl) × 1000
    const actProdn = actHank * constant
    const gps = workedSpindles > 0 ? (actProdn / workedSpindles) * 1000 : 0

    // Expected GPS = 7.2 × Speed / TPI / Count × Effi
    const expGps = calculateSpinningExpectedGps({
      speed,
      tpi,
      count,
      efficiency: setupDraft?.efficiency ?? row.efficiency ?? 0.95
    })

    return {
      stoppedSpindles: Math.round(stoppedSpindles * 100) / 100,
      workedSpindles: Math.round(workedSpindles * 100) / 100,
      gps: Math.round(gps * 100) / 100,
      expGps: Math.round(expGps * 1000) / 1000
    }
  }, [effectiveTotalTime, findSetupDraftForMachine, productionDraftEdits])

  // Load data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      const tabResult = await getSpinningEntryTabDataAction('stoppage', { headerId })
      if (!tabResult.success) throw new Error(tabResult.error)
      const { stoppageResult, reasonsResult, machinesResult } = tabResult.data

      if (stoppageResult.success) {
        const data = stoppageResult.data || []
        // Add calculated values, then re-apply local drafts so partial/full apply does not discard unsaved edits.
        const enrichedData = data.map(row => {
          const draft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
          const mergedRow = draft ? { ...row, ...draft } : row
          const mergedTotal =
            (parseInt(mergedRow.stoppage1_time) || 0) +
            (parseInt(mergedRow.stoppage2_time) || 0) +
            (parseInt(mergedRow.stoppage3_time) || 0) +
            (parseInt(mergedRow.stoppage4_time) || 0)
          const calculated = calculateStoppageValues(mergedRow, mergedTotal)
          return {
            ...mergedRow,
            run_time: mergedRow.run_time ?? effectiveTotalTime,
            total_stoppage_time: mergedTotal,
            ...calculated
          }
        })
        // Sort by natural machine number order
        const sortedData = enrichedData.sort((a, b) => {
          const aNum = parseInt(a.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
          const bNum = parseInt(b.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
          return aNum - bNum
        })
        setStoppageData(sortedData)
      }

      if (reasonsResult.success) {
        setStoppageReasons(reasonsResult.data || [])
      } else {
        console.error('Failed to load stoppage reasons:', reasonsResult.error)
      }

      if (machinesResult.success) {
        // Sort machines list for dropdowns
        const sortedMachines = (machinesResult.data || []).sort((a, b) => {
          const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
          const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
          return aNum - bNum
        })
        setMachines(sortedMachines)
      }
    } catch (error) {
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, effectiveTotalTime, calculateStoppageValues])

  useServerDataLoader(loadData, [headerId, shiftNo, effectiveTotalTime])

  useEffect(() => {
    if (!stoppageData.length) return

    setStoppageData(prev => prev.map(row => {
      const draft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const mergedRow = draft ? { ...row, ...draft } : row
      const mergedTotal =
        (parseInt(mergedRow.stoppage1_time) || 0) +
        (parseInt(mergedRow.stoppage2_time) || 0) +
        (parseInt(mergedRow.stoppage3_time) || 0) +
        (parseInt(mergedRow.stoppage4_time) || 0)
      const calculated = calculateStoppageValues(mergedRow, mergedTotal)
      return {
        ...mergedRow,
        run_time: mergedRow.run_time ?? effectiveTotalTime,
        total_stoppage_time: mergedTotal,
        ...calculated
      }
    }))
  }, [editedRows, setupDraftEdits, productionDraftEdits, calculateStoppageValues, effectiveTotalTime, stoppageData.length])

  // Handle stoppage time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = parseInt(value) || 0
    const stoppageEntryId = stoppageData.find(row => String(row.id) === String(rowId))?.stoppage_entry_id
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        production_detail_id: rowId,
        ...(stoppageEntryId ? { stoppage_entry_id: stoppageEntryId } : {}),
        [field]: numValue
      }
    }))

    setStoppageData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        // Recalculate total
        updatedRow.total_stoppage_time = 
          (updatedRow.stoppage1_time || 0) +
          (updatedRow.stoppage2_time || 0) +
          (updatedRow.stoppage3_time || 0) +
          (updatedRow.stoppage4_time || 0)
        
        // Recalculate values
        const calculated = calculateStoppageValues(updatedRow, updatedRow.total_stoppage_time)
        return { ...updatedRow, ...calculated }
      }
      return row
    }))
  }

  // Handle stoppage reason change
  const handleStoppageReasonChange = (rowId, field, value) => {
    // Get the time field name (e.g., 'stoppage1_id' -> 'stoppage1_time')
    const timeField = field.replace('_id', '_time')
    const isClearing = !value || value === 'NONE'
    const savedValue = isClearing ? null : value
    const stoppageEntryId = stoppageData.find(row => String(row.id) === String(rowId))?.stoppage_entry_id
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        production_detail_id: rowId,
        ...(stoppageEntryId ? { stoppage_entry_id: stoppageEntryId } : {}),
        [field]: savedValue,
        ...(isClearing ? { [timeField]: 0 } : {})
      }
    }))

    // Find the selected reason to update the display
    const selectedReason = isClearing ? null : stoppageReasons.find(r => r.id === value)
    const stoppageField = field.replace('_id', '') // e.g., 'stoppage1_id' -> 'stoppage1'

    setStoppageData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { 
          ...row,
          [field]: savedValue,
          [stoppageField]: selectedReason,
          ...(isClearing ? { [timeField]: 0 } : {})
        }
        updatedRow.total_stoppage_time =
          (parseInt(updatedRow.stoppage1_time) || 0) +
          (parseInt(updatedRow.stoppage2_time) || 0) +
          (parseInt(updatedRow.stoppage3_time) || 0) +
          (parseInt(updatedRow.stoppage4_time) || 0)
        return updatedRow
      }
      return row
    }))
  }

  // Commit this tab's draft during the final Update
  const handleSave = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    const currentEdits = editedRowsRef.current || editedRows || {}
    if (hasExceededError) {
      toast.error(`Stoppage minutes cannot exceed the ${shiftTimeVal}-minute shift.`)
      return { success: false, error: 'cannot exceed shift time' }
    }
    if (Object.keys(currentEdits).length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      // Map editedRows (keyed by production_detail id) to use the correct stoppage_entry_id
      const updates = Object.entries(currentEdits).map(([rowId, changes]) => {
        const row = stoppageData.find(r => r.id === rowId)
        const stoppageEntryId = row?.stoppage_entry_id
        if (!stoppageEntryId) {
          throw new Error(`No stoppage entry ID found for row ${rowId}`)
        }
        const { production_detail_id: _productionDetailId, stoppage_entry_id: _stoppageEntryId, ...persistedChanges } = changes
        return { id: stoppageEntryId, updates: persistedChanges }
      })

      const batchResult = await runSpinningEntryBatchAction('stoppage-update', updates)
      if (!batchResult.success) throw new Error(batchResult.error || 'Failed to save stoppage data')
      const results = batchResult.data || []
      const failures = results.filter(r => !r.success)
      
      if (failures.length > 0) {
        console.error('Some updates failed:', failures)
        toast.error(`${failures.length} update(s) failed`)
        return { success: false, saved: results.length - failures.length, failed: failures.length }
      } else {
        if (!suppressSuccessToast) {
          toast.success('Stoppage data saved successfully')
        }
      }
      
      const savedCount = Object.keys(currentEdits).length
      setEditedRows({})
      if (!skipParentRefresh) {
        if (onRefresh) onRefresh()
        else await loadData()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving stoppage data:', error)
      toast.error('Failed to save stoppage data')
      return { success: false, saved: 0, error: error.message }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshClick = async () => {
    if (Object.keys(editedRows).length > 0) {
      const shouldDiscard = window.confirm('You have unsaved changes in Stoppage. Refresh will discard them. Continue?')
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

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRows).length === 0) return true
    return window.confirm('You have unsaved stoppage row edits. This action will reload data and discard them. Continue?')
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRowsRef.current || editedRows || {}).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, editedRows, isSaving, discardChanges])

  // Apply full stoppage to shared local drafts. Final Update persists it.
  const handleApplyFullStoppage = () => {
    if (!fullStoppage.reason) {
      toast.warning('Please select a stoppage reason')
      return
    }

    const parsedTime = parseInt(fullStoppage.time) || 0
    if (parsedTime <= 0) {
      toast.error('Enter a valid stoppage time greater than 0 minutes.')
      return
    }
    const selectedReason = stoppageReasons.find(
      item => String(item.id) === String(fullStoppage.reason)
    )
    const result = applyBulkStoppageDraft({
      rows: stoppageData,
      drafts: editedRows,
      reasonId: fullStoppage.reason,
      reason: selectedReason,
      minutes: parsedTime,
      maxMinutes: shiftTimeVal,
      additionalChanges: { is_full_stoppage: true }
    })

    setEditedRows(result.drafts)
    setStoppageData(result.rows)
    toast.success(
      `Full stoppage added to draft: updated ${result.updatedCount}, skipped ${result.skippedCount}, overflow ${result.overflowCount}`
    )
    setFullStoppage({ reason: '', time: '' })
  }

  // Apply partial stoppage to shared local drafts. Final Update persists it.
  const handleApplyPartialStoppage = () => {
    if (!partialStoppage.reason || !partialStoppage.fromMachine || !partialStoppage.toMachine) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }

    const parsedTime = parseInt(partialStoppage.time) || 0
    if (parsedTime <= 0) {
      toast.error('Enter a valid stoppage time greater than 0 minutes.')
      return
    }
    const fromNum = parseInt(String(partialStoppage.fromMachine || '').replace(/\D/g, '') || '0')
    const toNum = parseInt(String(partialStoppage.toMachine || '').replace(/\D/g, '') || '0')
    const minNum = Math.min(fromNum, toNum)
    const maxNum = Math.max(fromNum, toNum)

    const selectedReason = stoppageReasons.find(
      item => String(item.id) === String(partialStoppage.reason)
    )
    const result = applyBulkStoppageDraft({
      rows: stoppageData,
      drafts: editedRows,
      reasonId: partialStoppage.reason,
      reason: selectedReason,
      minutes: parsedTime,
      maxMinutes: shiftTimeVal,
      shouldApply: row => {
        const machineNo = row.production_detail?.machine?.machine_no || ''
        const machineNumber = parseInt(String(machineNo).replace(/\D/g, '') || '0')
        return machineNumber >= minNum && machineNumber <= maxNum
      }
    })

    setEditedRows(result.drafts)
    setStoppageData(result.rows)
    if (result.updatedCount === 0) {
        toast.warning('No machines updated. All target machines may already have all 4 stoppage slots filled.')
    } else {
      toast.success(
        `Partial stoppage added to draft: updated ${result.updatedCount}, skipped ${result.skippedCount}, overflow ${result.overflowCount}`
      )
    }
    setPartialStoppage({ reason: '', fromMachine: '', toMachine: '', time: '' })
  }

  // Helper: get display value for a stoppage reason
  const getStoppageDisplayValue = (stoppageObj) => {
    if (!stoppageObj) return ''
    return stoppageObj.stoppage_name || ''
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading stoppage data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasExceededError && (
        <div className="p-3 bg-red-100 border-2 border-red-500 text-red-700 rounded font-semibold text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Total stoppage cannot exceed the shift time.</span>
        </div>
      )}
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {stoppageData.length} machines | Shift Time: {effectiveTotalTime} mins | Reasons: {stoppageReasons.length}
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Stoppage Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table className="entry-data-grid w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16 whitespace-nowrap">Frame No</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-48 whitespace-nowrap">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">ShiftTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">G.P.S</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Exp G.P.S</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time4</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody>
              {stoppageData.map((row, index) => {
                const setupDraft = findSetupDraftForMachine(row.machine_id, row.setup_id)
                const hasMultipleRuns = stoppageData.filter(item => String(item.machine_id) === String(row.machine_id)).length > 1
                const effectiveRunTime = setupDraft?.run_time ?? row.run_time ?? effectiveTotalTime
                return <tr
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    {row.production_detail?.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                    {row.production_detail?.machine?.description || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                    {row.production_detail?.session_no ?? '-'}
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <EnterSelect
                      value={setupDraft?.count_id || row.count_id || ''}
                      options={counts.map(count => ({ value: count.id, label: count.count_name }))}
                      onChange={(countId) => onMachineCountChange?.(
                        row.setup_id,
                        row.machine_id,
                        countId,
                        setupDraft?.speed ?? row.speed
                      )}
                      placeholder="Select count..."
                      searchable
                      cleanCell
                      className="h-9 rounded-none text-xs"
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0 text-center tabular-nums whitespace-nowrap">
                    {hasMultipleRuns ? (
                      <NumberInput
                        type="number"
                        min="0"
                        value={effectiveRunTime}
                        onChange={(e) => onMachineSetupFieldChange?.(
                          row.setup_id,
                          row.machine_id,
                          'run_time',
                          parseFloat(e.target.value) || 0
                        )}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0"
                      />
                    ) : effectiveRunTime}
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-center font-medium tabular-nums whitespace-nowrap ${
                    row.gps !== undefined && row.expGps !== undefined && row.gps !== null && row.expGps !== null && row.gps < row.expGps
                      ? 'text-red-600 bg-red-50'
                      : 'text-green-600'
                  }`}>
                    {row.gps?.toFixed(2) || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-purple-600 tabular-nums whitespace-nowrap">
                    {formatExpectedGps(row.expGps)}
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage1?.id ? String(row.stoppage1.id) : ''}
                      displayValue={getStoppageDisplayValue(row.stoppage1)}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage1_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage1_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="w-full h-9"
                      data-row={index}
                      data-col="stoppage1_id"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage1_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      type="number"
                      value={row.stoppage1?.id ? (row.stoppage1_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage1_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage1_time')}
                      data-row={index}
                      data-col="stoppage1_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage2?.id ? String(row.stoppage2.id) : ''}
                      displayValue={getStoppageDisplayValue(row.stoppage2)}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage2_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage2_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="w-full h-9"
                      data-row={index}
                      data-col="stoppage2_id"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage2_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      type="number"
                      value={row.stoppage2?.id ? (row.stoppage2_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage2_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage2_time')}
                      data-row={index}
                      data-col="stoppage2_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage3?.id ? String(row.stoppage3.id) : ''}
                      displayValue={getStoppageDisplayValue(row.stoppage3)}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage3_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage3_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="w-full h-9"
                      data-row={index}
                      data-col="stoppage3_id"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage3_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      type="number"
                      value={row.stoppage3?.id ? (row.stoppage3_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage3_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage3_time')}
                      data-row={index}
                      data-col="stoppage3_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage4?.id ? String(row.stoppage4.id) : ''}
                      displayValue={getStoppageDisplayValue(row.stoppage4)}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage4_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage4_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="w-full h-9"
                      data-row={index}
                      data-col="stoppage4_id"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage4_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      type="number"
                      value={row.stoppage4?.id ? (row.stoppage4_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage4_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage4_time')}
                      data-row={index}
                      data-col="stoppage4_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-orange-600 font-medium tabular-nums whitespace-nowrap">
                    {row.total_stoppage_time || 0}
                  </td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stoppage Application Forms */}
      <div className="grid grid-cols-2 gap-6">
        {/* Full Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-4 bg-gray-50">
            <CardTitle className="text-base font-semibold">Full Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
                <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
                <Input
                  type="number"
                  min="1"
                  max={shiftTimeVal}
                  placeholder="Minutes"
                  value={fullStoppage.time}
                  onChange={(e) => setFullStoppage(prev => ({ ...prev, time: e.target.value }))}
                  className="h-10 text-sm"
                />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Stoppage Reason</Label>
              <StoppageAutocomplete
                value={fullStoppage.reason || ''}
                displayValue={getStoppageDisplayValue(stoppageReasons.find(r => String(r.id) === fullStoppage.reason))}
                reasons={stoppageReasons}
                onSelect={(id) => setFullStoppage(prev => ({ ...prev, reason: String(id) }))}
                onClear={() => setFullStoppage(prev => ({ ...prev, reason: '' }))}
                placeholder="Search stoppage reason..."
              />
            </div>
            <Button 
              onClick={handleApplyFullStoppage}
              disabled={isSaving}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply
            </Button>
          </CardContent>
        </Card>

        {/* Partial Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-4 bg-gray-50">
            <CardTitle className="text-base font-semibold">Partial Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
              <Input
                type="number"
                min="1"
                max={shiftTimeVal}
                placeholder="Minutes"
                value={partialStoppage.time}
                onChange={(e) => setPartialStoppage(prev => ({ ...prev, time: e.target.value }))}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Stoppage Reason</Label>
              <StoppageAutocomplete
                value={partialStoppage.reason || ''}
                displayValue={getStoppageDisplayValue(stoppageReasons.find(r => String(r.id) === partialStoppage.reason))}
                reasons={stoppageReasons}
                onSelect={(id) => setPartialStoppage(prev => ({ ...prev, reason: String(id) }))}
                onClear={() => setPartialStoppage(prev => ({ ...prev, reason: '' }))}
                placeholder="Search stoppage reason..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">From M/c No.</Label>
                <Select
                  value={partialStoppage.fromMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, fromMachine: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="From" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.machine_no}>
                        {m.machine_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">To M/c No.</Label>
                <Select
                  value={partialStoppage.toMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, toMachine: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="To" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.machine_no}>
                        {m.machine_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleApplyPartialStoppage}
              disabled={isSaving}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
})

export default SpinningStoppageTab
