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
import { Loader2, RefreshCw, Plus, Trash2, Edit, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import EnterSelect from '@/components/ui/enter-select'
import {
  getComberMachineSetupsAction,
  updateComberMachineSetupAction,
  addComberMachineAction,
  removeComberMachineAction,
  getComberMachinesAction,
  getComberCountOptionsAction,
  bulkUpdateComberMachineCountAction,
  getComberShiftConfigurationAction
} from '@/app/actions/comber-entry'
import { lookupComberMachineByNoAction } from '@/app/actions/comber-machine'
import { NumberInput } from '@/components/ui/number-input'
import { resolveComberShiftFallbackTime } from '@/lib/comberShiftFallback'
import { COMBER_FORMULA_FALLBACK } from '@/lib/comberFormulaFallback'

const ComberMachineSetupTab = forwardRef(function ComberMachineSetupTab({
  shift = 1,
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
  const editedRowsRef = useRef({})

  const setEditedRows = useCallback((updater) => {
    if (onSharedDraftEditsChange) {
      const prev = editedRowsRef.current || {}
      const next = typeof updater === 'function' ? updater(prev) : (updater || {})
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
  const [countOptions, setCountOptions] = useState([])
  const [shiftTime, setShiftTime] = useState(resolveComberShiftFallbackTime(shift))

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCountChangeDialog, setShowCountChangeDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [addCountSearch, setAddCountSearch] = useState('')
  const [showAddCountDrop, setShowAddCountDrop] = useState(false)
  const addCountRef = useRef(null)

  // New machine form
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    description: '',
    make_name: '',
    model: '',
    prodn_count: '',
    speed: 350,
    session: 1,
    cc_time: 0,
    sl_hank: COMBER_FORMULA_FALLBACK.slHank,
    mc_effi: COMBER_FORMULA_FALLBACK.mcEffiFactor,
    installed_date: ''
  })

  // Count change form
  const [newCount, setNewCount] = useState('')
  const [customCount, setCustomCount] = useState('')

  const mergeServerRowsWithDrafts = useCallback((rows) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))

    // Drop drafts for rows no longer present in refreshed server payload.
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
  }, [])

  // Close add-count dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (addCountRef.current && !addCountRef.current.contains(e.target)) {
        setShowAddCountDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load shift time from database when shift changes
  useEffect(() => {
    const loadShiftTime = async () => {
      try {
        const result = await getComberShiftConfigurationAction(shift)
        if (result.success && result.data) {
          setShiftTime(result.data.totalTime || resolveComberShiftFallbackTime(shift))
        } else {
          setShiftTime(resolveComberShiftFallbackTime(shift))
        }
      } catch (error) {
        console.error('Error loading shift time:', error)
        setShiftTime(resolveComberShiftFallbackTime(shift))
      }
    }
    loadShiftTime()
  }, [shift])

  // Load machine setups
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [setupsResult, countsResult] = await Promise.all([
        getComberMachineSetupsAction(),
        getComberCountOptionsAction()
      ])
      
      if (!setupsResult.success || !countsResult.success) {
        throw new Error(setupsResult.error || countsResult.error)
      }
      
      const setups = setupsResult.data
      const counts = countsResult.data
      
      // Sort by natural machine number order (CO1, CO2, ... CO10, CO11)
      const sortedSetups = setups?.sort((a, b) => {
        const aNum = parseInt(a.machine?.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.machine?.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      const mergedRows = mergeServerRowsWithDrafts(sortedSetups)
      setSetupData(mergedRows)
      setCountOptions(counts || [])
    } catch (error) {
      console.error('Error loading machine setups:', error)
      toast.error('Failed to load machine setups')
    } finally {
      setIsLoading(false)
    }
  }, [mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const baseRow = setupData.find(row => row.id === rowId)
    const machineId = baseRow?.machine_id
    let processedValue = value
    
    // Handle numeric fields
    if (['session_no', 'cc_time'].includes(field)) {
      processedValue = parseInt(value) || 0
    } else if (['sl_hank', 'mc_effi'].includes(field)) {
      processedValue = parseFloat(value) || 0
    }
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        ...(machineId ? { machine_id: machineId } : {}),
        [field]: processedValue
      }
    }))

    // Update display data
    setSetupData(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: processedValue }
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
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => 
        updateComberMachineSetupAction(rowId, changes)
      )

      const results = await Promise.all(updatePromises)
      const failed = results.filter(r => !r.success)
      if (failed.length > 0) throw new Error(failed[0].error)
      
      const savedCount = Object.keys(editedRows).length
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

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRows).length === 0) return true
    return window.confirm('You have unsaved machine setup edits. This action will reload data and discard them. Continue?')
  }

  const handleRefreshClick = async () => {
    if (!confirmDiscardLocalEdits()) return
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
    const toastId = toast.loading(`Looking up machine #${val}…`)
    const result = await lookupComberMachineByNoAction(val)
    if (!result.success) { toast.error(result.error || 'Lookup failed', { id: toastId }); return }
    if (!result.data) { toast.error(`Machine #${val} not found in master`, { id: toastId }); return }
    const d = result.data
    setNewMachine(prev => ({
      ...prev,
      machine_no: d.machine_no ?? prev.machine_no,
      description: d.description || prev.description,
      make_name: d.make_name || prev.make_name,
      model: d.model || prev.model,
      speed: d.speed ?? prev.speed,
      mc_effi: d.mc_effi ?? prev.mc_effi,
      sl_hank: d.sl_hank ?? d.sliver_hank ?? prev.sl_hank,
      prodn_count: d.prodn_mixing || prev.prodn_count,
      installed_date: d.installed_date ? d.installed_date.split('T')[0] : prev.installed_date,
    }))
    setAddCountSearch(d.prodn_mixing || '')
    toast.success(`Machine #${val} details filled`, { id: toastId })
  }

  const handleAddMachine = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (!newMachine.machine_no) {
      toast.warning('Please enter machine number')
      return
    }

    setIsSaving(true)
    try {
      const result = await addComberMachineAction({
        machine_no: newMachine.machine_no,
        description: newMachine.description || newMachine.machine_no,
        make_name: newMachine.make_name,
        model: newMachine.model || null,
        prodn_mixing: newMachine.prodn_count,
        speed: newMachine.speed,
        session_no: newMachine.session,
        cc_time: newMachine.cc_time,
        sl_hank: newMachine.sl_hank,
        mc_effi: newMachine.mc_effi,
        installed_date: newMachine.installed_date || null,
        shift
      })
      if (!result.success) throw new Error(result.error)
      toast.success(result.data?.reactivated ? 'Machine reactivated successfully' : 'New machine added successfully')
      setShowAddDialog(false)
      setAddCountSearch('')
      setShowAddCountDrop(false)
      setNewMachine({
        machine_no: '',
        description: '',
        make_name: '',
        model: '',
        prodn_count: '',
        speed: 350,
        session: 1,
        cc_time: 0,
        sl_hank: COMBER_FORMULA_FALLBACK.slHank,
        mc_effi: COMBER_FORMULA_FALLBACK.mcEffiFactor,
        installed_date: ''
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

  // Remove selected machines
  const handleRemoveMachines = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (selectedRows.length === 0) {
      toast.warning('Please select machines to remove')
      return
    }

    setIsSaving(true)
    try {
      const promises = selectedRows.map(id => removeComberMachineAction(id))
      const results = await Promise.all(promises)
      const failed = results.filter(r => !r.success)
      if (failed.length > 0) throw new Error(failed[0].error)
      toast.success(`${selectedRows.length} machine(s) removed successfully`)
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

  // Change count for selected machines
  const handleCountChange = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (selectedRows.length === 0) {
      toast.warning('Please select machines to change count')
      return
    }

    const countToSet = customCount || newCount
    if (!countToSet) {
      toast.warning('Please select or enter a count')
      return
    }

    setIsSaving(true)
    try {
      const result = await bulkUpdateComberMachineCountAction(selectedRows, countToSet)
      if (!result.success) throw new Error(result.error)
      toast.success(`Count updated for ${selectedRows.length} machine(s)`)
      setShowCountChangeDialog(false)
      setNewCount('')
      setCustomCount('')
      setSelectedRows([])
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error changing count:', error)
      toast.error('Failed to change count')
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
        <div className="overflow-x-auto max-h-112.5 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-10">
                  <Checkbox
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="border-white"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Description</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-64 whitespace-nowrap">Mixing Name</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">C.C.Time</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Sl.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">McEffi</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 bg-green-600 whitespace-nowrap">Shift Time</th>
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
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium text-blue-700 whitespace-nowrap">
                    {row.machine?.machine_no || row.machine_id}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap">
                    {row.machine?.description || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap">
                    {row.machine?.make_name || ''}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="prodn_mixing">
                    <EnterSelect
                      value={row.prodn_mixing || row.machine?.prodn_mixing || ''}
                      options={countOptions.length > 0
                        ? countOptions.map(opt => ({ value: opt.count_name, label: opt.count_name }))
                        : []}
                      onChange={(value) => handleInputChange(row.id, 'prodn_mixing', value)}
                      onNextRow={() => {
                        const next = tableRef.current?.querySelector(`td[data-row="${index + 1}"][data-col="prodn_mixing"] button`)
                        if (next) next.focus()
                      }}
                      placeholder="Select mixing"
                      className="h-9 rounded-none border-0"
                      searchable
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {row.machine?.speed || 350}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="session_no">
                    <NumberInput
                      type="number"
                      value={row.session_no ?? 1}
                      onChange={(e) => handleInputChange(row.id, 'session_no', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="session_no"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'session_no')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="cc_time">
                    <NumberInput
                      type="number"
                      value={row.cc_time ?? 0}
                      onChange={(e) => handleInputChange(row.id, 'cc_time', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="cc_time"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'cc_time')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="sl_hank">
                    <NumberInput
                      type="number"
                      value={row.sl_hank ?? COMBER_FORMULA_FALLBACK.slHank}
                      onChange={(e) => handleInputChange(row.id, 'sl_hank', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="sl_hank"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'sl_hank')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="mc_effi">
                    <NumberInput
                      type="number"
                      value={row.mc_effi ?? row.machine?.mc_effi ?? COMBER_FORMULA_FALLBACK.mcEffiPercent}
                      onChange={(e) => handleInputChange(row.id, 'mc_effi', e.target.value)}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      data-row={index}
                      data-col="mc_effi"
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'mc_effi')}
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-bold text-green-700 bg-green-50 tabular-nums whitespace-nowrap">
                    {shiftTime}
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
          onClick={() => setShowCountChangeDialog(true)}
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>Add a new comber machine configuration</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Machine No.</Label>
              <Input
                className="col-span-3"
                placeholder="e.g., CO14"
                value={newMachine.machine_no}
                onChange={(e) => setNewMachine(prev => ({ ...prev, machine_no: e.target.value.toUpperCase() }))}
                onBlur={(e) => handleMachineNoLookup(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMachineNoLookup(e.target.value) } }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Description</Label>
              <Input
                className="col-span-3"
                placeholder="e.g., Comber Machine 14"
                value={newMachine.description}
                onChange={(e) => setNewMachine(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Make</Label>
              <Input
                className="col-span-3"
                placeholder="e.g. LMW"
                value={newMachine.make_name}
                onChange={(e) => setNewMachine(prev => ({ ...prev, make_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Model</Label>
              <Input
                className="col-span-3"
                placeholder="e.g. LK64"
                value={newMachine.model}
                onChange={(e) => setNewMachine(prev => ({ ...prev, model: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Speed</Label>
              <NumberInput
                className="col-span-3"
                value={newMachine.speed}
                onChange={(v) => setNewMachine(prev => ({ ...prev, speed: v }))}
                zeroAsEmpty
                onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Sliver Hank</Label>
              <NumberInput
                className="col-span-3"
                value={newMachine.sl_hank}
                onChange={(v) => setNewMachine(prev => ({ ...prev, sl_hank: v }))}
                step={0.0001}
                zeroAsEmpty
                onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Count</Label>
              <div className="col-span-3 relative" ref={addCountRef}>
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={addCountSearch}
                  onChange={(e) => {
                    setAddCountSearch(e.target.value)
                    setNewMachine(prev => ({ ...prev, prodn_count: e.target.value }))
                    setShowAddCountDrop(true)
                  }}
                  onFocus={() => setShowAddCountDrop(true)}
                  placeholder="Search count..."
                  autoComplete="off"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pl-8 pr-8 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {addCountSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddCountSearch('')
                      setNewMachine(prev => ({ ...prev, prodn_count: '', sl_hank: 0 }))
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {showAddCountDrop && countOptions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {countOptions
                      .filter(c => !addCountSearch.trim() || c.count_name?.toLowerCase().includes(addCountSearch.toLowerCase()))
                      .slice(0, 40)
                      .map((opt) => (
                        <div
                          key={opt.id}
                          className="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50"
                          onMouseDown={() => {
                            setAddCountSearch(opt.count_name)
                            setNewMachine(prev => ({
                              ...prev,
                              prodn_count: opt.count_name,
                              ...(opt.sliver_hank != null && { sl_hank: parseFloat(opt.sliver_hank) })
                            }))
                            setShowAddCountDrop(false)
                          }}
                        >
                          {opt.count_name}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Std Effi %</Label>
              <NumberInput
                className="col-span-3"
                value={newMachine.mc_effi}
                onChange={(v) => setNewMachine(prev => ({ ...prev, mc_effi: v }))}
                zeroAsEmpty
                onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Installed Date</Label>
              <Input
                type="date"
                className="col-span-3"
                value={newMachine.installed_date || ''}
                onChange={(e) => setNewMachine(prev => ({ ...prev, installed_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddMachine} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Count Change Dialog */}
      <Dialog open={showCountChangeDialog} onOpenChange={setShowCountChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Count</DialogTitle>
            <DialogDescription>
              Change count for {selectedRows.length} selected machine(s)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Select Count</Label>
              <EnterSelect
                value={newCount}
                options={countOptions.length > 0
                  ? countOptions.map(opt => ({ value: opt.count_name, label: opt.count_name }))
                  : []
                }
                onChange={(v) => { setNewCount(v); setCustomCount(''); }}
                searchable
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Or Custom</Label>
              <Input
                className="col-span-3"
                placeholder="Enter custom count"
                value={customCount}
                onChange={(e) => {
                  setCustomCount(e.target.value)
                  setNewCount('')
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCountChangeDialog(false)}>Cancel</Button>
            <Button onClick={handleCountChange} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Edit className="h-4 w-4 mr-1" />}
              Apply Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Machine(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedRows.length} machine(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveMachines} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export default ComberMachineSetupTab
