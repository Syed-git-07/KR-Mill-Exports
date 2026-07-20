'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import EnterSelect from '@/components/ui/enter-select'
import { Loader2, RefreshCw, Plus, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import {
  getLapFormerMachineSetupsAction,
  updateLapFormerMachineSetupAction,
  addLapFormerMachineAction,
  removeLapFormerMachineAction,
  bulkUpdateLapFormerMachineMixingAction,
  getLapFormerMixingOptionsAction,
  getSpinningCountOptionsAction,
  lookupLapFormerMachineByNoAction
} from '@/app/actions/lapFormerEntryActions'
import { NumberInput } from '@/components/ui/number-input'
import {
  LAP_FORMER_FORMULA_FALLBACK,
  calculateLapFormerStdProdn,
  resolveLapFormerFormulaInputs,
} from '@/lib/lapFormerFormulaFallback'
import { resolveLapFormerShiftFallbackTime } from '@/lib/lapFormerShiftFallback'

const getLapFormerDescription = (machineNo) => {
  const value = String(machineNo || '').trim().toUpperCase()
  if (!value) return ''

  const match = value.match(/^LF\s*0*(\d+)$/i)
  if (match) {
    return `LAPFORMER${parseInt(match[1], 10)}`
  }

  return value
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

const LapFormerMachineSetupTab = forwardRef(function LapFormerMachineSetupTab({
  shift = 1,
  totalTime = resolveLapFormerShiftFallbackTime(shift),
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange
}, ref) {
  const [setupData, setSetupData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
  const lastLoadKeyRef = useRef('')
  const [selectedRows, setSelectedRows] = useState([])

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
    if (targetInput) { targetInput.focus(); targetInput.select() }
  }, [])
  const focusNextRow = useCallback((rowIndex, colName) => focusRowByDelta(rowIndex, 1, colName), [focusRowByDelta])
  const handleEnterNavigation = useCallback((e, rowIndex, colName) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, colName) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, colName) }
  }, [focusRowByDelta])
  const [mixingOptions, setMixingOptions] = useState([])
  const [spinningCounts, setSpinningCounts] = useState([])

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showMixingChangeDialog, setShowMixingChangeDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // New machine form - defaults come from centralized Lap Former formula fallback.
  // shift_time uses totalTime from shift configuration
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    description: '',
    make_name: '',
    model: '',
    installed_date: new Date().toISOString().split('T')[0],
    prodn_mixing: '',
    speed: LAP_FORMER_FORMULA_FALLBACK.speed,
    prodn_effi: Math.round(LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor * 100),
    is_active: true,
    hank_constant: LAP_FORMER_FORMULA_FALLBACK.hankConstant,
    std_efficiency_factor: LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor,
    delivery: LAP_FORMER_FORMULA_FALLBACK.delivery
  })

  // Mixing change form
  const [newMixing, setNewMixing] = useState('')
  const [customMixing, setCustomMixing] = useState('')

  const mergeServerRowsWithDrafts = useCallback((rows) => {
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
      const draft = findDraftByKeys(drafts, row.id, row.machine_id)
      return draft ? { ...row, ...draft } : row
    })
  }, [setEditedRows])

  // Load machine setups
  const loadData = useCallback(async ({ force = false } = {}) => {
    const loadKey = `${shift}|${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) {
      return
    }
    lastLoadKeyRef.current = loadKey

    setIsLoading(true)
    try {
      const [setupsResult, mixingsResult, spinningCountsResult] = await Promise.all([
        getLapFormerMachineSetupsAction(),
        getLapFormerMixingOptionsAction(),
        getSpinningCountOptionsAction()
      ])
      
      if (!setupsResult.success) throw new Error(setupsResult.error)
      if (!mixingsResult.success) throw new Error(mixingsResult.error)
      // spinningCounts is optional, don't throw on error
      
      const setups = setupsResult.data
      const mixings = mixingsResult.data
      const counts = spinningCountsResult.success ? spinningCountsResult.data : []
      
      // Show only machines that already have setup entries.
      const setupRows = (setups || [])
        .map(setup => ({
          id: setup.id,
          machine_id: setup.machine_id,
          machine_no: setup.machine?.machine_no,
          make_name: setup.machine?.make_name || '',
          mixing: setup.machine?.prodn_mixing || '',
          speed: resolveLapFormerFormulaInputs(setup, setup.machine?.speed).speed,
          std_prodn: setup.std_prodn || 0,
          std_efficiency_factor: resolveLapFormerFormulaInputs(setup, setup.machine?.speed).stdEfficiencyFactor,
          hank_constant: resolveLapFormerFormulaInputs(setup, setup.machine?.speed).hankConstant,
          divisor_constant: resolveLapFormerFormulaInputs(setup, setup.machine?.speed).divisorConstant,
          delivery: resolveLapFormerFormulaInputs(setup, setup.machine?.speed).delivery,
          shift_time: totalTime,
          is_active: setup.machine?.is_active ?? true
        }))
        .filter(row => !!row.machine_id && !!row.machine_no)
        .sort((a, b) => {
          const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
          const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
          return aNum - bNum
        })
      
      const mergedRows = mergeServerRowsWithDrafts(setupRows)
      setSetupData(mergedRows)
      setMixingOptions(mixings || [])
      setSpinningCounts(counts || [])
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading machine setups:', error)
      toast.error('Failed to load machine setups')
    } finally {
      setIsLoading(false)
    }
  }, [shift, totalTime, mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Calculate Std Prodn - LAP FORMER Formula
  const calculateStdProdn = (speed, hankConstant, stdEffiFactor, delivery, divisor = LAP_FORMER_FORMULA_FALLBACK.divisorConstant, shiftTime = totalTime) => {
    return calculateLapFormerStdProdn(
      {
        speed,
        hank_constant: hankConstant,
        std_efficiency_factor: stdEffiFactor,
        divisor_constant: divisor,
        delivery,
      },
      shiftTime,
      speed
    )
  }

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const baseRow = setupData.find(row => String(row.id) === String(rowId))
    const machineId = baseRow?.machine_id
    const numValue = parseFloat(value) || 0
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        ...(machineId ? { machine_id: machineId } : {}),
        [field]: numValue
      }
    }))

    // Update display data and recalculate std_prodn
    setSetupData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        
        // Recalculate std_prodn when relevant fields change
        // Note: shift_time is now shift-based (from props), not editable per machine
        if (['speed', 'hank_constant', 'std_efficiency_factor', 'divisor_constant', 'delivery'].includes(field)) {
          const speed = field === 'speed' ? numValue : row.speed
          const hankConstant = field === 'hank_constant' ? numValue : row.hank_constant
          const stdEffi = field === 'std_efficiency_factor' ? numValue : row.std_efficiency_factor
          const divisor = field === 'divisor_constant' ? numValue : row.divisor_constant
          const delivery = field === 'delivery' ? numValue : row.delivery
          
          // Use totalTime from props (shift-based)
          updatedRow.std_prodn = Math.round(calculateStdProdn(speed, hankConstant, stdEffi, delivery, divisor, totalTime) * 100) / 100
        }
        
        return updatedRow
      }
      return row
    }))
  }

  // Save changes
  const handleSave = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    const pendingEdits = editedRowsRef.current || editedRows || {}

    if (Object.keys(pendingEdits).length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const resolvedUpdates = Object.entries(pendingEdits).map(([rowId, changes]) => {
        const row = setupData.find(
          r => String(r.id) === String(rowId) || String(r.machine_id) === String(rowId)
        )
        if (!row) {
          return { rowId, changes, row: null }
        }
        return { rowId, changes, row }
      })

      const unresolvedEdits = resolvedUpdates.filter(item => !item.row)
      if (unresolvedEdits.length > 0) {
        throw new Error(`Unable to map ${unresolvedEdits.length} machine setup edit(s) to table rows. Please refresh and try again.`)
      }

      const updatePromises = resolvedUpdates.map(({ row, changes }) =>
        updateLapFormerMachineSetupAction(row.machine_id, changes)
      )

      if (updatePromises.length === 0) {
        throw new Error('No machine setup updates were prepared for saving.')
      }

      const results = await Promise.all(updatePromises)
      const failed = results.filter(r => !r?.success)
      if (failed.length > 0) {
        throw new Error(failed[0]?.error || 'Some setup updates failed')
      }
      
      const savedCount = results.length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Machine setups saved successfully')
      }
      
      await loadData({ force: true })
      if (!skipParentRefresh) {
        onRefresh?.()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving machine setups:', error)
      toast.error(error.message || 'Failed to save machine setups')
      return { success: false, saved: 0, error: error.message }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshClick = async () => {
    if (Object.keys(editedRows).length > 0) {
      const shouldDiscard = window.confirm('You have unsaved changes in Machine Setup. Refresh will discard them. Continue?')
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

  // Toggle row selection
  const handleRowSelect = (machineId) => {
    setSelectedRows(prev => 
      prev.includes(machineId) 
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    )
  }

  // Select all rows
  const handleSelectAll = () => {
    if (selectedRows.length === setupData.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(setupData.map(row => row.machine_id))
    }
  }

  // Add new machine
  const handleMachineNoLookup = async (machineNo) => {
    const val = String(machineNo || '').trim().toUpperCase()
    if (!val) return

    const toastId = toast.loading(`Looking up machine #${val}...`)
    const result = await lookupLapFormerMachineByNoAction(val)
    if (!result.success) {
      toast.error(result.error || 'Lookup failed', { id: toastId })
      return
    }
    if (!result.data) {
      toast.error(`Machine #${val} not found in master`, { id: toastId })
      return
    }

    const d = result.data
    setNewMachine(prev => ({
      ...prev,
      machine_no: d.machine_no ?? prev.machine_no,
      description: getLapFormerDescription(d.machine_no || d.description || prev.description),
      make_name: d.make_name || prev.make_name,
      model: d.model || prev.model,
      installed_date: d.installed_date
        ? String(d.installed_date).split('T')[0]
        : prev.installed_date,
      prodn_mixing: d.prodn_mixing || prev.prodn_mixing,
      ...(d.speed != null && { speed: Number(d.speed) }),
      ...(d.prodn_efficiency != null && { prodn_effi: Number(d.prodn_efficiency) }),
      ...(d.hank_constant != null && { hank_constant: Number(d.hank_constant) }),
      ...(d.std_efficiency_factor != null && { std_efficiency_factor: Number(d.std_efficiency_factor) }),
      ...(d.delivery != null && { delivery: Number(d.delivery) })
    }))

    if (d.has_setup) {
      toast.info(`Machine #${val} found - it will be reactivated with existing setup`, { id: toastId })
    } else {
      toast.success(`Machine #${val} details filled`, { id: toastId })
    }
  }

  const handleAddMachine = async () => {
    if (!newMachine.is_active) {
      toast.warning('Machine must be active to add from setup')
      return
    }

    setIsSaving(true)
    try {
      await addLapFormerMachineAction({
        machine_no: newMachine.machine_no,
        description: newMachine.description,
        make_name: newMachine.make_name,
        model: newMachine.model,
        installed_date: newMachine.installed_date,
        prodn_mixing: newMachine.prodn_mixing,
        speed: newMachine.speed,
        prodn_effi: newMachine.prodn_effi,
        hank_constant: LAP_FORMER_FORMULA_FALLBACK.hankConstant,
        std_efficiency_factor: (Number(newMachine.prodn_effi) || Math.round(LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor * 100)) / 100,
        delivery: LAP_FORMER_FORMULA_FALLBACK.delivery,
        shift_time: totalTime
      })
      toast.success('New machine added successfully')
      setShowAddDialog(false)
      setNewMachine({
        machine_no: '',
        description: '',
        make_name: '',
        model: '',
        installed_date: new Date().toISOString().split('T')[0],
        prodn_mixing: '',
        speed: LAP_FORMER_FORMULA_FALLBACK.speed,
        prodn_effi: Math.round(LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor * 100),
        is_active: true,
        hank_constant: LAP_FORMER_FORMULA_FALLBACK.hankConstant,
        std_efficiency_factor: LAP_FORMER_FORMULA_FALLBACK.stdEfficiencyFactor,
        delivery: LAP_FORMER_FORMULA_FALLBACK.delivery
      })
      setEditedRows({})
      await loadData({ force: true })
      onRefresh?.()
    } catch (error) {
      console.error('Error adding machine:', error)
      toast.error('Failed to add machine')
    } finally {
      setIsSaving(false)
    }
  }

  // Remove machine
  const handleRemoveMachine = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select at least one machine')
      return
    }

    setIsSaving(true)
    try {
      const removePromises = selectedRows.map(machineId => 
        removeLapFormerMachineAction(machineId)
      )
      await Promise.all(removePromises)
      toast.success(`${selectedRows.length} machine(s) removed`)
      setShowRemoveDialog(false)
      setSelectedRows([])
      setEditedRows({})
      await loadData({ force: true })
      onRefresh?.()
    } catch (error) {
      console.error('Error removing machines:', error)
      toast.error('Failed to remove machines')
    } finally {
      setIsSaving(false)
    }
  }

  // Change count/mixing for selected machines
  const handleChangeMixing = async () => {
    // Use customMixing if entered, otherwise use selected newMixing
    const mixingValue = customMixing || newMixing
    
    if (!mixingValue) {
      toast.warning('Please select or enter a mixing value')
      return
    }

    if (selectedRows.length === 0) {
      toast.warning('Please select at least one machine')
      return
    }

    setIsSaving(true)
    try {
      await bulkUpdateLapFormerMachineMixingAction(selectedRows, mixingValue)
      toast.success(`Count/Mixing updated for ${selectedRows.length} machine(s)`)
      setShowMixingChangeDialog(false)
      setNewMixing('')
      setCustomMixing('')
      setSelectedRows([])
      setEditedRows({})
      await loadData({ force: true })
      onRefresh?.()
    } catch (error) {
      console.error('Error updating mixing:', error)
      toast.error('Failed to update mixing')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading machine setups...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {setupData.length} machines configured
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

      {/* Machine Setup Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 w-10">
                  <Checkbox
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="border-white"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-24 whitespace-nowrap">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Shift Time</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 whitespace-nowrap">Std.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Std.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Sl.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Delivery</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {setupData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} ${selectedRows.includes(row.machine_id) ? 'bg-blue-100' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <Checkbox
                      checked={selectedRows.includes(row.machine_id)}
                      onCheckedChange={() => handleRowSelect(row.machine_id)}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    {row.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                    {row.make_name || ''}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                    {row.mixing || ''}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                    1
                  </td>
                  {/* Shift Time - readonly, from shift configuration */}
                  <td className="border border-gray-300 px-2 py-1 text-right text-gray-600 tabular-nums whitespace-nowrap">
                    {totalTime}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium text-blue-700 tabular-nums whitespace-nowrap">
                    {Number(row.std_prodn || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.speed ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'speed', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="speed"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'speed')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.std_efficiency_factor ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'std_efficiency_factor', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="std_efficiency_factor"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'std_efficiency_factor')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.hank_constant ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'hank_constant', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="hank_constant"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'hank_constant')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      value={row.delivery ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'delivery', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="delivery"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'delivery')}
                      zeroAsEmpty
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons - VB6 Layout */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowMixingChangeDialog(true)}
            disabled={selectedRows.length === 0}
          >
            <Edit className="h-4 w-4 mr-1" />
            Count change {selectedRows.length > 0 && `(${selectedRows.length})`}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add new machine
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowRemoveDialog(true)}
            disabled={selectedRows.length === 0}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove machine {selectedRows.length > 0 && `(${selectedRows.length})`}
          </Button>
        </div>
        <span className="text-sm text-gray-500">
          {selectedRows.length > 0 && (
            <span className="text-blue-600 font-medium mr-4">
              {selectedRows.length} machine(s) selected
            </span>
          )}
          {Object.keys(editedRows).length > 0 && (
            <span className="text-yellow-600 font-medium">
              {Object.keys(editedRows).length} row(s) modified
            </span>
          )}
        </span>
      </div>

      {/* Add Machine Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Machine</DialogTitle>
            <DialogDescription className="text-sm">Enter details for the new Lap Former machine</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Machine No</Label>
                <Input
                  value={newMachine.machine_no}
                  onChange={(e) => {
                    const machineNo = e.target.value.toUpperCase()
                    setNewMachine(prev => ({
                      ...prev,
                      machine_no: machineNo,
                      description: getLapFormerDescription(machineNo)
                    }))
                  }}
                  onBlur={(e) => handleMachineNoLookup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleMachineNoLookup(newMachine.machine_no)
                    }
                  }}
                  placeholder="e.g. LF3"
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Input
                  value={newMachine.description}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Auto-filled from machine no"
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Make Name</Label>
                <Input
                  value={newMachine.make_name}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, make_name: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Model</Label>
                <Input
                  value={newMachine.model || ''}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, model: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Count</Label>
                {spinningCounts.length > 0 ? (
                  <EnterSelect
                    value={newMachine.prodn_mixing}
                    options={spinningCounts.map(count => ({
                      value: count.count_name,
                      label: count.count_name
                    }))}
                    onChange={(v) => setNewMachine(prev => ({ ...prev, prodn_mixing: v }))}
                    searchable
                    className="h-10 text-sm"
                  />
                ) : (
                  <Input
                    value={newMachine.prodn_mixing}
                    onChange={(e) => setNewMachine(prev => ({ ...prev, prodn_mixing: e.target.value }))}
                    className="h-10 text-sm"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Speed</Label>
                <NumberInput
                  value={newMachine.speed}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, speed: v }))}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Std Efi %</Label>
                <NumberInput
                  value={newMachine.prodn_effi}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, prodn_effi: Number(v) || 0 }))}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Installed Date</Label>
                <Input
                  type="date"
                  value={newMachine.installed_date || ''}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, installed_date: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-lg max-w-xs">
              <Checkbox
                id="lapformer-setup-is-active"
                checked={!!newMachine.is_active}
                onCheckedChange={(checked) => setNewMachine(prev => ({ ...prev, is_active: !!checked }))}
              />
              <Label htmlFor="lapformer-setup-is-active" className="text-sm font-medium cursor-pointer">Is Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button onClick={handleAddMachine} disabled={isSaving} className="h-10 px-6 bg-blue-600 hover:bg-blue-700">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Count Change Dialog */}
      <Dialog open={showMixingChangeDialog} onOpenChange={setShowMixingChangeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Change Count</DialogTitle>
            <DialogDescription className="text-sm">Update count/mixing for {selectedRows.length} selected machine(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Existing Count</Label>
              <EnterSelect
                value={newMixing}
                options={spinningCounts.map(count => ({ value: count.count_name, label: count.count_name }))}
                onChange={(v) => { setNewMixing(v); setCustomMixing(''); }}
                searchable
                className="h-10 text-sm"
              />
            </div>
            <div className="text-center text-sm text-gray-500 font-medium">- OR -</div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Enter New Count</Label>
              <Input
                value={customMixing}
                onChange={(e) => { setCustomMixing(e.target.value); setNewMixing(''); }}
                placeholder="Enter new count..."
                className="h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowMixingChangeDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button onClick={handleChangeMixing} disabled={isSaving || (!newMixing && !customMixing)} className="h-10 px-6 bg-blue-600 hover:bg-blue-700">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply to {selectedRows.length} Machine(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Remove Machines</DialogTitle>
            <DialogDescription className="text-sm">
              Are you sure you want to remove {selectedRows.length} selected machine(s)? 
              This will deactivate them from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Warning:</strong> Removing machines will affect any future production entries.
            Existing production data will be preserved.
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleRemoveMachine} 
              disabled={isSaving}
              className="h-10 px-6"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove {selectedRows.length} Machine(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export default LapFormerMachineSetupTab
