'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getFinisherDrawingStoppageEntriesAction,
  getFinisherDrawingProductionDetailsAction,
  updateFinisherDrawingStoppageEntryAction,
  getFinisherDrawingStoppageReasonsAction,
  applyFinisherDrawingFullStoppageAction,
  applyFinisherDrawingPartialStoppageAction,
  getFinisherDrawingMachinesAction,
  getFinisherDrawingMachineSetupsAction,
  updateFinisherDrawingDetailAction,
  syncFinisherDrawingNewMachinesToHeaderAction
} from '@/app/actions/finisher-drawing-entry'
import { calculateFinisherDrawingValues } from '@/lib/queries/finisherDrawingEntryQueries'
import {
  FINISHER_DRAWING_FORMULA_FALLBACK,
  resolveFinisherDrawingFormulaInputs,
  calculateFinisherDrawingStdProdn,
} from '@/lib/finisherDrawingFormulaFallback'
import { NumberInput } from '@/components/ui/number-input'
import StoppageAutocomplete from '@/components/ui/stoppage-autocomplete'

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  if (typeof value === 'object' && value.toString) return parseFloat(value.toString()) || 0
  return 0
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
    // If this row had a draft, keep it but mark for update
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

const round2 = (value) => Math.round(toNumber(value) * 100) / 100
const normalizeDraftKey = (value) => String(value || '').trim().toLowerCase()

const resolveStdProdn = (productionDetail, setup, totalTime) => {
  if (setup) {
    return calculateFinisherDrawingStdProdn(setup, toNumber(totalTime))
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
    work_time: round2(workTime),
    uti_percent: round2(utiPercent),
    exp_prodn: round2(expProdn),
    effi_percent: round2(effiPercent),
  }
}

const FinisherDrawingStoppageTab = forwardRef(function FinisherDrawingStoppageTab({
  headerId,
  totalTime = 0,
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

  const setEditedRows = useCallback((updater) => {
    if (onSharedDraftEditsChange) {
      const prev = editedRowsRef.current || {}
      const next = typeof updater === 'function' ? updater(prev) : (updater || {})
      if (next === prev) {
        return
      }
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
  const lastLoadKeyRef = useRef('')
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

  // Full stoppage form
  // Full stoppage form (allows manual slot selection)
  const [fullStoppage, setFullStoppage] = useState({
    reason: '',
    time: '',
    slot: '1'
  })

  // Partial stoppage form (auto-allocates slot, no manual slot selector)
  const [partialStoppage, setPartialStoppage] = useState({
    reason: '',
    fromMachine: '',
    toMachine: '',
    time: ''
  })

  const mergeProductionDetailDraft = useCallback((productionDetail) => {
    const base = productionDetail || {}
    const productionDraft = productionDraftEdits?.[base.id] || productionDraftEdits?.[String(base.id)]
    return productionDraft ? { ...base, ...productionDraft } : base
  }, [productionDraftEdits])

  const getEffectiveSetup = useCallback((machineId, setupsByMachine = machineSetups) => {
    const baseSetup = setupsByMachine[machineId]
    if (!baseSetup) return null

    const directDraft =
      setupDraftEdits?.[baseSetup.id] ||
      setupDraftEdits?.[String(baseSetup.id)] ||
      setupDraftEdits?.[machineId] ||
      setupDraftEdits?.[String(machineId)]

    if (directDraft) {
      return { ...baseSetup, ...directDraft }
    }

    const setupIdKey = normalizeDraftKey(baseSetup.id)
    const machineIdKey = normalizeDraftKey(machineId)
    for (const [key, value] of Object.entries(setupDraftEdits || {})) {
      const normalizedKey = normalizeDraftKey(key)
      if (normalizedKey === setupIdKey || normalizedKey === machineIdKey) {
        return { ...baseSetup, ...value }
      }
    }

    return baseSetup
  }, [machineSetups, setupDraftEdits])

  const mergeServerRowsWithDrafts = useCallback((rows, reasons, setupsByMachine = {}) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))
    const reasonMap = (reasons || []).reduce((acc, reason) => {
      acc[reason.id] = reason
      return acc
    }, {})

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

      if (draft) {
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
      }

      mergedRow.total_stoppage_time =
        (mergedRow.stoppage1_time || 0) +
        (mergedRow.stoppage2_time || 0) +
        (mergedRow.stoppage3_time || 0) +
        (mergedRow.stoppage4_time || 0)

      const machineId = mergedRow.production_detail?.machine_id
      const setup = getEffectiveSetup(machineId, setupsByMachine)

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
  }, [setEditedRows, totalTime, machineSetups, mergeProductionDetailDraft, getEffectiveSetup])

  // Load data
  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!headerId) return
    const loadKey = `${headerId}|${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) {
      return
    }
    lastLoadKeyRef.current = loadKey
    
    setIsLoading(true)
    try {
      // First, sync any new machines that were added after this header was created
      await syncFinisherDrawingNewMachinesToHeaderAction(headerId)

      const [stoppagesResult, reasonsResult, machineListResult, setupsResult] = await Promise.all([
        getFinisherDrawingStoppageEntriesAction(headerId),
        getFinisherDrawingStoppageReasonsAction(),
        getFinisherDrawingMachinesAction(),
        getFinisherDrawingMachineSetupsAction(1, headerId)
      ])
      
      const stoppages = stoppagesResult.success ? stoppagesResult.data : []
      const reasons = reasonsResult.success ? reasonsResult.data : []
      const machineList = machineListResult.success ? machineListResult.data : []
      const setups = setupsResult.success ? setupsResult.data : []
      
      // Sort by natural machine number order (FD4, FD5, FD6, etc.)
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
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      
      const mergedRows = mergeServerRowsWithDrafts(sortedStoppages, reasons, setupMap)
      setStoppageData(mergedRows)
      setStoppageReasons(reasons || [])
      setMachines(sortedMachines)
      setMachineSetups(setupMap)
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!stoppageData.length) return

    setStoppageData(prev => prev.map(row => {
      const totalStoppageTime =
        toNumber(row.stoppage1_time) +
        toNumber(row.stoppage2_time) +
        toNumber(row.stoppage3_time) +
        toNumber(row.stoppage4_time)

      const setup = getEffectiveSetup(row.production_detail?.machine_id)
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
  }, [productionDraftEdits, setupDraftEdits, totalTime, machineSetups, mergeProductionDetailDraft, getEffectiveSetup, stoppageData.length])

  // Handle stoppage time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = Math.max(parseInt(value) || 0, 0)
    
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
        // Recalculate total (Finisher Drawing has 4 stoppage slots)
        updatedRow.total_stoppage_time = 
          (updatedRow.stoppage1_time || 0) +
          (updatedRow.stoppage2_time || 0) +
          (updatedRow.stoppage3_time || 0) +
          (updatedRow.stoppage4_time || 0)

        const setup = getEffectiveSetup(updatedRow.production_detail?.machine_id)

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

          const setup = getEffectiveSetup(updatedRow.production_detail?.machine_id)

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
      // First update stoppage entries
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => 
        updateFinisherDrawingStoppageEntryAction(rowId, changes)
      )

      await Promise.all(updatePromises)
      
      // Now recalculate production details based on updated stoppages
      const latestDetailsResult = await getFinisherDrawingProductionDetailsAction(headerId)
      const latestDetails = latestDetailsResult.success ? (latestDetailsResult.data || []) : []
      const latestDetailMap = {}
      latestDetails.forEach(detail => {
        latestDetailMap[detail.id] = detail
      })

      const productionUpdatePromises = Object.keys(editedRows).map(async (rowId) => {
        const stoppageRow = stoppageData.find(s => s.id === rowId)
        if (!stoppageRow || !stoppageRow.production_detail) return null
        
        const prodDetail = stoppageRow.production_detail
        const latestProdDetail = latestDetailMap[prodDetail.id] || prodDetail
        const machineId = prodDetail.machine_id
        const setup = getEffectiveSetup(machineId)
        // Keep setup draft speed authoritative for modify-9 dynamic consistency.
        const machineSpeed = setup?.speed ?? prodDetail.machine?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed
        
        // Calculate new total stoppage (4 slots for Finisher Drawing)
        const editedChanges = editedRows[rowId]
        const newTotalStoppage = 
          (editedChanges.stoppage1_time ?? stoppageRow.stoppage1_time ?? 0) +
          (editedChanges.stoppage2_time ?? stoppageRow.stoppage2_time ?? 0) +
          (editedChanges.stoppage3_time ?? stoppageRow.stoppage3_time ?? 0) +
          (editedChanges.stoppage4_time ?? stoppageRow.stoppage4_time ?? 0)
        
        // Recalculate production values with new stoppage and machine speed
        const calculated = calculateFinisherDrawingValues(
          latestProdDetail.act_hank || 0,
          latestProdDetail.act_prodn || 0,
          totalTime,
          newTotalStoppage,
          setup,
          machineSpeed
        )

        const preservedWaste = latestProdDetail.waste ?? prodDetail.waste ?? 0
        const actProdn = latestProdDetail.act_prodn || 0
        calculated.waste = preservedWaste
        calculated.waste_percent = actProdn > 0
          ? Math.round((preservedWaste / actProdn) * 100 * 100) / 100
          : 0
        
        // Update production detail
        return updateFinisherDrawingDetailAction(prodDetail.id, calculated)
      })
      
      await Promise.all(productionUpdatePromises.filter(Boolean))
      
      const savedCount = Object.keys(editedRows).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Stoppage data saved and production recalculated')
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

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRows).length === 0) return true
    return window.confirm('You have unsaved stoppage edits. This action will reload data and discard them. Continue?')
  }

  const discardChanges = async () => {
    setEditedRows({})
    await loadData({ force: true })
    return { success: true }
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRows).length,
    isSaving: () => isSaving,
    discardChanges,
    refreshData: () => loadData({ force: true })
  }), [handleSave, editedRows, isSaving, discardChanges, loadData])

  // Apply full stoppage
  // Apply full stoppage (draft-safe: does not force save/discard of unsaved row edits)
  const handleApplyFullStoppage = async () => {
    const parsedTime = parseInt(fullStoppage.time)
    if (!fullStoppage.reason || !fullStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
      toast.warning('Please select stoppage reason and enter time')
      return
    }

    setIsSaving(true)
    try {
      const result = await applyFinisherDrawingFullStoppageAction(headerId, {
        stoppageId: fullStoppage.reason,
        stoppageTime: parsedTime,
        slot: parseInt(fullStoppage.slot)
      })
      if (result.success) {
        applyServerRowsToDrafts(result.data || [], editedRowsRef, setEditedRows, stoppageReasons, machineSetups)
        toast.success(`Full stoppage applied to Stoppage ${fullStoppage.slot} for all machines`)
        setFullStoppage({ reason: '', time: '', slot: '1' })
        await loadData()
        onRefresh?.()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error applying full stoppage:', error?.message || error)
      toast.error(error?.message || 'Failed to apply full stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply partial stoppage (draft-safe: does not force save/discard of unsaved row edits, auto-slot allocation)
  const handleApplyPartialStoppage = async () => {
    const parsedTime = parseInt(partialStoppage.time)
    if (!partialStoppage.reason || !partialStoppage.fromMachine || !partialStoppage.toMachine || !partialStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }

    setIsSaving(true)
    try {
      const result = await applyFinisherDrawingPartialStoppageAction(
        headerId,
        partialStoppage.fromMachine,
        partialStoppage.toMachine,
        partialStoppage.reason,
        parsedTime
      )
      
      if (result?.success) {
        applyServerRowsToDrafts(result.data?.appliedRows || [], editedRowsRef, setEditedRows, stoppageReasons, machineSetups)

        const updated = result.data?.updatedCount || 0
        const overflow = result.data?.overflowCount || 0
        const skipped = result.data?.skippedCount || 0

        if (updated === 0) {
          toast.warning('No machines updated. All target machines may already have all 4 stoppage slots filled.')
        } else {
          toast.success(`Partial stoppage applied: updated ${updated}, skipped ${skipped}, overflow ${overflow}`)
        }

        setPartialStoppage({ reason: '', fromMachine: '', toMachine: '', time: '' })
        await loadData()
        onRefresh?.()
      } else {
        throw new Error(result?.error || 'Failed to apply partial stoppage')
      }
    } catch (error) {
      console.error('Error applying partial stoppage:', error?.message || error)
      toast.error(error?.message || 'Failed to apply partial stoppage')
    } finally {
      setIsSaving(false)
    }
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
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {stoppageData.length} machines | Shift Time: {totalTime} mins
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

      {/* Stoppage Grid - Finisher Drawing has 4 stoppage columns */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">R.Time</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Stoppage 4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">S.Time4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 bg-orange-600 whitespace-nowrap">Total Stopp</th>
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
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {Number(
                      getEffectiveSetup(row.production_detail?.machine_id)?.speed ??
                      row.production_detail?.machine?.speed ??
                      machineSetups[row.production_detail?.machine_id]?.speed ??
                      FINISHER_DRAWING_FORMULA_FALLBACK.speed
                    ).toFixed(0)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                    {row.production_detail?.session_no || 1}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {Number(row.production_detail?.effi_percent || 0).toFixed(2)}
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
                  <td className="border border-gray-300 px-0 py-0">
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
                  <td className="border border-gray-300 px-0 py-0">
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
                  <td className="border border-gray-300 px-0 py-0">
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
                  <td className="border border-gray-300 px-0 py-0">
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
                  {/* Total Stoppage */}
                  <td className="border border-gray-300 px-2 py-1 text-right font-bold text-orange-600 bg-orange-50 tabular-nums whitespace-nowrap">
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
                  placeholder="0"
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
                displayValue={getStoppageDisplayValue(fullStoppage.reason, stoppageReasons)}
                reasons={stoppageReasons}
                onSelect={(id) => setFullStoppage(prev => ({ ...prev, reason: id }))}
                onClear={() => setFullStoppage(prev => ({ ...prev, reason: '' }))}
                className="w-full h-10"
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
              <Label className="text-sm font-medium mb-2 block">Stoppage Reason</Label>
              <StoppageAutocomplete
                value={partialStoppage.reason || ''}
                displayValue={getStoppageDisplayValue(partialStoppage.reason, stoppageReasons)}
                reasons={stoppageReasons}
                onSelect={(id) => setPartialStoppage(prev => ({ ...prev, reason: id }))}
                onClear={() => setPartialStoppage(prev => ({ ...prev, reason: '' }))}
                className="w-full h-10"
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
            <div>
              <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
              <Input
                type="number"
                placeholder="0"
                value={partialStoppage.time}
                onChange={(e) => setPartialStoppage(prev => ({ ...prev, time: e.target.value }))}
                className="h-10 text-sm"
              />
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

export default FinisherDrawingStoppageTab
