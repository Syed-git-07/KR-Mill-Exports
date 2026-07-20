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
import { NumberInput } from '@/components/ui/number-input'
import EnterSelect from '@/components/ui/enter-select'
import { Loader2, RefreshCw, Plus, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import {
  getFinisherDrawingMachineSetupsAction,
  updateFinisherDrawingMachineSetupAction,
  addFinisherDrawingMachineAction,
  removeFinisherDrawingMachineAction,
  bulkUpdateFinisherDrawingMachineMixingAction,
  getFinisherDrawingMixingOptionsAction,
  getSpinningCountOptionsAction,
  lookupFinisherDrawingMachineByNoAction
} from '@/app/actions/finisher-drawing-entry'
import {
  FINISHER_DRAWING_FORMULA_FALLBACK,
  resolveFinisherDrawingFormulaInputs,
  calculateFinisherDrawingStdProdn,
} from '@/lib/finisherDrawingFormulaFallback'

const FinisherDrawingMachineSetupTab = forwardRef(function FinisherDrawingMachineSetupTab({
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
  const [selectedRows, setSelectedRows] = useState([])
  const [mixingOptions, setMixingOptions] = useState([])
  const [spinningCountOptions, setSpinningCountOptions] = useState([])
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

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showMixingChangeDialog, setShowMixingChangeDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // New machine form seeded from centralized fallback defaults.
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    description: '',
    make_name: '',
    model: '',
    installed_date: '',
    prodn_mixing: '',
    speed: FINISHER_DRAWING_FORMULA_FALLBACK.speed,
    prodn_effi: 90,
    shift_time: totalTime,
    hank_constant: FINISHER_DRAWING_FORMULA_FALLBACK.hankConstant,
    std_efficiency_factor: FINISHER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor,
    delivery: 1
  })

  // Mixing change form
  const [newMixing, setNewMixing] = useState('')
  const [customMixing, setCustomMixing] = useState('')

  // Lookup machine from master by machine_no (auto-fill Add dialog)
  const handleMachineNoLookup = async (machineNo) => {
    const val = String(machineNo || '').trim()
    if (!val) return
    const toastId = toast.loading(`Looking up machine ${val}…`)
    const result = await lookupFinisherDrawingMachineByNoAction(val)
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
      prodn_effi: d.prodn_efficiency != null
        ? parseFloat(d.prodn_efficiency)
        : (d.std_efficiency_factor != null ? parseFloat(d.std_efficiency_factor) * 100 : prev.prodn_effi),
      std_efficiency_factor: d.std_efficiency_factor != null
        ? parseFloat(d.std_efficiency_factor)
        : (d.prodn_efficiency != null ? parseFloat(d.prodn_efficiency) / 100 : prev.std_efficiency_factor),
    }))
    if (d.has_setup) {
      toast.info(`Machine ${val} found — it will be reactivated with existing setup`, { id: toastId })
    } else {
      toast.success(`Machine ${val} details filled`, { id: toastId })
    }
  }

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
      const draft = drafts[row.id] || drafts[String(row.id)]
      if (!draft) return row
      return { ...row, ...draft }
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
      const [setupsResult, mixingsResult, countsResult] = await Promise.all([
        getFinisherDrawingMachineSetupsAction(shift),
        getFinisherDrawingMixingOptionsAction(),
        getSpinningCountOptionsAction()
      ])
      
      const setups = setupsResult.success ? setupsResult.data : []
      const mixings = mixingsResult.success ? mixingsResult.data : []
      const counts = countsResult.success ? countsResult.data : []
      
      // Spinning-style behavior: show only machines that have setup rows
      const mergedData = (setups || [])
        .map(setup => {
          const shiftTime = setup.shift_time || totalTime
          const formula = resolveFinisherDrawingFormulaInputs(setup, setup.machine?.speed || setup.speed)
          const speed = formula.speed
          const hankConstant = formula.hankConstant
          const stdEffi = formula.stdEfficiencyFactor
          const divisor = formula.divisorConstant
          const delivery = formula.delivery
          const stdProdn = Math.round(calculateStdProdn(speed, hankConstant, stdEffi, delivery, divisor, shiftTime) * 100) / 100

          return {
          id: setup.id,
          machine_id: setup.machine_id,
          machine_no: setup.machine?.machine_no,
          description: setup.machine?.description || `Finisher Drawing Machine ${setup.machine?.machine_no}`,
          make_name: setup.machine?.make_name || '',
          mixing: setup.machine?.prodn_mixing || setup.prodn_mixing || '',
          speed,
          std_prodn: stdProdn,
          std_efficiency_factor: stdEffi,
          hank_constant: hankConstant,
          divisor_constant: divisor,
          delivery,
          shift_time: shiftTime,
          is_active: setup.machine?.is_active ?? true,
          isNewSetup: false
          }
        })
        .sort((a, b) => {
          const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
          const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
          return aNum - bNum
        })
      
      const mergedRows = mergeServerRowsWithDrafts(mergedData)
      setSetupData(mergedRows)
      setMixingOptions(mixings || [])
      setSpinningCountOptions(counts || [])
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading machine setups:', error)
      toast.error('Failed to load machine setups')
    } finally {
      setIsLoading(false)
    }
  }, [shift, totalTime, mergeServerRowsWithDrafts])

  useEffect(() => {
    setNewMachine(prev => ({ ...prev, shift_time: totalTime }))
  }, [totalTime])

  useEffect(() => {
    loadData()
  }, [loadData])

  const calculateStdProdn = (speed, hankConstant, stdEffiFactor, delivery, divisor, shiftTime) => {
    return calculateFinisherDrawingStdProdn(
      {
        speed,
        hank_constant: hankConstant,
        std_efficiency_factor: stdEffiFactor,
        delivery,
        divisor_constant: divisor,
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
      if (String(row.id) === String(rowId)) {
        const updatedRow = { ...row, [field]: numValue }
        
        // Recalculate std_prodn when relevant fields change
        if (['speed', 'hank_constant', 'std_efficiency_factor', 'shift_time', 'divisor_constant', 'delivery'].includes(field)) {
          const speed = field === 'speed' ? numValue : row.speed
          const hankConstant = field === 'hank_constant' ? numValue : row.hank_constant
          const stdEffi = field === 'std_efficiency_factor' ? numValue : row.std_efficiency_factor
          const shiftTime = field === 'shift_time' ? numValue : row.shift_time
          const divisor = field === 'divisor_constant' ? numValue : row.divisor_constant
          const delivery = field === 'delivery' ? numValue : row.delivery
          
          updatedRow.std_prodn = Math.round(calculateStdProdn(speed, hankConstant, stdEffi, delivery, divisor, shiftTime) * 100) / 100
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
        updateFinisherDrawingMachineSetupAction(row.machine_id, changes)
      )

      if (updatePromises.length === 0) {
        throw new Error('No machine setup updates were prepared for saving.')
      }

      const updateResults = await Promise.all(updatePromises)
      const failedUpdates = updateResults.filter(result => !result?.success)
      if (failedUpdates.length > 0) {
        const firstError = failedUpdates[0]?.error || 'Unknown error while saving machine setup changes'
        throw new Error(firstError)
      }

      const savedCount = updateResults.length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Machine setups saved successfully')
      }
      
      await loadData({ force: true })
      if (!skipParentRefresh) {
        await onRefresh?.()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      toast.error(error?.message || 'Failed to save machine setups')
      return { success: false, saved: 0, error: error.message }
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRowsRef.current || editedRows || {}).length === 0) return true
    return window.confirm('You have unsaved machine setup edits. This action will reload data and discard them. Continue?')
  }

  const handleRefreshClick = async () => {
    if (!confirmDiscardLocalEdits()) return
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
  const handleAddMachine = async () => {
    if (!newMachine.machine_no) {
      toast.warning('Please enter machine number')
      return
    }

    setIsSaving(true)
    try {
      const result = await addFinisherDrawingMachineAction({
        machine_no: newMachine.machine_no,
        description: newMachine.description || `Finisher Drawing Machine ${newMachine.machine_no}`,
        shift,
        make_name: newMachine.make_name,
        model: newMachine.model,
        installed_date: newMachine.installed_date || null,
        prodn_mixing: newMachine.prodn_mixing,
        speed: newMachine.speed,
        prodn_effi: newMachine.prodn_effi,
        shift_time: newMachine.shift_time,
        hank_constant: newMachine.hank_constant,
        std_efficiency_factor: newMachine.std_efficiency_factor,
        delivery: newMachine.delivery
      })
      if (result.success) {
        toast.success(result.data.reactivated ? 'Machine reactivated successfully' : 'New machine added successfully')
        setShowAddDialog(false)
        setNewMachine({
          machine_no: '',
          description: '',
          make_name: '',
          model: '',
          installed_date: '',
          prodn_mixing: '',
          speed: FINISHER_DRAWING_FORMULA_FALLBACK.speed,
          prodn_effi: 90,
          shift_time: totalTime,
          hank_constant: FINISHER_DRAWING_FORMULA_FALLBACK.hankConstant,
          std_efficiency_factor: FINISHER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor,
          delivery: 1
        })
        await loadData({ force: true })
        onRefresh?.()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error adding machine:', error)
      toast.error(error.message || 'Failed to add machine')
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
        removeFinisherDrawingMachineAction(machineId)
      )
      await Promise.all(removePromises)
      toast.success(`${selectedRows.length} machine(s) removed`)
      setShowRemoveDialog(false)
      setSelectedRows([])
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
      const result = await bulkUpdateFinisherDrawingMachineMixingAction(selectedRows, mixingValue)
      if (result.success) {
        toast.success(`Count/Mixing updated for ${selectedRows.length} machine(s)`)
        setShowMixingChangeDialog(false)
        setNewMixing('')
        setCustomMixing('')
        setSelectedRows([])
        await loadData({ force: true })
        onRefresh?.()
      } else {
        throw new Error(result.error)
      }
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
      {/* Header with Refresh and Save */}
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
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-44 whitespace-nowrap">Description</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-24 whitespace-nowrap">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 whitespace-nowrap">Std.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Std.Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-24 whitespace-nowrap">Shift Time</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">TYPE</th>
              </tr>
            </thead>
            <tbody>
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
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium text-blue-700 whitespace-nowrap">
                    {row.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis" title={row.description || `Finisher Drawing Machine ${row.machine_no}`}>
                    {row.description || `Finisher Drawing Machine ${row.machine_no}`}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap">
                    {row.make_name || ''}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis" title={row.mixing}>
                    {row.mixing}
                  </td>
                  <td className="border border-gray-300 px-0 py-0">
                    <NumberInput
                      type="number"
                      value={row.speed ?? ''}
                      onChange={(e) => handleInputChange(row.id, 'speed', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                    {Number(row.std_prodn || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {row.std_efficiency_factor
                      ? Math.round(Number(row.std_efficiency_factor) * 100)
                      : Math.round(FINISHER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor * 100)}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {Number(row.hank_constant || FINISHER_DRAWING_FORMULA_FALLBACK.hankConstant)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {row.shift_time || totalTime}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-xs whitespace-nowrap">
                    FINISHER
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons - Centered like Carding */}
      <div className="flex justify-center gap-4">
        <Button 
          variant="outline" 
          onClick={() => setShowMixingChangeDialog(true)}
          disabled={selectedRows.length === 0}
        >
          <Edit className="h-4 w-4 mr-1" />
          Count change
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add new machine
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowRemoveDialog(true)}
          disabled={selectedRows.length === 0}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Remove machine
        </Button>
      </div>

      {/* Add Machine Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) {
            setNewMachine({
              machine_no: '',
              description: '',
              make_name: '',
              model: '',
              installed_date: '',
              prodn_mixing: '',
              speed: FINISHER_DRAWING_FORMULA_FALLBACK.speed,
              prodn_effi: 90,
              shift_time: totalTime,
              hank_constant: FINISHER_DRAWING_FORMULA_FALLBACK.hankConstant,
              std_efficiency_factor: FINISHER_DRAWING_FORMULA_FALLBACK.stdEfficiencyFactor,
              delivery: 1
            })
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>
              Add a new Finisher Drawing machine to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Machine No *</Label>
                <Input
                  placeholder="e.g. FD11"
                  value={newMachine.machine_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, machine_no: e.target.value.toUpperCase() }))}
                  onBlur={(e) => handleMachineNoLookup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMachineNoLookup(e.target.value) } }}
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
                placeholder="Enter machine description"
                value={newMachine.description}
                onChange={(e) => setNewMachine(prev => ({ ...prev, description: e.target.value }))}
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
              <Label className="text-sm font-medium mb-2 block">Count / Mixing</Label>
              <EnterSelect
                value={newMachine.prodn_mixing}
                options={[
                  ...spinningCountOptions.map(c => ({ value: c.count_name, label: c.count_name })),
                  ...mixingOptions.map(m => ({ value: m, label: m }))
                ]}
                onChange={(v) => setNewMachine(prev => ({ ...prev, prodn_mixing: v }))}
                searchable
                className="h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-medium mb-2 block">Speed (m/min)</Label>
                <NumberInput
                  value={newMachine.speed}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, speed: e.target.value }))}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Std. Efficiency (%)</Label>
                <NumberInput
                  value={newMachine.prodn_effi}
                  onChange={(e) => {
                    const effi = Number(e.target.value) || 0
                    setNewMachine(prev => ({
                      ...prev,
                      prodn_effi: effi,
                      std_efficiency_factor: effi / 100
                    }))
                  }}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="h-10 px-6">
              Cancel
            </Button>
            <Button 
              onClick={handleAddMachine}
              disabled={isSaving}
              className="h-10 px-6 bg-blue-600 hover:bg-blue-700"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Mixing Dialog */}
      <Dialog open={showMixingChangeDialog} onOpenChange={setShowMixingChangeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Count/Mixing</DialogTitle>
            <DialogDescription>
              Change the count/mixing for {selectedRows.length} selected machine(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Spinning Count / Mixing</Label>
              <EnterSelect
                value={newMixing}
                options={[
                  ...spinningCountOptions.map(c => ({ value: c.count_name, label: c.count_name })),
                  ...mixingOptions.map(m => ({ value: m, label: m }))
                ]}
                onChange={(v) => { setNewMixing(v); setCustomMixing(''); }}
                searchable
              />
            </div>
            <div className="text-center text-sm text-gray-500 font-medium">- OR -</div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Custom Mixing</Label>
              <Input
                placeholder="Enter custom mixing"
                value={customMixing}
                onChange={(e) => { setCustomMixing(e.target.value); setNewMixing(''); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMixingChangeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangeMixing}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Edit className="h-4 w-4 mr-1" />
              Apply Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Machine(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedRows.length} machine(s)? This action will deactivate the machines.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRemoveMachine}
              disabled={isSaving}
              variant="destructive"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export default FinisherDrawingMachineSetupTab
