'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NumberInput } from '@/components/ui/number-input'
import StoppageAutocomplete from '@/components/ui/stoppage-autocomplete'

import {
  getSimplexStoppageEntriesAction,
  updateSimplexStoppageEntryAction,
  applySimplexFullStoppageAction,
  applySimplexPartialStoppageAction,
  getSimplexStoppageReasonsAction,
  getSimplexMachinesAction,
  getSimplexMachineSetupsAction
} from '@/app/actions/simplexEntryActions'
import { calculateSimplexProductionValues } from '@/lib/utils/simplexCalculations'

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  return parseFloat(String(value)) || 0
}

const recalcProductionFromStoppage = (productionDetail, totalStoppageTime, totalTime, setup) => {
  if (!productionDetail) return null

  const machine = productionDetail.machine || {}
  const calculated = calculateSimplexProductionValues({
    runHrs: toNumber(productionDetail.run_hrs),
    speed: setup?.speed || machine.speed || 960,
    tpi: setup?.tpi || machine.tpi || 1.73,
    hank: setup?.sl_hank || 1.4,
    mcEffi: setup?.mc_effi || machine.mc_effi || 92,
    totalSpindles: setup?.spindles || machine.no_of_spindles || 140,
    idleSpindles: parseInt(productionDetail.idle_spindles, 10) || 0,
    waste: toNumber(productionDetail.waste),
    totalTime,
    stoppageTime: toNumber(totalStoppageTime)
  })

  return {
    ...productionDetail,
    run_time: totalTime,
    run_min: calculated.run_min,
    work_time: calculated.work_time,
    std_hrs: calculated.std_hrs,
    act_prodn: calculated.act_prodn,
    act_effi_percent: calculated.act_effi_percent,
    waste_percent: calculated.waste_percent,
    uti_percent: calculated.uti_percent
  }
}

const SimplexStoppageTab = forwardRef(function SimplexStoppageTab({
  headerId,
  totalTime = 510,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  productionDraftEdits,
  setupDraftEdits
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
  const lastLoadKeyRef = useRef('')

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

  // Full Stoppage State
  const [fullStoppage, setFullStoppage] = useState({
    slot: '1',
    reason: '',
    time: ''
  })

  // Partial Stoppage State (no manual slot - auto-resolved)
  const [partialStoppage, setPartialStoppage] = useState({
    reason: '',
    time: '',
    fromMachine: '',
    toMachine: ''
  })

  const findSetupDraftForMachine = useCallback((machineId, setupId) => {
    const drafts = setupDraftEdits || {}
    const direct =
      drafts[setupId] || drafts[String(setupId)] || drafts[machineId] || drafts[String(machineId)]
    if (direct && direct.machine_id) return direct
    return Object.values(drafts).find(draft => String(draft?.machine_id) === String(machineId)) || null
  }, [setupDraftEdits])

  const getEffectiveSetup = useCallback((machineId, setupMap) => {
    const baseSetup = setupMap?.[machineId] || machineSetups?.[machineId] || {}
    if (!baseSetup?.id) return baseSetup
    const setupDraft = findSetupDraftForMachine(machineId, baseSetup.id)
    return setupDraft ? { ...baseSetup, ...setupDraft } : baseSetup
  }, [machineSetups, findSetupDraftForMachine])

  const mergeServerRowsWithDrafts = useCallback((rows, reasons, setupMap) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))
    const reasonMap = (reasons || []).reduce((acc, reason) => {
      acc[reason.id] = reason
      return acc
    }, {})

    setEditedRows(prev => {
      const next = {}
      for (const [id, value] of Object.entries(prev || {})) {
        if (rowIds.has(String(id))) next[id] = value
      }
      return Object.keys(next).length === Object.keys(prev || {}).length ? prev : next
    })

    return (rows || []).map(row => {
      const draft = drafts[row.id] || drafts[String(row.id)]
      if (!draft) return row
      const merged = { ...row, ...draft }
      for (let slot = 1; slot <= 4; slot += 1) {
        const idField = `stoppage${slot}_id`
        const timeField = `stoppage${slot}_time`
        const reasonField = `stoppage${slot}`
        if (!(idField in draft)) continue
        const selectedReasonId = draft[idField]
        if (!selectedReasonId || selectedReasonId === 'NONE') {
          merged[idField] = null
          merged[reasonField] = null
          merged[timeField] = 0
        } else {
          merged[idField] = selectedReasonId
          merged[reasonField] = reasonMap[selectedReasonId] || null
        }
      }
      merged.total_stoppage_time =
        (merged.stoppage1_time || 0) +
        (merged.stoppage2_time || 0) +
        (merged.stoppage3_time || 0) +
        (merged.stoppage4_time || 0)

      const machineId = merged.production_detail?.machine_id
      const productionDetail = merged.production_detail || {}
      const productionDraft = productionDraftEdits?.[productionDetail.id] || productionDraftEdits?.[String(productionDetail.id)]
      const mergedProductionDetail = productionDraft ? { ...productionDetail, ...productionDraft } : productionDetail

      merged.production_detail = recalcProductionFromStoppage(
        mergedProductionDetail,
        merged.total_stoppage_time,
        totalTime,
        getEffectiveSetup(machineId, setupMap)
      )
      return merged
    })
  }, [setEditedRows, totalTime, productionDraftEdits, getEffectiveSetup])

  // Load data
  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!headerId) return
    const loadKey = `${headerId}|${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) return
    lastLoadKeyRef.current = loadKey
    
    setIsLoading(true)
    try {
      const [stoppagesResult, reasonsResult, machineListResult, setupResult] = await Promise.all([
        getSimplexStoppageEntriesAction(headerId),
        getSimplexStoppageReasonsAction(),
        getSimplexMachinesAction(),
        getSimplexMachineSetupsAction(headerId)
      ])
      
      const stoppages = stoppagesResult.success ? stoppagesResult.data : []
      const reasons = reasonsResult.success ? reasonsResult.data : []
      const machineList = machineListResult.success ? machineListResult.data : []
      const setups = setupResult.success ? setupResult.data : []

      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })

      if (!stoppagesResult.success) {
        console.error('Simplex stoppage query failed:', stoppagesResult.error)
        toast.error(stoppagesResult.error || 'Failed to load stoppage rows')
      }
      if (!reasonsResult.success) {
        console.error('Simplex stoppage reasons query failed:', reasonsResult.error)
      }
      if (!machineListResult.success) {
        console.error('Simplex machine list query failed:', machineListResult.error)
      }
      if (!setupResult.success) {
        console.error('Simplex machine setup query failed:', setupResult.error)
      }
      
      // Sort by natural machine number order (1, 2, 3... 10)
      const sortedStoppages = stoppages?.sort((a, b) => {
        const aNum = parseInt(a.production_detail?.machine?.machine_no || '0')
        const bNum = parseInt(b.production_detail?.machine?.machine_no || '0')
        return aNum - bNum
      }) || []
      
      // Sort machines list for dropdowns
      const sortedMachines = machineList?.sort((a, b) => {
        const aNum = parseInt(a.machine_no || '0')
        const bNum = parseInt(b.machine_no || '0')
        return aNum - bNum
      }) || []
      
      // Filter for active machines only (is_active: true)
      const activeMachines = sortedMachines.filter(m => m.is_active === true) || []
      
      const mergedRows = mergeServerRowsWithDrafts(sortedStoppages, reasons, setupMap)
      setStoppageData(mergedRows)
      setStoppageReasons(reasons || [])
      setMachines(activeMachines)
      setMachineSetups(setupMap)
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, totalTime, mergeServerRowsWithDrafts])

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

      const productionDetail = row.production_detail || {}
      const productionDraft = productionDraftEdits?.[productionDetail.id] || productionDraftEdits?.[String(productionDetail.id)]
      const mergedProductionDetail = productionDraft ? { ...productionDetail, ...productionDraft } : productionDetail

      const machineId = mergedProductionDetail?.machine_id
      return {
        ...row,
        total_stoppage_time: totalStoppageTime,
        production_detail: recalcProductionFromStoppage(
          mergedProductionDetail,
          totalStoppageTime,
          totalTime,
          getEffectiveSetup(machineId)
        )
      }
    }))
  }, [productionDraftEdits, setupDraftEdits, totalTime, machineSetups, getEffectiveSetup, stoppageData.length])

  // Handle stoppage reason change
  const handleStoppageReasonChange = (rowId, field, value) => {
    // Handle "NONE" option to clear the stoppage
    const actualValue = value === 'NONE' ? null : value
    const timeField = field.replace('_id', '_time')
    
    // Find full reason object for display
    const selectedReason = stoppageReasons.find(r => r.id === actualValue)
    
    setStoppageData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      
      // Clear the relationship object and set the new ID
      const fieldBase = field.replace('_id', '') // e.g., 'stoppage1'
      const updatedRow = { 
        ...row, 
        [field]: actualValue,
        [fieldBase]: selectedReason || (actualValue ? { id: actualValue } : null),
        // Clear time field when NONE is selected
        ...(value === 'NONE' ? { [timeField]: 0 } : {})
      }
      
      // Recalculate total stoppage time if NONE was selected
      if (value === 'NONE') {
        updatedRow.total_stoppage_time = 
          (updatedRow.stoppage1_time || 0) +
          (updatedRow.stoppage2_time || 0) +
          (updatedRow.stoppage3_time || 0) +
          (updatedRow.stoppage4_time || 0)

        const machineId = updatedRow.production_detail?.machine_id
        const productionDraft = productionDraftEdits?.[updatedRow.production_detail?.id] || productionDraftEdits?.[String(updatedRow.production_detail?.id)]
        const mergedProductionDetail = productionDraft ? { ...updatedRow.production_detail, ...productionDraft } : updatedRow.production_detail
        updatedRow.production_detail = recalcProductionFromStoppage(
          mergedProductionDetail,
          updatedRow.total_stoppage_time,
          totalTime,
          getEffectiveSetup(machineId)
        )
      }
      
      return updatedRow
    }))
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: actualValue,
        ...(value === 'NONE' ? { [timeField]: 0 } : {})
      }
    }))
  }

  // Handle time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = parseInt(value) || 0
    setStoppageData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      
      const updatedRow = { ...row, [field]: numValue }
      
      // Recalculate total stoppage time
      const total = 
        (field === 'stoppage1_time' ? numValue : (updatedRow.stoppage1_time || 0)) +
        (field === 'stoppage2_time' ? numValue : (updatedRow.stoppage2_time || 0)) +
        (field === 'stoppage3_time' ? numValue : (updatedRow.stoppage3_time || 0)) +
        (field === 'stoppage4_time' ? numValue : (updatedRow.stoppage4_time || 0))
      
      updatedRow.total_stoppage_time = total
      const machineId = updatedRow.production_detail?.machine_id
      const productionDraft = productionDraftEdits?.[updatedRow.production_detail?.id] || productionDraftEdits?.[String(updatedRow.production_detail?.id)]
      const mergedProductionDetail = productionDraft ? { ...updatedRow.production_detail, ...productionDraft } : updatedRow.production_detail
      updatedRow.production_detail = recalcProductionFromStoppage(
        mergedProductionDetail,
        total,
        totalTime,
        getEffectiveSetup(machineId)
      )
      return updatedRow
    }))
    setEditedRows(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: numValue } }))
  }

  // Handle save
  const handleSave = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    const currentEdits = editedRowsRef.current || editedRows || {}
    const editedRowIds = Object.keys(currentEdits)
    if (editedRowIds.length === 0) {
      if (!suppressNoChangesToast) toast.info('No changes to save')
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const rowsToSave = stoppageData.filter(row => currentEdits[row.id] || currentEdits[String(row.id)])
      
      for (const row of rowsToSave) {
        await updateSimplexStoppageEntryAction(row.id, {
          stoppage1_id: row.stoppage1_id || null,
          stoppage1_time: row.stoppage1_id ? (row.stoppage1_time || 0) : 0,
          stoppage2_id: row.stoppage2_id || null,
          stoppage2_time: row.stoppage2_id ? (row.stoppage2_time || 0) : 0,
          stoppage3_id: row.stoppage3_id || null,
          stoppage3_time: row.stoppage3_id ? (row.stoppage3_time || 0) : 0,
          stoppage4_id: row.stoppage4_id || null,
          stoppage4_time: row.stoppage4_id ? (row.stoppage4_time || 0) : 0
        })
      }

      if (!suppressSuccessToast) {
        toast.success(`${rowsToSave.length} row(s) saved successfully`)
      }
      setEditedRows({})
      
      await loadData({ force: true })
      if (!skipParentRefresh) onRefresh?.()
      return { success: true, saved: rowsToSave.length }
    } catch (error) {
      console.error('Error saving stoppage data:', error)
      toast.error('Failed to save changes')
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

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRows).length,
    isSaving: () => isSaving,
    discardChanges,
    refreshData: () => loadData({ force: true })
  }), [handleSave, editedRows, isSaving, discardChanges, loadData])

  // Apply Full Stoppage
  const handleApplyFullStoppage = async () => {
    if (!fullStoppage.reason || !fullStoppage.time) {
      toast.warning('Please select stoppage reason and enter time')
      return
    }

    if (!headerId) {
      toast.error('No production header found')
      return
    }

    setIsSaving(true)
    try {
      const result = await applySimplexFullStoppageAction(
        headerId,
        fullStoppage.reason,
        parseInt(fullStoppage.time) || 0,
        parseInt(fullStoppage.slot)
      )
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to apply full stoppage')
      }
      
      toast.success(`Full stoppage applied to Stoppage ${fullStoppage.slot} for all machines`)
      setFullStoppage({ slot: '1', reason: '', time: '' })
      
      await loadData({ force: true })
      onRefresh?.()
    } catch (error) {
      console.error('Error applying full stoppage:', error)
      toast.error(error?.message || 'Failed to apply stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply Partial Stoppage
  const handleApplyPartialStoppage = async () => {
    if (!partialStoppage.reason || !partialStoppage.time) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }

    if (!partialStoppage.fromMachine || !partialStoppage.toMachine) {
      toast.warning('Please select machine range')
      return
    }

    if (!headerId) {
      toast.error('No production header found')
      return
    }

    setIsSaving(true)
    try {
      const result = await applySimplexPartialStoppageAction(
        headerId,
        partialStoppage.fromMachine,
        partialStoppage.toMachine,
        partialStoppage.reason,
        parseInt(partialStoppage.time) || 0
      )
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to apply partial stoppage')
      }
      
      const { updatedCount = 0, skippedCount = 0, overflowCount = 0 } = result.data || {}
      const message = `Applied: ${updatedCount} machines | Skipped: ${skippedCount} | Overflow: ${overflowCount}`
      toast.success(message)
      setPartialStoppage({ reason: '', time: '', fromMachine: '', toMachine: '' })
      
      await loadData({ force: true })
      onRefresh?.()
    } catch (error) {
      console.error('Error applying partial stoppage:', error)
      toast.error(error?.message || 'Failed to apply stoppage')
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

      {/* Stoppage Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">ActEffi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">R.Time</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">Stoppage 4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time4</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 bg-orange-600 whitespace-nowrap">Total Stop</th>
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
                    {Number(row.production_detail?.act_effi_percent || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {totalTime}
                  </td>
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
                      className="w-full min-w-40"
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
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage1_time"
                      zeroAsEmpty
                    />
                  </td>
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
                      className="w-full min-w-40"
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
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage2_time"
                      zeroAsEmpty
                    />
                  </td>
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
                      className="w-full min-w-40"
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
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage3_time"
                      zeroAsEmpty
                    />
                  </td>
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
                      className="w-full min-w-40"
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
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="stoppage4_time"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium bg-orange-50 text-orange-700 tabular-nums whitespace-nowrap">
                    {row.total_stoppage_time || ((row.stoppage1_time || 0) + (row.stoppage2_time || 0) + (row.stoppage3_time || 0) + (row.stoppage4_time || 0))}
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
                displayValue={stoppageReasons.find(r => r.id === fullStoppage.reason)?.stoppage_name || ''}
                reasons={stoppageReasons}
                onSelect={(id) => setFullStoppage(prev => ({ ...prev, reason: id }))}
                onClear={() => setFullStoppage(prev => ({ ...prev, reason: '' }))}
                placeholder="Search stoppage reason..."
              />
            </div>
            <Button 
              onClick={handleApplyFullStoppage}
              disabled={isSaving}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply to All Machines
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
                displayValue={stoppageReasons.find(r => r.id === partialStoppage.reason)?.stoppage_name || ''}
                reasons={stoppageReasons}
                onSelect={(id) => setPartialStoppage(prev => ({ ...prev, reason: id }))}
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
              Apply to Range
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
})

export default SimplexStoppageTab
