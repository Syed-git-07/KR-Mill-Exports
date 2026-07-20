'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import EmployeeAutocomplete from "@/components/ui/employee-autocomplete"
import {
  getLapFormerProductionWithSetupAction,
  updateLapFormerDetailAction,
  getLapFormerMachineSetupsAction
} from '@/app/actions/lapFormerEntryActions'
import { calculateLapFormerValues } from '@/lib/queries/lapFormerQueries'
import {
  getLapFormerActProdnConstant,
  resolveLapFormerFormulaInputs,
} from '@/lib/lapFormerFormulaFallback'
import { resolveLapFormerShiftFallbackTime } from '@/lib/lapFormerShiftFallback'
import { NumberInput } from '@/components/ui/number-input'

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    return parseFloat(normalized) || 0
  }
  return parseFloat(String(value?.toString?.() || '0').replace(/,/g, '').trim()) || 0
}

const normalizeDraftKey = (value) => String(value ?? '').trim().toLowerCase()

const findDraftByKeys = (drafts, ...keys) => {
  if (!drafts) return undefined

  for (const key of keys) {
    if (key === undefined || key === null) continue
    if (drafts[key] !== undefined) return drafts[key]
    const asString = String(key)
    if (drafts[asString] !== undefined) return drafts[asString]
  }

  const normalizedKeys = new Set(
    keys
      .filter(key => key !== undefined && key !== null)
      .map(key => normalizeDraftKey(key))
      .filter(Boolean)
  )

  if (normalizedKeys.size === 0) return undefined

  for (const [draftKey, draftValue] of Object.entries(drafts)) {
    if (normalizedKeys.has(normalizeDraftKey(draftKey))) {
      return draftValue
    }
  }

  return undefined
}

// Constst = (1 / 2.20456 / Hank) * Delivery
const calculateConstst = (setup) => {
  const constst = getLapFormerActProdnConstant(setup)
  return toNumber(constst)
}

const LapFormerProductionTab = forwardRef(function LapFormerProductionTab({
  headerId,
  totalTime = resolveLapFormerShiftFallbackTime(1),
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  setupDraftEdits = {},
  stoppageDraftEdits = {}
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

  const getEffectiveTotalStoppageMins = useCallback((row) => {
    const stoppageEntry = Array.isArray(row.stoppage) ? row.stoppage[0] : row.stoppage
    const baseTotal = stoppageEntry?.total_stoppage_time ?? row.total_stoppage_mins ?? (totalTime - (row.work_time || totalTime))

    if (!stoppageEntry?.id) return baseTotal

    const draft = findDraftByKeys(stoppageDraftEdits, stoppageEntry.id)
    if (!draft) return baseTotal

    const s1 = toNumber(draft.stoppage1_time ?? stoppageEntry.stoppage1_time ?? 0)
    const s2 = toNumber(draft.stoppage2_time ?? stoppageEntry.stoppage2_time ?? 0)
    const s3 = toNumber(draft.stoppage3_time ?? stoppageEntry.stoppage3_time ?? 0)
    const s4 = toNumber(draft.stoppage4_time ?? stoppageEntry.stoppage4_time ?? 0)
    return s1 + s2 + s3 + s4
  }, [stoppageDraftEdits, totalTime])

  const getEffectiveSetup = useCallback((machineId) => {
    const baseSetup = machineSetups[machineId]
    if (!baseSetup) return undefined
    const draft = findDraftByKeys(setupDraftEdits, baseSetup.id, baseSetup.machine_id, machineId)
    return draft ? { ...baseSetup, ...draft } : baseSetup
  }, [machineSetups, setupDraftEdits])

  const recalculateDisplayRow = useCallback((row, setupMap = machineSetups) => {
    const setup = getEffectiveSetup(row.machine_id) || setupMap[row.machine_id]
    if (!setup) return row

    const totalStoppageMins = getEffectiveTotalStoppageMins(row)
    const { speed: machineSpeed, hankConstant, stdEfficiencyFactor, delivery, divisorConstant } = resolveLapFormerFormulaInputs(setup, row.machine?.speed)
    const constst = calculateConstst(setup)
    const productionDraft = findDraftByKeys(editedRowsRef.current, row.id)

    let actHank = toNumber(row.act_hank)
    let actProdn = (row.act_prodn !== null && row.act_prodn !== undefined)
      ? toNumber(row.act_prodn)
      : (actHank * constst)
    if (productionDraft?.act_hank !== undefined && productionDraft?.act_prodn === undefined) {
      actProdn = actHank * constst
    } else if (productionDraft?.act_prodn !== undefined && productionDraft?.act_hank === undefined && constst > 0) {
      actHank = actProdn / constst
    }
    const waste = toNumber(row.waste)

    const workTime = totalTime - totalStoppageMins
    const stdProdn = (machineSpeed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery
    const calculatedExpProdn = stdProdn * (workTime / totalTime)
    const expProdn = productionDraft?.exp_prodn !== undefined
      ? toNumber(productionDraft.exp_prodn)
      : calculatedExpProdn
    const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
    const utiPercent = (workTime / totalTime) * 100
    const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

    return {
      ...row,
      act_hank: actHank,
      act_prodn: Math.round(actProdn * 100) / 100,
      std_prodn: Math.round(stdProdn * 100) / 100,
      exp_prodn: Math.round(expProdn * 100) / 100,
      effi_percent: Math.round(effiPercent * 100) / 100,
      uti_percent: Math.round(utiPercent * 100) / 100,
      waste,
      waste_percent: Math.round(wastePercent * 100) / 100,
      work_time: workTime,
      run_time: totalTime,
      total_stoppage_mins: totalStoppageMins
    }
  }, [machineSetups, totalTime, getEffectiveTotalStoppageMins, getEffectiveSetup])

  const mergeServerRowsWithDrafts = useCallback((rows, setupMap) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))

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
      const draft = findDraftByKeys(drafts, row.id)
      if (!draft) return row

      const mergedRow = { ...row, ...draft }
      const totalStoppageMins = getEffectiveTotalStoppageMins(mergedRow)
      const setup = getEffectiveSetup(mergedRow.machine_id) || setupMap[mergedRow.machine_id]
      const { speed: machineSpeed, hankConstant, stdEfficiencyFactor, delivery, divisorConstant } = resolveLapFormerFormulaInputs(setup, mergedRow.machine?.speed)
      const constst = calculateConstst(setup)

      let actHank = draft.act_hank ?? mergedRow.act_hank ?? 0
      let actProdn = draft.act_prodn ?? mergedRow.act_prodn ?? (actHank * constst)
      if (draft.act_prodn !== undefined && draft.act_hank === undefined) {
        actHank = constst > 0 ? (actProdn / constst) : actHank
      }
      const waste = draft.waste ?? mergedRow.waste ?? 0

      const workTime = mergedRow.work_time && mergedRow.work_time < totalTime
        ? mergedRow.work_time
        : totalTime - totalStoppageMins

      const stdProdn = (machineSpeed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery
      const calculatedExpProdn = stdProdn * (workTime / totalTime)
      const expProdn = draft.exp_prodn !== undefined
        ? toNumber(draft.exp_prodn)
        : calculatedExpProdn
      const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
      const utiPercent = (workTime / totalTime) * 100
      const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0

      return {
        ...mergedRow,
        act_hank: actHank,
        act_prodn: Math.round(actProdn * 100) / 100,
        std_prodn: Math.round(stdProdn * 100) / 100,
        exp_prodn: Math.round(expProdn * 100) / 100,
        effi_percent: Math.round(effiPercent * 100) / 100,
        uti_percent: Math.round(utiPercent * 100) / 100,
        waste,
        waste_percent: Math.round(wastePercent * 100) / 100,
        work_time: workTime,
        run_time: totalTime,
        total_stoppage_mins: totalStoppageMins
      }
    })
  }, [setEditedRows, totalTime, getEffectiveTotalStoppageMins, getEffectiveSetup])

  // Load production data
  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!headerId) return
    const loadKey = `${headerId}|${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) {
      return
    }
    lastLoadKeyRef.current = loadKey
    
    setIsLoading(true)
    try {
      const [detailsResult, setupsResult] = await Promise.all([
        getLapFormerProductionWithSetupAction(headerId),
        getLapFormerMachineSetupsAction()
      ])
      
      if (!detailsResult.success) {
        throw new Error(detailsResult.error)
      }
      if (!setupsResult.success) {
        throw new Error(setupsResult.error)
      }
      
      const details = detailsResult.data
      const setups = setupsResult.data
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      setMachineSetups(setupMap)
      
      // Recalculate display values based on current stoppage times
      const recalculatedDetails = (details || []).map(row => {
        // Get total stoppage from stoppage entry (array access like Carding)
        // Priority: stoppage entry > DB stored value > 0
        const totalStoppageMins = row.stoppage?.[0]?.total_stoppage_time ?? (totalTime - (row.work_time || totalTime))
        const setup = getEffectiveSetup(row.machine_id) || setupMap[row.machine_id]
        const { speed: machineSpeed, hankConstant, stdEfficiencyFactor, delivery, divisorConstant } = resolveLapFormerFormulaInputs(setup, row.machine?.speed)
        
        // Use DB work_time if available and valid, otherwise calculate
        const workTime = row.work_time && row.work_time < totalTime 
          ? row.work_time 
          : totalTime - totalStoppageMins
          
        if (setup) {
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
          const waste = toNumber(row.waste)
          const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0
          
          return {
            ...row,
            act_prodn: Math.round(actProdn * 100) / 100,
            std_prodn: Math.round(stdProdn * 100) / 100,
            exp_prodn: Math.round(expProdn * 100) / 100,
            effi_percent: Math.round(effiPercent * 100) / 100,
            uti_percent: Math.round(utiPercent * 100) / 100,
            waste,
            waste_percent: Math.round(wastePercent * 100) / 100,
            work_time: workTime,  // Running Time = Total Time - Stoppage
            run_time: totalTime,
            total_stoppage_mins: totalStoppageMins  // Store for display
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
  }, [headerId, totalTime, mergeServerRowsWithDrafts, getEffectiveSetup])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!productionData.length) return
    setProductionData(prev => prev.map(row => recalculateDisplayRow(row, machineSetups)))
  }, [stoppageDraftEdits, setupDraftEdits, totalTime, machineSetups, recalculateDisplayRow, productionData.length])

  // Handle input change with dynamic recalculation
  const handleInputChange = (rowId, field, value) => {
    const numValue = toNumber(value)
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: numValue
      }
    }))

    // Update production data for display with dynamic recalculation
    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        
        const setup = getEffectiveSetup(row.machine_id) || machineSetups[row.machine_id]
        const { speed: machineSpeed, hankConstant, stdEfficiencyFactor, delivery, divisorConstant } = resolveLapFormerFormulaInputs(setup, row.machine?.speed)
        
        // Get current or updated values
        const actHank = field === 'act_hank' ? numValue : row.act_hank
        const constst = calculateConstst(setup)
        const actProdn = field === 'act_prodn' ? numValue : (actHank * constst)
        const waste = field === 'waste' ? numValue : row.waste
        
        const totalStoppageMins = getEffectiveTotalStoppageMins(row)
        const workTime = totalTime - totalStoppageMins
        
        // Std Prodn = (Speed / Divisor / Hank) × Total Time × Std Effi × Delivery
        const stdProdn = (machineSpeed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery
        
        // Exp Prodn = Std Prodn × (Work Time / Total Time)
        const expProdn = field === 'exp_prodn' ? numValue : (stdProdn * (workTime / totalTime))
        
        // Act Effi % = Actual Prodn / Exp Prodn × 100
        const effiPercent = expProdn > 0 ? (actProdn / expProdn) * 100 : 0
        
        // UTI % = Work Time / Total Time × 100
        const utiPercent = totalTime > 0 ? (workTime / totalTime) * 100 : 0
        
        // Waste % = Waste / Actual Prodn × 100
        const wastePercent = actProdn > 0 ? (waste / actProdn) * 100 : 0
        
        return { 
          ...updatedRow, 
          act_hank: actHank,
          act_prodn: Math.round(actProdn * 100) / 100,
          std_prodn: Math.round(stdProdn * 100) / 100,
          exp_prodn: Math.round(expProdn * 100) / 100,
          waste: waste,
          run_time: totalTime,
          work_time: workTime,
          total_stoppage_mins: totalStoppageMins,
          effi_percent: Math.round(effiPercent * 100) / 100,
          uti_percent: Math.round(utiPercent * 100) / 100,
          waste_percent: Math.round(wastePercent * 100) / 100
        }
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

  // Handle text field change
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
    const currentEdits = editedRowsRef.current || editedRows || {}

    if (Object.keys(currentEdits).length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const updatePromises = Object.entries(currentEdits).map(([rowId, changes]) => {
        const row = productionData.find(r => r.id === rowId)
        if (!row) return null

        const stoppageTime = row.stoppage?.[0]?.total_stoppage_time ?? row.total_stoppage_mins ?? 0
        const setup = getEffectiveSetup(row.machine_id) || machineSetups[row.machine_id]
        const { speed: machineSpeed } = resolveLapFormerFormulaInputs(setup, row.machine?.speed)
        
        const actHank = toNumber(changes.act_hank ?? row.act_hank ?? 0)
        const derivedActProdn = Math.round((actHank * calculateConstst(setup)) * 100) / 100
        const actProdn = toNumber(changes.act_prodn ?? row.act_prodn ?? derivedActProdn)
        const waste = toNumber(changes.waste ?? row.waste ?? 0)
        
        // Recalculate production metrics using setup-driven formula inputs
        const calculated = calculateLapFormerValues(
          actHank,
          actProdn,
          totalTime,
          stoppageTime,
          setup,
          machineSpeed
        )

        if (changes.exp_prodn !== undefined) {
          const manualExpProdn = toNumber(changes.exp_prodn)
          calculated.exp_prodn = Math.round(manualExpProdn * 100) / 100
          calculated.effi_percent = manualExpProdn > 0
            ? Math.round((actProdn / manualExpProdn) * 100 * 100) / 100
            : 0
        }

        calculated.waste = waste
        calculated.waste_percent = actProdn > 0 ? Math.round((waste / actProdn) * 100 * 100) / 100 : 0

        const wastePercent = actProdn > 0 ? Math.round((waste / actProdn) * 100 * 100) / 100 : 0

        return updateLapFormerDetailAction(rowId, {
          ...calculated,
          employee_name: changes.employee_name ?? row.employee_name,
          prodn_mixing: changes.prodn_mixing ?? row.prodn_mixing,
          act_hank: actHank,
          act_prodn: actProdn,
          waste,
          waste_percent: wastePercent
        })
      }).filter(Boolean)

      const results = await Promise.all(updatePromises)
      const failed = results.filter(r => !r.success)
      if (failed.length > 0) {
        throw new Error('Some updates failed')
      }
      
      const savedCount = Object.keys(currentEdits).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Production data saved successfully')
      }
      
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
    discardChanges,
    refreshData: () => loadData({ force: true })
  }), [handleSave, editedRows, isSaving, discardChanges, loadData])

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

      {/* Production Grid - Layout matches Carding Entry */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-125 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-44 whitespace-nowrap">Emp.Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Exp.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Act.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">UTI%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Waste</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 bg-blue-700 whitespace-nowrap">RunTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 bg-blue-700 whitespace-nowrap">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 bg-orange-600 whitespace-nowrap">TotStop</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {productionData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    {row.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <EmployeeAutocomplete
                      value={row.employee_name || ''}
                      onChange={(value) => handleEmployeeChange(row.id, value)}
                      placeholder="Type employee name..."
                      cleanCell
                      editingHighlight
                      className="h-9 rounded-none text-sm w-full min-w-35"
                      data-row={index}
                      data-col="emp_name"
                      onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <Input
                      value={row.prodn_mixing || machineSetups[row.machine_id]?.prodn_mixing || row.machine?.prodn_mixing || ''}
                      readOnly
                      className="h-9 w-full rounded-none border-0 bg-gray-50 px-2 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 cursor-not-allowed whitespace-nowrap overflow-hidden text-ellipsis"
                      title="Mixing is managed via Machine Setup tab"
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.act_hank ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_hank', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="act_hank"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_hank')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.act_prodn ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_prodn', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm font-medium text-blue-600 tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="act_prodn"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_prodn')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.exp_prodn ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'exp_prodn', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="exp_prodn"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'exp_prodn')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap ${
                    Number(row.effi_percent) >= 100 ? 'text-green-600' : 
                    Number(row.effi_percent) >= 90 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {row.effi_percent != null ? Number(row.effi_percent).toFixed(2) : '0.00'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {row.uti_percent != null ? Number(row.uti_percent).toFixed(2) : '0.00'}
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.waste ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'waste', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="waste"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'waste')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {row.waste_percent != null ? Number(row.waste_percent).toFixed(2) : '0.00'}
                  </td>
                  {/* RunTime = Total Time - Fixed display only */}
                  <td className="border border-gray-300 px-2 py-1 text-center bg-blue-50 font-medium tabular-nums whitespace-nowrap">
                    {row.run_time || totalTime}
                  </td>
                  {/* WorkTime = TotalTime - Stoppage (Running Time) - Calculated display only */}
                  <td className="border border-gray-300 px-2 py-1 text-center bg-blue-50 font-medium tabular-nums whitespace-nowrap">
                    {row.work_time || totalTime}
                  </td>
                  {/* Total Stoppage Mins - Display only (from Stoppage Entry) */}
                  <td className="border border-gray-300 px-2 py-1 text-center bg-orange-50 font-medium text-orange-700 tabular-nums whitespace-nowrap">
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
        <div className="flex gap-4">
          <span>
            Avg Effi: {productionData.length > 0 
              ? (productionData.reduce((sum, r) => sum + Number(r.effi_percent || 0), 0) / productionData.length).toFixed(2) 
              : 0}%
          </span>
          <span>
            Total Prodn: {productionData.reduce((sum, r) => sum + Number(r.act_prodn || 0), 0).toFixed(2)} kg
          </span>
        </div>
      </div>

    </div>
  )
})

export default LapFormerProductionTab
