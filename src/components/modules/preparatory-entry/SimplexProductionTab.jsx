'use client'

import { useEntryRowSelection } from '@/components/common/EntryRowSelection'

import { confirmAction } from '@/lib/confirmation'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import EmployeeAutocomplete from '@/components/ui/employee-autocomplete'
import { 
  getSimplexEntryTabDataAction,
  runSimplexEntryBatchAction
} from '@/app/actions/simplexEntryActions'
import { calculateSimplexProductionValues } from '@/lib/utils/simplexCalculations'
import { NumberInput } from '@/components/ui/number-input'
import {
  findDraftByKeys,
  getEffectiveStoppageTotal,
  mergeSetupDraft,
  rowHasDependencyDraft,
  selectRowsForDependentCommit
} from '@/lib/entryDraftSync'

const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  return parseFloat(String(value)) || 0
}

const SimplexProductionTab = forwardRef(function SimplexProductionTab({ 
  headerId, 
  totalTime = 510,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  stoppageDraftEdits,
  setupDraftEdits
}, ref) {
  const [productionData, setProductionData] = useState([])
  const { getRowProps } = useEntryRowSelection()
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

  const getEffectiveSetup = useCallback((row, setupMap) => {
    const baseSetup = setupMap[row.machine_id] || {}
    return mergeSetupDraft(baseSetup, row.machine_id, setupDraftEdits) || baseSetup
  }, [setupDraftEdits])

  const recalculateRow = useCallback((row, setupMap, draft = null) => {
    const setup = getEffectiveSetup(row, setupMap)
    const machine = row.machine || {}
    const base = draft ? { ...row, ...draft } : row
    const stoppageTime = getEffectiveStoppageTotal(base, stoppageDraftEdits)

    const runHrs = toNumber(base.run_hrs)
    const idleSpindles = parseInt(base.idle_spindles, 10) || 0
    const waste = toNumber(base.waste)

    const speed = setup.speed ?? machine.speed ?? 960
    const tpi = setup.tpi ?? machine.tpi ?? 1.73
    const mcEffi = setup.mc_effi ?? machine.mc_effi ?? 92
    const totalSpindles = setup.spindles ?? machine.no_of_spindles ?? 140
    const hank = setup.sl_hank ?? 1.4

    const calculated = calculateSimplexProductionValues({
      runHrs,
      speed,
      tpi,
      hank,
      mcEffi,
      totalSpindles,
      idleSpindles,
      waste,
      totalTime,
      stoppageTime
    })

    return {
      ...base,
      prodn_mixing: setup?.prodn_mixing || machine?.prodn_mixing || base.prodn_mixing || '',
      run_time: totalTime,
      run_hrs: runHrs,
      idle_spindles: idleSpindles,
      waste,
      run_min: calculated.run_min,
      work_time: calculated.work_time,
      std_hrs: calculated.std_hrs,
      act_prodn: calculated.act_prodn,
      act_effi_percent: calculated.act_effi_percent,
      waste_percent: calculated.waste_percent,
      uti_percent: calculated.uti_percent
    }
  }, [totalTime, getEffectiveSetup, stoppageDraftEdits])

  const getEffectiveTotalStoppageMins = useCallback((row) => {
    return getEffectiveStoppageTotal(row, stoppageDraftEdits)
  }, [stoppageDraftEdits])

  useEffect(() => {
    if (!productionData.length) return

    setProductionData(prev => prev.map(row => {
      const draft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const effectiveStoppageMins = getEffectiveTotalStoppageMins(row)
      const withEffectiveStoppage = {
        ...row,
        total_stoppage_mins: effectiveStoppageMins,
        stoppage: [
          {
            ...(Array.isArray(row.stoppage) ? row.stoppage[0] : row.stoppage || {}),
            total_stoppage_time: effectiveStoppageMins
          }
        ]
      }
      const forceRecalculate = rowHasDependencyDraft(
        row,
        machineSetups,
        setupDraftEdits,
        stoppageDraftEdits
      )
      return recalculateRow(withEffectiveStoppage, machineSetups, draft, forceRecalculate)
    }))
  }, [stoppageDraftEdits, setupDraftEdits, machineSetups, recalculateRow, getEffectiveTotalStoppageMins, productionData.length])

  const mergeServerRowsWithDrafts = useCallback((rows, setupMap) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(r => String(r.id)))

    setEditedRows(prev => {
      const next = {}
      for (const [id, value] of Object.entries(prev || {})) {
        if (rowIds.has(String(id))) next[id] = value
      }
      return Object.keys(next).length === Object.keys(prev || {}).length ? prev : next
    })

    return (rows || []).map(row => {
      const draft = drafts[row.id] || drafts[String(row.id)]
      const forceRecalculate = rowHasDependencyDraft(
        row,
        setupMap,
        setupDraftEdits,
        stoppageDraftEdits
      )
      return recalculateRow(row, setupMap, draft, forceRecalculate)
    })
  }, [setEditedRows, recalculateRow, setupDraftEdits, stoppageDraftEdits])

  // Load production data
  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!headerId) return
    const loadKey = `${headerId}|${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) return
    lastLoadKeyRef.current = loadKey
    
    setIsLoading(true)
    try {
      const result = await getSimplexEntryTabDataAction('production', { headerId })
      if (!result.success) throw new Error(result.error || 'Failed to load Simplex production data')
      const { detailsResult, setupsResult } = result.data
      
      const setupMap = {}
      if (setupsResult.success) {
        setupsResult.data?.forEach(s => {
          setupMap[s.machine_id] = s
        })
      }
      setMachineSetups(setupMap)
      
      if (detailsResult.success) {
        const mergedRows = mergeServerRowsWithDrafts(detailsResult.data || [], setupMap)
        setProductionData(mergedRows)
      } else {
        setProductionData([])
        console.error('Simplex production query failed:', detailsResult.error)
        toast.error(detailsResult.error || 'Failed to load production rows')
      }
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading production data:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, totalTime, mergeServerRowsWithDrafts])

  useServerDataLoader(loadData, [headerId, totalTime])

  // Handle input changes
  const handleInputChange = (rowId, field, value) => {
    const numValue = field === 'idle_spindles' ? (parseInt(value, 10) || 0) : toNumber(value)
    
    setEditedRows(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: numValue } }))

    setProductionData(prev => prev.map(row => {
      if (row.id !== rowId) return row

      return recalculateRow({ ...row, [field]: numValue }, machineSetups)
    }))
  }

  // Handle employee name change
  const handleEmployeeChange = (rowId, value, employee) => {
    setEditedRows(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), employee_name: value, payroll_employee_id: employee?.payroll_employee_id ?? null } }))

    setProductionData(prev => prev.map(row => 
      row.id === rowId ? { ...row, employee_name: value, payroll_employee_id: employee?.payroll_employee_id ?? null } : row
    ))
  }

  // Handle save
  const handleSave = async ({
    suppressNoChangesToast = false,
    suppressSuccessToast = false,
    skipParentRefresh = false,
    dependencyDrafts = null
  } = {}) => {
    const currentEdits = editedRowsRef.current || editedRows || {}
    const effectiveSetupDrafts = dependencyDrafts?.setup ?? setupDraftEdits
    const effectiveStoppageDrafts = dependencyDrafts?.stoppage ?? stoppageDraftEdits
    const rowsToSave = selectRowsForDependentCommit(
      productionData,
      currentEdits,
      machineSetups,
      effectiveSetupDrafts,
      effectiveStoppageDrafts
    )

    if (rowsToSave.length === 0) {
      if (!suppressNoChangesToast) toast.info('No changes to save')
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const updates = rowsToSave.map(row => {
        const changes = findDraftByKeys(currentEdits, row.id) || {}
        const setup = mergeSetupDraft(
          machineSetups[row.machine_id],
          row.machine_id,
          effectiveSetupDrafts
        ) || {}
        const machine = row.machine || {}
        const stoppageTime = getEffectiveStoppageTotal(row, effectiveStoppageDrafts)
        const effectiveRow = { ...row, ...changes }

        // Get machine parameters
        const speed = setup.speed ?? machine.speed ?? 960
        const tpi = setup.tpi ?? machine.tpi ?? 1.73
        const mcEffi = setup.mc_effi ?? machine.mc_effi ?? 92
        const totalSpindles = setup.spindles ?? machine.no_of_spindles ?? 140
        const hank = setup.sl_hank ?? 1.4

        // Calculate production values
        const calculated = calculateSimplexProductionValues({
          runHrs: parseFloat(effectiveRow.run_hrs) || 0,
          speed,
          tpi,
          hank,
          mcEffi,
          totalSpindles,
          idleSpindles: parseInt(effectiveRow.idle_spindles) || 0,
          waste: parseFloat(effectiveRow.waste) || 0,
          totalTime,
          stoppageTime
        })

        return {
          id: row.id,
          updates: {
            employee_name: effectiveRow.employee_name,
            payroll_employee_id: effectiveRow.payroll_employee_id,
            prodn_mixing: setup?.prodn_mixing ?? effectiveRow.prodn_mixing,
            run_hrs: effectiveRow.run_hrs,
            run_min: calculated.run_min,
            run_time: totalTime,
            idle_spindles: effectiveRow.idle_spindles,
            waste: effectiveRow.waste,
            act_prodn: calculated.act_prodn,
            waste_percent: calculated.waste_percent,
            act_effi_percent: calculated.act_effi_percent,
            uti_percent: calculated.uti_percent,
            std_hrs: calculated.std_hrs,
            work_time: calculated.work_time
          }
        }
      })
      const batchResult = await runSimplexEntryBatchAction('production-update', updates)
      if (!batchResult.success) throw new Error(batchResult.error || 'Failed to save production data')
      const failed = (batchResult.data || []).find(result => !result?.success)
      if (failed) throw new Error(failed.error || 'Failed to save a Simplex production row')

      if (!suppressSuccessToast) {
        toast.success(`${rowsToSave.length} row(s) saved successfully`)
      }
      setEditedRows({})
      
      if (!skipParentRefresh) {
        if (onRefresh) onRefresh()
        else await loadData({ force: true })
      }
      return { success: true, saved: rowsToSave.length }
    } catch (error) {
      console.error('Error saving production data:', error)
      toast.error('Failed to update production')
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
    getEditedCount: () => Object.keys(editedRowsRef.current || editedRows || {}).length,
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
    <div className="entry-tab-panel">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {productionData.length} machines | Shift Time: {totalTime} mins | MCEffi: 92%
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
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-44 whitespace-nowrap">EmpName</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">
                  <span className="text-yellow-200">RunHrs</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">RunMin</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">
                  <span className="text-yellow-200">IdleSpdl</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">
                  <span className="text-yellow-200">Waste</span>
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Act.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Act.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Uti%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Std.hrs</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">WorkTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {productionData.map((row, index) => {
                const machine = row.machine || {}
                const setup = machineSetups[row.machine_id] || {}
                const isEdited = editedRows[row.id]

                return (
                  <tr key={row.id} {...getRowProps(row)} data-entry-modified={Boolean(editedRows[row.id])}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isEdited ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                  >
                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                      {machine.machine_no || '-'}
                    </td>
                    
                    {/* Employee Name */}
                    <td className="border border-gray-300 px-0 py-0">
                      <EmployeeAutocomplete
                        value={row.employee_name || ''}
                        employeeId={row.payroll_employee_id}
                        onChange={(value, employee) => handleEmployeeChange(row.id, value, employee)}
                        cleanCell
                        editingHighlight
                        dialogMode
                        className="h-9 rounded-none text-sm w-full min-w-35"
                        data-row={index}
                        data-col="emp_name"
                        onEnterNavigation={() => focusNextRow(index, 'emp_name')}
                      />
                    </td>
                    
                    {/* Count/Mixing - Linked from Machine Setup */}
                    <td className="border border-gray-300 px-2 py-1 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={row.prodn_mixing || ''}>
                      {row.prodn_mixing || ''}
                    </td>
                    
                    {/* Run Hours (HH.MM) - EDITABLE */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.run_hrs ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'run_hrs', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="run_hrs"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'run_hrs')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* Run Minutes (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right text-gray-600 tabular-nums whitespace-nowrap">
                      {row.run_min || 0}
                    </td>
                    
                    {/* Idle Spindles - EDITABLE */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.idle_spindles ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'idle_spindles', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="idle_spindles"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'idle_spindles')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* Waste - EDITABLE */}
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
                    
                    {/* Actual Production (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                      {Number(row.act_prodn || 0).toFixed(2)}
                    </td>
                    
                    {/* Waste % (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                      {Number(row.waste_percent || 0).toFixed(2)}
                    </td>
                    
                    {/* Actual Efficiency % (calculated) */}
                    <td className={`border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap ${
                      Number(row.act_effi_percent || 0) >= 100 ? 'text-green-600' : 
                      Number(row.act_effi_percent || 0) >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {Number(row.act_effi_percent || 0).toFixed(2)}
                    </td>
                    
                    {/* UTI % (calculated) */}
                    <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                      {Number(row.uti_percent || 0).toFixed(2)}
                    </td>
                    
                    {/* Std.Hrs (Standard Hours) */}
                    <td className="border border-gray-300 px-2 py-1 text-right text-gray-600 tabular-nums whitespace-nowrap">
                      {Number(row.std_hrs || 0).toFixed(1)}
                    </td>
                    
                    {/* Work Time (TotalTime - TotalStoppage) */}
                    <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                      {row.work_time || 0}
                    </td>
                    
                    {/* Total Stoppage Time */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-orange-600 font-medium tabular-nums whitespace-nowrap">
                      {getEffectiveTotalStoppageMins(row)}
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
            Total Act.Prodn: <strong>{productionData.reduce((sum, r) => sum + Number(r.act_prodn || 0), 0).toFixed(2)}</strong> Kg
          </span>
          <span>
            Avg Effi: <strong>{productionData.length > 0 
              ? (productionData.reduce((sum, r) => sum + Number(r.act_effi_percent || 0), 0) / productionData.length).toFixed(2) 
              : 0}%</strong>
          </span>
        </div>
      </div>

    </div>
  )
})

export default SimplexProductionTab
