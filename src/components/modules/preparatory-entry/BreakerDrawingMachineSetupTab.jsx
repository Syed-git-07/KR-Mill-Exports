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
  getBreakerDrawingMachineSetupsAction,
  updateMachineSetupAction,
  addBreakerDrawingMachineAction,
  removeBreakerDrawingMachineAction,
  updateBreakerDrawingMachineMixingAction,
  bulkUpdateBreakerDrawingMachineMixingAction,
  getMixingOptionsAction
} from '@/app/actions/breaker-drawing-entry'
import { lookupDrawingBreakerMachineByNoAction } from '@/app/actions/drawing-breaker'
import { NumberInput } from '@/components/ui/number-input'
import { BREAKER_DRAWING_FORMULA_FALLBACK, resolveBreakerDrawingFormulaInputs } from '@/lib/breakerDrawingFormulaFallback'

// Helper to convert Prisma Decimal to number
const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return parseFloat(value) || 0
}

// Helper to format number for display
const formatNumber = (value, decimals = 2) => {
  const num = toNumber(value)
  return num.toFixed(decimals)
}

const BreakerDrawingMachineSetupTab = forwardRef(function BreakerDrawingMachineSetupTab({
  headerId = null,
  shift = 1,
  totalTime = 0,
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

  // Lookup machine from master by machine_no
  const handleMachineNoLookup = async (machineNo) => {
    const val = String(machineNo || '').trim()
    if (!val) return
    const toastId = toast.loading(`Looking up machine ${val}…`)
    const result = await lookupDrawingBreakerMachineByNoAction(val)
    if (!result.success) {
      toast.error(result.error || 'Lookup failed', { id: toastId })
      return
    }
    if (!result.data) {
      toast.error(`Machine ${val} not found in master`, { id: toastId })
      return
    }
    const d = result.data
    setNewMachine(prev => ({
      ...prev,
      machine_no: d.machine_no ?? prev.machine_no,
      description: d.description || prev.description,
      make_name: d.make_name || prev.make_name,
      model: d.model || prev.model,
      installed_date: d.installed_date ? String(d.installed_date).split('T')[0] : prev.installed_date,
      prodn_mixing: d.prodn_mixing || prev.prodn_mixing,
      speed: d.speed != null ? parseFloat(d.speed) : prev.speed,
      // Use existing setup's hank_constant if available (deactivated machine), else sliver_hank from master
      hank_constant: d.setup_hank_constant != null ? parseFloat(d.setup_hank_constant) : (d.sliver_hank != null ? parseFloat(d.sliver_hank) : prev.hank_constant),
      std_efficiency_factor: d.std_efficiency_factor != null ? parseFloat(d.std_efficiency_factor) : prev.std_efficiency_factor,
      delivery: d.delivery != null ? parseFloat(d.delivery) : prev.delivery,
    }))
    if (d.has_setup) {
      toast.info(`Machine ${val} found – it will be reactivated with existing setup`, { id: toastId })
    } else {
      toast.success(`Machine ${val} details filled`, { id: toastId })
    }
  }

  const [selectedRows, setSelectedRows] = useState([])
  const [mixingOptions, setMixingOptions] = useState([])

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showMixingChangeDialog, setShowMixingChangeDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // New machine form - Breaker Drawing specific defaults
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    description: '',
    make_name: '',
    model: '',
    installed_date: '',
    prodn_mixing: '',
    speed: BREAKER_DRAWING_FORMULA_FALLBACK.speed,
    shift_time: totalTime,
    hank_constant: BREAKER_DRAWING_FORMULA_FALLBACK.hankConstant,
    std_efficiency_factor: BREAKER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor,
    delivery: BREAKER_DRAWING_FORMULA_FALLBACK.delivery
  })

  // Mixing change form
  const [newMixing, setNewMixing] = useState('')
  const [customMixing, setCustomMixing] = useState('')

  // Load machine setups
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [setupsRes, mixingsRes] = await Promise.all([
        getBreakerDrawingMachineSetupsAction(shift, headerId),
        getMixingOptionsAction()
      ])
      
      const setups = setupsRes?.data || []
      const mixings = mixingsRes?.data || []
      
      // Sort by natural machine number order (BD1, BD2, BD3, BD4)
      const sortedSetups = setups?.sort((a, b) => {
        const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      const drafts = editedRowsRef.current || {}
      const mergedSetups = sortedSetups.map(row => {
        const draft = drafts[row.id] || drafts[String(row.id)]
        return draft ? { ...row, ...draft } : row
      })
      setSetupData(mergedSetups)
      setMixingOptions(mixings || [])
    } catch (error) {
      console.error('Error loading machine setups:', error)
      toast.error('Failed to load machine setups')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const baseRow = setupData.find(row => row.id === rowId)
    const machineId = baseRow?.machine_id ?? baseRow?.machine?.id
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
    // Formula: Std Prodn = Speed / Divisor / Hank × Total Time × Std Effi × Delivery
    setSetupData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        
        // Recalculate std_prodn when relevant fields change
        if (['speed', 'hank_constant', 'std_efficiency_factor', 'divisor_constant', 'delivery'].includes(field)) {
          const mergedSetup = {
            ...row,
            speed: field === 'speed' ? numValue : toNumber(row.speed),
            hank_constant: field === 'hank_constant' ? numValue : toNumber(row.hank_constant),
            std_efficiency_factor: field === 'std_efficiency_factor' ? numValue : toNumber(row.std_efficiency_factor),
            divisor_constant: field === 'divisor_constant' ? numValue : toNumber(row.divisor_constant),
            delivery: field === 'delivery' ? numValue : toNumber(row.delivery)
          }
          const { speed, hankConstant, stdEfficiencyFactor, divisorConstant, delivery } = resolveBreakerDrawingFormulaInputs(mergedSetup, mergedSetup.speed)
          
          // Std Prodn = Speed / Divisor / Hank × Time × Std Effi × Delivery (use totalTime from shift)
          updatedRow.std_prodn = (speed / divisorConstant / hankConstant) * totalTime * stdEfficiencyFactor * delivery
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
      const currentEdits = editedRowsRef.current || editedRows || {}
      const updatePromises = Object.entries(currentEdits).map(([rowId, changes]) => 
        updateMachineSetupAction(rowId, changes)
      )

      await Promise.all(updatePromises)
      const savedCount = Object.keys(currentEdits).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Machine setups saved successfully')
      }
      
      await loadData()
      if (!skipParentRefresh) {
        onRefresh?.()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving machine setups:', error)
      toast.error('Failed to save machine setups')
      return { success: false, saved: 0, error: error.message }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshClick = async () => {
    if (Object.keys(editedRowsRef.current || editedRows || {}).length > 0) {
      const shouldDiscard = window.confirm('You have unsaved changes in Machine Setup. Refresh will discard them. Continue?')
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
    if (Object.keys(editedRowsRef.current || editedRows || {}).length === 0) return true
    return window.confirm('You have unsaved machine setup edits. This action will reload data and discard them. Continue?')
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRowsRef.current || editedRows || {}).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, editedRows, isSaving, discardChanges])

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
      setSelectedRows(setupData.map(row => row.machine?.id))
    }
  }

  // Add new machine
  const handleAddMachine = async () => {
    if (!confirmDiscardLocalEdits()) return

    setIsSaving(true)
    try {
      const response = await addBreakerDrawingMachineAction(newMachine)
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to add machine')
      }
      const result = response.data
      toast.success(result.reactivated ? 'Machine reactivated successfully' : 'New machine added successfully')
      setShowAddDialog(false)
      setNewMachine({
        machine_no: '',
        description: '',
        make_name: '',
        model: '',
        installed_date: '',
        prodn_mixing: '',
        speed: BREAKER_DRAWING_FORMULA_FALLBACK.speed,
        shift_time: totalTime,
        hank_constant: BREAKER_DRAWING_FORMULA_FALLBACK.hankConstant,
        std_efficiency_factor: BREAKER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor,
        delivery: BREAKER_DRAWING_FORMULA_FALLBACK.delivery
      })
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error adding machine:', error)
      toast.error(error.message || 'Failed to add machine')
    } finally {
      setIsSaving(false)
    }
  }

  // Remove machine
  const handleRemoveMachine = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (selectedRows.length === 0) {
      toast.warning('Please select at least one machine')
      return
    }

    setIsSaving(true)
    try {
      const removePromises = selectedRows.map(machineId => 
        removeBreakerDrawingMachineAction(machineId)
      )
      await Promise.all(removePromises)
      toast.success(`${selectedRows.length} machine(s) removed`)
      setShowRemoveDialog(false)
      setSelectedRows([])
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error removing machines:', error)
      toast.error('Failed to remove machines')
    } finally {
      setIsSaving(false)
    }
  }

  // Change mixing for selected machines
  const handleChangeMixing = async () => {
    if (!confirmDiscardLocalEdits()) return

    const mixingValue = newMixing === 'custom' ? customMixing : newMixing
    
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
      await bulkUpdateBreakerDrawingMachineMixingAction(selectedRows, mixingValue, headerId)
      toast.success(`Mixing updated for ${selectedRows.length} machine(s)`)
      setShowMixingChangeDialog(false)
      setNewMixing('')
      setCustomMixing('')
      setSelectedRows([])
      await loadData()
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
        <div className="overflow-x-auto max-h-100 overflow-y-auto">
          <table ref={tableRef} className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 w-10 whitespace-nowrap">
                  <Checkbox
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="border-white"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-24 whitespace-nowrap">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Shift Time</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 whitespace-nowrap">Std.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Std.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Sl.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {setupData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} ${selectedRows.includes(row.machine?.id) ? 'bg-blue-100' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <Checkbox
                      checked={selectedRows.includes(row.machine?.id)}
                      onCheckedChange={() => handleRowSelect(row.machine?.id)}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    {row.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                    {row.machine?.make_name || ''}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                    {row.machine?.prodn_mixing || ''}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                    1
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                    {totalTime}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium text-blue-700 tabular-nums whitespace-nowrap">
                    {formatNumber(row.std_prodn)}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="speed">
                    <NumberInput
                      type="number"
                      value={toNumber(row.speed) || BREAKER_DRAWING_FORMULA_FALLBACK.speed}
                      onChange={(e) => handleInputChange(row.id, 'speed', e.target.value)}
                      data-row={index}
                      data-col="speed"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'speed')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="std_eff">
                    <NumberInput
                      type="number"
                      value={toNumber(row.std_efficiency_factor ?? BREAKER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor)}
                      onChange={(e) => handleInputChange(row.id, 'std_efficiency_factor', e.target.value)}
                      data-row={index}
                      data-col="std_eff"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'std_eff')}
                      step="0.01"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="hank">
                    <NumberInput
                      type="number"
                      value={toNumber(row.hank_constant) || BREAKER_DRAWING_FORMULA_FALLBACK.hankConstant}
                      onChange={(e) => handleInputChange(row.id, 'hank_constant', e.target.value)}
                      data-row={index}
                      data-col="hank"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'hank')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="delivery">
                    <NumberInput
                      type="number"
                      value={toNumber(row.delivery) || 1}
                      onChange={(e) => handleInputChange(row.id, 'delivery', e.target.value)}
                      data-row={index}
                      data-col="delivery"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
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
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open)
        if (!open) setNewMachine({ machine_no: '', description: '', make_name: '', prodn_mixing: '', speed: BREAKER_DRAWING_FORMULA_FALLBACK.speed, shift_time: totalTime, hank_constant: BREAKER_DRAWING_FORMULA_FALLBACK.hankConstant, std_efficiency_factor: BREAKER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor, delivery: BREAKER_DRAWING_FORMULA_FALLBACK.delivery })
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Machine</DialogTitle>
            <DialogDescription className="text-sm">Enter details for the new Breaker Drawing machine</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Machine No *</Label>
                <Input
                  value={newMachine.machine_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, machine_no: e.target.value }))}
                  onBlur={(e) => handleMachineNoLookup(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleMachineNoLookup(e.currentTarget.value)
                    }
                  }}
                  placeholder="e.g. BD1, BD2"
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Make Name</Label>
                <Input
                  value={newMachine.make_name}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, make_name: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Description</Label>
              <Input
                value={newMachine.description}
                onChange={(e) => setNewMachine(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter machine description"
                className="h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Model</Label>
                <Input
                  value={newMachine.model}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="e.g. DO/6"
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Installed Date</Label>
                <Input
                  type="date"
                  value={newMachine.installed_date}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, installed_date: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Count / Mixing (Select from Spinning Count)</Label>
              <EnterSelect
                value={newMachine.prodn_mixing}
                options={mixingOptions.map(c => ({ value: c, label: c }))}
                onChange={(v) => setNewMachine(prev => ({ ...prev, prodn_mixing: v }))}
                searchable
                className="h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Speed</Label>
                <NumberInput
                  value={newMachine.speed}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, speed: v }))}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Sliver Hank</Label>
                <NumberInput
                  value={newMachine.hank_constant}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, hank_constant: v }))}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  step="0.01"
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Std. Efficiency (Factor)</Label>
                <NumberInput
                  value={newMachine.std_efficiency_factor}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, std_efficiency_factor: Number(v) || BREAKER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor }))}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  step="0.01"
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Delivery</Label>
                <NumberInput
                  value={newMachine.delivery}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, delivery: v }))}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
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
                options={mixingOptions.map(c => ({ value: c, label: c }))}
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

export default BreakerDrawingMachineSetupTab
