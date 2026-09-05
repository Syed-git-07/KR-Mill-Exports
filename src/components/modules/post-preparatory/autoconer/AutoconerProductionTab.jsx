'use client'

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Button } from "@/components/ui/button"
import EmployeeAutocomplete from "@/components/ui/employee-autocomplete"
import EnterSelect from "@/components/ui/entry-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'
import {
  getAutoconerEntryTabDataAction,
  batchUpdateAutoconerProductionDetailsAction,
} from '@/app/actions/autoconerEntryActions'
import { calculateAutoconerProductionValues } from '@/lib/queries/autoconerEntryQueries'
import {
  findDraftByKeys,
  findSetupDraft as findMachineSetupDraft,
  getEffectiveStoppageTotal,
  selectRowsForDependentCommit
} from '@/lib/entryDraftSync'

/**
 * Autoconer Production Formulas (from plan.md):
 * 
 * WASTE % = (Waste Kg / Act Prodn) × 100
 * IDLE DRUM % = (Idle Drum / Total Drum) × 100
 * DRUM EFFICIENCY = 100 - Idle Drum %
 * Util % = (Work Time / Total Time) × 100
 * Prodn Effi % = (Work Time / Total Time) × Drum Efficiency
 */

const AutoconerProductionTab = forwardRef(function AutoconerProductionTab({
  headerId,
  totalTime = 510,
  shiftNo = 1,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  stoppageDraftEdits,
  setupDraftEdits,
  counts = [],
  onMachineCountChange
}, ref) {
  const [productionData, setProductionData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = sharedDraftEdits ?? localEditedRows
  const [idleReasons, setIdleReasons] = useState([])
  const hasShownInitToast = useRef(false)
  const editedRowsRef = useRef(editedRows)

  useEffect(() => {
    editedRowsRef.current = editedRows || {}
  }, [editedRows])

  const setEditedRows = useCallback((updater) => {
    // Keep the ref in sync in the same event that changes the draft.  React
    // effects run after render, so relying on the effect below could make a
    // click on Update immediately after typing save the previous row state.
    const current = editedRowsRef.current || {}
    const next = typeof updater === 'function' ? updater(current) : (updater || {})
    editedRowsRef.current = next
    setLocalEditedRows(next)
    onSharedDraftEditsChange?.(next)
  }, [onSharedDraftEditsChange])

  // Table ref for Enter-to-next-row navigation
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

  // Reset toast flag when headerId changes
  useEffect(() => {
    hasShownInitToast.current = false
  }, [headerId])

  const findSetupDraft = useCallback((row, drafts = setupDraftEdits) => {
    const machineId = row?.machine_id ?? row?.machine?.id
    if (!machineId) return null
    return findMachineSetupDraft(drafts, row?.setup?.id, machineId)
  }, [setupDraftEdits])

  const getEffectiveTotalStoppageMins = useCallback((row) => {
    return getEffectiveStoppageTotal(row, stoppageDraftEdits)
  }, [stoppageDraftEdits])

  const recalculateRow = useCallback((row, changes = {}) => {
    const actProdn = changes.act_prodn ?? row.act_prodn ?? 0
    const wasteKg = changes.waste_kg ?? row.waste_kg ?? 0
    const setupDraft = findSetupDraft(row)
    const totalDrums =
      parseInt(setupDraft?.no_of_drums) ||
      parseInt(setupDraft?.total_drums) ||
      parseInt(row.machine?.no_of_drums) ||
      parseInt(row._totalDrums) ||
      0
    const idleDrum = changes.idle_drum ?? row.idle_drum ?? 0
    const totalStoppageMins = changes.total_stoppage_mins ?? row.total_stoppage_mins ?? 0

    const calculated = calculateAutoconerProductionValues(
      actProdn,
      wasteKg,
      idleDrum,
      totalDrums,
      totalStoppageMins,
      totalTime
    )
    return {
      ...calculated,
      // Prodn Effi is a manual entry. Formula recalculation must not replace it.
      prodn_effi: changes.prodn_effi ?? row.prodn_effi ?? 0,
      _totalDrums: totalDrums
    }
  }, [totalTime, findSetupDraft])

  const mergeServerRowsWithDrafts = useCallback((rows = []) => {
    const drafts = editedRowsRef.current || {}
    return rows.map((row) => {
      const draft = drafts[row.id] || drafts[String(row.id)]
      const merged = draft ? { ...row, ...draft } : row
      const effectiveTotalStoppage = getEffectiveTotalStoppageMins(merged)
      const calculated = recalculateRow(merged, { total_stoppage_mins: effectiveTotalStoppage })
      return {
        ...merged,
        total_stoppage_mins: effectiveTotalStoppage,
        ...calculated
      }
    })
  }, [getEffectiveTotalStoppageMins, recalculateRow])

  // Load production data
  const loadData = useCallback(async () => {
    if (!headerId) return
    
    setIsLoading(true)
    try {
      const tabResult = await getAutoconerEntryTabDataAction('production', {
        headerId,
        shift: shiftNo
      })
      if (!tabResult.success) throw new Error(tabResult.error)
      const { syncResult, detailsResult, idleReasonsResult } = tabResult.data

      if (syncResult.success && syncResult.data && syncResult.data.length > 0 && !hasShownInitToast.current) {
        toast.info(`Initialized ${syncResult.data.length} machine(s) for this shift`)
        hasShownInitToast.current = true
      }

      if (!detailsResult.success) throw new Error(detailsResult.error)
      if (!idleReasonsResult.success) throw new Error(idleReasonsResult.error)
      
      const details = detailsResult.data || []
      setIdleReasons(idleReasonsResult.data || [])
      setProductionData(mergeServerRowsWithDrafts(details))
    } catch (error) {
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, mergeServerRowsWithDrafts, shiftNo])

  useServerDataLoader(loadData, [headerId, shiftNo])

  useEffect(() => {
    if (!productionData.length) return
    setProductionData(prev => prev.map((row) => {
      const effectiveTotalStoppage = getEffectiveTotalStoppageMins(row)
      const calculated = recalculateRow(row, { total_stoppage_mins: effectiveTotalStoppage })
      return {
        ...row,
        total_stoppage_mins: effectiveTotalStoppage,
        ...calculated
      }
    }))
  }, [stoppageDraftEdits, totalTime, getEffectiveTotalStoppageMins, recalculateRow])

  // Handle numeric input change
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
        
        // Recalculate based on which field changed
        if (['act_prodn', 'waste_kg', 'idle_drum'].includes(field)) {
          const effectiveTotalStoppage = getEffectiveTotalStoppageMins(row)
          const calculated = recalculateRow(row, {
            ...editedRowsRef.current?.[rowId],
            [field]: numValue,
            total_stoppage_mins: effectiveTotalStoppage
          })
          return { ...updatedRow, ...calculated }
        }
        
        return updatedRow
      }
      return row
    }))
  }

  // Handle employee name change
  const handleEmployeeChange = (rowId, value, employee) => {
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        emp_name: value,
        payroll_employee_id: employee?.payroll_employee_id ?? null
      }
    }))

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, emp_name: value, payroll_employee_id: employee?.payroll_employee_id ?? null } : row
    ))
  }

  // Handle text input change (for idle_reason, etc.)
  const handleTextChange = (rowId, field, value) => {
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value
      }
    }))

    setProductionData(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: value }
      }
      return row
    }))
  }

  // Commit this tab's draft during the final Update
  const handleSave = async ({
    suppressNoChangesToast = false,
    suppressSuccessToast = false,
    skipParentRefresh = false,
    dependencyDrafts = null
  } = {}) => {
    const draftRows = editedRowsRef.current || {}
    const effectiveSetupDrafts = dependencyDrafts?.setup ?? setupDraftEdits
    const effectiveStoppageDrafts = dependencyDrafts?.stoppage ?? stoppageDraftEdits
    const rowsToSave = selectRowsForDependentCommit(
      productionData,
      draftRows,
      {},
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
        const rowId = row.id
        const changes = findDraftByKeys(draftRows, row.id) || {}

        // Get current or updated values
        const actProdn = changes.act_prodn ?? row.act_prodn ?? 0
        const wasteKg = changes.waste_kg ?? row.waste_kg ?? 0
        const idleDrum = changes.idle_drum ?? row.idle_drum ?? 0
        const totalStoppageMins = getEffectiveStoppageTotal(row, effectiveStoppageDrafts)
        const setupDraft = findSetupDraft(row, effectiveSetupDrafts)
        const totalDrums =
          parseInt(setupDraft?.no_of_drums) ||
          parseInt(setupDraft?.total_drums) ||
          parseInt(row.machine?.no_of_drums) ||
          parseInt(row._totalDrums) ||
          0

        // Calculate all production values (like carding does)
        const calculated = calculateAutoconerProductionValues(
          actProdn,
          wasteKg,
          idleDrum,
          totalDrums,
          totalStoppageMins,
          totalTime
        )

        // Filter out underscore-prefixed fields (they're not in database schema)
        // uti_percent is a display-only calculation for AutoCorner.  Unlike
        // other production modules it is not a column on
        // autoconer_production_detail, so it must never be sent to Prisma.
        const {
          _idleDrumPercent,
          _drumEfficiency,
          uti_percent: _utiPercent,
          prodn_effi: _calculatedProdnEffi,
          ...dbFields
        } = calculated

        return {
          id: rowId,
          ...changes,
          ...dbFields,
          act_prodn: actProdn,
          prodn_effi: changes.prodn_effi ?? row.prodn_effi ?? 0,
          waste_kg: wasteKg,
          idle_drum: idleDrum,
          run_time: totalTime,
          total_stoppage_mins: totalStoppageMins
        }
      }).filter(Boolean)

      const result = await batchUpdateAutoconerProductionDetailsAction(updates)
      if (!result.success) throw new Error(result.error)
      
      const savedCount = updates.length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Production data saved successfully')
      }
      
      if (!skipParentRefresh) {
        if (onRefresh) onRefresh()
        else await loadData()
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
    if (Object.keys(editedRowsRef.current || {}).length > 0) {
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
    getEditedCount: () => Object.keys(editedRowsRef.current || {}).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, isSaving, discardChanges])

  const productionSummary = useMemo(() => {
    const producedRows = productionData.filter(row => (parseFloat(row.act_prodn) || 0) > 0)
    const totalProduction = productionData.reduce((sum, row) => sum + (parseFloat(row.act_prodn) || 0), 0)
    const totalWaste = productionData.reduce((sum, row) => sum + (parseFloat(row.waste_kg) || 0), 0)
    const efficiency = totalProduction > 0
      ? producedRows.reduce((sum, row) => {
          const production = parseFloat(row.act_prodn) || 0
          return sum + (parseFloat(row.prodn_effi) || 0) * production
        }, 0) / totalProduction
      : 0

    return { totalProduction, totalWaste, efficiency }
  }, [productionData])

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
          {productionData.length} machines | Shift {shiftNo} | Time: {totalTime} mins
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Production Grid */}
      <div className="entry-grid-frame border-2 border-gray-400 rounded overflow-hidden" ref={tableRef}>
        <div className="entry-grid-scroll overflow-x-auto overflow-y-auto">
          <table className="entry-data-grid w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20 whitespace-nowrap">Mc No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Emp. Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Count Name</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">From</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">To</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Total</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20">Prodn Effi %</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Red Light</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Idle Drm</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36">Idle Reason</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14">Act Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16">Waste Kg</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16">Util %</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 bg-blue-500">RunTm</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 bg-orange-500">T.Stop</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 bg-green-500">WrkTm</th>
              </tr>
            </thead>
            <tbody>
              {productionData.map((row, index) => {
                // Target efficiency is snapshotted from Count Master for this entry.
                const setupDraft = findSetupDraft(row)
                const effectiveSetup = setupDraft ? { ...(row.setup || {}), ...setupDraft } : (row.setup || {})
                const effectiveCountName = effectiveSetup.count_name || row.count_name || row.count?.count_name || '-'
                const hasTargetEffi = effectiveSetup.target_effi !== null && effectiveSetup.target_effi !== undefined && effectiveSetup.target_effi !== ''
                const targetEffi = hasTargetEffi ? parseFloat(effectiveSetup.target_effi) : null
                const currentEffi = parseFloat(row.prodn_effi) || 0
                
                // Green if efficiency meets or exceeds target, red if below target
                const effiColor = !hasTargetEffi
                  ? 'text-amber-700 font-semibold'
                  : currentEffi >= targetEffi
                    ? 'text-green-600 font-semibold'
                    : 'text-red-600 font-semibold'
                
                return (
                  <tr 
                    key={row.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                  >
                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                      {row.machine?.machine_no}
                    </td>
                    {/* Employee Name */}
                    <td className="border border-gray-300 px-0 py-0">
                      <EmployeeAutocomplete
                        value={row.emp_name || ''}
                        employeeId={row.payroll_employee_id}
                        onChange={(value, employee) => handleEmployeeChange(row.id, value, employee)}
                        placeholder="Type employee name..."
                        cleanCell
                        editingHighlight
                        dialogMode
                        className="h-9 rounded-none text-xs w-full min-w-35"
                        data-row={index}
                        data-col="emp_name"
                        onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                      />
                    </td>
                    {/* Count Name */}
                    <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="count_name">
                      <EnterSelect
                        value={effectiveSetup.count_id || row.count_id || ''}
                        options={counts.map(count => ({ value: count.id, label: count.count_name }))}
                        onChange={value => onMachineCountChange?.(
                          row.setup?.id,
                          row.machine_id ?? row.machine?.id,
                          value
                        )}
                        placeholder={effectiveCountName}
                        className="h-9 rounded-none"
                        cleanCell
                        editingHighlight
                        searchable
                      />
                    </td>
                    {/* Drum From */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                      {row.machine?.from_drum ?? '-'}
                    </td>
                    {/* Drum To */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs">
                      {row.machine?.to_drum ?? '-'}
                    </td>
                    {/* Drum Total */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs font-medium">
                      {row.machine?.no_of_drums ?? '-'}
                    </td>
                    {/* Actual Production */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.act_prodn ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'act_prodn', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'act_prodn')}
                        data-row={index}
                        data-col="act_prodn"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0.00"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Production Efficiency (Manual Entry) */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.prodn_effi ?? '0.00'}
                        onChange={(e) => handleInputChange(row.id, 'prodn_effi', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'prodn_effi')}
                        data-row={index}
                        data-col="prodn_effi"
                        className={`h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100 ${effiColor}`}
                        placeholder="0.00"
                      />
                    </td>
                    {/* Red Light */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.red_light ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'red_light', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'red_light')}
                        data-row={index}
                        data-col="red_light"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Idle Drum */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="1"
                        value={row.idle_drum ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'idle_drum', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'idle_drum')}
                        data-row={index}
                        data-col="idle_drum"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Idle Reason */}
                    <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="idle_reason">
                      <EnterSelect
                        value={row.idle_reason || 'none'}
                        dialogTitle="Select idle-drum reason"
                        options={[
                          { value: 'none', label: '-' },
                          ...idleReasons.map(r => ({ value: r.id, label: r.name }))
                        ]}
                        onChange={(val) => handleTextChange(row.id, 'idle_reason', val === 'none' ? '' : val)}
                        onNextRow={() => {
                          const next = tableRef.current?.querySelector(`td[data-row="${index + 1}"][data-col="idle_reason"] button`)
                          if (next) next.focus()
                        }}
                        placeholder="-"
                        cleanCell
                        editingHighlight
                        className="h-9 rounded-none"
                        searchable
                      />
                    </td>
                    {/* Target efficiency from this entry's count snapshot */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs bg-gray-100">
                      {effectiveSetup.target_effi ?? '-'}
                    </td>
                    {/* Waste Kg */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.0001"
                        value={row.waste_kg ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'waste_kg', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'waste_kg')}
                        data-row={index}
                        data-col="waste_kg"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        placeholder="0"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Waste % (Calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                      {row.waste_percent != null ? Number(row.waste_percent).toFixed(2) : ''}
                    </td>
                    {/* Util % (Calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap text-indigo-600">
                      {row.uti_percent != null ? Number(row.uti_percent).toFixed(3) : '0.000'}
                    </td>
                    {/* Run Time (from shift config - updates when shift changes) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-blue-600 bg-blue-50 tabular-nums whitespace-nowrap">
                      {totalTime}
                    </td>
                    {/* Total Stoppage Mins */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-orange-600 bg-orange-50 tabular-nums whitespace-nowrap">
                      {row.total_stoppage_mins ?? 0}
                    </td>
                    {/* Work Time (Calculated = RunTime - TotalStoppage) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-green-600 bg-green-50 tabular-nums whitespace-nowrap">
                      {row.work_time ?? (totalTime - (row.total_stoppage_mins || 0))}
                    </td>
                  </tr>
                )
              })}
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
            Total Production: <strong>{productionSummary.totalProduction.toFixed(2)} kg</strong>
          </span>
          <span>
            Total Waste: <strong>{productionSummary.totalWaste.toFixed(4)} kg</strong>
          </span>
          <span>
            Avg Effi: <strong>{productionSummary.efficiency.toFixed(1)}%</strong>
          </span>
        </div>
      </div>

    </div>
  )
})

export default AutoconerProductionTab
