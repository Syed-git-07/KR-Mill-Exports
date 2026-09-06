'use client'

import { useEntryRowSelection } from '@/components/common/EntryRowSelection'

import { confirmAction } from '@/lib/confirmation'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'
import EmployeeAutocomplete from "@/components/ui/employee-autocomplete"
import {
  getFinisherDrawingEntryTabDataAction,
  runFinisherDrawingEntryBatchAction,
} from '@/app/actions/finisher-drawing-entry'
import { calculateFinisherDrawingValues } from '@/lib/queries/finisherDrawingEntryQueries'
import {
  FINISHER_DRAWING_FORMULA_FALLBACK,
  resolveFinisherDrawingFormulaInputs,
  getFinisherDrawingActProdnConstant,
} from '@/lib/finisherDrawingFormulaFallback'
import {
  findDraftByKeys,
  getEffectiveStoppageTotal,
  mergeSetupDraft,
  selectRowsForDependentCommit
} from '@/lib/entryDraftSync'
import { NumberInput } from '@/components/ui/number-input'

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeDraftKey = (value) => String(value || '').trim().toLowerCase()

const FinisherDrawingProductionTab = forwardRef(function FinisherDrawingProductionTab({
  headerId,
  totalTime = 0,
  shift = 1,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  setupDraftEdits,
  stoppageDraftEdits
}, ref) {
  const [productionData, setProductionData] = useState([])
  const { getRowProps } = useEntryRowSelection()
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

  // When using the shared-prop path (onSharedDraftEditsChange is provided), the ref is already
  // written synchronously inside setEditedRows BEFORE onSharedDraftEditsChange is called.
  // Letting the useEffect fire here would clobber the ref with a stale sharedDraftEdits value
  // (e.g. {waste:6} arriving from a prior parent render while the ref is already at {waste:6.78}).
  // Fix: only sync state→ref for the local-state path where no synchronous write exists.
  useEffect(() => {
    if (!onSharedDraftEditsChange) {
      editedRowsRef.current = editedRows
    }
  }, [editedRows, onSharedDraftEditsChange])

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

  const getEffectiveTotalStoppageMins = useCallback(
    (row) => getEffectiveStoppageTotal(row, stoppageDraftEdits),
    [stoppageDraftEdits]
  )

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
    for (const [key, value] of Object.entries(setupDraftEdits || {})) {
      const normalizedKey = normalizeDraftKey(key)
      if (normalizedKey === setupIdKey || normalizedKey === machineIdKey) {
        return { ...baseSetup, ...value }
      }
    }

    return baseSetup
  }, [machineSetups, setupDraftEdits])
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
      const draft = drafts[row.id] || drafts[String(row.id)]
      const stoppageTime = getEffectiveTotalStoppageMins(row)

      const mergedRow = draft ? { ...row, ...draft } : { ...row }

      const setup = getEffectiveSetup(mergedRow.machine_id, setupMap)
      const machineSpeed = setup?.speed ?? mergedRow.machine?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed
      const constant = getFinisherDrawingActProdnConstant(setup)
      let actHank = draft?.act_hank ?? mergedRow.act_hank ?? 0
      actHank = parseFloat(actHank) || 0
      let actProdn = actHank * constant
      actProdn = parseFloat(actProdn) || 0
      const waste = parseFloat(draft?.waste ?? mergedRow.waste) || 0

      const calculated = calculateFinisherDrawingValues(
        actHank,
        actProdn,
        totalTime,
        stoppageTime,
        setup,
        machineSpeed,
        waste
      )

      calculated.act_prodn = Math.round(actProdn * 100) / 100

      return {
        ...mergedRow,
        ...calculated,
        act_hank: actHank,
        act_prodn: calculated.act_prodn,
        waste,
        total_stoppage_mins: stoppageTime,
        stoppage: [
          {
            ...(Array.isArray(mergedRow.stoppage) ? mergedRow.stoppage[0] : mergedRow.stoppage || {}),
            total_stoppage_time: stoppageTime
          }
        ]
      }
    })
  }, [setEditedRows, totalTime, getEffectiveTotalStoppageMins, getEffectiveSetup])

  // Recalculate display when stoppageDraftEdits, machineSetups, or totalTime change.
  // FIX: waste is read from editedRowsRef.current first (the authoritative in-memory draft),
  // so stoppageTab edits can never clobber a user-entered waste value even if the parent
  // sharedDraftEdits prop hasn't re-propagated yet.
  useEffect(() => {
    if (!productionData.length) return

    setProductionData(prev => prev.map(row => {
      const draft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const setup = getEffectiveSetup(row.machine_id) || machineSetups[row.machine_id]
      const machineSpeed = setup?.speed ?? row.machine?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed
      const constant = getFinisherDrawingActProdnConstant(setup)
      const stoppageTime = getEffectiveTotalStoppageMins(row)
      let actHank = draft?.act_hank ?? row.act_hank ?? 0
      actHank = parseFloat(actHank) || 0
      let actProdn = actHank * constant
      actProdn = parseFloat(actProdn) || 0

      // Always prefer the draft's waste (user's in-memory edit) over the row's display value,
      // which may lag if sharedDraftEdits prop propagation hasn't completed yet.
      const draftWaste = editedRowsRef.current?.[row.id]?.waste ?? editedRowsRef.current?.[String(row.id)]?.waste
      const waste = Number.isFinite(draftWaste) ? draftWaste : (parseFloat(row.waste) || 0)

      const calculated = calculateFinisherDrawingValues(
        actHank,
        actProdn,
        totalTime,
        stoppageTime,
        setup,
        machineSpeed,
        waste
      )

      calculated.act_prodn = Math.round(actProdn * 100) / 100

      return {
        ...row,
        ...calculated,
        act_hank: actHank,
        act_prodn: calculated.act_prodn,
        waste,
        total_stoppage_mins: stoppageTime,
        stoppage: [
          {
            ...(Array.isArray(row.stoppage) ? row.stoppage[0] : row.stoppage || {}),
            total_stoppage_time: stoppageTime
          }
        ]
      }
    }))
  }, [stoppageDraftEdits, setupDraftEdits, machineSetups, totalTime, getEffectiveTotalStoppageMins, getEffectiveSetup, productionData.length])

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
      const result = await getFinisherDrawingEntryTabDataAction('production', { headerId, shift })
      if (!result.success) throw new Error(result.error || 'Failed to load Finisher Drawing production data')
      const { syncResult, detailsResult, setupsResult } = result.data
      if (syncResult.success && syncResult.data.added > 0) {
        toast.info(`Added ${syncResult.data.added} new machine(s): ${syncResult.data.machines.join(', ')}`)
      }
      if (!detailsResult.success) throw new Error(detailsResult.error || 'Failed to load production details')
      if (!setupsResult.success) throw new Error(setupsResult.error || 'Failed to load machine setups')
      
      const details = detailsResult.success ? detailsResult.data : []
      const setups = setupsResult.success ? setupsResult.data : []
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      setMachineSetups(setupMap)
      
      // Recalculate display values based on current stoppage times and current setup/master inputs.
      const recalculatedDetails = (details || []).map(row => {
        // Handle stoppage - could be array or object depending on Supabase relationship
        const stoppageEntry = Array.isArray(row.stoppage) ? row.stoppage[0] : row.stoppage
        const stoppageTime = stoppageEntry?.total_stoppage_time ?? 0
        
        const setup = getEffectiveSetup(row.machine_id, setupMap)
        const machineSpeed = setup?.speed ?? row.machine?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed
        // Get mixing from machine table (source of truth)
        const machineMixing = row.machine?.prodn_mixing || setup?.mixing || row.prodn_mixing
        const effectiveWaste = parseFloat(row.waste) || 0
        const effectiveActProdn = parseFloat(row.act_prodn) || 0

        const calculated = calculateFinisherDrawingValues(
          row.act_hank || 0,
          row.act_prodn || 0,
          totalTime,
          stoppageTime,
          setup,
          machineSpeed,
          effectiveWaste
        )

        return {
          ...row,
          ...calculated,
          prodn_mixing: machineMixing,
          waste: effectiveWaste,
          waste_percent: effectiveActProdn > 0 ? Math.round((effectiveWaste / effectiveActProdn) * 100 * 100) / 100 : 0,
        }
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
  }, [headerId, shift, totalTime, mergeServerRowsWithDrafts, getEffectiveSetup])

  useServerDataLoader(loadData, [headerId, totalTime])

  // Handle input change — mirrors Spinning module pattern:
  // 1. Find current row synchronously via productionData.find()
  // 2. Calculate ALL derived values synchronously BEFORE any state setter
  // 3. Commit to draft (setEditedRows) first
  // 4. Then update display (setProductionData)
  // This avoids the React 18 batching bug where calculatedDraft was populated
  // inside setProductionData's deferred updater, causing setEditedRows to skip.
  const handleInputChange = (rowId, field, value) => {
    const rawValue = String(value ?? '').trim()
    const parsedValue = Number.parseFloat(rawValue)
    const hasNumericInput = rawValue !== '' && Number.isFinite(parsedValue)
    const numValue = hasNumericInput ? parsedValue : 0

    // Partial decimal: "6." or "6.7e" etc — do NOT commit to draft (display-only)
    const isPartialDecimal = hasNumericInput && (
      rawValue.endsWith('.') || rawValue.endsWith('e') ||
      rawValue.endsWith('e+') || rawValue.endsWith('e-') || rawValue.endsWith('-')
    )

    // Waste: also skip empty/non-numeric states entirely
    if (field === 'waste' && (!hasNumericInput || isPartialDecimal)) {
      return
    }

    // ── Step 1: Find row synchronously (like Spinning's .find() before state updates) ──
    const currentRow = productionData.find(r => r.id === rowId || String(r.id) === String(rowId))
    if (!currentRow) return

    const existingDraft = editedRowsRef.current?.[rowId] || editedRowsRef.current?.[String(rowId)] || null
    const setup = getEffectiveSetup(currentRow.machine_id) || machineSetups[currentRow.machine_id]
    const machineSpeed = setup?.speed ?? currentRow.machine?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed

    // ── Step 2: Compute all derived values synchronously ──
    let actHank = field === 'act_hank' ? numValue : (Number(currentRow.act_hank) || 0)
    const constant = getFinisherDrawingActProdnConstant(setup)
    let actProdn = field === 'act_prodn' ? numValue : (Number(currentRow.act_prodn) || 0)
    if (field === 'act_hank') actProdn = numValue * constant
    if (field === 'act_prodn') actHank = constant > 0 ? numValue / constant : 0

    const waste = field === 'waste'
      ? numValue
      : (Number.isFinite(existingDraft?.waste) ? existingDraft.waste : (Number(currentRow.waste) || 0))
    const runTime  = field === 'run_time'  ? numValue : (Number(currentRow.run_time)  || totalTime)
    const workTime = field === 'work_time' ? numValue : (Number(currentRow.work_time) || totalTime)

    const updatedRowForStoppage = { ...currentRow, [field]: numValue }
    const stoppageTime = getEffectiveTotalStoppageMins(updatedRowForStoppage) // eslint-disable-line no-unused-vars

    let expProdn = field === 'exp_prodn' ? numValue : (Number(currentRow.exp_prodn) || 0)
    if (field === 'work_time' || field === 'act_hank') {
      const formula = resolveFinisherDrawingFormulaInputs(setup, machineSpeed)
      const stdProdn = (formula.speed / formula.divisorConstant / formula.hankConstant) * totalTime * formula.stdEfficiencyFactor * formula.delivery
      expProdn = stdProdn * ((field === 'work_time' ? numValue : workTime) / totalTime)
    }

    const roundedActProdn    = Math.round(actProdn   * 100) / 100
    const roundedExpProdn    = Math.round(expProdn   * 100) / 100
    const roundedEffiPercent = Math.round((expProdn > 0 ? (actProdn  / expProdn) * 100 : 0) * 100) / 100
    const roundedUtiPercent  = Math.round((totalTime > 0 ? (workTime / totalTime) * 100 : 0) * 100) / 100
    const roundedWastePercent = Math.round((actProdn > 0 ? (waste / actProdn) * 100 : 0) * 100) / 100

    const computedValues = {
      act_hank: actHank,
      act_prodn: roundedActProdn,
      exp_prodn: roundedExpProdn,
      waste,
      run_time: runTime,
      work_time: workTime,
      effi_percent: roundedEffiPercent,
      uti_percent: roundedUtiPercent,
      waste_percent: roundedWastePercent,
    }

    // ── Step 3: Commit to draft FIRST (like Spinning's setEditedRows before setProductionData) ──
    if (!isPartialDecimal) {
      const draftPayload = { [field]: numValue, ...computedValues }
      const nextDrafts = {
        ...(editedRowsRef.current || {}),
        [rowId]: { ...(editedRowsRef.current?.[rowId] || {}), ...draftPayload }
      }
      setEditedRows(nextDrafts)
    }

    // ── Step 4: Update display state ──
    setProductionData(prev => prev.map(row =>
      (row.id === rowId || String(row.id) === String(rowId))
        ? { ...row, [field]: numValue, ...computedValues }
        : row
    ))
  }

  // Handle employee name change
  const handleEmployeeChange = (rowId, value, employee) => {
    const previousDrafts = editedRowsRef.current || {}
    const nextDrafts = {
      ...previousDrafts,
      [rowId]: {
        ...(previousDrafts[rowId] || {}),
        employee_name: value,
        payroll_employee_id: employee?.payroll_employee_id ?? null
      }
    }
    setEditedRows(nextDrafts)

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, employee_name: value, payroll_employee_id: employee?.payroll_employee_id ?? null } : row
    ))
  }

  // Handle text field change
  const handleTextChange = (rowId, field, value) => {
    const previousDrafts = editedRowsRef.current || {}
    const nextDrafts = {
      ...previousDrafts,
      [rowId]: {
        ...(previousDrafts[rowId] || {}),
        [field]: value
      }
    }
    setEditedRows(nextDrafts)

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ))
  }

  // Commit this tab's draft during the final Update
  // PATTERN (mirrors Spinning): read ONLY from editedRowsRef.current — the synchronously-maintained
  // source of truth. Do NOT merge with stale `editedRows` state prop, which may lag by one or more
  // parent render cycles and corrupt decimal values (e.g. {waste:6} overwriting {waste:6.78}).
  const handleSave = async ({
    suppressNoChangesToast = false,
    suppressSuccessToast = false,
    skipParentRefresh = false,
    dependencyDrafts = null
  } = {}) => {
    // Use only the ref — it is always the most current (updated synchronously in setEditedRows).
    const pendingEdits = editedRowsRef.current || {}

    const effectiveSetupDrafts = dependencyDrafts?.setup ?? setupDraftEdits
    const effectiveStoppageDrafts = dependencyDrafts?.stoppage ?? stoppageDraftEdits
    const rowsToSave = selectRowsForDependentCommit(
      productionData,
      pendingEdits,
      machineSetups,
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
      const updates = rowsToSave.map((row) => {
        const rowId = String(row.id)
        const changes = findDraftByKeys(pendingEdits, row.id) || {}
        const stoppageTime = getEffectiveStoppageTotal(row, effectiveStoppageDrafts)
        const setup = mergeSetupDraft(
          machineSetups[row.machine_id],
          row.machine_id,
          effectiveSetupDrafts
        )
        const machineSpeed = setup?.speed ?? row.machine?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed

        const constant = getFinisherDrawingActProdnConstant(setup)
        let actHank = toNumber(changes.act_hank ?? row.act_hank ?? 0)
        const actProdn = actHank * constant
        // Waste: read directly from the draft (same as Spinning reads from editedRows).
        // toNumber() safely handles undefined (falls back to row.waste from DB).
        const waste = toNumber(changes.waste ?? row.waste)
        const roundedActProdn = Math.round(actProdn * 100) / 100
        
        const calculated = calculateFinisherDrawingValues(
          actHank,
          roundedActProdn,
          totalTime,
          stoppageTime,
          setup,
          machineSpeed,
          waste
        )

        // Exclude waste and waste_percent from calculated, then add them explicitly to preserve edited waste value
        const { waste_percent: calculatedWastePercent, ...otherCalculated } = calculated
        
        return {
          id: rowId,
          updates: {
            employee_name: changes.employee_name ?? row.employee_name,
            payroll_employee_id: Object.hasOwn(changes, 'payroll_employee_id') ? changes.payroll_employee_id : row.payroll_employee_id,
            prodn_mixing: setup?.prodn_mixing ?? changes.prodn_mixing ?? row.prodn_mixing,
            act_hank: actHank,
            act_prodn: roundedActProdn,
            ...otherCalculated,
            waste,
            waste_percent: calculatedWastePercent,
          }
        }
      }).filter(Boolean)

      const batchResult = await runFinisherDrawingEntryBatchAction('production-update', updates)
      if (!batchResult.success) throw new Error(batchResult.error || 'Failed to save production data')
      const results = batchResult.data || []

      const failed = results.find(result => !result?.success)
      if (failed) {
        throw new Error(failed.error || 'Failed to save one or more production rows')
      }
      const savedCount = rowsToSave.length
      editedRowsRef.current = {}
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Production data saved successfully')
      }
      
      if (!skipParentRefresh) {
        if (onRefresh) onRefresh()
        else await loadData({ force: true })
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
      const shouldDiscard = await confirmAction('discard unsaved changes')
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
    // Use editedRowsRef.current (synchronously updated) rather than the editedRows state prop
    // (asynchronously propagated). This ensures getEditedCount is accurate immediately after
    // handleInputChange sets the draft — even if the parent's sharedDraftEdits prop hasn't
    // re-rendered yet, which would cause the parent's getUnsavedEditCount() to see stale zero.
    getEditedCount: () => Object.keys(editedRowsRef.current || {}).length,
    isSaving: () => isSaving,
    discardChanges,
    refreshData: () => loadData({ force: true })
  }), [handleSave, isSaving, discardChanges, loadData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading production data...</span>
      </div>
    )
  }

  return (
    <div className="entry-tab-panel">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {productionData.length} machines | Shift Time: {totalTime} mins
          {Object.keys(editedRows).length > 0 && (
            <span className="ml-4 text-orange-600 font-medium">
              Unsaved draft: {Object.keys(editedRows).length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Production Grid */}
      <div className="entry-grid-frame border-2 border-gray-400 rounded overflow-hidden">
        <div className="entry-grid-scroll overflow-x-auto overflow-y-auto">
          <table className="entry-data-grid w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-44 whitespace-nowrap">Emp.Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-64 whitespace-nowrap">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Act.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-semibold tabular-nums whitespace-nowrap">Exp.Prodn</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-semibold tabular-nums whitespace-nowrap">Act.Effi%</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-semibold tabular-nums whitespace-nowrap">UTI%</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-semibold whitespace-nowrap w-16">Waste</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-semibold tabular-nums whitespace-nowrap">Waste%</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-semibold tabular-nums whitespace-nowrap">RunTime</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-semibold tabular-nums whitespace-nowrap">WorkTime</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-semibold tabular-nums whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {productionData.map((row, index) => (
                <tr key={row.id} {...getRowProps(row)} data-entry-modified={Boolean(editedRows[row.id])}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium text-blue-700 whitespace-nowrap">
                    {row.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {Number(row.machine?.speed ?? machineSetups[row.machine_id]?.speed ?? FINISHER_DRAWING_FORMULA_FALLBACK.speed).toFixed(0)}
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <EmployeeAutocomplete
                      departmentScope="preparatory"
                      value={row.employee_name || ''}
                      employeeId={row.payroll_employee_id}
                      onChange={(value, employee) => handleEmployeeChange(row.id, value, employee)}
                      placeholder="Type employee name..."
                      cleanCell
                      editingHighlight
                      dialogMode
                      className="h-9 rounded-none text-sm w-full min-w-44"
                      data-row={index}
                      data-col="emp_name"
                      onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <Input
                      value={row.prodn_mixing || ''}
                      readOnly
                      className="h-9 w-full rounded-none border-0 bg-gray-50 px-2 text-left text-sm shadow-none"
                      title="Mixing is managed via Machine Setup tab"
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      type="number"
                      value={row.act_hank ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'act_hank', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="act_hank"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'act_hank')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {Number(row.act_prodn || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {Number(row.exp_prodn || 0).toFixed(2)}
                  </td>
                  <td className={`border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap ${
                    Number(row.effi_percent || 0) >= 100 ? 'text-green-600' : 
                    Number(row.effi_percent || 0) >= 90 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {Number(row.effi_percent || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {Number(row.uti_percent || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-0 py-0 w-16">
                    <NumberInput
                      type="number"
                      step="0.0001"
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
                    {Number(row.waste_percent || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {row.run_time || totalTime}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {row.work_time || 0}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right text-orange-600 font-medium tabular-nums whitespace-nowrap">
                    {getEffectiveTotalStoppageMins(row)}
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

export default FinisherDrawingProductionTab
