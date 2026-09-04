'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { NumberInput } from '@/components/ui/number-input'
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
import EnterSelect from '@/components/ui/entry-select'
import { Loader2, Plus, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'
import { resolveCardingShiftFallbackTime } from '@/lib/cardingShiftFallback'
import { CARDING_FORMULA_FALLBACK } from '@/lib/cardingFormulaFallback'
import {
  getCardingEntryTabDataAction,
  runCardingEntryBatchAction,
  addCardingMachineAction,
  lookupCardingMachineByNoAction
} from '@/app/actions/carding-entry'

// Helper function to safely convert any value to a number
const toNumber = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  if (typeof value === 'object' && value.toString) return parseFloat(value.toString()) || 0
  return 0
}

// Helper function to format number with fixed decimals
const formatNumber = (value, decimals = 2) => {
  return toNumber(value).toFixed(decimals)
}

const CardingMachineSetupTab = forwardRef(function CardingMachineSetupTab({
  headerId,
  entryDate,
  shift = 1,
  totalTime,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange
}, ref) {
  const effectiveTotalTime = totalTime ?? resolveCardingShiftFallbackTime(shift)
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

  const [selectedRows, setSelectedRows] = useState([])
  const [countOptions, setCountOptions] = useState([])
  const tableRef = useRef(null)
  const loadRequestRef = useRef(0)

  const focusRowByDelta = useCallback((rowIndex, delta, col) => {
    const targetRow = rowIndex + delta
    if (targetRow < 0) return
    const el = tableRef.current?.querySelector(`[data-row="${targetRow}"][data-col="${col}"]`)
    const input = el?.querySelector('input, button')
    input?.focus()
  }, [])

  const focusNextRow = useCallback((rowIndex, col) => focusRowByDelta(rowIndex, 1, col), [focusRowByDelta])

  const handleEnterNavigation = useCallback((e, rowIndex, col) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRowByDelta(rowIndex, 1, col) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRowByDelta(rowIndex, -1, col) }
  }, [focusRowByDelta])

  // Arrow Up/Down navigation between inputs in the Add Machine dialog
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

  // Lookup machine from master by machine_no
  const handleMachineNoLookup = async (machineNo) => {
    const val = String(machineNo || '').trim()
    if (!val) return
    const toastId = toast.loading(`Looking up machine ${val}…`)
    const result = await lookupCardingMachineByNoAction(val, entryDate)
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
      machine_id: d.id,
      machine_no: d.machine_no ?? prev.machine_no,
      description: d.description || prev.description,
      make_name: d.make_name || prev.make_name,
      model: d.model || prev.model,
      prodn_mixing: d.prodn_mixing || prev.prodn_mixing,
      installed_date: d.installed_date ? String(d.installed_date).split('T')[0] : prev.installed_date,
      speed: d.speed_setup != null ? parseFloat(d.speed_setup) : (d.speed != null ? parseFloat(d.speed) : prev.speed),
      hank_constant: d.hank_constant != null ? parseFloat(d.hank_constant) : prev.hank_constant,
      std_efficiency_factor: d.std_efficiency_factor != null ? parseFloat(d.std_efficiency_factor) : prev.std_efficiency_factor,
    }))
    toast.success(`Machine ${val} details filled`, { id: toastId })
  }

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCountChangeDialog, setShowCountChangeDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // New machine form
  const [newMachine, setNewMachine] = useState({
    machine_id: '',
    machine_no: '',
    description: '',
    make_name: '',
    model: '',
    prodn_mixing: '',
    installed_date: '',
    speed: CARDING_FORMULA_FALLBACK.speed,
    shift_time: effectiveTotalTime,
    hank_constant: CARDING_FORMULA_FALLBACK.hankConstant,
    std_efficiency_factor: CARDING_FORMULA_FALLBACK.stdEfficiencyFactor
  })

  // Count change form
  const [newCount, setNewCount] = useState('')
  const [customCount, setCustomCount] = useState('')

  // Load machine setups
  const loadData = useCallback(async () => {
    if (!entryDate) return
    const requestId = ++loadRequestRef.current
    setIsLoading(true)
    try {
      const formattedDate = typeof entryDate === 'string' ? entryDate : format(entryDate, 'yyyy-MM-dd')
      const result = await getCardingEntryTabDataAction('setup', {
        entryDate: formattedDate,
        shift
      })
      if (!result.success) throw new Error(result.error || 'Failed to load Carding setup data')
      const { setupsResult, countsResult } = result.data
      if (!setupsResult.success) throw new Error(setupsResult.error || 'Failed to load machine setups')
      if (!countsResult.success) throw new Error(countsResult.error || 'Failed to load count options')
      
      const setups = setupsResult.success ? setupsResult.data : []
      const counts = countsResult.success ? countsResult.data : []

      // Date/shift changes and initialization can overlap with an older load.
      // Never allow that older response to replace the freshly initialized
      // Carding setup currently shown on screen.
      if (requestId !== loadRequestRef.current) return
      
      // Sort by natural machine number order (CA1, CA2, ... CA10, CA11)
      const sortedSetups = setups?.sort((a, b) => {
        const machineNoA = a.machine?.machine_no || ''
        const machineNoB = b.machine?.machine_no || ''
        // Extract numeric part from machine number (e.g., "CA1" -> 1, "CA22" -> 22)
        const aNum = parseInt(machineNoA.replace(/[^0-9]/g, '') || '0', 10)
        const bNum = parseInt(machineNoB.replace(/[^0-9]/g, '') || '0', 10)
        return aNum - bNum
      }) || []
      const drafts = editedRowsRef.current || {}
      const mergedSetups = sortedSetups.map(row => {
        const draft = drafts[row.id] || drafts[String(row.id)]
        return draft ? { ...row, ...draft } : row
      })
      setSetupData(mergedSetups)
      setCountOptions(counts || [])
    } catch (error) {
      if (requestId !== loadRequestRef.current) return
      console.error('Error loading machine setups:', error)
      toast.error('Failed to load machine setups')
    } finally {
      if (requestId === loadRequestRef.current) setIsLoading(false)
    }
  }, [entryDate, shift])

  useServerDataLoader(loadData, [entryDate, shift])

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    let processedValue = value
    const baseRow = setupData.find(row => row.id === rowId)
    const machineId = baseRow?.machine_id ?? baseRow?.machine?.id
    
    // Process numeric fields
    if (['speed', 'hank_constant', 'std_efficiency_factor', 'divisor_constant'].includes(field)) {
      processedValue = parseFloat(value) || 0
    }
    
    // When count/mixing changes, auto-populate sliver hank as hank_constant from countOptions
    if (field === 'prodn_mixing') {
      const selectedCount = countOptions.find(c => c.count_name === value)
      const sliverHank = selectedCount?.sliver_hank != null ? parseFloat(selectedCount.sliver_hank) : null
      
      const countFields = {
        prodn_mixing: value,
        ...(sliverHank != null && { hank_constant: sliverHank })
      }
      
      setEditedRows(prev => ({
        ...prev,
        [rowId]: {
          ...prev[rowId],
          ...(machineId ? { machine_id: machineId } : {}),
          ...countFields
        }
      }))
      
      setSetupData(prev => prev.map(row => {
        if (row.id === rowId) {
          const updatedRow = {
            ...row,
            prodn_mixing: value,
            ...(sliverHank != null && { hank_constant: sliverHank }),
            machine: {
              ...row.machine,
              prodn_mixing: value
            }
          }
          
          // Recalculate std_prodn using the new sliver hank / speed / standard efficiency
          const speed = row.speed ?? CARDING_FORMULA_FALLBACK.speed
          const hankConstant = sliverHank != null ? sliverHank : (row.hank_constant ?? CARDING_FORMULA_FALLBACK.hankConstant)
          const stdEffi = row.std_efficiency_factor ?? CARDING_FORMULA_FALLBACK.stdEfficiencyFactor
          const divisor = row.divisor_constant ?? 1693
          
          updatedRow.std_prodn = (speed / divisor / hankConstant) * effectiveTotalTime * stdEffi
          return updatedRow
        }
        return row
      }))
      return
    }
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        ...(machineId ? { machine_id: machineId } : {}),
        [field]: processedValue
      }
    }))

    // Update display data and recalculate std_prodn
    setSetupData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: processedValue }
        
        // Recalculate std_prodn when relevant fields change (use totalTime from shift)
        if (['speed', 'hank_constant', 'std_efficiency_factor', 'divisor_constant'].includes(field)) {
          const speed = field === 'speed' ? processedValue : (row.speed ?? CARDING_FORMULA_FALLBACK.speed)
          const hankConstant = field === 'hank_constant' ? processedValue : (row.hank_constant ?? CARDING_FORMULA_FALLBACK.hankConstant)
          const stdEffi = field === 'std_efficiency_factor' ? processedValue : (row.std_efficiency_factor ?? CARDING_FORMULA_FALLBACK.stdEfficiencyFactor)
          const divisor = field === 'divisor_constant' ? processedValue : (row.divisor_constant ?? 1693)
          
          updatedRow.std_prodn = (speed / divisor / hankConstant) * effectiveTotalTime * stdEffi
        }
        
        return updatedRow
      }
      return row
    }))
  }

  // Commit this tab's draft during the final Update
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
      const formattedDate = typeof entryDate === 'string' ? entryDate : format(entryDate, 'yyyy-MM-dd')
      const updates = Object.entries(currentEdits).map(([rowId, changes]) => {
        // Drafts are keyed by the exact dated setup UUID. Save that row
        // directly instead of converting it to a machine ID and rediscovering
        // the setup by date/shift on the server.
        return { id: rowId, updates: changes, entryDate: formattedDate, shift }
      })

      const batchResult = await runCardingEntryBatchAction('setup-update', updates)
      if (!batchResult.success) throw new Error(batchResult.error || 'Failed to save Carding machine setups')
      const results = batchResult.data || []
      const failed = results.find(result => !result?.success)
      if (failed) throw new Error(failed.error || 'Failed to save a Carding machine setup row')
      const savedCount = Object.keys(currentEdits).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Machine setups saved successfully')
      }
      
      if (!skipParentRefresh) {
        if (onRefresh) onRefresh()
        else await loadData()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving machine setups:', error)
      toast.error(error?.message || 'Failed to save machine setups')
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
    if (Object.keys(editedRows).length === 0) return true
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

  // Add new machine to setup
  const handleAddMachine = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (!newMachine.machine_no) {
      toast.warning('Machine number is required')
      return
    }
    setIsSaving(true)
    try {
      const result = await addCardingMachineAction({ ...newMachine, headerId })
      if (result.success) {
        if (result.data?.reactivated) {
          toast.success('Machine added back to this entry')
        } else {
          toast.success('Machine added to this entry')
        }
        setShowAddDialog(false)
        setNewMachine({
          machine_id: '',
          machine_no: '',
          description: '',
          make_name: '',
          model: '',
          prodn_mixing: '',
          installed_date: '',
          speed: CARDING_FORMULA_FALLBACK.speed,
          shift_time: effectiveTotalTime,
          hank_constant: CARDING_FORMULA_FALLBACK.hankConstant,
          std_efficiency_factor: CARDING_FORMULA_FALLBACK.stdEfficiencyFactor
        })
        if (onRefresh) onRefresh()
        else await loadData()
      } else {
        throw new Error(result.error || 'Failed to add machine')
      }
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
      const batchResult = await runCardingEntryBatchAction(
        'machine-remove',
        selectedRows.map(id => ({ id })),
        { headerId }
      )
      if (!batchResult.success) throw new Error(batchResult.error || 'Failed to remove Carding machines')
      const results = batchResult.data || []
      const failed = results.find(result => !result?.success)
      if (failed) throw new Error(failed.error || 'Failed to remove a machine')
      toast.success(`${selectedRows.length} machine(s) removed successfully`)
      setShowRemoveDialog(false)
      setSelectedRows([])
      if (onRefresh) onRefresh()
      else await loadData()
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

    // Look up sliver hank for this count from master data
    const foundCount = countOptions.find(c => c.count_name === countToSet)
    const sliverHank = foundCount?.sliver_hank != null
      ? parseFloat(foundCount.sliver_hank)
      : null

    setupData
      .filter(row => selectedRows.includes(row.machine_id ?? row.machine?.id))
      .forEach(row => handleInputChange(row.id, 'prodn_mixing', countToSet))

    toast.success(`Count staged for ${selectedRows.length} machine(s). Click Update to save.`)
    setShowCountChangeDialog(false)
    setNewCount('')
    setCustomCount('')
    setSelectedRows([])
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
              Unsaved draft: {Object.keys(editedRows).length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Machine Setup Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-112.5 overflow-y-auto">
          <table ref={tableRef} className="entry-data-grid w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-20 whitespace-nowrap">MakeName</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-56 whitespace-nowrap">Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">ShiftTime</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">Std.Prodn</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">Std.Effi.</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-20 whitespace-nowrap">SliverHank</th>
              </tr>
            </thead>
            <tbody>
              {setupData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} ${selectedRows.includes(row.machine?.id) ? 'bg-blue-100' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row.machine?.id)}
                      onChange={() => handleRowSelect(row.machine?.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    <div>{row.machine?.machine_no}</div>
                  </td>
                  <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                    {row.machine?.make_name || ''}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="prodn_mixing">
                    <EnterSelect
                      value={row.prodn_mixing || row.machine?.prodn_mixing || ''}
                      options={countOptions.map(c => ({ value: c.count_name, label: c.count_name }))}
                      onChange={(v) => handleInputChange(row.id, 'prodn_mixing', v)}
                      onNextRow={() => focusRowByDelta(index, 1, 'prodn_mixing')}
                      placeholder="Select..."
                      className="h-9 rounded-none text-xs"
                      cleanCell
                      editingHighlight
                      searchable
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                    1
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-medium tabular-nums whitespace-nowrap">
                    {effectiveTotalTime}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-medium text-green-700 tabular-nums whitespace-nowrap">
                    {formatNumber(row.std_prodn)}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="speed">
                    <NumberInput
                      type="number"
                      value={row.speed ?? CARDING_FORMULA_FALLBACK.speed}
                      onChange={(e) => handleInputChange(row.id, 'speed', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'speed')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="std_efficiency_factor">
                    <NumberInput
                      type="number"
                      value={row.std_efficiency_factor ?? CARDING_FORMULA_FALLBACK.stdEfficiencyFactor}
                      onChange={(e) => handleInputChange(row.id, 'std_efficiency_factor', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'std_efficiency_factor')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="hank_constant">
                    <NumberInput
                      type="number"
                      value={row.hank_constant ?? CARDING_FORMULA_FALLBACK.hankConstant}
                      onChange={(e) => handleInputChange(row.id, 'hank_constant', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'hank_constant')}
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                </tr>
              ))}
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
            onClick={() => setShowCountChangeDialog(true)}
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
            Add Master machine
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
        if (!open) setNewMachine({ machine_id: '', machine_no: '', description: '', make_name: '', model: '', prodn_mixing: '', installed_date: '', speed: CARDING_FORMULA_FALLBACK.speed, shift_time: effectiveTotalTime, hank_constant: CARDING_FORMULA_FALLBACK.hankConstant, std_efficiency_factor: CARDING_FORMULA_FALLBACK.stdEfficiencyFactor })
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add Machine to Setup</DialogTitle>
            <DialogDescription className="text-sm">Enter the machine number and press Enter to auto-fill from master data</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Machine No / Name *</Label>
                <Input
                  value={newMachine.machine_no}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, machine_id: '', machine_no: e.target.value }))}
                  onBlur={(e) => handleMachineNoLookup(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleMachineNoLookup(e.currentTarget.value)
                    } else {
                      handleDialogNav(e)
                    }
                  }}
                  placeholder="e.g. CA1, CA22"
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Description</Label>
                <Input
                  value={newMachine.description}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, description: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  placeholder="e.g. Carding Machine 1"
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Make Name</Label>
                <Input
                  value={newMachine.make_name}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, make_name: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Model</Label>
                <Input
                  value={newMachine.model}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, model: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Count Name</Label>
                <EnterSelect
                  value={newMachine.prodn_mixing}
                  options={countOptions.map(c => ({ value: c.count_name, label: c.count_name }))}
                  onChange={(v) => {
                    const found = countOptions.find(c => c.count_name === v)
                    setNewMachine(prev => ({
                      ...prev,
                      prodn_mixing: v,
                      ...(found?.sliver_hank != null && { hank_constant: parseFloat(found.sliver_hank) })
                    }))
                  }}
                  placeholder="Select count..."
                  searchable
                  className="h-10 text-sm w-full"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Installed Date</Label>
                <Input
                  type="date"
                  value={newMachine.installed_date}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, installed_date: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Speed</Label>
                <NumberInput
                  value={newMachine.speed}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, speed: v }))}
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); handleDialogNav(e) } }}
                  className="h-10 text-sm"
                  zeroAsEmpty
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Sliver Hank</Label>
                <NumberInput
                  value={newMachine.hank_constant}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, hank_constant: v }))}
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); handleDialogNav(e) } }}
                  className="h-10 text-sm"
                  zeroAsEmpty
                  step="0.01"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Std. Efficiency Factor</Label>
                <NumberInput
                  value={newMachine.std_efficiency_factor ?? CARDING_FORMULA_FALLBACK.stdEfficiencyFactor}
                  onChange={(v) => setNewMachine(prev => ({ ...prev, std_efficiency_factor: Number(v) || CARDING_FORMULA_FALLBACK.stdEfficiencyFactor }))}
                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); handleDialogNav(e) } }}
                  className="h-10 text-sm"
                  zeroAsEmpty
                />
              </div>
            </div>
            <p className="text-xs text-blue-600">
              Tip: Type the machine number (e.g. CA23) and press Enter to auto-fill details from the master.
            </p>
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
      <Dialog open={showCountChangeDialog} onOpenChange={setShowCountChangeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Change Count</DialogTitle>
            <DialogDescription className="text-sm">Update count/mixing for {selectedRows.length} selected machine(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Existing Count</Label>
              <EnterSelect
                value={newCount}
                options={countOptions.map(c => ({ value: c.count_name, label: c.count_name }))}
                onChange={(v) => { setNewCount(v); setCustomCount(''); }}
                searchable
                className="h-10 text-sm"
              />
            </div>
            <div className="text-center text-sm text-gray-500 font-medium">- OR -</div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Enter New Count</Label>
              <Input
                value={customCount}
                onChange={(e) => { setCustomCount(e.target.value); setNewCount(''); }}
                placeholder="Enter new count..."
                className="h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowCountChangeDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button onClick={handleCountChange} disabled={isSaving || (!newCount && !customCount)} className="h-10 px-6 bg-blue-600 hover:bg-blue-700">
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
              Are you sure you want to remove {selectedRows.length} selected machine(s) from this entry?
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            This affects only this date and shift. Machine Master and all other entries remain unchanged.
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)} className="h-10 px-6">Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleRemoveMachines} 
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

export default CardingMachineSetupTab
