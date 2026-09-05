'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { changeEntryMachineCountRunAction } from '@/app/actions/entry-count-run'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import EnterSelect from "@/components/ui/entry-select"
import HolidayAwareCalendar from '@/components/common/HolidayAwareCalendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { format } from 'date-fns'
import { CalendarIcon, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from "@/components/ui/label"
import { resolveSpinningShiftFallbackTime } from '@/lib/spinningShiftFallback'
import { useServerDataLoader } from '@/hooks/useServerDataLoader'
import {
  getSpinningEntryTabDataAction,
  runSpinningEntryBatchAction,
  updateSpinningMachineSetupAction,
  batchUpdateSpinningMachineSetupsAction,
  applySpinningOptionCheckAction,
  getSpinningOptionCheckSourceAction,
  addSpinningMachineAction,
  lookupSpinningMachineByNoAction
} from '@/app/actions/spinning-entry'
import { calculateSpinningNoOfSpindles } from '@/lib/productionFormulaMath'
import { getSpinningMachineWithSetupAction } from '@/app/actions/spinning-machine'
import { buildSpinningCountSnapshot } from '@/lib/countMasterSnapshots'

/**
 * Spinning Machine Setup Tab
 * 
 * Fields: McNo, MakeName, CountName, Act.Count, Session, 
 *         Allocated Spls, TW.Con, DoffLoss, C.Waste%, Speed, TPI
 */

const SpinningMachineSetupTab = forwardRef(function SpinningMachineSetupTab({
  headerId,
  shift = 1,
  totalTime,
  entryDate,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange
}, ref) {
  const effectiveTotalTime = totalTime ?? resolveSpinningShiftFallbackTime(shift)
  const [setupData, setSetupData] = useState([])
  const [counts, setCounts] = useState([])
  const [machines, setMachines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
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

  // Count changes staged from Production/Stoppage must be visible here immediately.
  useEffect(() => {
    if (!sharedDraftEdits || Object.keys(sharedDraftEdits).length === 0) return
    setSetupData(rows => rows.map(row => {
      const draft = sharedDraftEdits[row.id] || sharedDraftEdits[String(row.id)]
      return draft ? { ...row, ...draft } : row
    }))
  }, [sharedDraftEdits])

  // Ref for table container (Enter/Arrow row navigation)
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

  const handleMachineNoLookup = async (machineNo) => {
    const val = String(machineNo || '').trim()
    if (!val) return
    const toastId = toast.loading(`Looking up machine #${val}…`)
    const result = await lookupSpinningMachineByNoAction(val, entryDate)
    if (!result.success) {
      toast.error(result.error || 'Lookup failed', { id: toastId })
      return
    }
    if (!result.data) {
      toast.error(`Machine #${val} not found in master`, { id: toastId })
      return
    }
    const d = result.data
    setNewMachineData(prev => ({
      ...prev,
      machine_id: d.id,
      machine_no: d.machine_no ?? prev.machine_no,
      description: d.description || prev.description,
      make_name: d.make_name || prev.make_name,
      model: d.model || prev.model,
      allocated_spindles: d.allocated_spindles ?? prev.allocated_spindles,
      installed_date: d.installed_date
        ? String(d.installed_date).split('T')[0]
        : prev.installed_date,
      // Setup fields from spinning_machine_setup (may come from inactive machine's setup as fallback)
      ...(d.count_id != null && { count_id: d.count_id }),
      ...(d.count_name != null && { count_name: d.count_name }),
      ...(d.act_count != null && { act_count: parseFloat(d.act_count) }),
      ...(d.tpi != null && { tpi: parseFloat(d.tpi) }),
      ...(d.speed != null && { speed: parseInt(d.speed) }),
      ...(d.tw_con != null && { tw_con: parseFloat(d.tw_con) }),
      ...(d.doff_loss != null && { doff_loss: parseFloat(d.doff_loss) }),
      ...(d.c_waste_percent != null && { c_waste_percent: parseFloat(d.c_waste_percent) }),
    }))
    toast.success(`Machine #${val} details filled`, { id: toastId })
  }

  // Count change dialog
  const [countChangeDialog, setCountChangeDialog] = useState(false)
  const [newCountId, setNewCountId] = useState('')
  const [countRunMinutes, setCountRunMinutes] = useState('')
  const [bulkEfficiencyPercent, setBulkEfficiencyPercent] = useState('95')

  // Option check (carry-forward from a selected earlier entry)
  const [optionCheck, setOptionCheck] = useState({
    copySpeed: false,
    copyTpi: false,
    copyTwCon: false,
    copyCount: false
  })
  const [optionSourceDate, setOptionSourceDate] = useState('')
  const [optionSourceShift, setOptionSourceShift] = useState('')
  const [availableSourceShifts, setAvailableSourceShifts] = useState([])
  const [isLoadingOptionSource, setIsLoadingOptionSource] = useState(false)
  const [optionSourceStatus, setOptionSourceStatus] = useState('loading')
  const [optionCalendarOpen, setOptionCalendarOpen] = useState(false)
  const optionSourceRequestRef = useRef(0)

  const loadOptionCheckSource = useCallback(async (requestedDate = '', preferredShift = '') => {
    const requestId = ++optionSourceRequestRef.current
    setIsLoadingOptionSource(true)
    setOptionSourceStatus('loading')

    if (!requestedDate) {
      setOptionSourceDate('')
      setOptionSourceShift('')
      setAvailableSourceShifts([])
    }

    try {
      const result = await getSpinningOptionCheckSourceAction({
        targetDate: entryDate,
        targetShift: parseInt(shift),
        sourceDate: requestedDate || null
      })

      if (requestId !== optionSourceRequestRef.current) return

      if (!result.success) {
        throw new Error(result.error || 'Failed to find previous spinning entries')
      }

      const source = result.data || {}
      const sourceDate = requestedDate || source.sourceDate || ''
      const sourceShifts = (source.availableShifts || []).map(String)
      const sourceShift = requestedDate
        ? String(preferredShift || '')
        : source.sourceShift
          ? String(source.sourceShift)
          : ''

      setOptionSourceDate(sourceDate)
      setAvailableSourceShifts(sourceShifts)
      setOptionSourceShift(sourceShift)
      setOptionSourceStatus(
        sourceDate && sourceShift && sourceShifts.includes(sourceShift)
          ? 'available'
          : 'none'
      )
    } catch (error) {
      if (requestId !== optionSourceRequestRef.current) return

      console.error('Error loading option check source:', error)
      setOptionSourceShift('')
      setAvailableSourceShifts([])
      setOptionSourceStatus('error')
      toast.error(error.message || 'Failed to find previous spinning entries')
    } finally {
      if (requestId === optionSourceRequestRef.current) {
        setIsLoadingOptionSource(false)
      }
    }
  }, [entryDate, shift])

  useServerDataLoader(
    () => loadOptionCheckSource(),
    [entryDate, shift]
  )

  const handleOptionSourceDateChange = (selectedDate) => {
    if (!selectedDate) return

    const sourceDate = format(selectedDate, 'yyyy-MM-dd')
    setOptionSourceDate(sourceDate)
    setAvailableSourceShifts([])
    setOptionCalendarOpen(false)
    loadOptionCheckSource(sourceDate, optionSourceShift)
  }

  const handleOptionSourceShiftChange = (sourceShift) => {
    setOptionSourceShift(sourceShift)
    setOptionSourceStatus(
      optionSourceDate && availableSourceShifts.includes(sourceShift)
        ? 'available'
        : 'none'
    )
  }

  const optionSourceDateValue = optionSourceDate
    ? new Date(`${optionSourceDate}T00:00:00`)
    : undefined
  const optionCalendarMonth = optionSourceDateValue || (
    entryDate ? new Date(`${entryDate}T00:00:00`) : undefined
  )
  const isOptionSourceDateDisabled = (day) => {
    if (!entryDate) return false

    const dayKey = format(day, 'yyyy-MM-dd')
    if (dayKey > entryDate) return true
    if (dayKey < entryDate) return false

    return !optionSourceShift || parseInt(optionSourceShift) >= parseInt(shift)
  }

  // Add machine dialog
  const [addMachineDialog, setAddMachineDialog] = useState(false)
  const getDefaultMachineData = (countData = null) => ({
    machine_id: '',
    machine_no: '',
    description: '',
    make_name: '',
    model: '',
    allocated_spindles: 1104,
    installed_date: new Date().toISOString().split('T')[0],
    // Setup fields - populated from spinning_counts master
    count_id: countData?.id || '',
    count_name: countData?.count_name || '',
    act_count: countData?.act_count != null ? parseFloat(countData.act_count) : 0,
    session_no: 1,
    run_time: effectiveTotalTime,
    tw_con: countData?.tw_con != null ? parseFloat(countData.tw_con) : 0,
    doff_loss: countData?.doff_loss != null ? parseFloat(countData.doff_loss) : 0,
    c_waste_percent: countData?.waste_percent != null ? parseFloat(countData.waste_percent) : 0,
    speed: countData?.speed != null ? parseInt(countData.speed) : 0,
    tpi: countData?.tpi != null ? parseFloat(countData.tpi) : 0,
  })
  const [newMachineData, setNewMachineData] = useState(getDefaultMachineData())

  // Reset form
  const resetMachineForm = () => {
    setNewMachineData(getDefaultMachineData())
  }

  // Remove machine dialog
  const [removeDialog, setRemoveDialog] = useState(false)

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

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tabResult = await getSpinningEntryTabDataAction('setup', { shift, entryDate })
      if (!tabResult.success) throw new Error(tabResult.error)
      const { setupsResult, countsResult, machinesResult } = tabResult.data
      
      const setups = setupsResult.success ? setupsResult.data || [] : []
      setSetupData(mergeServerRowsWithDrafts(setups))
      setCounts(countsResult.success ? countsResult.data || [] : [])
      setMachines(machinesResult.success ? machinesResult.data || [] : [])
    } catch (error) {
      console.error('Error loading setup data:', error)
      toast.error('Failed to load setup data')
    } finally {
      setIsLoading(false)
    }
  }, [shift, entryDate, mergeServerRowsWithDrafts])

  useServerDataLoader(loadData, [shift, entryDate])

  // Handle input change
  const handleInputChange = (rowId, field, value) => {
    let processedValue = value
    const baseRow = setupData.find(row => row.id === rowId)
    const machineId = baseRow?.machine_id ?? baseRow?.machine?.id
    
    // Process numeric fields
    if (['speed', 'tpi', 'act_count', 'allocated_spindles', 'tw_con', 'doff_loss', 'c_waste_percent', 'session_no', 'run_time', 'efficiency'].includes(field)) {
      processedValue = parseFloat(value) || 0
    }
    
    // Selecting a count fully replaces every count-controlled snapshot value.
    if (field === 'count_id') {
      const selectedCount = counts.find(c => c.id === value)
      if (selectedCount) {
        const countFields = buildSpinningCountSnapshot(selectedCount, {
          machineSpeed: baseRow?.machine?.speed
        })
        
        setEditedRows(prev => ({
          ...prev,
          [rowId]: {
            ...prev[rowId],
            setup_id: rowId,
            ...(machineId ? { machine_id: machineId } : {}),
            ...countFields
          }
        }))
        
        setSetupData(prev => prev.map(row => {
          if (row.id === rowId) {
            return { ...row, ...countFields }
          }
          return row
        }))
        return
      }
    }
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        setup_id: rowId,
        ...(machineId ? { machine_id: machineId } : {}),
        [field]: processedValue
      }
    }))

    setSetupData(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: processedValue }
      }
      return row
    }))
  }

  const applyEfficiencyPercent = () => {
    const percent = Number(bulkEfficiencyPercent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error('Efficiency must be between 0 and 100')
      return
    }

    const efficiency = percent / 100
    setEditedRows(previous => {
      const next = { ...previous }
      setupData.forEach(row => {
        const machineId = row.machine_id ?? row.machine?.id
        next[row.id] = {
          ...next[row.id],
          setup_id: row.id,
          ...(machineId ? { machine_id: machineId } : {}),
          efficiency
        }
      })
      return next
    })
    setSetupData(previous => previous.map(row => ({ ...row, efficiency })))
    toast.success(`Efficiency staged at ${percent}% for this entry. Click Update to save.`)
  }

  // Handle row selection
  const handleRowSelection = (rowId, checked) => {
    if (checked) {
      setSelectedRows(prev => [...prev, rowId])
    } else {
      setSelectedRows(prev => prev.filter(id => id !== rowId))
    }
  }

  // Select all rows
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(setupData.map(row => row.id))
    } else {
      setSelectedRows([])
    }
  }

  // Save single row
  const handleSaveRow = async (row) => {
    setIsSaving(true)
    try {
      const updates = (editedRowsRef.current || editedRows || {})[row.id] || {}
      const result = await updateSpinningMachineSetupAction(row.id, updates, shift)
      
      if (result.success) {
        toast.success('Setup saved')
        setEditedRows(prev => {
          const newEdited = { ...prev }
          delete newEdited[row.id]
          return newEdited
        })
        onRefresh?.()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error saving setup:', error)
      toast.error('Failed to save setup')
    } finally {
      setIsSaving(false)
    }
  }

  // Save all changes
  const handleSaveAll = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    const currentEdits = editedRowsRef.current || editedRows || {}
    const editedIds = Object.keys(currentEdits)
    if (editedIds.length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      const updates = editedIds.map(id => ({
        id,
        ...currentEdits[id]
      }))

      const result = await batchUpdateSpinningMachineSetupsAction(updates, shift)
      
      if (result.success) {
        if (!suppressSuccessToast) {
          toast.success(`Saved ${updates.length} setup(s)`)
        }
        setEditedRows({})
        if (!skipParentRefresh) {
          if (onRefresh) onRefresh()
          else await loadData()
        }
        return { success: true, saved: updates.length }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error saving setups:', error)
      toast.error('Failed to save setups')
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
    saveChanges: handleSaveAll,
    getEditedCount: () => Object.keys(editedRowsRef.current || editedRows || {}).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSaveAll, editedRows, isSaving, discardChanges])

  // Split the latest run of one physical machine into a new count run.
  const handleCountChange = async () => {
    if (selectedRows.length !== 1) {
      toast.warning('Select exactly one machine count row')
      return
    }
    if (!newCountId) {
      toast.warning('Please select a count')
      return
    }

    // Find the selected count details
    const selectedCount = counts.find(c => c.id === newCountId)

    if (!selectedCount) {
      toast.error('Selected count is no longer available')
      return
    }

    const selected = setupData.find(row => String(row.id) === String(selectedRows[0]))
    if (!selected?.is_latest_run) {
      toast.warning('Only the latest count row can be changed')
      return
    }
    const elapsed = Number(countRunMinutes)
    const currentRuntime = Number(selected.run_time)
    if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed >= currentRuntime) {
      toast.warning(`Enter a time greater than 0 and less than ${currentRuntime} minutes`)
      return
    }
    setIsSaving(true)
    try {
        const result = await changeEntryMachineCountRunAction('spinning', headerId, selected.id, {
          countId: selectedCount.id,
          countName: selectedCount.count_name,
          changeAfter: elapsed
      })
      if (!result?.success) throw new Error(result?.error || 'Unable to change count')
      toast.success('New count run added')
      setCountChangeDialog(false)
      setNewCountId('')
      setCountRunMinutes('')
      setSelectedRows([])
      if (onRefresh) onRefresh()
      else await loadData()
    } catch (error) {
      toast.error(error.message || 'Unable to change count')
    } finally {
      setIsSaving(false)
    }
  }

  const hasOptionSelected = optionCheck.copySpeed || optionCheck.copyTpi || optionCheck.copyTwCon || optionCheck.copyCount

  const handleOptionToggle = (key, checked) => {
    setOptionCheck(prev => ({
      ...prev,
      [key]: checked === true
    }))
  }

  const handleOptionCheckApply = async () => {
    if (!entryDate) {
      toast.warning('Current entry date is not available')
      return
    }

    if (!hasOptionSelected) {
      toast.warning('Please select at least one option to apply')
      return
    }

    if (!optionSourceDate || !optionSourceShift) {
      if (optionSourceStatus === 'none') {
        toast.warning(
          optionSourceDate
            ? `No spinning entry exists for ${optionSourceDate}, Shift ${optionSourceShift || '-'}. Choose another source date or shift.`
            : 'No previous spinning entry is available. Initialize an earlier date and shift first.'
        )
      } else if (optionSourceStatus === 'error') {
        toast.error('Previous entries could not be loaded. Try selecting the source date again.')
      } else {
        toast.warning('Select a source date and shift')
      }
      return
    }

    if (!confirmDiscardLocalEdits()) return

    setIsSaving(true)
    try {
      const result = await applySpinningOptionCheckAction({
        targetDate: entryDate,
        targetShift: parseInt(shift),
        sourceDate: optionSourceDate,
        sourceShift: parseInt(optionSourceShift),
        options: optionCheck
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to apply option check')
      }

      const { sourceDate, sourceShift, machinesUpdated, machinesSkipped } = result.data || {}

      if ((machinesUpdated || 0) === 0) {
        toast.warning(`No eligible values found from ${sourceDate || '-'} Shift ${sourceShift || '-'}`)
      } else {
        toast.success(`Copied from ${sourceDate} Shift ${sourceShift}: updated ${machinesUpdated}, skipped ${machinesSkipped}`)
      }

      setEditedRows({})
      if (onRefresh) onRefresh()
      else await loadData()
    } catch (error) {
      console.error('Error applying option check:', error)
      toast.error(error.message || 'Failed to apply option check')
    } finally {
      setIsSaving(false)
    }
  }

  // Add machine (creates new or reactivates existing)
  const handleAddMachine = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (!newMachineData.machine_no) {
      toast.warning('Machine number is required')
      return
    }

    setIsSaving(true)
    try {
      // Convert date to full ISO DateTime format for Prisma
      const installedDate = newMachineData.installed_date 
        ? new Date(newMachineData.installed_date + 'T00:00:00.000Z')
        : null
      
      // Convert empty strings to null for integer fields
      const result = await addSpinningMachineAction({
        ...newMachineData,
        headerId,
        entryDate,
        shift: parseInt(shift),
        run_time: totalTime, // Use current shift's totalTime
        description: newMachineData.description || newMachineData.machine_no,
        model: newMachineData.model || null,
        act_count: newMachineData.act_count,
        allocated_spindles: newMachineData.allocated_spindles === '' || newMachineData.allocated_spindles == null
          ? 1104
          : parseInt(newMachineData.allocated_spindles),
        speed: newMachineData.speed === '' || newMachineData.speed == null
          ? 0
          : parseInt(newMachineData.speed),
        installed_date: installedDate
      })
      
      if (!result.success) throw new Error(result.error)
      
      if (result.data.reactivated) {
        toast.success(`Machine ${newMachineData.machine_no} added back to this entry`)
      } else {
        toast.success(`Machine ${result.data.machine?.machine_no || newMachineData.machine_no} added to this entry`)
      }
      
      setAddMachineDialog(false)
      resetMachineForm()
      
      if (onRefresh) onRefresh()
      else await loadData()
    } catch (error) {
      console.error('Error adding machine:', error)
      toast.error(error.message || 'Failed to add machine')
    } finally {
      setIsSaving(false)
    }
  }

  // Remove selected machines from this entry snapshot only.
  const handleRemoveMachines = async () => {
    if (!confirmDiscardLocalEdits()) return

    if (selectedRows.length === 0) {
      toast.warning('Please select machines to remove')
      return
    }

    setIsSaving(true)
    try {
      // Get machine IDs from selected setup rows (machine is a nested object)
      const machineIds = [...new Set(selectedRows
        .map(setupId => setupData.find(s => s.id === setupId)?.machine?.id)
        .filter(id => id !== undefined))]

      const batchResult = await runSpinningEntryBatchAction(
        'machine-remove',
        machineIds.map(id => ({ id })),
        { headerId }
      )
      if (!batchResult.success) throw new Error(batchResult.error || 'Failed to remove machines')
      const results = batchResult.data || []
      const failed = results.find(result => !result?.success)
      if (failed) throw new Error(failed.error || 'Failed to remove a machine')

      toast.success(`${machineIds.length} machine(s) removed successfully`)
      setRemoveDialog(false)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading machine setup...</span>
      </div>
    )
  }

  return (
    <div className="entry-tab-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {setupData.length} machines configured
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Machine Setup Grid */}
      <div className="entry-grid-frame border-2 border-gray-400 rounded overflow-hidden" ref={tableRef}>
        <div className="entry-grid-scroll overflow-x-auto overflow-y-auto">
          <table className="entry-data-grid w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 w-8">
                  <Checkbox
                    checked={selectedRows.length === setupData.length && setupData.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-16 whitespace-nowrap">Machine</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-28 whitespace-nowrap">Description</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-40 whitespace-nowrap">CountName</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Act.Count</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">ShiftTime</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">Alloc. Spls</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-24 whitespace-nowrap">No of Spls</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">TW.Con</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">DoffLoss</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">C.Waste%</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Speed</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">TPI</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-20 whitespace-nowrap">Effi. %</th>
              </tr>
            </thead>
            <tbody>
              {setupData.map((row, index) => {
                const isEdited = !!editedRows[row.id]
                const isSelected = selectedRows.includes(row.id)
                const bgClass = isSelected 
                  ? 'bg-blue-100' 
                  : isEdited 
                    ? 'bg-yellow-50' 
                    : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')
                
                return (
                  <tr key={row.id} className={`${bgClass} hover:bg-blue-50`}>
                    <td className="border border-gray-300 px-2 py-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleRowSelection(row.id, checked)}
                      />
                    </td>
                    <td className="border border-gray-300 px-2 py-1 font-medium whitespace-nowrap">
                      <div>{row.machine?.machine_no || '-'}</div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                      {row.machine?.description || '-'}
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <EnterSelect
                        value={row.count_id || ''}
                        options={counts.map(c => ({ value: c.id, label: c.count_name }))}
                        onChange={(v) => handleInputChange(row.id, 'count_id', v)}
                        placeholder="Select..."
                        className="h-9 rounded-none text-xs"
                        cleanCell
                        editingHighlight
                        searchable
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.1"
                        value={row.act_count ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'act_count', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'act_count')}
                        data-row={index}
                        data-col="act_count"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0 text-center font-medium text-blue-600 tabular-nums whitespace-nowrap">
                      {row.has_multiple_runs ? (
                        <NumberInput
                          type="number"
                          min="1"
                          value={row.run_time ?? ''}
                          onChange={(e) => handleInputChange(row.id, 'run_time', e.target.value)}
                          className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0"
                        />
                      ) : (row.run_time ?? effectiveTotalTime)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-medium text-blue-600 tabular-nums whitespace-nowrap">
                      {row.allocated_spindles ?? row.machine?.allocated_spindles ?? 1104}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-medium text-green-600 tabular-nums whitespace-nowrap">
                      {calculateSpinningNoOfSpindles(
                        row.allocated_spindles ?? row.machine?.allocated_spindles,
                        row.run_time ?? effectiveTotalTime,
                        shift
                      )}
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.001"
                        value={row.tw_con ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'tw_con', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'tw_con')}
                        data-row={index}
                        data-col="tw_con"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.doff_loss ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'doff_loss', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'doff_loss')}
                        data-row={index}
                        data-col="doff_loss"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.01"
                        value={row.c_waste_percent ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'c_waste_percent', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'c_waste_percent')}
                        data-row={index}
                        data-col="c_waste_percent"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        value={row.speed ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'speed', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'speed')}
                        data-row={index}
                        data-col="speed"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        step="0.001"
                        value={row.tpi ?? ''}
                        onChange={(e) => handleInputChange(row.id, 'tpi', e.target.value)}
                        onKeyDown={(e) => handleEnterNavigation(e, index, 'tpi')}
                        data-row={index}
                        data-col="tpi"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                        zeroAsEmpty
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <NumberInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={Math.round(Number(row.efficiency ?? 0.95) * 10000) / 100}
                        onChange={(event) => handleInputChange(row.id, 'efficiency', Number(event.target.value) / 100)}
                        onKeyDown={(event) => handleEnterNavigation(event, index, 'efficiency')}
                        data-row={index}
                        data-col="efficiency"
                        className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Setup tools */}
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-t border-slate-200 pt-3 pb-1">
        <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5">
            <span className="text-xs font-medium text-gray-700">Option Check</span>
            <label className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={optionCheck.copySpeed}
                onCheckedChange={(checked) => handleOptionToggle('copySpeed', checked)}
              />
              <span>Speed</span>
            </label>
            <label className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={optionCheck.copyTpi}
                onCheckedChange={(checked) => handleOptionToggle('copyTpi', checked)}
              />
              <span>TPI</span>
            </label>
            <label className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={optionCheck.copyTwCon}
                onCheckedChange={(checked) => handleOptionToggle('copyTwCon', checked)}
              />
              <span>TW.Con</span>
            </label>
            <label className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={optionCheck.copyCount}
                onCheckedChange={(checked) => handleOptionToggle('copyCount', checked)}
              />
              <span>Count</span>
            </label>
            <span className="border-l border-gray-300 pl-1.5 text-[11px] font-medium text-gray-600">
              From
            </span>
            <Popover open={optionCalendarOpen} onOpenChange={setOptionCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving || isLoadingOptionSource}
                  aria-label="Option Check source date"
                  aria-invalid={optionSourceStatus === 'none' || optionSourceStatus === 'error'}
                  title={
                    optionSourceStatus === 'none'
                      ? optionSourceDate
                        ? `No initialized spinning entry exists for ${optionSourceDate}, Shift ${optionSourceShift || '-'}`
                        : 'No earlier initialized spinning entry is available'
                      : optionSourceStatus === 'error'
                        ? 'Previous entries could not be loaded'
                        : 'Source date'
                  }
                  className="h-8 w-[116px] justify-start px-2 text-xs font-normal"
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {optionSourceDateValue
                    ? format(optionSourceDateValue, 'dd-MMM-yy')
                    : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <HolidayAwareCalendar
                  mode="single"
                  selected={optionSourceDateValue}
                  onSelect={handleOptionSourceDateChange}
                  tableName="spinning_production_header"
                  shift={optionSourceShift || undefined}
                  defaultMonth={optionCalendarMonth}
                  disabled={isOptionSourceDateDisabled}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Select
              value={optionSourceShift}
              onValueChange={handleOptionSourceShiftChange}
              disabled={isSaving || isLoadingOptionSource}
            >
              <SelectTrigger
                size="sm"
                aria-label="Option Check source shift"
                title={
                  optionSourceStatus === 'none'
                    ? 'No initialized previous entry is available'
                    : optionSourceStatus === 'error'
                      ? 'Previous entries could not be loaded'
                      : 'Source shift'
                }
                className="w-[84px] text-xs"
              >
                <SelectValue
                  placeholder={
                    isLoadingOptionSource
                      ? 'Loading...'
                      : optionSourceStatus === 'none'
                        ? 'No entry'
                        : optionSourceStatus === 'error'
                          ? 'Load failed'
                          : 'Shift'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {['1', '2', '3'].map(sourceShift => (
                  <SelectItem key={sourceShift} value={sourceShift}>
                    Shift {sourceShift}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOptionCheckApply}
              disabled={isSaving || isLoadingOptionSource || !hasOptionSelected}
            >
              Check
            </Button>
        </div>
        <div
          className="flex shrink-0 items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5"
          title="Applies to every machine in this entry only. Click Update to save."
        >
            <Label htmlFor="bulk-spinning-efficiency" className="whitespace-nowrap text-xs">Set Effi. %</Label>
            <NumberInput
              id="bulk-spinning-efficiency"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={bulkEfficiencyPercent}
              onChange={(event) => setBulkEfficiencyPercent(event.target.value)}
              className="h-8 w-20 text-center text-xs"
            />
            <Button type="button" size="sm" onClick={applyEfficiencyPercent} disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700">
              Apply all
            </Button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const selected = setupData.find(row => String(row.id) === String(selectedRows[0]))
                setNewCountId('')
                setCountRunMinutes(String(selected?.run_time ?? ''))
                setCountChangeDialog(true)
              }}
              disabled={selectedRows.length !== 1 || !setupData.find(row => String(row.id) === String(selectedRows[0]))?.is_latest_run}
              className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            >
              Count Change
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { resetMachineForm(); setAddMachineDialog(true); }}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add machine
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemoveDialog(true)}
              disabled={selectedRows.length === 0}
              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove machine {selectedRows.length > 0 && `(${selectedRows.length})`}
            </Button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 text-xs">
            {selectedRows.length > 0 && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                {selectedRows.length} machine(s) selected
              </span>
            )}
            {Object.keys(editedRows).length > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                {Object.keys(editedRows).length} row(s) modified
              </span>
            )}
        </div>
      </div>

      {/* Count Change Dialog */}
      <Dialog open={countChangeDialog} onOpenChange={setCountChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Count</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Current count: {setupData.find(row => String(row.id) === String(selectedRows[0]))?.count_name || '-'}
            </p>
            <EnterSelect
              value={newCountId || ''}
              options={counts.map(c => ({ value: c.id, label: c.count_name }))}
              onChange={setNewCountId}
              placeholder="Select new count..."
              searchable
              className="w-full mt-1"
            />
            <div className="mt-4">
              <Label>Minutes run on current count</Label>
              <NumberInput
                type="number"
                min="1"
                max={Math.max(Number(setupData.find(row => String(row.id) === String(selectedRows[0]))?.run_time || 0) - 1, 1)}
                value={countRunMinutes}
                onChange={(event) => setCountRunMinutes(event.target.value)}
                className="mt-1 w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The remaining minutes are assigned automatically to the new count.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountChangeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCountChange} disabled={isSaving || !newCountId || countRunMinutes === ''}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Machine Dialog */}
      <Dialog open={addMachineDialog} onOpenChange={setAddMachineDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Spinning Machine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
              <Label>Machine No / Name *</Label>
                <Input 
                  value={newMachineData.machine_no} 
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, machine_id: '', machine_no: e.target.value }))}
                  onBlur={(e) => handleMachineNoLookup(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleMachineNoLookup(e.currentTarget.value)
                    } else {
                      handleDialogNav(e)
                    }
                  }}
                  placeholder="e.g. 1, 50"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input 
                  value={newMachineData.description} 
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, description: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  placeholder="e.g. RF1"
                  className="mt-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Make Name</Label>
                <Input 
                  value={newMachineData.make_name} 
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, make_name: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input 
                  value={newMachineData.model} 
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, model: e.target.value }))}
                  onKeyDown={handleDialogNav}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Allocated Spindles</Label>
                <NumberInput
                  type="number"
                  value={newMachineData.allocated_spindles}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, allocated_spindles: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                  onKeyDown={handleDialogNav}
                  className="mt-2"
                  zeroAsEmpty
                />
              </div>
            </div>
            <div>
              <Label>Speed</Label>
              <NumberInput
                type="number"
                value={newMachineData.speed}
                onChange={(e) => setNewMachineData(prev => ({ ...prev, speed: parseInt(e.target.value) || 0 }))}
                onKeyDown={handleDialogNav}
                placeholder="15000"
                className="mt-2 w-40"
                zeroAsEmpty
              />
            </div>
            <div>
              <Label>Installed Date</Label>
              <Input 
                type="date"
                value={newMachineData.installed_date} 
                onChange={(e) => setNewMachineData(prev => ({ ...prev, installed_date: e.target.value }))}
                onKeyDown={handleDialogNav}
                className="mt-2"
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Setup Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Count</Label>
                  <EnterSelect
                    value={newMachineData.count_id || ''}
                    options={counts.map(c => ({ value: c.id, label: c.count_name }))}
                    onChange={(val) => {
                      const selectedCount = counts.find(c => c.id === val)
                      setNewMachineData(prev => ({
                        ...prev,
                        ...buildSpinningCountSnapshot(selectedCount, { machineSpeed: prev.speed }),
                      }))
                    }}
                    placeholder="Select count..."
                    searchable
                    className="mt-2 w-full"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label>TPI</Label>
                <NumberInput
                  type="number"
                  step="0.01"
                  value={newMachineData.tpi}
                  onChange={(e) => setNewMachineData(prev => ({ ...prev, tpi: parseFloat(e.target.value) || 0 }))}
                  onKeyDown={handleDialogNav}
                  className="mt-2 w-40"
                  zeroAsEmpty
                />
              </div>
              <p className="text-xs text-blue-600 mt-2">
                ⏱ Run Time is auto-set from the shift selected on the production entry page — no need to enter here.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddMachineDialog(false); resetMachineForm(); }}>Cancel</Button>
            <Button onClick={handleAddMachine} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Machines Dialog */}
      <Dialog open={removeDialog} onOpenChange={setRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Machines</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to remove {selectedRows.length} machine(s)?
            </p>
            <p className="text-sm text-red-600">
              This removes the selected machines from this entry and subsequently initialized entries. Machine Master remains unchanged.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveMachines} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Legend */}
      <div className="entry-field-reference bg-gray-50 rounded-lg text-xs text-gray-600">
        <h4 className="font-semibold mb-2">Field Reference:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div><strong>Act.Count:</strong> Actual count value (e.g., 69.5)</div>
          <div><strong>Alloc. Spls:</strong> Allocated spindles (default 1104)</div>
          <div><strong>TW.Con:</strong> Traveller count (default 4)</div>
          <div><strong>DoffLoss:</strong> Doff loss percentage (default 0.7)</div>
          <div><strong>C.Waste%:</strong> Configured waste % (default 0.9)</div>
          <div><strong>Speed:</strong> Machine speed</div>
          <div><strong>TPI:</strong> Twists per inch (default 13)</div>
        </div>
      </div>
    </div>
  )
})

export default SpinningMachineSetupTab
