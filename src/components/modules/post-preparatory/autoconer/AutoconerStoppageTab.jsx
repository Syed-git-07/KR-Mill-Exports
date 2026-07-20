'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import StoppageAutocomplete from "@/components/ui/stoppage-autocomplete"
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
import {
  getAutoconerStoppageEntriesAction,
  updateAutoconerStoppageEntryAction,
  applyAutoconerFullStoppageAction,
  applyAutoconerPartialStoppageAction,
  getStoppageDetailsAction,
  getAutoconerMachinesAction,
  syncNewMachinesToAutoconerHeaderAction
} from '@/app/actions/autoconerEntryActions'

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

/**
 * Autoconer Stoppage Entry Tab
 * Manages stoppage reasons and times for each machine
 * Supports Full Stoppage (all machines) and Partial Stoppage (by machine range)
 * UI follows Carding module pattern
 */
const AutoconerStoppageTab = forwardRef(function AutoconerStoppageTab({
  headerId,
  totalTime = 510,
  shiftNo = 1,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  productionDraftEdits,
  setupDraftEdits
}, ref) {
  const [stoppageData, setStoppageData] = useState([])
  const [stoppageReasons, setStoppageReasons] = useState([])
  const [machines, setMachines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = sharedDraftEdits ?? localEditedRows
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

  // Table ref for Enter/Arrow row navigation
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

  const mergeServerRowsWithDrafts = useCallback((rows = []) => {
    const drafts = editedRowsRef.current || {}
    return rows.map((row) => {
      const draft = drafts[row.id] || drafts[String(row.id)] || {}
      const merged = { ...row, ...draft }
      const totalStoppage =
        toNumber(merged.stoppage1_time) +
        toNumber(merged.stoppage2_time) +
        toNumber(merged.stoppage3_time) +
        toNumber(merged.stoppage4_time)

      return {
        ...merged,
        total_stoppage_time: totalStoppage
      }
    })
  }, [])

  // Load data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      // First, sync any new machines that were added after this header was created
      // This also initializes stoppage entries if header exists but has no details
      await syncNewMachinesToAutoconerHeaderAction(headerId, shiftNo)

      const [stoppagesResult, reasonsResult, machinesResult] = await Promise.all([
        getAutoconerStoppageEntriesAction(headerId),
        getStoppageDetailsAction(),
        getAutoconerMachinesAction()
      ])
      
      const stoppages = stoppagesResult.success ? stoppagesResult.data : []
      const reasons = reasonsResult.success ? reasonsResult.data : []
      const machineList = machinesResult.success ? machinesResult.data : []
      
      // Sort stoppages by machine group and number
      const sortedStoppages = stoppages?.sort((a, b) => {
        const machineA = a.production_detail?.machine
        const machineB = b.production_detail?.machine
        const groupA = machineA?.group_id || 999
        const groupB = machineB?.group_id || 999
        if (groupA !== groupB) return groupA - groupB
        
        const matchA = machineA?.machine_no?.match(/^AC(\d+)-(\d+)$/i)
        const matchB = machineB?.machine_no?.match(/^AC(\d+)-(\d+)$/i)
        if (matchA && matchB) {
          const subA = parseInt(matchA[2])
          const subB = parseInt(matchB[2])
          return subA - subB
        }
        return 0
      }) || []
      
      // Sort machines list for dropdowns
      const sortedMachines = machineList?.sort((a, b) => {
        const groupA = a.group_id || 999
        const groupB = b.group_id || 999
        if (groupA !== groupB) return groupA - groupB
        
        const matchA = a.machine_no?.match(/^AC(\d+)-(\d+)$/i)
        const matchB = b.machine_no?.match(/^AC(\d+)-(\d+)$/i)
        if (matchA && matchB) {
          const subA = parseInt(matchA[2])
          const subB = parseInt(matchB[2])
          return subA - subB
        }
        return 0
      }) || []
      
      setStoppageData(mergeServerRowsWithDrafts(sortedStoppages))
      setStoppageReasons(reasons || [])
      setMachines(sortedMachines)
    } catch (error) {
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, mergeServerRowsWithDrafts, shiftNo])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!stoppageData.length) return

    setStoppageData(prev => mergeServerRowsWithDrafts(prev))
  }, [productionDraftEdits, setupDraftEdits, mergeServerRowsWithDrafts, stoppageData.length])

  // Handle stoppage time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = toNumber(value)
    
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
          toNumber(updatedRow.stoppage1_time) +
          toNumber(updatedRow.stoppage2_time) +
          toNumber(updatedRow.stoppage3_time) +
          toNumber(updatedRow.stoppage4_time)
        return updatedRow
      }
      return row
    }))
  }

  // Handle stoppage reason change
  const handleStoppageReasonChange = (rowId, field, value) => {
    // Get the time field name (e.g., 'stoppage1_id' -> 'stoppage1_time')
    const timeField = field.replace('_id', '_time')
    // Treat 'NONE' and null/undefined the same — clear the slot
    const isClearing = !value || value === 'NONE'
    const savedValue = isClearing ? null : value
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: savedValue,
        // Clear time when clearing the reason
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
          // Clear time when clearing the reason
          ...(isClearing ? { [timeField]: 0 } : {})
        }
        updatedRow.total_stoppage_time = 
          toNumber(updatedRow.stoppage1_time) +
          toNumber(updatedRow.stoppage2_time) +
          toNumber(updatedRow.stoppage3_time) +
          toNumber(updatedRow.stoppage4_time)
        return updatedRow
      }
      return row
    }))
  }

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
      const updatePromises = Object.entries(draftRows).map(([rowId, changes]) => 
        updateAutoconerStoppageEntryAction(rowId, changes)
      )

      await Promise.all(updatePromises)
      const savedCount = Object.keys(editedRows).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Stoppage data saved successfully')
      }
      
      await loadData()
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
    if (Object.keys(editedRowsRef.current || {}).length > 0) {
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
    if (Object.keys(editedRowsRef.current || {}).length === 0) return true
    return window.confirm('You have unsaved stoppage row edits. This action will reload data and discard them. Continue?')
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRowsRef.current || {}).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, isSaving, discardChanges])

  // Apply full stoppage (draft-safe: does not force save/discard of unsaved row edits)
  const handleApplyFullStoppage = async () => {
    if (!fullStoppage.reason || !fullStoppage.time) {
      toast.warning('Please select stoppage reason and enter time')
      return
    }

    setIsSaving(true)
    try {
      const result = await applyAutoconerFullStoppageAction(
        headerId, 
        fullStoppage.reason, 
        parseInt(fullStoppage.time),
        parseInt(fullStoppage.slot)
      )
      if (!result.success) throw new Error(result.error)

      applyServerRowsToDrafts(result.data || [])
      
      toast.success(`Full stoppage applied to Stoppage ${fullStoppage.slot} for all machines`)
      setFullStoppage({ reason: '', time: '', slot: '1' })
      await loadData()
    } catch (error) {
      console.error('Error applying full stoppage:', error)
      toast.error('Failed to apply full stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply partial stoppage (draft-safe: does not force save/discard of unsaved row edits)
  const handleApplyPartialStoppage = async () => {
    if (!partialStoppage.reason || !partialStoppage.fromMachine || !partialStoppage.toMachine || !partialStoppage.time) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }

    setIsSaving(true)
    try {
      const result = await applyAutoconerPartialStoppageAction(
        headerId,
        partialStoppage.fromMachine,
        partialStoppage.toMachine,
        partialStoppage.reason,
        parseInt(partialStoppage.time)
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
      await loadData()
    } catch (error) {
      console.error('Error applying partial stoppage:', error)
      toast.error(error.message || 'Failed to apply partial stoppage')
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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshClick}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stoppage Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-12 whitespace-nowrap">Grp</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-32 whitespace-nowrap">Count Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Stoppage 4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">S.Time4</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Total Stopp</th>
              </tr>
            </thead>
            <tbody>
              {stoppageData.map((row, index) => {
                const machine = row.production_detail?.machine
                const totalStoppage =
                  toNumber(row.stoppage1_time) + toNumber(row.stoppage2_time) +
                  toNumber(row.stoppage3_time) + toNumber(row.stoppage4_time)
                
                return (
                  <tr 
                    key={row.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                  >
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                      {machine?.machine_no}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                      {machine?.group_id}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                      {row.production_detail?.session_no ?? '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-xs whitespace-nowrap">
                      {row.production_detail?.count_name || '-'}
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <StoppageAutocomplete
                        value={row.stoppage1_id ? String(row.stoppage1_id) : ''}
                        displayValue={row.stoppage1?.stoppage_name || ''}
                        reasons={stoppageReasons}
                        onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage1_id', id)}
                        onClear={() => handleStoppageReasonChange(row.id, 'stoppage1_id', 'NONE')}
                        compact
                        cleanCell
                        editingHighlight
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
                        data-row={index}
                        data-col="stoppage1_time"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <StoppageAutocomplete
                        value={row.stoppage2_id ? String(row.stoppage2_id) : ''}
                        displayValue={row.stoppage2?.stoppage_name || ''}
                        reasons={stoppageReasons}
                        onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage2_id', id)}
                        onClear={() => handleStoppageReasonChange(row.id, 'stoppage2_id', 'NONE')}
                        compact
                        cleanCell
                        editingHighlight
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
                        data-row={index}
                        data-col="stoppage2_time"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <StoppageAutocomplete
                        value={row.stoppage3_id ? String(row.stoppage3_id) : ''}
                        displayValue={row.stoppage3?.stoppage_name || ''}
                        reasons={stoppageReasons}
                        onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage3_id', id)}
                        onClear={() => handleStoppageReasonChange(row.id, 'stoppage3_id', 'NONE')}
                        compact
                        cleanCell
                        editingHighlight
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
                        data-row={index}
                        data-col="stoppage3_time"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <StoppageAutocomplete
                        value={row.stoppage4_id ? String(row.stoppage4_id) : ''}
                        displayValue={row.stoppage4?.stoppage_name || ''}
                        reasons={stoppageReasons}
                        onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage4_id', id)}
                        onClear={() => handleStoppageReasonChange(row.id, 'stoppage4_id', 'NONE')}
                        compact
                        cleanCell
                        editingHighlight
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
                        data-row={index}
                        data-col="stoppage4_time"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-orange-600 font-medium tabular-nums whitespace-nowrap">
                      {totalStoppage || row.total_stoppage_time || 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stoppage Application Forms - Similar to Carding UI */}
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
                displayValue={stoppageReasons.find(r => String(r.id) === fullStoppage.reason)?.stoppage_name || ''}
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
                displayValue={stoppageReasons.find(r => String(r.id) === partialStoppage.reason)?.stoppage_name || ''}
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

export default AutoconerStoppageTab
