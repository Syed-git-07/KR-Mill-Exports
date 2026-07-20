'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import EnterSelect from "@/components/ui/enter-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAutoconerMachineSetupsAction,
  updateAutoconerMachineSetupAction,
  upsertAutoconerMachineSetupAction,
  getSpinningCountsAction,
  getAutoconerMachinesAction,
  lookupAutoconerMachineByNoAction,
  addAutoconerMachineAction,
  removeAutoconerMachineAction,
  removeAutoconerMachineSetupsAction
} from '@/app/actions/autoconerEntryActions'

/**
 * Autoconer Machine Setup Tab
 * Manages machine configuration: Count assignment, Session, Run Time
 * Supports bulk operations: Count Check, Count Change, Add/Remove machines
 */

const AutoconerMachineSetupTab = forwardRef(function AutoconerMachineSetupTab({
  shift = 1,
  totalTime = 510,
  onRefresh,
  entryDate,
  sharedDraftEdits,
  onSharedDraftEditsChange
}, ref) {
  const [setupData, setSetupData] = useState([])
  const [counts, setCounts] = useState([])
  const [machines, setMachines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = sharedDraftEdits ?? localEditedRows
  const editedRowsRef = useRef({})
  const setEditedRows = useCallback((updater) => {
    const applyUpdate = (current) => (typeof updater === 'function' ? updater(current) : updater)
    setLocalEditedRows(prev => applyUpdate(prev))
    if (onSharedDraftEditsChange) {
      onSharedDraftEditsChange(prev => applyUpdate(prev || {}))
    }
  }, [onSharedDraftEditsChange])
  const [selectedRows, setSelectedRows] = useState([])

  useEffect(() => {
    editedRowsRef.current = editedRows || {}
  }, [editedRows])

  // Table ref for Enter/Arrow row navigation
  const tableRef = useRef(null)
  const focusRowByDelta = useCallback((rowIndex, delta, colName) => {
    const targetRow = rowIndex + delta
    if (targetRow < 0 || !tableRef.current) return
    const targetInput = tableRef.current.querySelector(
      `input[data-row="${targetRow}"][data-col="${colName}"]`
    )
    if (targetInput) { targetInput.focus(); targetInput.select() }
  }, [])
  const handleEnterNavigation = useCallback((e, rowIndex, colName) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, colName) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, colName) }
  }, [focusRowByDelta])

  // Arrow Up/Down navigation between inputs in the Add New Machine dialog
  const handleDialogNav = useCallback((e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const dialog = e.currentTarget.closest('[role="dialog"]')
    if (!dialog) return
    const focusable = Array.from(
      dialog.querySelectorAll('input:not([readonly]):not([disabled]), button[role="combobox"]')
    ).filter(el => el.offsetParent !== null)
    const idx = focusable.indexOf(e.currentTarget)
    if (idx === -1) return
    const next = focusable[e.key === 'ArrowDown' ? idx + 1 : idx - 1]
    if (next) { next.focus(); if (next.select) next.select() }
  }, [])

  // Count change dialog
  const [countChangeDialog, setCountChangeDialog] = useState(false)
  const [newCountId, setNewCountId] = useState('')

  // Add machine dialog (for existing machines without setup)
  const [addMachineDialog, setAddMachineDialog] = useState(false)
  const [newMachine, setNewMachine] = useState({
    machine_id: '',
    count_id: '',
    session_no: 1,
    run_time: 510
  })

  // Add NEW machine dialog (for creating new machine in master)
  const [addNewMachineDialog, setAddNewMachineDialog] = useState(false)
  const [newMachineData, setNewMachineData] = useState({
    mc_id: '',
    group_id: '',
    machine_no: '',
    description: '',
    make_name: 'MURT',
    model: '',
    from_drum: '',
    to_drum: '',
    no_of_drums: '',
    speed: '',
    count: '',
    act_effi: '',
    installed_date: new Date().toISOString().split('T')[0],
    // Setup fields
    count_id: '',
    count_name: '',
    session_no: 1,
    run_time: 510
  })

  // Remove machine dialog
  const [removeDialog, setRemoveDialog] = useState(false)

  // Helper to calculate next machine number for a group
  const getNextMachineNoForGroup = useCallback((groupId) => {
    if (!groupId) return ''
    
    // Find all machines in this group from current machines list
    const groupMachines = machines.filter(m => m.group_id === parseInt(groupId))
    
    if (groupMachines.length === 0) {
      // First machine in this group
      return `AC${groupId}-1`
    }
    
    // Find the highest sub-number in this group
    let maxSubNum = 0
    groupMachines.forEach(m => {
      const match = m.machine_no?.match(/^AC(\d+)-(\d+)$/i)
      if (match && parseInt(match[1]) === parseInt(groupId)) {
        const subNum = parseInt(match[2])
        if (subNum > maxSubNum) maxSubNum = subNum
      }
    })
    
    return `AC${groupId}-${maxSubNum + 1}`
  }, [machines])

  // Helper to get next mc_id
  const getNextMcId = useCallback(() => {
    if (machines.length === 0) return 1
    const maxMcId = Math.max(...machines.map(m => m.mc_id || 0))
    return maxMcId + 1
  }, [machines])

  // Lookup machine from master by machine_no and auto-fill the Add New Machine form
  // Searches ALL machines (active + inactive) via server action to avoid stale state issues
  const handleMachineNoLookup = useCallback(async (machineNo) => {
    const trimmed = machineNo?.trim()
    if (!trimmed) return
    toast.loading('Looking up machine...', { id: 'machine-lookup' })
    const result = await lookupAutoconerMachineByNoAction(trimmed)
    if (!result.success) {
      toast.error(`Lookup error: ${result.error}`, { id: 'machine-lookup' })
      return
    }
    if (!result.data) {
      toast.error(`Machine "${trimmed}" not found in master. Enter details manually or check the machine number.`, { id: 'machine-lookup' })
      return
    }
    const found = result.data
    const matchedCount = counts.find(c => c.count_name === found.count)
    const derivedActEffi = found.act_effi ?? matchedCount?.effi_actual_prodn ?? matchedCount?.auto_effi
    const dateStr = found.installed_date
      ? String(found.installed_date).split('T')[0]
      : new Date().toISOString().split('T')[0]
    setNewMachineData(prev => ({
      ...prev,
      machine_no: found.machine_no,
      group_id: found.group_id?.toString() || '',
      description: found.description || '',
      make_name: found.make_name || 'MURT',
      model: found.model || '',
      from_drum: found.from_drum?.toString() || '',
      to_drum: found.to_drum?.toString() || '',
      no_of_drums: found.no_of_drums?.toString() || '',
      speed: found.speed?.toString() || '',
      count: found.count || '',
      count_id: matchedCount?.id || '',
      count_name: found.count || '',
      act_effi: derivedActEffi != null ? derivedActEffi.toString() : '',
      installed_date: dateStr,
    }))
    toast.success(`Machine ${found.machine_no} found — all fields auto-filled from master`, { id: 'machine-lookup' })
  }, [counts])

  const mergeServerRowsWithDrafts = useCallback((rows = []) => {
    const drafts = editedRowsRef.current || {}
    return rows.map(row => {
      const draft = drafts[row.id] || drafts[String(row.id)]
      return draft ? { ...row, ...draft } : row
    })
  }, [])

  // Load data
  const loadData = useCallback(async () => {
    if (!entryDate) return
    setIsLoading(true)
    try {
      const [setupsResult, countsResult, machinesResult] = await Promise.all([
        getAutoconerMachineSetupsAction(shift, entryDate),  // Pass shift and entryDate
        getSpinningCountsAction(),
        getAutoconerMachinesAction()
      ])
      
      const rows = setupsResult.success ? setupsResult.data || [] : []
      setSetupData(mergeServerRowsWithDrafts(rows))
      setCounts(countsResult.success ? countsResult.data || [] : [])
      setMachines(machinesResult.success ? machinesResult.data || [] : [])
    } catch (error) {
      console.error('Error loading setup data:', error)
      toast.error('Failed to load setup data')
    } finally {
      setIsLoading(false)
    }
  }, [shift, entryDate, mergeServerRowsWithDrafts])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    const baseRow = setupData.find(row => row.id === rowId)
    const machineId = baseRow?.machine_id ?? baseRow?.machine?.id
    const numValue = field === 'session_no' || field === 'run_time' ? parseInt(value) || 0 : value
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        ...(machineId ? { machine_id: machineId } : {}),
        [field]: numValue
      }
    }))

    setSetupData(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: numValue } : row
    ))
  }

  // Handle count change for a row - includes act_count from spinning_counts
  const handleCountChange = (rowId, countId) => {
    const count = counts.find(c => c.id === countId)
    const baseRow = setupData.find(row => row.id === rowId)
    const machineId = baseRow?.machine_id ?? baseRow?.machine?.id
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        ...(machineId ? { machine_id: machineId } : {}),
        count_id: countId,
        count_name: count?.count_name,
        act_count: count?.act_count || 0
      }
    }))

    setSetupData(prev => prev.map(row => 
      row.id === rowId ? { ...row, count_id: countId, count_name: count?.count_name, act_count: count?.act_count || 0 } : row
    ))
  }

  // Toggle row selection
  const toggleRowSelection = (rowId) => {
    setSelectedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    )
  }

  // Select all rows
  const toggleSelectAll = () => {
    if (selectedRows.length === setupData.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(setupData.map(r => r.id))
    }
  }

  // Apply count change to selected rows - includes act_count from spinning_counts
  const handleBulkCountChange = () => {
    if (!newCountId) {
      toast.warning('Please select a count')
      return
    }

    const count = counts.find(c => c.id === newCountId)
    
    selectedRows.forEach(rowId => {
      setEditedRows(prev => ({
        ...prev,
        [rowId]: {
          ...prev[rowId],
          count_id: newCountId,
          count_name: count?.count_name,
          act_count: count?.act_count || 0
        }
      }))
    })

    setSetupData(prev => prev.map(row => 
      selectedRows.includes(row.id) 
        ? { ...row, count_id: newCountId, count_name: count?.count_name, act_count: count?.act_count || 0 } 
        : row
    ))

    setCountChangeDialog(false)
    setNewCountId('')
    toast.success(`Count changed for ${selectedRows.length} machines`)
  }

  // Save all changes
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
        updateAutoconerMachineSetupAction(rowId, changes, shift)
      )

      await Promise.all(updatePromises)
      const savedCount = Object.keys(editedRows).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Setup data saved successfully')
      }
      
      await loadData()
      if (!skipParentRefresh) {
        onRefresh?.()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving setup data:', error)
      toast.error('Failed to save setup data')
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
    await loadData()
  }

  const discardChanges = async () => {
    setEditedRows({})
    await loadData()
    return { success: true }
  }

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRows).length === 0) return true
    return window.confirm('You have unsaved machine setup edits. This action will reload data and discard them. Continue?')
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRows).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, editedRows, isSaving, discardChanges])

  // Add new machine setup
  const handleAddMachine = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (!newMachine.machine_id || !newMachine.count_id) {
      toast.warning('Please select machine and count')
      return
    }

    // Check if machine already has a setup
    if (setupData.some(s => s.machine_id === newMachine.machine_id)) {
      toast.warning('Machine already has a setup')
      return
    }

    setIsSaving(true)
    try {
      const machine = machines.find(m => m.id === newMachine.machine_id)
      const count = counts.find(c => c.id === newMachine.count_id)
      
      const result = await upsertAutoconerMachineSetupAction(
        newMachine.machine_id,
        entryDate,
        shift,
        {
          count_id: newMachine.count_id,
          count_name: count?.count_name,
          session_no: newMachine.session_no,
          run_time: newMachine.run_time
        }
      )

      if (!result.success) throw new Error(result.error)

      setAddMachineDialog(false)
      setNewMachine({ machine_id: '', count_id: '', session_no: 1, run_time: totalTime })
      toast.success(`Machine ${machine?.machine_no} added to setup`)
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error adding machine:', error)
      toast.error('Failed to add machine')
    } finally {
      setIsSaving(false)
    }
  }

  // Add brand NEW machine (creates in master table + setup)
  const handleAddNewMachine = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (!newMachineData.group_id) {
      toast.warning('Please enter Group ID')
      return
    }
    if (!newMachineData.machine_no) {
      toast.warning('Machine number is required')
      return
    }

    setIsSaving(true)
    try {
      const count = counts.find(c => c.id === newMachineData.count_id)
      
      // Convert date to full ISO DateTime format for Prisma
      const installedDate = newMachineData.installed_date 
        ? new Date(newMachineData.installed_date + 'T00:00:00.000Z')
        : null
      
      const result = await addAutoconerMachineAction({
        ...newMachineData,
        description: newMachineData.description || newMachineData.machine_no,
        count_name: count?.count_name || null,
        mc_id: newMachineData.mc_id ? parseInt(newMachineData.mc_id) : null,
        group_id: newMachineData.group_id ? parseInt(newMachineData.group_id) : null,
        from_drum: newMachineData.from_drum ? parseInt(newMachineData.from_drum) : null,
        to_drum: newMachineData.to_drum ? parseInt(newMachineData.to_drum) : null,
        no_of_drums: newMachineData.no_of_drums ? parseInt(newMachineData.no_of_drums) : null,
        speed: newMachineData.speed ? parseInt(newMachineData.speed) : null,
        act_effi: newMachineData.act_effi ? parseInt(newMachineData.act_effi) : 0,
        installed_date: installedDate,
        count_id: newMachineData.count_id || null,
        entryDate,
        shift
      })
      
      if (!result.success) throw new Error(result.error)
      
      if (result.data.reactivated) {
        toast.success(`Machine ${newMachineData.machine_no} reactivated successfully`)
      } else {
        toast.success(`Machine ${result.data.machine?.machine_no || newMachineData.machine_no} added successfully`)
      }
      
      setAddNewMachineDialog(false)
      setNewMachineData({
        mc_id: '',
        group_id: '',
        machine_no: '',
        description: '',
        make_name: 'MURT',
        model: '',
        from_drum: '',
        to_drum: '',
        no_of_drums: '',
        speed: '',
        count: '',
        act_effi: '',
        installed_date: new Date().toISOString().split('T')[0],
        count_id: '',
        count_name: '',
        session_no: 1,
        run_time: totalTime
      })
      
      await loadData()
      onRefresh?.()
    } catch (error) {
      console.error('Error adding new machine:', error)
      toast.error(error.message || 'Failed to add machine')
    } finally {
      setIsSaving(false)
    }
  }

  // Remove selected machines from setup AND deactivate the machine master
  const handleRemoveMachines = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (selectedRows.length === 0) {
      toast.warning('Please select machines to remove')
      return
    }

    setIsSaving(true)
    try {
      // Get machine IDs from selected setup rows (machine is a nested object)
      const machineIds = selectedRows
        .map(setupId => setupData.find(s => s.id === setupId)?.machine?.id)
        .filter(id => id !== undefined)

      // Deactivate machines in master table (like Carding)
      const removePromises = machineIds.map(id => removeAutoconerMachineAction(id, entryDate))
      await Promise.all(removePromises)

      toast.success(`${selectedRows.length} machine(s) removed successfully`)
      setRemoveDialog(false)
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

  // Count check - verify counts against master
  const handleCountCheck = async () => {
    const invalidSetups = setupData.filter(s => {
      const validCount = counts.find(c => c.id === s.count_id)
      return !validCount
    })

    if (invalidSetups.length === 0) {
      toast.success('All counts are valid!')
    } else {
      toast.warning(`${invalidSetups.length} machines have invalid counts`)
      // Highlight invalid rows
      setSelectedRows(invalidSetups.map(s => s.id))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading setup data...</span>
      </div>
    )
  }

  // Get available machines (not yet in setup)
  const availableMachines = machines.filter(m => !setupData.some(s => s.machine_id === m.id))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {setupData.length} machines configured
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshClick}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Setup Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto max-h-112.5 overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 w-10">
                  <Checkbox
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onCheckedChange={toggleSelectAll}
                    className="border-white"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16 whitespace-nowrap">Mc.No</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-28 whitespace-nowrap">Make Name</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-48 whitespace-nowrap">Count Name</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Act Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Shift Time</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Drums</th>
              </tr>
            </thead>
            <tbody>
              {setupData.map((row, index) => {
                const machine = row.machine
                const rowKey = row.id || `setup-row-${index}`
                const isSelected = selectedRows.includes(row.id)
                const isEdited = editedRows[row.id]
                
                return (
                  <tr 
                    key={rowKey}
                    className={`
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                      ${isSelected ? 'bg-blue-100' : ''} 
                      ${isEdited ? 'bg-yellow-50' : ''} 
                      hover:bg-blue-50
                    `}
                  >
                    {/* Select */}
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRowSelection(row.id)}
                      />
                    </td>
                    {/* Machine No */}
                    <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                      {machine?.machine_no}
                    </td>
                    {/* Make Name */}
                    <td className="border border-gray-300 px-2 py-1 text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">
                      {machine?.make_name ?? '-'}
                    </td>
                    {/* Count Selection - allows changing the count */}
                    <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="count_name">
                      <EnterSelect
                        value={row.count_id || 'none'}
                        options={[
                          { value: 'none', label: '-' },
                          ...counts.map(c => ({ value: c.id, label: c.count_name }))
                        ]}
                        onChange={(val) => handleCountChange(row.id, val === 'none' ? null : val)}
                        onNextRow={() => {
                          const next = tableRef.current?.querySelector(`td[data-row="${index + 1}"][data-col="count_name"] button`)
                          if (next) next.focus()
                        }}
                        placeholder="Select count"
                        className="h-9 rounded-none"
                        cleanCell
                        editingHighlight
                        searchable
                      />
                    </td>
                    {/* Act Count - displays the numeric act_count value from spinning_counts */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-sm font-medium tabular-nums whitespace-nowrap">
                      {row.act_count ? parseFloat(row.act_count).toFixed(1) : '-'}
                    </td>
                    {/* Session */}
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        min="1"
                        max="3"
                        value={row.session_no ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'session_no', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'session_no')}
                        data-row={index}
                        data-col="session_no"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    {/* Shift Time (from shift config - updates when shift changes) */}
                    <td className="border border-gray-300 px-2 py-1 text-center bg-blue-50 font-medium tabular-nums whitespace-nowrap">
                      {totalTime}
                    </td>
                    {/* Drums */}
                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-600 tabular-nums whitespace-nowrap">
                      {machine?.no_of_drums ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCountChangeDialog(true)}
            disabled={selectedRows.length === 0}
          >
            Count Change {selectedRows.length > 0 && `(${selectedRows.length})`}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setAddNewMachineDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add new machine
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setRemoveDialog(true)}
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

      {/* Count Change Dialog */}
      <Dialog open={countChangeDialog} onOpenChange={setCountChangeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Count for {selectedRows.length} Machines</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select New Count</Label>
              <EnterSelect
                value={newCountId || ''}
                options={counts.map(c => ({ value: c.id, label: c.count_name }))}
                onChange={(val) => setNewCountId(val || '')}
                placeholder="Select count..."
                searchable
                className="mt-2 w-full"
              />
            </div>
            <div className="text-sm text-gray-500">
              This will change the count for all {selectedRows.length} selected machines.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountChangeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkCountChange} disabled={!newCountId}>
              Apply Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Machine Dialog */}
      <Dialog open={addMachineDialog} onOpenChange={setAddMachineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Machine to Setup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Machine</Label>
              <Select 
                value={newMachine.machine_id || 'none'} 
                onValueChange={(value) => setNewMachine(prev => ({ ...prev, machine_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select machine..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select machine...</SelectItem>
                  {availableMachines.map(machine => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.machine_no} ({machine.no_of_drums} drums)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Count</Label>
              <EnterSelect
                value={newMachine.count_id || ''}
                options={counts.map(c => ({ value: c.id, label: c.count_name }))}
                onChange={(val) => setNewMachine(prev => ({ ...prev, count_id: val || '' }))}
                placeholder="Select count..."
                searchable
                className="mt-2 w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Session</Label>
                <NumberInput
                  type="number"
                  min="1"
                  max="3"
                  value={newMachine.session_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, session_no: parseInt(e.target.value) || 1 }))}
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                  className="mt-2"
                  zeroAsEmpty
                />
              </div>
              <div>
                <Label>Shift Time (mins)</Label>
                <Input
                  type="number"
                  value={newMachine.run_time}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, run_time: parseInt(e.target.value) || totalTime }))}
                  className="mt-2"
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">Auto-set from shift config</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMachineDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMachine} disabled={isSaving || !newMachine.machine_id || !newMachine.count_id}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machine Dialog */}
      <Dialog open={removeDialog} onOpenChange={setRemoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Machines</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <strong>Warning:</strong> Are you sure you want to remove {selectedRows.length} selected machine(s) from setup? 
              This will not affect existing production data.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRemoveMachines} 
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Remove {selectedRows.length} Machine(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add NEW Machine Dialog (Create new machine in master) */}
      <Dialog open={addNewMachineDialog} onOpenChange={setAddNewMachineDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Autoconer Machine</DialogTitle>
          </DialogHeader>
          <div className="bg-blue-50 p-2 rounded-lg mb-2">
            <p className="text-xs text-blue-800">Machine Make Screen : To Add, Modify Machine Make Details</p>
          </div>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
            {/* Row 1: M/c No. — primary field, press Enter to auto-fill from master */}
            <div>
              <Label>M/c No. *</Label>
              <Input
                type="text"
                placeholder="Type machine no. e.g. AC5-2 and press Enter to auto-fill from master"
                value={newMachineData.machine_no}
                onChange={(e) => setNewMachineData(prev => ({ ...prev, machine_no: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const currentValue = e.currentTarget.value  // read directly from DOM to avoid stale closure
                    handleMachineNoLookup(currentValue)
                  } else {
                    handleDialogNav(e)
                  }
                }}
                className="mt-1"
              />
              <p className="text-xs text-blue-600 mt-1">↳ Press Enter to auto-fill details from master</p>
            </div>

            {/* Row 2: Group ID & Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Group ID *</Label>
                <NumberInput
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={newMachineData.group_id}
                  onChange={(e) => {
                    const groupId = e.target.value
                    const nextMachineNo = getNextMachineNoForGroup(groupId)
                    setNewMachineData(prev => ({
                      ...prev,
                      group_id: groupId,
                      machine_no: nextMachineNo,
                      description: nextMachineNo
                    }))
                  }}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                  zeroAsEmpty
                />
                <p className="text-xs text-blue-600 mt-1">↳ Auto-generates M/c No. &amp; Description</p>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  type="text"
                  placeholder="Auto-filled from M/c No."
                  value={newMachineData.description}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, description: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Row 3: Make Name & Model */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Make Name</Label>
                <Input
                  type="text"
                  placeholder="e.g. MURT, SCHLAFHORST, SAVIO"
                  value={newMachineData.make_name}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, make_name: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  type="text"
                  placeholder="e.g. Autoconer 338, X5"
                  value={newMachineData.model}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, model: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Row 4: From Drum & To Drum */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Drum</Label>
                <NumberInput
                  type="number"
                  placeholder="e.g. 1"
                  value={newMachineData.from_drum}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, from_drum: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                  zeroAsEmpty
                />
              </div>
              <div>
                <Label>To Drum</Label>
                <NumberInput
                  type="number"
                  placeholder="e.g. 60 → auto-calculates count"
                  value={newMachineData.to_drum}
                  onChange={(e) => {
                    const toDrum = e.target.value
                    const fromDrum = parseInt(newMachineData.from_drum) || 0
                    const toVal = parseInt(toDrum) || 0
                    setNewMachineData(prev => ({ 
                      ...prev, 
                      to_drum: toDrum,
                      no_of_drums: toVal > fromDrum ? (toVal - fromDrum + 1).toString() : prev.no_of_drums
                    }))
                  }}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                  zeroAsEmpty
                />
                <p className="text-xs text-muted-foreground mt-1">No. of Drums auto-calculated</p>
              </div>
            </div>

            {/* Row 5: No. of Drums */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>No. of Drums</Label>
                <NumberInput
                  type="number"
                  placeholder="To Drum − From Drum"
                  value={newMachineData.no_of_drums}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, no_of_drums: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                  zeroAsEmpty
                />
              </div>
              <div></div>
            </div>

            {/* Row 6: Count Name — auto-fills Act Effi & Speed */}
            <div>
              <Label>Count Name *</Label>
              <EnterSelect
                value={newMachineData.count_id || ''}
                options={counts.map(c => ({ value: c.id, label: c.count_name }))}
                onChange={(value) => {
                  const selectedCount = counts.find(c => c.id === value)
                  setNewMachineData(prev => ({ 
                    ...prev, 
                    count_id: value || '',
                    count_name: selectedCount?.count_name || '',
                    count: selectedCount?.count_name || '',
                    ...(selectedCount?.speed_autoconer != null && { speed: selectedCount.speed_autoconer.toString() }),
                    ...((selectedCount?.effi_actual_prodn ?? selectedCount?.auto_effi) != null && {
                      act_effi: (selectedCount?.effi_actual_prodn ?? selectedCount?.auto_effi).toString()
                    }),
                  }))
                }}
                placeholder="Select count..."
                searchable
                className="mt-1 w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">Selecting a count auto-fills Speed &amp; Act Effi below</p>
            </div>

            {/* Row 7: Act Effi & Speed (auto-fetched from Count) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Act Effi (%)</Label>
                <NumberInput
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 82"
                  value={newMachineData.act_effi}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, act_effi: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                  zeroAsEmpty
                />
                <p className="text-xs text-muted-foreground mt-1">Target efficiency — production turns red below this</p>
              </div>
              <div>
                <Label>Speed</Label>
                <NumberInput
                  type="number"
                  value={newMachineData.speed}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, speed: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                  zeroAsEmpty
                />
              </div>
            </div>

            {/* Row 7: Installed Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Installed Date</Label>
                <Input
                  type="date"
                  value={newMachineData.installed_date}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, installed_date: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-1"
                />
              </div>
              <div></div>
            </div>


          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNewMachineDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddNewMachine} 
              disabled={isSaving || !newMachineData.machine_no}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add New Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export default AutoconerMachineSetupTab
