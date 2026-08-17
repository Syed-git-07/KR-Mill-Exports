'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getComberEntryTabDataAction,
  runComberEntryBatchAction
} from '@/app/actions/comber-entry'
import { NumberInput } from '@/components/ui/number-input'
import StoppageAutocomplete from '@/components/ui/stoppage-autocomplete'
import { resolveComberShiftFallbackTime } from '@/lib/comberShiftFallback'
import { COMBER_FORMULA_FALLBACK, resolveComberMcEffiFactor } from '@/lib/comberFormulaFallback'
import { applyBulkStoppageDraft } from '@/lib/stoppageSlotUtils'

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

const calculateRunMin = (runHrs) => {
  const hoursValue = toNumber(runHrs)
  if (hoursValue <= 0) return 0
  const hours = Math.floor(hoursValue)
  const minutes = Math.round((hoursValue - hours) * 100)
  return (hours * 60) + minutes
}

const recalcProductionFromStoppage = (productionDetail, totalStoppageTime, totalTime, setup) => {
  const safeTotalTime = Math.max(toNumber(totalTime), 0)
  if (safeTotalTime <= 0) {
    return {
      work_time: 0,
      uti_percent: 0,
      std_hrs: 0,
      act_effi_percent: 0
    }
  }

  const mcEffiFactor = resolveComberMcEffiFactor(
    setup?.mc_effi ?? productionDetail?.mc_effi ?? COMBER_FORMULA_FALLBACK.mcEffiFactor
  )
  const runMin = calculateRunMin(productionDetail?.run_hrs)
  const workTime = Math.max(safeTotalTime - toNumber(totalStoppageTime), 0)
  const stdHrs = workTime * mcEffiFactor
  const utiPercent = (workTime / safeTotalTime) * 100
  const actEffiPercent = stdHrs > 0 ? (runMin / stdHrs) * 100 : 0

  return {
    work_time: Math.round(workTime * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    std_hrs: Math.round(stdHrs * 10) / 10,
    act_effi_percent: Math.round(actEffiPercent * 100) / 100
  }
}

// Helper to get stoppage display value for autocomplete
const getStoppageDisplayValue = (stoppageId, stoppageReasons) => {
  if (!stoppageId) return ''
  const reason = stoppageReasons.find(r => r.id === stoppageId)
  return reason ? `${reason.stoppage_name}→${reason.short_code}` : ''
}

// Helper to merge server-returned rows into draft edits (draft-safe apply)
const applyServerRowsToDrafts = (appliedRows, editedRowsRef, setEditedRows, stoppageReasons, setupMap = {}) => {
  if (!appliedRows || appliedRows.length === 0) return

  // For each applied row, update the local draft if it existed, otherwise clear from drafts
  const updatedDrafts = {}
  ;(appliedRows || []).forEach(row => {
    if (!row?.id) return
    // If this row had a draft, keep the slot fields but update totals
    const existingDraft = editedRowsRef.current?.[row.id]
    if (existingDraft) {
      updatedDrafts[row.id] = existingDraft
    }
  })

  // Merge back into edits
  setEditedRows(prev => {
    const next = { ...prev }
    // Remove drafts for applied rows to avoid stale state
    ;(appliedRows || []).forEach(row => {
      if (row?.id && row.id in next) {
        delete next[row.id]
      }
    })
    return next
  })
}

const ComberStoppageTab = forwardRef(function ComberStoppageTab({
  headerId,
  totalTime = resolveComberShiftFallbackTime(1),
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  setupDraftEdits,
  productionDraftEdits
}, ref) {
  const [stoppageData, setStoppageData] = useState([])
  const [stoppageReasons, setStoppageReasons] = useState([])
  const [machines, setMachines] = useState([])
  const [machineSetups, setMachineSetups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
  const shiftTimeVal = totalTime
  const hasExceededError = stoppageData.some(row => ((Number(row.stoppage1_time) || 0) + (Number(row.stoppage2_time) || 0) + (Number(row.stoppage3_time) || 0) + (Number(row.stoppage4_time) || 0)) > shiftTimeVal)

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

  const mergeProductionDetailDraft = useCallback((productionDetail) => {
    const base = productionDetail || {}
    const productionDraft = productionDraftEdits?.[base.id] || productionDraftEdits?.[String(base.id)]
    return productionDraft ? { ...base, ...productionDraft } : base
  }, [productionDraftEdits])

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

  const mergeServerRowsWithDrafts = useCallback((rows, reasons, setupMap = {}) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))
    const reasonMap = (reasons || []).reduce((acc, reason) => {
      acc[reason.id] = reason
      return acc
    }, {})

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
      if (!draft) return row

      const mergedRow = { ...row, ...draft }
      for (let slot = 1; slot <= 4; slot += 1) {
        const idField = `stoppage${slot}_id`
        const timeField = `stoppage${slot}_time`
        const reasonField = `stoppage${slot}`

        if (!(idField in draft)) continue

        const selectedReasonId = draft[idField]
        if (!selectedReasonId || selectedReasonId === 'NONE') {
          mergedRow[idField] = null
          mergedRow[reasonField] = null
          mergedRow[timeField] = 0
        } else {
          mergedRow[idField] = selectedReasonId
          mergedRow[reasonField] = reasonMap[selectedReasonId] || null
        }
      }

      mergedRow.total_stoppage_time =
        (mergedRow.stoppage1_time || 0) +
        (mergedRow.stoppage2_time || 0) +
        (mergedRow.stoppage3_time || 0) +
        (mergedRow.stoppage4_time || 0)

      const setup = resolveEffectiveSetup(setupMap[mergedRow.production_detail?.machine_id], mergedRow.production_detail?.machine_id)
      const mergedProductionDetail = mergeProductionDetailDraft(mergedRow.production_detail)
      mergedRow.production_detail = {
        ...mergedProductionDetail,
        ...recalcProductionFromStoppage(
          mergedProductionDetail,
          mergedRow.total_stoppage_time,
          totalTime,
          setup
        )
      }

      return mergedRow
    })
  }, [totalTime, mergeProductionDetailDraft, resolveEffectiveSetup])

  // Full stoppage form (slot is selected automatically per machine)
  const [fullStoppage, setFullStoppage] = useState({
    reason: '',
    time: ''
  })

  // Partial stoppage form (auto-allocates slot, no manual slot selector)
  const [partialStoppage, setPartialStoppage] = useState({
    reason: '',
    fromMachine: '',
    toMachine: '',
    time: ''
  })

  // Load data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      const tabResult = await getComberEntryTabDataAction('stoppage', { headerId })
      if (!tabResult.success) throw new Error(tabResult.error)
      const { stoppagesResult, reasonsResult, machineListResult, setupsResult } = tabResult.data
      
      if (!stoppagesResult.success || !reasonsResult.success || !machineListResult.success || !setupsResult.success) {
        throw new Error(stoppagesResult.error || reasonsResult.error || machineListResult.error || setupsResult.error)
      }
      
      const stoppages = stoppagesResult.data
      const reasons = reasonsResult.data
      const machineList = machineListResult.data
      const setups = setupsResult.data

      const setupMap = {}
      ;(setups || []).forEach(setup => {
        if (setup?.machine_id) {
          setupMap[setup.machine_id] = setup
        }
      })
      
      // Sort by natural machine number order (CO1, CO2, ... CO10, CO11)
      const sortedStoppages = stoppages?.sort((a, b) => {
        const aNum = parseInt(a.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      
      // Sort machines list for dropdowns
      const sortedMachines = machineList?.sort((a, b) => {
        const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      
      const mergedRows = mergeServerRowsWithDrafts(sortedStoppages, reasons, setupMap)
      setStoppageData(mergedRows)
      setStoppageReasons(reasons || [])
      setMachines(sortedMachines)
      setMachineSetups(setupMap)
    } catch (error) {
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, mergeServerRowsWithDrafts])

  useServerDataLoader(loadData, [headerId])

  useEffect(() => {
    if (!stoppageData.length) return

    setStoppageData(prev => prev.map(row => {
      const totalStoppageTime =
        toNumber(row.stoppage1_time) +
        toNumber(row.stoppage2_time) +
        toNumber(row.stoppage3_time) +
        toNumber(row.stoppage4_time)

      const setup = resolveEffectiveSetup(machineSetups[row.production_detail?.machine_id], row.production_detail?.machine_id)
      const mergedProductionDetail = mergeProductionDetailDraft(row.production_detail)

      return {
        ...row,
        total_stoppage_time: totalStoppageTime,
        production_detail: {
          ...mergedProductionDetail,
          ...recalcProductionFromStoppage(
            mergedProductionDetail,
            totalStoppageTime,
            totalTime,
            setup
          )
        }
      }
    }))
  }, [editedRows, productionDraftEdits, totalTime, machineSetups, mergeProductionDetailDraft, stoppageData.length, resolveEffectiveSetup])

  // Handle stoppage time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = parseInt(value) || 0
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
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

        const setup = resolveEffectiveSetup(machineSetups[updatedRow.production_detail?.machine_id], updatedRow.production_detail?.machine_id)
        const mergedProductionDetail = mergeProductionDetailDraft(updatedRow.production_detail)
        updatedRow.production_detail = {
          ...mergedProductionDetail,
          ...recalcProductionFromStoppage(
            mergedProductionDetail,
            updatedRow.total_stoppage_time,
            totalTime,
            setup
          )
        }
        return updatedRow
      }
      return row
    }))
  }

  // Handle stoppage reason change
  const handleStoppageReasonChange = (rowId, field, value) => {
    // Get the time field name (e.g., 'stoppage1_id' -> 'stoppage1_time')
    const timeField = field.replace('_id', '_time')
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value || null,
        // Clear time when NONE is selected
        ...(value === 'NONE' ? { [timeField]: 0 } : {})
      }
    }))

    // Find the selected reason to update the display
    const selectedReason = stoppageReasons.find(r => r.id === value)
    const stoppageField = field.replace('_id', '') // e.g., 'stoppage1_id' -> 'stoppage1'

    setStoppageData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { 
          ...row, 
          [field]: value, 
          [stoppageField]: selectedReason,
          // Clear time when NONE is selected
          ...(value === 'NONE' ? { [timeField]: 0 } : {})
        }
        // Recalculate total if time was cleared
        if (value === 'NONE') {
          updatedRow.total_stoppage_time = 
            (updatedRow.stoppage1_time || 0) +
            (updatedRow.stoppage2_time || 0) +
            (updatedRow.stoppage3_time || 0) +
            (updatedRow.stoppage4_time || 0)

          const setup = resolveEffectiveSetup(machineSetups[updatedRow.production_detail?.machine_id], updatedRow.production_detail?.machine_id)
          const mergedProductionDetail = mergeProductionDetailDraft(updatedRow.production_detail)
          updatedRow.production_detail = {
            ...mergedProductionDetail,
            ...recalcProductionFromStoppage(
              mergedProductionDetail,
              updatedRow.total_stoppage_time,
              totalTime,
              setup
            )
          }
        }
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
      const updates = Object.entries(currentEdits).map(([rowId, changes]) => {
        const { production_detail_id: _productionDetailId, stoppage_entry_id: _stoppageEntryId, ...persistedChanges } = changes
        return { id: rowId, updates: persistedChanges }
      })

      const batchResult = await runComberEntryBatchAction('stoppage-update', updates)
      if (!batchResult.success) throw new Error(batchResult.error)
      const results = batchResult.data
      const failed = results.find(result => !result?.success)
      if (failed) throw new Error(failed.error || 'Failed to save a Comber stoppage row')
      const savedCount = Object.keys(currentEdits).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Stoppage data saved successfully')
      }
      
      if (!skipParentRefresh) {
        if (onRefresh) await onRefresh()
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

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRows).length === 0) return true
    return window.confirm('You have unsaved stoppage edits. This action will reload data and discard them. Continue?')
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

  // Apply full stoppage to shared local drafts. Final Update persists it.
  const handleApplyFullStoppage = () => {
    const parsedTime = parseInt(fullStoppage.time)
    if (!fullStoppage.reason) {
      toast.warning('Please select a stoppage reason')
      return
    }
    if (!fullStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
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
    const parsedTime = parseInt(partialStoppage.time)
    if (!partialStoppage.reason || !partialStoppage.fromMachine || !partialStoppage.toMachine) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }
    if (!partialStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
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
          {stoppageData.length} machines | Shift Time: {totalTime} mins
          {Object.keys(editedRows).length > 0 && (
            <span className="ml-4 text-orange-600 font-medium">
              Unsaved draft: {Object.keys(editedRows).length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Stoppage Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table className="entry-color-grid w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">ActEffi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">R.Time</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {stoppageData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    {row.production_detail?.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                    {row.production_detail?.session_no || 1}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.production_detail?.act_effi_percent)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {totalTime}
                  </td>
                  {/* Stoppage 1 */}
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage1_id || ''}
                      displayValue={row.stoppage1?.stoppage_name || ''}
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
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage1_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage1_id ? (row.stoppage1_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage1_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage1_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage1_time"
                      zeroAsEmpty
                    />
                  </td>
                  {/* Stoppage 2 */}
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage2_id || ''}
                      displayValue={row.stoppage2?.stoppage_name || ''}
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
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage2_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage2_id ? (row.stoppage2_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage2_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage2_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage2_time"
                      zeroAsEmpty
                    />
                  </td>
                  {/* Stoppage 3 */}
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage3_id || ''}
                      displayValue={row.stoppage3?.stoppage_name || ''}
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
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage3_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage3_id ? (row.stoppage3_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage3_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage3_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage3_time"
                      zeroAsEmpty
                    />
                  </td>
                  {/* Stoppage 4 */}
                  <td className="border border-gray-300 px-0 py-0">
                    <StoppageAutocomplete
                      value={row.stoppage4_id || ''}
                      displayValue={row.stoppage4?.stoppage_name || ''}
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
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage4_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage4_id ? (row.stoppage4_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage4_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage4_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage4_time"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-orange-600 font-medium tabular-nums whitespace-nowrap">
                    {row.total_stoppage_time || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stoppage Application Forms */}
      <div className="grid grid-cols-2 gap-6">
        {/* Full Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-3 bg-gray-50">
            <CardTitle className="text-base font-semibold">Full Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div>
                <Label className="text-sm font-medium mb-1 block">Stoppage Reason</Label>
                <StoppageAutocomplete
                  value={fullStoppage.reason || ''}
                  displayValue={getStoppageDisplayValue(fullStoppage.reason, stoppageReasons)}
                  reasons={stoppageReasons}
                  onSelect={(id) => setFullStoppage(prev => ({ ...prev, reason: id }))}
                  onClear={() => setFullStoppage(prev => ({ ...prev, reason: '' }))}
                  className="w-full h-9"
                />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-sm font-medium mb-1 block">Time (mins)</Label>
                <Input
                  type="number"
                  min="1"
                  max={shiftTimeVal}
                  placeholder="0"
                  value={fullStoppage.time}
                  onChange={(e) => setFullStoppage(prev => ({ ...prev, time: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <Button 
                onClick={handleApplyFullStoppage}
                disabled={isSaving}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Partial Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-3 bg-gray-50">
            <CardTitle className="text-base font-semibold">Partial Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">Stoppage Reason</Label>
              <StoppageAutocomplete
                value={partialStoppage.reason || ''}
                displayValue={getStoppageDisplayValue(partialStoppage.reason, stoppageReasons)}
                reasons={stoppageReasons}
                onSelect={(id) => setPartialStoppage(prev => ({ ...prev, reason: id }))}
                onClear={() => setPartialStoppage(prev => ({ ...prev, reason: '' }))}
                className="w-full h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1 block">From M/c No.</Label>
                <Select
                  value={partialStoppage.fromMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, fromMachine: value }))}
                >
                  <SelectTrigger className="h-9 text-sm">
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
                <Label className="text-sm font-medium mb-1 block">To M/c No.</Label>
                <Select
                  value={partialStoppage.toMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, toMachine: value }))}
                >
                  <SelectTrigger className="h-9 text-sm">
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
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-sm font-medium mb-1 block">Time (mins)</Label>
                <Input
                  type="number"
                  min="1"
                  max={shiftTimeVal}
                  placeholder="0"
                  value={partialStoppage.time}
                  onChange={(e) => setPartialStoppage(prev => ({ ...prev, time: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <Button 
                onClick={handleApplyPartialStoppage}
                disabled={isSaving}
                className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
})

export default ComberStoppageTab
