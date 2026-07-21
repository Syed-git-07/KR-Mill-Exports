'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import EmployeeAutocomplete from '@/components/ui/employee-autocomplete'
import {
  getBreakerDrawingProductionWithSetupAction,
  updateBreakerDrawingDetailAction,
  getBreakerDrawingMachineSetupsAction,
  syncNewMachinesToBreakerDrawingHeaderAction
} from '@/app/actions/breaker-drawing-entry'
import { calculateBreakerDrawingValues } from '@/lib/queries/breakerDrawingQueries'
import { BREAKER_DRAWING_FORMULA_FALLBACK, resolveBreakerDrawingFormulaInputs } from '@/lib/breakerDrawingFormulaFallback'
import { NumberInput } from '@/components/ui/number-input'

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

// Constst = (1 / 2.20456 / Hank) * Delivery
const calculateConstst = (setup) => {
  const hankConstant = toNumber(setup?.hank_constant)
  const delivery = toNumber(setup?.delivery) || BREAKER_DRAWING_FORMULA_FALLBACK.delivery
  if (hankConstant <= 0) return 0
  return (1 / 2.20456 / hankConstant) * delivery
}

const normalizeDraftKey = (value) => String(value || '').trim().toLowerCase()

const BreakerDrawingProductionTab = forwardRef(function BreakerDrawingProductionTab({
  headerId,
  totalTime = 0,
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
      if (inp) { inp.focus(); inp.select() } else { targetAuto.click() }
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

  const getEffectiveSetup = useCallback((machineId, setupMap = machineSetups) => {
    const baseSetup = setupMap[machineId]
    if (!baseSetup) return undefined

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
    let normalizedDraft = null
    for (const [key, value] of Object.entries(setupDraftEdits || {})) {
      const normalizedKey = normalizeDraftKey(key)
      if (normalizedKey === setupIdKey || normalizedKey === machineIdKey) {
        normalizedDraft = value
        break
      }
    }

    const draft = normalizedDraft
    return draft ? { ...baseSetup, ...draft } : baseSetup
  }, [machineSetups, setupDraftEdits])

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
      const machineSpeed = setup?.speed ?? mergedRow.machine?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed

      const actHank = draft?.act_hank ?? mergedRow.act_hank ?? 0
      const derivedActProdn = Math.round((actHank * calculateConstst(setup)) * 100) / 100
      const actProdn = draft?.act_prodn ?? mergedRow.act_prodn ?? derivedActProdn
      const waste = draft?.waste ?? mergedRow.waste ?? null

      const calculated = calculateBreakerDrawingValues(
        actHank,
        actProdn,
        totalTime,
        stoppageTime,
        setup,
        machineSpeed,
        waste
      )

      return {
        ...mergedRow,
        ...calculated,
        act_hank: actHank,
        act_prodn: actProdn,
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
  }, [totalTime, getEffectiveTotalStoppageMins, setEditedRows, getEffectiveSetup])

  // Load production data
  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!headerId) return
    const loadKey = `${headerId}|${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) return
    lastLoadKeyRef.current = loadKey
    
    setIsLoading(true)
    try {
      // First, sync any new machines that were added after this header was created
      const syncResult = await syncNewMachinesToBreakerDrawingHeaderAction(headerId)
      if (syncResult?.success && syncResult?.data?.added > 0) {
        toast.info(`Added ${syncResult.data.added} new machine(s): ${syncResult.data.machines.join(', ')}`)
      }

      const [detailsResult, setupsResult] = await Promise.all([
        getBreakerDrawingProductionWithSetupAction(headerId),
        getBreakerDrawingMachineSetupsAction(1, headerId)
      ])
      
      const details = detailsResult?.data || []
      const setups = setupsResult?.data || []
      
      // Create machine setup map (speed already merged from machine table by query)
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      setMachineSetups(setupMap)
      
      // Recalculate display values based on current stoppage times
      // Speed comes from machine table (via setup which merges it)
      const recalculatedDetails = (details || []).map(row => {
        // Source of truth: WorkTime is derived from stoppage total.
        const rawStoppageTime = row.stoppage?.[0]?.total_stoppage_time ?? row.total_stoppage_mins ?? 0
        const stoppageTime = Math.max(0, Math.min(totalTime, toNumber(rawStoppageTime)))
        const setup = setupMap[row.machine_id]
        // Speed priority: machine.speed (source of truth) > setup.speed
        const machineSpeed = setup?.speed ?? row.machine?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed
        
        if (setup) {
          const workTime = totalTime - stoppageTime
          const { hankConstant, stdEfficiencyFactor, delivery, divisorConstant } = resolveBreakerDrawingFormulaInputs(setup, machineSpeed)
          const constst = calculateConstst(setup)
          const actProdn = (row.act_prodn !== null && row.act_prodn !== undefined)
            ? toNumber(row.act_prodn)
            : (toNumber(row.act_hank) * constst)
          
          // Std Prodn = (Speed / Divisor / Hank) × Total Time × Std Effi × Delivery
          const stdProdn = (machineSpeed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery
          // Exp Prodn = Std Prodn × (Work Time / Total Time)
          const expProdn = stdProdn * (workTime / totalTime)
          // Act Effi % = Actual Prodn / Exp Prodn × 100
          const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
          // UTI % = Work Time / Total Time × 100
          const utiPercent = (workTime / totalTime) * 100
          const wastePercent = actProdn > 0 ? (((row.waste ?? 0) / actProdn)) * 100 : 0
          
          return {
            ...row,
            act_prodn: Math.round(actProdn * 100) / 100,
            std_prodn: Math.round(stdProdn * 100) / 100,
            exp_prodn: Math.round(expProdn * 100) / 100,
            effi_percent: Math.round(effiPercent * 100) / 100,
            uti_percent: Math.round(utiPercent * 100) / 100,
            waste_percent: Math.round(wastePercent * 100) / 100,
            work_time: workTime,
            run_time: totalTime
          }
        }
        return row
      })
      
      const mergedRows = mergeServerRowsWithDrafts(recalculatedDetails, setupMap)
      setProductionData(mergedRows)
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, totalTime, mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!productionData.length) return

    setProductionData(prev => prev.map(row => {
      const draft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const setup = getEffectiveSetup(row.machine_id) || machineSetups[row.machine_id]
      const machineSpeed = setup?.speed ?? row.machine?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed
      const stoppageTime = getEffectiveTotalStoppageMins(row)
      const actHank = draft?.act_hank ?? row.act_hank ?? 0
      const derivedActProdn = Math.round((actHank * calculateConstst(setup)) * 100) / 100
      const actProdn = draft?.act_prodn ?? row.act_prodn ?? derivedActProdn
      const waste = draft?.waste ?? row.waste ?? null

      const calculated = calculateBreakerDrawingValues(
        actHank,
        actProdn,
        totalTime,
        stoppageTime,
        setup,
        machineSpeed,
        waste
      )

      return {
        ...row,
        ...calculated,
        act_hank: actHank,
        act_prodn: actProdn,
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
  }, [stoppageDraftEdits, setupDraftEdits, machineSetups, totalTime, getEffectiveTotalStoppageMins, getEffectiveSetup, productionData.length])

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
        
        // Get stoppage time from stoppage entry
        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time ?? 0
        const setup = getEffectiveSetup(row.machine_id) || machineSetups[row.machine_id]
        // Speed from machine table (source of truth)
        const machineSpeed = setup?.speed ?? row.machine?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed
        const workTime = totalTime - Math.max(0, Math.min(totalTime, toNumber(stoppageTime)))
        
        // Recalculate based on which field changed
        if (['act_hank', 'act_prodn', 'waste'].includes(field)) {
          const actHank = field === 'act_hank' ? numValue : row.act_hank
          const waste = field === 'waste' ? numValue : row.waste
          const constst = calculateConstst(setup)
          const actProdn = field === 'act_prodn' ? numValue : (actHank * constst)
          
          // Recalculate std_prodn and exp_prodn from machine speed
          const { hankConstant, stdEfficiencyFactor, delivery, divisorConstant } = resolveBreakerDrawingFormulaInputs(setup, machineSpeed)
          const stdProdn = (machineSpeed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery
          const expProdn = stdProdn * (workTime / totalTime)
          
          // Calculate efficiency: Act Effi % = Actual Prodn / Exp Prodn × 100
          const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
          
          // Calculate UTI: UTI % = Work Time / Total Time × 100 (WorkTime is actual running time)
          const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0
          
          // Calculate Waste%: Waste % = Waste / Actual Prodn × 100
          const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0
          
          return { 
            ...updatedRow, 
            act_hank: actHank,
            act_prodn: Math.round(actProdn * 100) / 100,
            exp_prodn: Math.round(expProdn * 100) / 100,
            waste: waste,
            run_time: totalTime,
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

        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time || 0
        const setup = getEffectiveSetup(row.machine_id) || machineSetups[row.machine_id]
        // Speed from machine table (source of truth)
        const machineSpeed = setup?.speed ?? row.machine?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed
        
        // Get actual values - either from changes or from current row
        const actHank = changes.act_hank ?? row.act_hank ?? 0
        const derivedActProdn = Math.round((actHank * calculateConstst(setup)) * 100) / 100
        const actProdn = changes.act_prodn ?? row.act_prodn ?? derivedActProdn
        const waste = changes.waste ?? row.waste ?? null
        
        // Use Breaker Drawing specific calculations with setup and machine speed
        const calculated = calculateBreakerDrawingValues(
          actHank,
          actProdn,
          totalTime,
          stoppageTime,
          setup,
          machineSpeed  // Pass machine speed explicitly (source of truth)
        )

        // Include waste in calculated values
        calculated.waste = waste
        calculated.waste_percent = actProdn > 0 ? Math.round((((waste ?? 0) / actProdn) * 100) * 100) / 100 : 0

        return updateBreakerDrawingDetailAction(rowId, {
          employee_name: changes.employee_name ?? row.employee_name,
          prodn_mixing: changes.prodn_mixing ?? row.prodn_mixing,
          act_hank: actHank,
          act_prodn: actProdn,
          ...calculated
        })
      }).filter(Boolean)

      const results = await Promise.all(updatePromises)
      
      // Check if any updates failed
      const failed = results.filter(r => !r?.success)
      if (failed.length > 0) {
        throw new Error(`Failed to update ${failed.length} record(s)`)
      }
      const savedCount = Object.keys(editedRows).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Production data saved successfully')
      }
      
      // Reload data
      await loadData({ force: true })
      if (!skipParentRefresh) {
        onRefresh?.()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving production data:', error)
      toast.error(error.message || 'Failed to save production data')
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
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Exp.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Act.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 whitespace-nowrap">UTI</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Waste</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">RunTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Total Stopp</th>
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
                      data-row={index}
                      data-col="emp_name"
                      cleanCell
                      editingHighlight
                      className="h-9 rounded-none text-sm w-full min-w-35"
                      onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <Input
                      value={row.prodn_mixing || ''}
                      onChange={(e) => handleTextChange(row.id, 'prodn_mixing', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-left text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="act_hank">
                    <NumberInput
                      type="number"
                      value={row.act_hank ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_hank', e.target.value)}
                      data-row={index}
                      data-col="act_hank"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_hank')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="act_prodn">
                    <NumberInput
                      type="number"
                      value={row.act_prodn ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_prodn', e.target.value)}
                      data-row={index}
                      data-col="act_prodn"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_prodn')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="exp_prodn">
                    <NumberInput
                      type="number"
                      value={row.exp_prodn ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'exp_prodn', e.target.value)}
                      data-row={index}
                      data-col="exp_prodn"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'exp_prodn')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium ${
                    row.effi_percent >= 100 ? 'text-blue-600' : 
                    row.effi_percent >= 90 ? 'text-yellow-600' : 'text-red-600'
                  } tabular-nums whitespace-nowrap`}>
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
                      data-row={index}
                      data-col="waste"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'waste')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.waste_percent)}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 whitespace-nowrap">
                    {row.run_time || totalTime}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 whitespace-nowrap">
                    {row.work_time || totalTime}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-orange-600 font-medium tabular-nums whitespace-nowrap">
                    {row.total_stoppage_mins ?? 0}
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
            Avg Effi: {productionData.length > 0 
              ? formatNumber(productionData.reduce((sum, r) => sum + toNumber(r.effi_percent), 0) / productionData.length)
              : '0.00'}%
          </span>
          <span>
            Total Prodn: {formatNumber(productionData.reduce((sum, r) => sum + toNumber(r.act_prodn), 0))} kg
          </span>
        </div>
      </div>

    </div>
  )
})

export default BreakerDrawingProductionTab
