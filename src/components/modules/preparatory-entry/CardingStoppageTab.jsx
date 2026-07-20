'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { NumberInput } from '@/components/ui/number-input'
import StoppageAutocomplete from '@/components/ui/stoppage-autocomplete'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { resolveCardingShiftFallbackTime } from '@/lib/cardingShiftFallback'
import { resolveCardingFormulaInputs } from '@/lib/cardingFormulaFallback'
import {
  getCardingStoppageEntriesAction,
  getCardingStoppageReasonsAction,
  getCardingMachineSetupsAction,
  updateStoppageEntryAction,
  applyFullStoppageAction,
  applyPartialStoppageAction,
  getCardingMachinesAction
} from '@/app/actions/carding-entry'

// Helper function to safely convert any value to a number
const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  if (typeof value === 'object' && value.toString) return parseFloat(value.toString()) || 0
  return 0
}

// Helper function to format number with fixed decimals
const formatNumber = (value, decimals = 2) => {
  return toNumber(value).toFixed(decimals)
}

const resolveStdProdn = (productionDetail, setup, totalTime) => {
  const safeTotalTime = Math.max(toNumber(totalTime), 0)
  if (safeTotalTime <= 0) return 0

  if (setup) {
    const { speed, hankConstant, stdEfficiencyFactor, divisorConstant } = resolveCardingFormulaInputs(setup)
    return (speed / divisorConstant / hankConstant) * safeTotalTime * stdEfficiencyFactor
  }

  const fromProduction = toNumber(productionDetail?.std_prodn)
  if (fromProduction > 0) return fromProduction

  return 0
}

const recalcProductionFromStoppage = (productionDetail, totalStoppageTime, totalTime, setup) => {
  const safeTotalTime = Math.max(toNumber(totalTime), 0)
  if (safeTotalTime <= 0) {
    return {
      work_time: 0,
      uti_percent: 0,
      exp_prodn: 0,
      effi_percent: 0,
    }
  }

  const workTime = Math.max(safeTotalTime - toNumber(totalStoppageTime), 0)
  const stdProdn = resolveStdProdn(productionDetail, setup, safeTotalTime)
  const actProdn = toNumber(productionDetail?.act_prodn)
  const expProdn = stdProdn > 0 ? (stdProdn * workTime) / safeTotalTime : 0
  const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
  const utiPercent = (workTime / safeTotalTime) * 100

  return {
    work_time: Math.round(workTime * 100) / 100,
    uti_percent: Math.round(utiPercent * 100) / 100,
    exp_prodn: Math.round(expProdn * 100) / 100,
    effi_percent: Math.round(effiPercent * 100) / 100,
  }
}

const CardingStoppageTab = forwardRef(function CardingStoppageTab({
  headerId,
  totalTime,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  productionDraftEdits,
  setupDraftEdits
}, ref) {
  const effectiveTotalTime = totalTime ?? resolveCardingShiftFallbackTime(1)
  const [stoppageData, setStoppageData] = useState([])
  const [stoppageReasons, setStoppageReasons] = useState([])
  const [machines, setMachines] = useState([])
  const [machineSetups, setMachineSetups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
  const lastLoadKeyRef = useRef('')
  const tableRef = useRef(null)

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

  const focusRowByDelta = useCallback((rowIndex, delta, col) => {
    const targetRow = rowIndex + delta
    if (targetRow < 0) return
    const el = tableRef.current?.querySelector(`[data-row="${targetRow}"][data-col="${col}"]`)
    if (!el) return
    const input = el.querySelector('input')
    if (input) { input.focus(); input.select(); return }
    el.querySelector('button')?.click()
  }, [])

  const focusNextRow = useCallback((rowIndex, col) => focusRowByDelta(rowIndex, 1, col), [focusRowByDelta])

  const handleEnterNavigation = useCallback((e, rowIndex, col) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, col) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, col) }
  }, [focusRowByDelta])

  const mergeProductionDetailWithDraft = useCallback((productionDetail, row) => {
    const base = productionDetail || {}
    const productionDetailId = base?.id || row?.production_detail_id
    if (!productionDetailId) return base

    const draft =
      productionDraftEdits?.[productionDetailId] ||
      productionDraftEdits?.[String(productionDetailId)]

    return draft ? { ...base, ...draft } : base
  }, [productionDraftEdits])

  const findSetupDraftForMachine = useCallback((machineId) => {
    if (!setupDraftEdits || !machineId) return null
    const direct = setupDraftEdits[machineId] || setupDraftEdits[String(machineId)]
    if (direct) return direct
    for (const draft of Object.values(setupDraftEdits)) {
      if (draft?.machine_id && String(draft.machine_id) === String(machineId)) {
        return draft
      }
    }
    return null
  }, [setupDraftEdits])

  const getEffectiveSetup = useCallback((machineId, setupMap = machineSetups) => {
    const baseSetup = setupMap?.[machineId]
    if (!baseSetup) return null
    const draft =
      setupDraftEdits?.[baseSetup.id] ||
      setupDraftEdits?.[String(baseSetup.id)] ||
      findSetupDraftForMachine(machineId)
    return draft ? { ...baseSetup, ...draft } : baseSetup
  }, [machineSetups, setupDraftEdits, findSetupDraftForMachine])

  const mergeServerRowsWithDrafts = useCallback((rows) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))

    setEditedRows(prev => {
      const next = {}
      for (const [id, value] of Object.entries(prev || {})) {
        if (rowIds.has(String(id))) {
          next[id] = value
        }
      }
      return Object.keys(next).length === Object.keys(prev || {}).length ? prev : next
    })

    return (rows || []).map(row => {
      const rowDraft = drafts[row.id] || drafts[String(row.id)]
      const mergedRow = rowDraft ? { ...row, ...rowDraft } : { ...row }
      const totalStoppageTime =
        toNumber(mergedRow.stoppage1_time ?? 0) +
        toNumber(mergedRow.stoppage2_time ?? 0) +
        toNumber(mergedRow.stoppage3_time ?? 0) +
        toNumber(mergedRow.stoppage4_time ?? 0)

      const machineId = mergedRow.production_detail?.machine_id
      const setup = getEffectiveSetup(machineId)
      const mergedProduction = mergeProductionDetailWithDraft(mergedRow.production_detail, mergedRow)
      const derived = recalcProductionFromStoppage(mergedProduction, totalStoppageTime, effectiveTotalTime, setup)

      return {
        ...mergedRow,
        total_stoppage_time: totalStoppageTime,
        production_detail: {
          ...mergedProduction,
          ...derived
        }
      }
    })
  }, [mergeProductionDetailWithDraft, effectiveTotalTime, machineSetups, getEffectiveSetup, setEditedRows])

  // Full stoppage form
  const [fullStoppage, setFullStoppage] = useState({
    reason: '',
    time: '',
    slot: '1'
  })

  // Partial stoppage form
  const [partialStoppage, setPartialStoppage] = useState({
    reason: '',
    fromMachine: '',
    toMachine: '',
    time: ''
  })

  const applyServerRowsToDrafts = useCallback((updatedRows = []) => {
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) return

    setEditedRows(prev => {
      const next = { ...(prev || {}) }
      for (const row of updatedRows) {
        if (!row?.id) continue
        const rowId = row.id
        const existing = next[rowId] || {}
        next[rowId] = {
          ...existing,
          ...(row.stoppage1_id !== undefined ? { stoppage1_id: row.stoppage1_id } : {}),
          ...(row.stoppage1_time !== undefined ? { stoppage1_time: toNumber(row.stoppage1_time) } : {}),
          ...(row.stoppage2_id !== undefined ? { stoppage2_id: row.stoppage2_id } : {}),
          ...(row.stoppage2_time !== undefined ? { stoppage2_time: toNumber(row.stoppage2_time) } : {}),
          ...(row.stoppage3_id !== undefined ? { stoppage3_id: row.stoppage3_id } : {}),
          ...(row.stoppage3_time !== undefined ? { stoppage3_time: toNumber(row.stoppage3_time) } : {}),
          ...(row.stoppage4_id !== undefined ? { stoppage4_id: row.stoppage4_id } : {}),
          ...(row.stoppage4_time !== undefined ? { stoppage4_time: toNumber(row.stoppage4_time) } : {}),
          ...(row.total_stoppage_time !== undefined ? { total_stoppage_time: toNumber(row.total_stoppage_time) } : {})
        }
      }
      return next
    })
  }, [setEditedRows])

  const getStoppageDisplayValue = useCallback((stoppageObj) => {
    if (!stoppageObj) return ''
    return stoppageObj.stoppage_name || ''
  }, [])

  const resolveRowReasonBySlot = useCallback((row, slot) => {
    const relation = row?.[`stoppage${slot}`]
    if (relation?.id) return relation
    const idValue = row?.[`stoppage${slot}_id`]
    if (!idValue) return null
    return stoppageReasons.find(r => String(r.id) === String(idValue)) || null
  }, [stoppageReasons])

  // Load data
  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!headerId) return

    const loadKey = `${headerId}|${effectiveTotalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) {
      return
    }
    lastLoadKeyRef.current = loadKey
    
    setIsLoading(true)
    try {
      const [stoppagesResult, reasonsResult, machineListResult, setupsResult] = await Promise.all([
        getCardingStoppageEntriesAction(headerId),
        getCardingStoppageReasonsAction(),
        getCardingMachinesAction(),
        getCardingMachineSetupsAction()
      ])
      
      const stoppages = stoppagesResult.success ? stoppagesResult.data : []
      const reasons = reasonsResult.success ? reasonsResult.data : []
      const machineList = machineListResult.success ? machineListResult.data : []
      const setups = setupsResult.success ? setupsResult.data : []

      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      setMachineSetups(setupMap)
      
      // Sort by natural machine number order (CA1, CA2, ... CA10, CA11)
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
      
      const mergedRows = mergeServerRowsWithDrafts(sortedStoppages)
      setStoppageData(mergedRows)
      setStoppageReasons(reasons || [])
      setMachines(sortedMachines)
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, effectiveTotalTime, mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!stoppageData.length) return

    setStoppageData(prev => prev.map(row => {
      const rowDraft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const mergedRow = rowDraft ? { ...row, ...rowDraft } : row
      const totalStoppageTime =
        toNumber(mergedRow.stoppage1_time ?? 0) +
        toNumber(mergedRow.stoppage2_time ?? 0) +
        toNumber(mergedRow.stoppage3_time ?? 0) +
        toNumber(mergedRow.stoppage4_time ?? 0)

      const machineId = mergedRow.production_detail?.machine_id
      const setup = getEffectiveSetup(machineId)
      const mergedProduction = mergeProductionDetailWithDraft(mergedRow.production_detail, mergedRow)

      return {
        ...mergedRow,
        total_stoppage_time: totalStoppageTime,
        production_detail: {
          ...mergedProduction,
          ...recalcProductionFromStoppage(
            mergedProduction,
            totalStoppageTime,
            effectiveTotalTime,
            setup
          )
        }
      }
    }))
  }, [productionDraftEdits, setupDraftEdits, effectiveTotalTime, machineSetups, getEffectiveSetup, mergeProductionDetailWithDraft, stoppageData.length])

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

        // Reflect formula-dependent values live while typing stoppage minutes.
        const machineId = updatedRow.production_detail?.machine_id
        const setup = getEffectiveSetup(machineId)
        const mergedProduction = mergeProductionDetailWithDraft(updatedRow.production_detail, updatedRow)
        updatedRow.production_detail = {
          ...mergedProduction,
          ...recalcProductionFromStoppage(
            mergedProduction,
            updatedRow.total_stoppage_time,
            effectiveTotalTime,
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
    const isClearing = !value || value === 'NONE'
    const savedValue = isClearing ? null : value
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: savedValue,
        // Clear time when NONE is selected
        ...(isClearing ? { [timeField]: 0 } : {})
      }
    }))

    // Find the selected reason to update the display
    const selectedReason = isClearing ? null : (stoppageReasons.find(r => String(r.id) === String(value)) || null)
    const stoppageField = field.replace('_id', '') // e.g., 'stoppage1_id' -> 'stoppage1'

    setStoppageData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { 
          ...row, 
          [field]: savedValue,
          [stoppageField]: selectedReason,
          // Clear time when NONE is selected
          ...(isClearing ? { [timeField]: 0 } : {})
        }
        // Recalculate total if time was cleared
        if (isClearing) {
          updatedRow.total_stoppage_time =
            (updatedRow.stoppage1_time || 0) +
            (updatedRow.stoppage2_time || 0) +
            (updatedRow.stoppage3_time || 0) +
            (updatedRow.stoppage4_time || 0)

          const machineId = updatedRow.production_detail?.machine_id
          const setup = getEffectiveSetup(machineId)
          const mergedProduction = mergeProductionDetailWithDraft(updatedRow.production_detail, updatedRow)
          updatedRow.production_detail = {
            ...mergedProduction,
            ...recalcProductionFromStoppage(
              mergedProduction,
              updatedRow.total_stoppage_time,
              effectiveTotalTime,
              setup
            )
          }
        }
        return updatedRow
      }
      return row
    }))
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
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => 
        updateStoppageEntryAction(rowId, changes)
      )

      await Promise.all(updatePromises)
      const savedCount = Object.keys(editedRows).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Stoppage data saved successfully')
      }
      
      await loadData({ force: true })
      if (!skipParentRefresh) {
        onRefresh?.()
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
    await loadData({ force: true })
  }

  const discardChanges = async () => {
    setEditedRows({})
    await loadData({ force: true })
    return { success: true }
  }

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRows).length === 0) return true
    return window.confirm('You have unsaved stoppage row edits. This action will reload data and discard them. Continue?')
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRows).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, editedRows, isSaving, discardChanges])

  // Apply full stoppage (draft-safe: does not force save/discard of unsaved row edits)
  const handleApplyFullStoppage = async () => {
    const parsedTime = parseInt(fullStoppage.time)
    if (!fullStoppage.reason || !fullStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
      toast.warning('Please select stoppage reason and enter time')
      return
    }

    setIsSaving(true)
    try {
      const result = await applyFullStoppageAction(headerId, fullStoppage.reason, parsedTime, parseInt(fullStoppage.slot))
      if (!result.success) throw new Error(result.error)

      applyServerRowsToDrafts(result.data || [])
      toast.success(`Full stoppage applied to Stoppage ${fullStoppage.slot} for all machines`)
      setFullStoppage({ reason: '', time: '', slot: '1' })
      await loadData({ force: true })
    } catch (error) {
      console.error('Error applying full stoppage:', error)
      toast.error(error.message || 'Failed to apply full stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply partial stoppage (draft-safe: does not force save/discard of unsaved row edits)
  const handleApplyPartialStoppage = async () => {
    const parsedTime = parseInt(partialStoppage.time)
    if (!partialStoppage.reason || !partialStoppage.fromMachine || !partialStoppage.toMachine || !partialStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }

    setIsSaving(true)
    try {
      const result = await applyPartialStoppageAction(
        headerId,
        partialStoppage.fromMachine,
        partialStoppage.toMachine,
        partialStoppage.reason,
        parsedTime
      )

      if (!result.success) throw new Error(result.error)

      applyServerRowsToDrafts(result.data?.appliedRows || [])

      const updated = result.data?.updatedCount || 0
      const overflow = result.data?.overflowCount || 0
      const skipped = result.data?.skippedCount || 0

      if (updated === 0) {
        toast.warning('No machines updated. All target machines may already have all 4 stoppage slots filled.')
      } else {
        toast.success(`Partial stoppage applied: updated ${updated}, skipped ${skipped}, overflow ${overflow}`)
      }

      setPartialStoppage({ reason: '', fromMachine: '', toMachine: '', time: '' })
      await loadData({ force: true })
    } catch (error) {
      console.error('Error applying partial stoppage:', error)
      toast.error(error.message || 'Failed to apply partial stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Format stoppage display
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
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {stoppageData.length} machines | Shift Time: {effectiveTotalTime} mins
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

      {/* Stoppage Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table ref={tableRef} className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 whitespace-nowrap">Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">ShiftTime</th>
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
                    {formatNumber(row.production_detail?.effi_percent)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {effectiveTotalTime}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage1_id">
                    <StoppageAutocomplete
                      value={row.stoppage1_id ? String(row.stoppage1_id) : ''}
                      displayValue={getStoppageDisplayValue(resolveRowReasonBySlot(row, 1))}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage1_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage1_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage1_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage1_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage1_id ? (row.stoppage1_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage1_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage1_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage2_id">
                    <StoppageAutocomplete
                      value={row.stoppage2_id ? String(row.stoppage2_id) : ''}
                      displayValue={getStoppageDisplayValue(resolveRowReasonBySlot(row, 2))}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage2_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage2_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage2_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage2_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage2_id ? (row.stoppage2_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage2_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage2_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage3_id">
                    <StoppageAutocomplete
                      value={row.stoppage3_id ? String(row.stoppage3_id) : ''}
                      displayValue={getStoppageDisplayValue(resolveRowReasonBySlot(row, 3))}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage3_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage3_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage3_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage3_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage3_id ? (row.stoppage3_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage3_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage3_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage4_id">
                    <StoppageAutocomplete
                      value={row.stoppage4_id ? String(row.stoppage4_id) : ''}
                      displayValue={getStoppageDisplayValue(resolveRowReasonBySlot(row, 4))}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage4_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage4_id', 'NONE')}
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage4_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage4_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage4_id ? (row.stoppage4_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage4_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage4_time')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-orange-600 font-medium tabular-nums whitespace-nowrap">
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
          <CardHeader className="py-4 bg-gray-50">
            <CardTitle className="text-base font-semibold">Full Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Stoppage Slot</Label>
                <Select
                  value={fullStoppage.slot}
                  onValueChange={(value) => setFullStoppage(prev => ({ ...prev, slot: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Stoppage 1</SelectItem>
                    <SelectItem value="2">Stoppage 2</SelectItem>
                    <SelectItem value="3">Stoppage 3</SelectItem>
                    <SelectItem value="4">Stoppage 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
                <Input
                  type="number"
                  placeholder="Minutes"
                  value={fullStoppage.time}
                  onChange={(e) => setFullStoppage(prev => ({ ...prev, time: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
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

export default CardingStoppageTab
