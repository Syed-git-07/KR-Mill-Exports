'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Loader2, Plus, Trash2, Edit, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  updateSimplexMachineSetupAction,
  bulkUpdateSimplexMachineCountAction,
  getSimplexCountOptionsAction,
  addSimplexMachineAction,
  removeSimplexMachineAction,
  getSimplexMachineSetupsAction,
  lookupSimplexMachineByNoAction
} from '@/app/actions/simplexEntryActions'
import { NumberInput } from '@/components/ui/number-input'
import EnterSelect from '@/components/ui/enter-select'

const parseFloatOr = (value, fallback) => {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

const parseIntOr = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const SimplexMachineSetupTab = forwardRef(function SimplexMachineSetupTab({ totalTime = 510, onRefresh, sharedDraftEdits, onSharedDraftEditsChange }, ref) {
  const [setupData, setSetupData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
  const lastLoadKeyRef = useRef('')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedRows, setSelectedRows] = useState([])

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
    if (targetInput) { targetInput.focus(); targetInput.select() }
  }, [])
  const focusNextRow = useCallback((rowIndex, colName) => focusRowByDelta(rowIndex, 1, colName), [focusRowByDelta])
  const handleEnterNavigation = useCallback((e, rowIndex, colName) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, colName) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, colName) }
  }, [focusRowByDelta])
  
  // Dialog states
  const [showCountChangeDialog, setShowCountChangeDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  
  // Count change form
  const [newCount, setNewCount] = useState('')
  const [customCount, setCustomCount] = useState('')
  const [countOptions, setCountOptions] = useState([])
  
  // New machine form (like Comber - creates new machine)
  const [newMachine, setNewMachine] = useState({
    machine_no: '',
    description: '',
    make_name: '',
    model: '',
    installed_date: new Date().toISOString().split('T')[0],
    prodn_mixing: '',
    prodn_effi: 85,
    tpi: 1.73,
    no_of_spindles: 140,
    speed: 1000
  })

  const mergeServerRowsWithDrafts = useCallback((rows) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))

    setEditedRows(prev => {
      const next = {}
      for (const [id, value] of Object.entries(prev || {})) {
        if (rowIds.has(String(id))) next[id] = value
      }
      return Object.keys(next).length === Object.keys(prev || {}).length ? prev : next
    })

    return (rows || []).map(row => {
      const draft = drafts[row.id] || drafts[String(row.id)]
      return draft ? { ...row, ...draft } : row
    })
  }, [setEditedRows])

  // Load machine setups
  const loadData = useCallback(async ({ force = false } = {}) => {
    const loadKey = `${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) return
    lastLoadKeyRef.current = loadKey

    setIsLoading(true)
    try {
      const [setupsResult, countsResult] = await Promise.all([
        getSimplexMachineSetupsAction(),
        getSimplexCountOptionsAction()
      ])
      
      const setups = setupsResult.success ? setupsResult.data : []
      const counts = countsResult.success ? countsResult.data : []
      
      // Sort by natural machine number order (1, 2, ... 10, 11)
      const sortedSetups = setups?.sort((a, b) => {
        const aNum = parseInt(a.machine?.machine_no || '0')
        const bNum = parseInt(b.machine?.machine_no || '0')
        return aNum - bNum
      }) || []
      const mergedRows = mergeServerRowsWithDrafts(sortedSetups)
      setSetupData(mergedRows)
      setCountOptions(counts || [])
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading machine setups:', error)
      toast.error('Failed to load machine setups')
    } finally {
      setIsLoading(false)
    }
  }, [totalTime, mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  const parseCountTpi = (value) => {
    if (value == null) return null
    const match = String(value).match(/\d+(\.\d+)?/)
    if (!match) return null
    const parsed = parseFloat(match[0])
    return Number.isNaN(parsed) ? null : parsed
  }

  const getMachineNoDigits = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    return digits || String(value || '').trim()
  }

  const buildSimplexDescription = (value) => {
    const digits = getMachineNoDigits(value)
    return digits ? `${digits} - SIMPLEX${digits}` : ''
  }

  const getSelectedCountTpi = (countName) => {
    const selected = (countOptions || []).find(c => c.count_name === countName)
    return parseCountTpi(selected?.tpi)
  }

  const handleMachineNoLookup = async (machineNo) => {
    const val = String(machineNo || '').trim().toUpperCase()
    if (!val) return

    const toastId = toast.loading(`Looking up machine #${val}...`)
    const result = await lookupSimplexMachineByNoAction(val)

    if (!result.success) {
      toast.error(result.error || 'Lookup failed', { id: toastId })
      return
    }

    if (!result.data) {
      setNewMachine(prev => ({
        ...prev,
        machine_no: val,
        description: prev.description || buildSimplexDescription(val)
      }))
      toast.info(`Master not found. Description auto-filled for #${val}`, { id: toastId })
      return
    }

    const d = result.data
    const selectedCountTpi = getSelectedCountTpi(d.prodn_mixing)
    setNewMachine(prev => ({
      ...prev,
      machine_no: d.machine_no ?? prev.machine_no,
      description: d.description || prev.description,
      make_name: d.make_name || prev.make_name,
      model: d.model || prev.model,
      installed_date: d.installed_date
        ? String(d.installed_date).split('T')[0]
        : prev.installed_date,
      prodn_mixing: d.prodn_mixing || prev.prodn_mixing,
      ...(d.speed != null && { speed: Number(d.speed) }),
      ...(d.prodn_efficiency != null && { prodn_effi: Number(d.prodn_efficiency) }),
      tpi: selectedCountTpi ?? (d.tpi != null ? Number(d.tpi) : prev.tpi),
      ...(d.no_of_spindles != null && { no_of_spindles: Number(d.no_of_spindles) })
    }))

    if (d.has_setup) {
      toast.info(`Machine #${val} found - it will be reactivated with existing setup`, { id: toastId })
    } else {
      toast.success(`Machine #${val} details filled`, { id: toastId })
    }
  }

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const baseRow = setupData.find(row => String(row.id) === String(rowId))
    const machineId = baseRow?.machine?.id || baseRow?.machine_id
    setSetupData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      return { ...row, [field]: value }
    }))
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        ...(machineId ? { machine_id: machineId } : {}),
        [field]: value
      }
    }))
  }

  // Toggle row selection (using setup row ID)
  const handleRowSelect = (rowId) => {
    setSelectedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    )
  }

  // Select all rows
  const handleSelectAll = () => {
    if (selectedRows.length === setupData.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(setupData.map(row => row.id))
    }
  }

  // Handle save
  const handleSave = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    const currentEdits = editedRowsRef.current || editedRows || {}
    const editedRowIds = Object.keys(currentEdits)
    if (editedRowIds.length === 0) {
      if (!suppressNoChangesToast) toast.info('No changes to save')
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const rowsToSave = setupData.filter(row => currentEdits[row.id] || currentEdits[String(row.id)])
      
      for (const row of rowsToSave) {
        const resolvedSpeed = parseIntOr(row.speed ?? row.machine?.speed, 960)
        await updateSimplexMachineSetupAction(row.id, {
          prodn_mixing: row.prodn_mixing,
          session_no: parseIntOr(row.session_no, 1),
          cc_time: parseFloatOr(row.cc_time, 0),
          sl_hank: parseFloatOr(row.sl_hank, 1.4),
          mc_effi: parseFloatOr(row.mc_effi, 92),
          tpi: parseFloatOr(row.tpi, 1.73),
          spindles: parseIntOr(row.spindles, 140),
          speed: resolvedSpeed,
          shift_time: parseIntOr(row.shift_time, 510)
        })
      }

      if (!suppressSuccessToast) {
        toast.success(`${rowsToSave.length} row(s) saved successfully`)
      }
      setEditedRows({})
      
      await loadData({ force: true })
      if (!skipParentRefresh) onRefresh?.()
      return { success: true, saved: rowsToSave.length }
    } catch (error) {
      console.error('Error saving machine setup:', error)
      toast.error('Failed to save changes')
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

  // Handle count change
  const handleCountChange = async () => {
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
      // Extract machine IDs from selected setup row IDs
      const machineIds = selectedRows.map(rowId => {
        const setup = setupData.find(r => r.id === rowId)
        return setup?.machine?.id
      }).filter(Boolean)
      
      await bulkUpdateSimplexMachineCountAction(machineIds, countToSet)
      toast.success(`Count updated for ${selectedRows.length} machine(s)`)
      setShowCountChangeDialog(false)
      setNewCount('')
      setCustomCount('')
      setSelectedRows([])
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error updating count:', error)
      toast.error('Failed to update count')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle add new machine (creates both machine and setup - like Comber)
  const handleAddMachine = async () => {
    if (!newMachine.machine_no) {
      toast.warning('Please enter machine number')
      return
    }

    setIsSaving(true)
    try {
      const selectedCountTpi = getSelectedCountTpi(newMachine.prodn_mixing)
      const result = await addSimplexMachineAction({
        machine_no: newMachine.machine_no,
        description: newMachine.description,
        make_name: newMachine.make_name,
        model: newMachine.model,
        installed_date: newMachine.installed_date,
        prodn_mixing: newMachine.prodn_mixing,
        speed: newMachine.speed,
        prodn_effi: newMachine.prodn_effi,
        tpi: selectedCountTpi ?? newMachine.tpi,
        count_tpi: (countOptions.find(c => c.count_name === newMachine.prodn_mixing)?.tpi) || null,
        no_of_spindles: newMachine.no_of_spindles,
        session_no: 1,
        cc_time: 0,
        sl_hank: 1.4,
        mc_effi: 92
      })

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to add machine')
      }
      
      toast.success('New machine added successfully')
      setShowAddDialog(false)
      setNewMachine({
        machine_no: '',
        description: '',
        make_name: '',
        model: '',
        installed_date: new Date().toISOString().split('T')[0],
        prodn_mixing: '',
        prodn_effi: 85,
        tpi: 1.73,
        no_of_spindles: 140,
        speed: 1000
      })
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error adding machine:', error)
      const errorMsg = error?.message || error?.toString() || 'Failed to add machine'
      toast.error(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle remove selected machines (soft delete - deactivates machine)
  const handleRemoveMachines = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select machines to remove')
      return
    }

    setIsSaving(true)
    try {
      for (const rowId of selectedRows) {
        const machineSetup = setupData.find(s => s.id === rowId)
        if (machineSetup?.machine?.id) {
          await removeSimplexMachineAction(machineSetup.machine.id)
        }
      }
      
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

  return (
    <div className="space-y-4">
      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2">Loading machine setups...</span>
        </div>
      ) : (
        <>
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{setupData.length} machines</span>
              {Object.keys(editedRows).length > 0 && (
                <span className="text-yellow-600 font-medium text-sm">
                  • {Object.keys(editedRows).length} unsaved change(s)
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
        <div className="overflow-x-auto max-h-125 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-24 whitespace-nowrap">Make</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-48 whitespace-nowrap">Count/Mixing</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">CC Time</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Sl.Hank</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">MC.Effi%</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 whitespace-nowrap">TPI</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Spindles</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">ShiftTime</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {setupData.map((row, index) => {
                const machine = row.machine || {}
                const isEdited = editedRows[row.id]
                const isSelected = selectedRows.includes(row.id)

                return (
                  <tr 
                    key={row.id}
                    className={`
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                      ${isEdited ? 'bg-yellow-50' : ''} 
                      ${isSelected ? 'bg-blue-100' : ''}
                      hover:bg-blue-50
                    `}
                  >
                    {/* Checkbox */}
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRowSelect(row.id)}
                        className="rounded border-gray-300"
                      />
                    </td>

                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                      {machine.machine_no || '-'}
                    </td>
                    
                    {/* Make */}
                    <td className="border border-gray-300 px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis" title={machine.make_name || '-'}>
                      {machine.make_name || '-'}
                    </td>
                    
                    {/* Count/Mixing */}
                    <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="prodn_mixing">
                      <EnterSelect
                        value={row.prodn_mixing || ''}
                        options={
                          countOptions.length > 0
                            ? countOptions.map(c => ({ value: c.count_name, label: c.count_name }))
                            : []
                        }
                        onChange={(value) => handleInputChange(row.id, 'prodn_mixing', value)}
                        onNextRow={() => {
                          const next = tableRef.current?.querySelector(`td[data-row="${index + 1}"][data-col="prodn_mixing"] button`)
                          if (next) next.focus()
                        }}
                        placeholder="Select count/mixing"
                        className="h-9 rounded-none text-xs"
                        searchable
                      />
                    </td>
                    
                    {/* Session */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.session_no ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'session_no', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="session_no"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'session_no')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* CC Time */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.cc_time ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'cc_time', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="cc_time"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'cc_time')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* Sliver Hank */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.sl_hank ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'sl_hank', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="sl_hank"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'sl_hank')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* MC Efficiency */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.mc_effi ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'mc_effi', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="mc_effi"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'mc_effi')}
                      />
                    </td>
                    
                    {/* TPI */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.tpi ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'tpi', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="tpi"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'tpi')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* Spindles */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.spindles ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'spindles', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="spindles"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'spindles')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* Speed */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        value={row.speed ?? machine.speed ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'speed', e.target.value)}
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        data-row={index}
                        data-col="speed"
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'speed')}
                        zeroAsEmpty
                      />
                    </td>
                    
                    {/* Shift Time - Read-only from shift config */}
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-blue-600 tabular-nums whitespace-nowrap">
                      {totalTime}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button 
          variant="outline"
          onClick={() => setShowCountChangeDialog(true)}
          disabled={selectedRows.length === 0}
        >
          <Edit className="h-4 w-4 mr-1" />
          Count change {selectedRows.length > 0 && `(${selectedRows.length})`}
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
          Remove machine {selectedRows.length > 0 && `(${selectedRows.length})`}
        </Button>
      </div>

      {/* Count Change Dialog */}
      <Dialog open={showCountChangeDialog} onOpenChange={setShowCountChangeDialog}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Change Count/Mixing</DialogTitle>
            <DialogDescription>
              Update count/mixing for {selectedRows.length} selected machine(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="existing-count">Select Existing Count</Label>
              <EnterSelect
                value={newCount}
                options={countOptions.map(c => ({ value: c.count_name, label: c.count_name }))}
                onChange={(v) => { setNewCount(v); setCustomCount(''); }}
                searchable
                className="w-full"
              />
            </div>
            
            <div className="text-center text-gray-500 text-sm">- OR -</div>
            
            <div>
              <Label htmlFor="custom-count">Enter Custom Count</Label>
              <Input
                id="custom-count"
                type="text"
                value={customCount}
                onChange={(e) => {
                  setCustomCount(e.target.value)
                  setNewCount('')
                }}
                placeholder="e.g., 80CARDED or 50COMBED"
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCountChangeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCountChange}
              disabled={isSaving || (!newCount && !customCount)}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Machine Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>
              Create or reactivate a simplex machine and add it to setup
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-machine-no">M/C No. *</Label>
                <Input
                  id="add-machine-no"
                  type="text"
                  value={newMachine.machine_no}
                  onChange={(e) => {
                    const raw = e.target.value.toUpperCase()
                    setNewMachine(prev => {
                      const next = { ...prev, machine_no: raw }
                      if (!prev.description || prev.description === buildSimplexDescription(prev.machine_no)) {
                        next.description = buildSimplexDescription(raw)
                      }
                      return next
                    })
                  }}
                  onBlur={(e) => handleMachineNoLookup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleMachineNoLookup(newMachine.machine_no)
                    }
                  }}
                  placeholder="Enter machine number"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="add-description">Description</Label>
                <Input
                  id="add-description"
                  type="text"
                  value={newMachine.description}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="add-make">Make Name</Label>
                <Input
                  id="add-make"
                  type="text"
                  value={newMachine.make_name}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, make_name: e.target.value }))}
                  placeholder="Enter make name"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="add-model">Model</Label>
                <Input
                  id="add-model"
                  type="text"
                  value={newMachine.model}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="Enter model"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="add-mixing">Count Name</Label>
                <div className="mt-2">
                  <EnterSelect
                    value={newMachine.prodn_mixing}
                    options={countOptions.map(c => ({ value: c.count_name, label: c.count_name }))}
                    onChange={(v) => {
                      const selected = countOptions.find(c => c.count_name === v)
                      const selectedTpi = parseCountTpi(selected?.tpi)
                      setNewMachine(prev => ({
                        ...prev,
                        prodn_mixing: v,
                        tpi: selectedTpi ?? prev.tpi
                      }))
                    }}
                    searchable
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="add-speed">Speed</Label>
                <NumberInput
                  id="add-speed"
                  value={newMachine.speed}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, speed: e.target.value }))}
                  className="mt-2"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
              <div>
                <Label htmlFor="add-std-effi">Std Effi %</Label>
                <NumberInput
                  id="add-std-effi"
                  value={newMachine.prodn_effi}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, prodn_effi: e.target.value }))}
                  className="mt-2"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
              <div>
                <Label htmlFor="add-tpi">TPI</Label>
                <NumberInput
                  id="add-tpi"
                  value={newMachine.tpi}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, tpi: e.target.value }))}
                  className="mt-2"
                  zeroAsEmpty
                  step="0.01"
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-spindles">No. of Spindles</Label>
                <NumberInput
                  id="add-spindles"
                  value={newMachine.no_of_spindles}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, no_of_spindles: e.target.value }))}
                  className="mt-2"
                  zeroAsEmpty
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                />
              </div>
              <div>
                <Label htmlFor="add-installed-date">Installed Date</Label>
                <Input
                  id="add-installed-date"
                  type="date"
                  value={newMachine.installed_date || ''}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, installed_date: e.target.value }))}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddMachine}
              disabled={isSaving || !newMachine.machine_no}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Remove Machines</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedRows.length} selected machine(s) from setup?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-sm text-gray-600">
              Selected machines to remove:
              <ul className="list-disc pl-5 mt-2">
                {selectedRows.map(rowId => {
                  const machine = setupData.find(r => r.id === rowId)?.machine
                  return (
                    <li key={rowId}>
                      {machine?.machine_no || 'Unknown'} - {machine?.machine_name || 'N/A'}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRemoveMachines}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  )
})

export default SimplexMachineSetupTab
