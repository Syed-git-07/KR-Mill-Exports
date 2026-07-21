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
import { Button } from "@/components/ui/button"
import EmployeeAutocomplete from "@/components/ui/employee-autocomplete"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCardingProductionWithSetupAction,
  updateProductionDetailAction,
  getCardingMachineSetupsAction,
  syncNewMachinesToHeaderAction
} from '@/app/actions/carding-entry'
import { calculateProductionValues } from '@/lib/queries/cardingEntryQueries'
import { resolveCardingFormulaInputs } from '@/lib/cardingFormulaFallback'
import { resolveCardingShiftFallbackTime } from '@/lib/cardingShiftFallback'

// Helper function to safely convert any value to a number
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

const calculateAutoExpProdn = (setup, totalTime, workTime) => {
  const { speed, hankConstant, stdEfficiencyFactor, divisorConstant } = resolveCardingFormulaInputs(setup)

  if (!totalTime || !hankConstant || !divisorConstant) return 0

  const stdProdn = (speed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor
  return stdProdn * workTime / totalTime
}

const CardingProductionTab = forwardRef(function CardingProductionTab({
  headerId,
  totalTime,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  stoppageDraftEdits,
  setupDraftEdits
}, ref) {
  const effectiveTotalTime = totalTime ?? resolveCardingShiftFallbackTime(1)
  const [productionData, setProductionData] = useState([])
  const [machineSetups, setMachineSetups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
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
    if (targetRow < 0 || !tableRef.current) return
    const el = tableRef.current.querySelector(`[data-row="${targetRow}"][data-col="${col}"]`)
    const input = el?.querySelector('input, button')
    input?.focus()
  }, [])

  const focusNextRow = useCallback((rowIndex, col) => focusRowByDelta(rowIndex, 1, col), [focusRowByDelta])

  const handleEnterNavigation = useCallback((e, rowIndex, col) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, col) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, col) }
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
    if (!baseSetup) return undefined
    const draft =
      setupDraftEdits?.[baseSetup.id] ||
      setupDraftEdits?.[String(baseSetup.id)] ||
      findSetupDraftForMachine(machineId)
    return draft ? { ...baseSetup, ...draft } : baseSetup
  }, [machineSetups, setupDraftEdits, findSetupDraftForMachine])

  const mergeServerRowsWithDrafts = useCallback((rows, setupMap) => {
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
      const draft = drafts[row.id] || drafts[String(row.id)]
      const hasProductionDraft = !!draft
      const stoppageTime = getEffectiveTotalStoppageMins(row)
      const hasStoppageDraft = stoppageTime !== toNumber(row?.total_stoppage_mins ?? row?.stoppage?.[0]?.total_stoppage_time ?? 0)

      const baseSetup = setupMap[row.machine_id]
      const setupDraft = baseSetup ? (setupDraftEdits?.[baseSetup.id] || setupDraftEdits?.[String(baseSetup.id)] || setupDraftEdits?.[row.machine_id] || setupDraftEdits?.[String(row.machine_id)]) : null
      const hasSetupDraft = !!setupDraft

      const mergedRow = draft ? { ...row, ...draft } : { ...row }

      // Preserve saved server calculations when no active drafts exist
      if (!hasProductionDraft && !hasStoppageDraft && !hasSetupDraft && row.std_prodn !== undefined && row.std_prodn !== null && Number(row.std_prodn) > 0) {
        return {
          ...mergedRow,
          total_stoppage_mins: stoppageTime,
        }
      }

      const setup = getEffectiveSetup(mergedRow.machine_id, setupMap)
      const actHank = toNumber(draft?.act_hank ?? mergedRow.act_hank)
      const actProdn = toNumber(draft?.act_prodn ?? mergedRow.act_prodn)
      const waste = toNumber(draft?.waste ?? mergedRow.waste)

      const calculated = calculateProductionValues(
        actHank,
        actProdn,
        effectiveTotalTime,
        stoppageTime,
        setup
      )

      const finalExpProdn = toNumber(draft?.exp_prodn ?? calculated.exp_prodn)
      const finalEffi = finalExpProdn > 0 ? (actProdn / finalExpProdn) * 100 : 0

      return {
        ...mergedRow,
        ...calculated,
        act_hank: actHank,
        act_prodn: actProdn,
        exp_prodn: Math.round(finalExpProdn * 100) / 100,
        effi_percent: Math.round(finalEffi * 100) / 100,
        waste,
        waste_percent: actProdn > 0 ? Math.round((waste / actProdn) * 100 * 100) / 100 : 0,
        total_stoppage_mins: stoppageTime,
        stoppage: [
          {
            ...(mergedRow.stoppage?.[0] || {}),
            total_stoppage_time: stoppageTime
          }
        ]
      }
    })
  }, [effectiveTotalTime, getEffectiveTotalStoppageMins, setEditedRows])

  // Load production data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      // First, sync any new machines that were added after this header was created
      const syncResult = await syncNewMachinesToHeaderAction(headerId)
      if (syncResult.success && syncResult.data?.added > 0) {
        toast.info(`Added ${syncResult.data.added} new machine(s): ${syncResult.data.machines.join(', ')}`)
      }

      const [detailsResult, setupsResult] = await Promise.all([
        getCardingProductionWithSetupAction(headerId),
        getCardingMachineSetupsAction()
      ])
      
      // Create machine setup map first
      const setupMap = {}
      if (setupsResult.success) {
        setupsResult.data?.forEach(s => {
          setupMap[s.machine_id] = s
        })
        setMachineSetups(setupMap)
      }
      
      if (detailsResult.success) {
        // Override run_time with the shift-based totalTime for each record
        // Also fetch count_mixing from machine setup to ensure it's always current
        const dataWithCorrectValues = (detailsResult.data || []).map(row => {
          const machineSetup = setupMap[row.machine_id]
          return {
            ...row,
            run_time: effectiveTotalTime,  // Use shift-based time from props
            work_time: effectiveTotalTime - toNumber(row.total_stoppage_mins),  // Recalculate work_time
            uti_percent: Math.round(((effectiveTotalTime - toNumber(row.total_stoppage_mins)) / effectiveTotalTime) * 100 * 100) / 100,  // Recalculate UTI%
            count_mixing: machineSetup?.machine?.prodn_mixing || row.count_mixing  // Fetch from machine setup
          }
        })
        const mergedRows = mergeServerRowsWithDrafts(dataWithCorrectValues, setupMap)
        setProductionData(mergedRows)
      }
    } catch (error) {
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, effectiveTotalTime, mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!productionData.length) return

    setProductionData(prev => prev.map(row => {
      const draft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const setup = getEffectiveSetup(row.machine_id)
      const stoppageTime = getEffectiveTotalStoppageMins(row)
      const actHank = toNumber(draft?.act_hank ?? row.act_hank)
      const actProdn = toNumber(draft?.act_prodn ?? row.act_prodn)
      const waste = toNumber(draft?.waste ?? row.waste)

      const calculated = calculateProductionValues(
        actHank,
        actProdn,
        effectiveTotalTime,
        stoppageTime,
        setup
      )

      const hasManualExpProdn = draft && Object.prototype.hasOwnProperty.call(draft, 'exp_prodn')
      const finalExpProdn = hasManualExpProdn
        ? toNumber(draft.exp_prodn)
        : toNumber(calculated.exp_prodn)
      const finalEffi = finalExpProdn > 0 ? (actProdn / finalExpProdn) * 100 : 0

      return {
        ...row,
        ...calculated,
        act_hank: actHank,
        act_prodn: actProdn,
        exp_prodn: Math.round(finalExpProdn * 100) / 100,
        effi_percent: Math.round(finalEffi * 100) / 100,
        waste,
        waste_percent: actProdn > 0 ? Math.round((waste / actProdn) * 100 * 100) / 100 : 0,
        total_stoppage_mins: stoppageTime,
        stoppage: [
          {
            ...(row.stoppage?.[0] || {}),
            total_stoppage_time: stoppageTime
          }
        ]
      }
    }))
  }, [stoppageDraftEdits, setupDraftEdits, machineSetups, effectiveTotalTime, getEffectiveTotalStoppageMins, getEffectiveSetup, productionData.length])

  // Handle input change
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
        
        // Get stoppage from effective values (server + stoppage draft)
        const stoppageTime = getEffectiveTotalStoppageMins(row)
        const setup = getEffectiveSetup(row.machine_id)
        
        // Recalculate based on which field changed
        if (['act_hank', 'act_prodn', 'exp_prodn', 'waste', 'run_time', 'work_time'].includes(field)) {
          const actHank = field === 'act_hank' ? numValue : row.act_hank
          const actProdn = field === 'act_prodn' ? numValue : row.act_prodn
          const waste = field === 'waste' ? numValue : row.waste
          const runTime = field === 'run_time' ? numValue : row.run_time
          const workTime = field === 'work_time' ? numValue : row.work_time

          // Auto-calculate Exp Prodn from formula unless user is editing Exp Prodn directly.
          const autoExpProdn = calculateAutoExpProdn(setup, effectiveTotalTime, toNumber(workTime))
          const expProdn = field === 'exp_prodn' ? numValue : autoExpProdn
          
          // Calculate efficiency (Performance %)
          const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
          
          // Calculate UTI% = WorkTime / TotalTime × 100 (based on actual working time)
          const utiPercent = effectiveTotalTime > 0 ? (workTime / effectiveTotalTime) * 100 : 0
          
          // Calculate Waste%
          const wastePercent = toNumber(actProdn) > 0 ? (toNumber(waste) / toNumber(actProdn)) * 100 : 0
          
          return { 
            ...updatedRow, 
            act_hank: actHank,
            act_prodn: actProdn,
            exp_prodn: Math.round(toNumber(expProdn) * 100) / 100,
            waste: waste,
            run_time: runTime,
            work_time: workTime,
            effi_percent: Math.round(effiPercent * 100) / 100,
            uti_percent: Math.round(utiPercent * 100) / 100,
            waste_percent: Math.round(wastePercent * 100) / 100
          }
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
        employee_name: value
      }
    }))

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, employee_name: value } : row
    ))
  }

  // Handle text field change (count_mixing, etc.)
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
      const updatePromises = Object.entries(editedRows).map(async ([rowId, changes]) => {
        // Get the full row data for recalculation
        const row = productionData.find(r => r.id === rowId)
        if (!row) return null

        const stoppageTime = getEffectiveTotalStoppageMins(row)
        const setup = getEffectiveSetup(row.machine_id)
        
        const actHank = changes.act_hank ?? row.act_hank
        const actProdn = changes.act_prodn ?? row.act_prodn
        
        const calculated = calculateProductionValues(
          actHank,
          actProdn,
          effectiveTotalTime,
          stoppageTime,
          setup
        )

        const wasteValue = toNumber(changes.waste ?? row.waste)
        const wastePercent = toNumber(actProdn) > 0
          ? Math.round((wasteValue / toNumber(actProdn)) * 100 * 100) / 100
          : 0

        const { waste: _ignoredWaste, waste_percent: _ignoredWastePercent, ...calculatedWithoutWaste } = calculated

        const hasManualExpProdn = Object.prototype.hasOwnProperty.call(changes, 'exp_prodn')
        const finalExpProdn = hasManualExpProdn ? toNumber(changes.exp_prodn) : toNumber(calculated.exp_prodn)
        const finalEffiPercent = finalExpProdn > 0 ? (toNumber(actProdn) / finalExpProdn) * 100 : 0

        return updateProductionDetailAction(rowId, {
          ...changes,
          ...calculatedWithoutWaste,
          act_hank: actHank,
          act_prodn: actProdn,
          waste: wasteValue,
          waste_percent: wastePercent,
          exp_prodn: Math.round(finalExpProdn * 100) / 100,
          effi_percent: Math.round(finalEffiPercent * 100) / 100
        })
      }).filter(Boolean)

      await Promise.all(updatePromises)
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
          {productionData.length} machines | Shift Time: {totalTime} mins
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
          <table ref={tableRef} className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">Emp.Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Exp.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Effi%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 whitespace-nowrap">UTI%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Waste</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">RunTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody>
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
                      onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                      placeholder="Type employee name..."
                      cleanCell
                      editingHighlight
                      className="h-9 rounded-none text-sm w-full min-w-35"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis" title={row.count_mixing || ''}>
                    <Input
                      value={row.count_mixing || ''}
                      readOnly
                      className="h-9 text-sm w-full rounded-none border-0 bg-gray-50 text-gray-700 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      title="Count is managed via Machine Setup tab"
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="act_hank">
                    <NumberInput
                      type="number"
                      value={row.act_hank ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_hank', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_hank')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="act_prodn">
                    <NumberInput
                      type="number"
                      value={row.act_prodn ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_prodn', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_prodn')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="exp_prodn">
                    <NumberInput
                      type="number"
                      value={row.exp_prodn ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'exp_prodn', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'exp_prodn')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap ${
                    toNumber(row.effi_percent) >= 100 ? 'text-green-600' : 
                    toNumber(row.effi_percent) >= 90 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {formatNumber(row.effi_percent)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.uti_percent)}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="waste">
                    <NumberInput
                      type="number"
                      value={row.waste ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'waste', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'waste')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.waste_percent)}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 whitespace-nowrap">
                    <Input
                      type="number"
                      value={row.run_time || effectiveTotalTime}
                      onChange={(e) => handleInputChange(row.id, 'run_time', e.target.value)}
                      className="h-9 text-sm text-center tabular-nums w-full rounded-none border-0 bg-gray-50 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      readOnly
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1 whitespace-nowrap">
                    <Input
                      type="number"
                      value={row.work_time || ''}
                      onChange={(e) => handleInputChange(row.id, 'work_time', e.target.value)}
                      className="h-9 text-sm text-center tabular-nums w-full rounded-none border-0 bg-gray-50 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      readOnly
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium text-orange-600 tabular-nums whitespace-nowrap">
                    {row.total_stoppage_mins ?? row.stoppage?.[0]?.total_stoppage_time ?? 0}
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
        <span>
          Avg Effi: {productionData.length > 0 
            ? formatNumber(productionData.reduce((sum, r) => sum + toNumber(r.effi_percent), 0) / productionData.length)
            : '0.00'}%
        </span>
      </div>
    </div>
  )
})

export default CardingProductionTab
