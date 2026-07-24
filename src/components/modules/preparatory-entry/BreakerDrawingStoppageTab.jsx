'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getBreakerDrawingStoppageEntriesAction,
  getBreakerDrawingStoppageReasonsAction,
  updateStoppageEntryAction,
  applyBreakerDrawingFullStoppageAction,
  applyBreakerDrawingPartialStoppageAction,
  getBreakerDrawingMachinesAction,
  getBreakerDrawingMachineSetupsAction,
  updateBreakerDrawingDetailAction,
  syncNewMachinesToBreakerDrawingHeaderAction
} from '@/app/actions/breaker-drawing-entry'
import { calculateBreakerDrawingValues } from '@/lib/queries/breakerDrawingQueries'
import { BREAKER_DRAWING_FORMULA_FALLBACK } from '@/lib/breakerDrawingFormulaFallback'
import { NumberInput } from '@/components/ui/number-input'
import StoppageAutocomplete from '@/components/ui/stoppage-autocomplete'

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

const normalizeDraftKey = (value) => String(value || '').trim().toLowerCase()

const resolveActProdnInput = (productionDetail) => {
  const raw = productionDetail?.act_prodn
  if (raw === null || raw === undefined || raw === '') return null
  return toNumber(raw)
}

const recalcProductionFromStoppage = (productionDetail, totalStoppageTime, totalTime, setup) => {
  const safeTotalTime = Math.max(toNumber(totalTime), 0)
  if (safeTotalTime <= 0) {
    return {
      run_time: 0,
      work_time: 0,
      uti_percent: 0,
      exp_prodn: 0,
      effi_percent: 0,
    }
  }

  // Setup speed first so draft/setup changes recalculate Exp Prodn immediately across tabs.
  const machineSpeed = setup?.speed ?? productionDetail?.machine?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed
  const calculated = calculateBreakerDrawingValues(
    toNumber(productionDetail?.act_hank),
    resolveActProdnInput(productionDetail),
    safeTotalTime,
    toNumber(totalStoppageTime),
    setup,
    machineSpeed,
    productionDetail?.waste
  )

  return {
    run_time: calculated.run_time,
    work_time: calculated.work_time,
    uti_percent: calculated.uti_percent,
    exp_prodn: calculated.exp_prodn,
    effi_percent: calculated.effi_percent,
    std_prodn: calculated.std_prodn,
  }
}

const BreakerDrawingStoppageTab = forwardRef(function BreakerDrawingStoppageTab({
  headerId,
  totalTime = 0,
  shift = 1,
  onRefresh,
  sharedDraftEdits,
  onSharedDraftEditsChange,
  setupDraftEdits,
  productionDraftEdits
}, ref) {
  const [stoppageData, setStoppageData] = useState([])
  const [stoppageReasons, setStoppageReasons] = useState([])
  const [machines, setMachines] = useState([])
  const [machineSetups, setMachineSetups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEditedRows, setLocalEditedRows] = useState({})
  const editedRows = onSharedDraftEditsChange ? (sharedDraftEdits || {}) : localEditedRows
  const editedRowsRef = useRef({})
  const shiftTimeVal = totalTime
  const hasExceededError = stoppageData.some(row => ((Number(row.stoppage1_time) || 0) + (Number(row.stoppage2_time) || 0) + (Number(row.stoppage3_time) || 0) + (Number(row.stoppage4_time) || 0)) > shiftTimeVal)
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

  const mergeProductionDetailWithDraft = useCallback((productionDetail) => {
    if (!productionDetail?.id) return productionDetail || {}
    const draft = productionDraftEdits?.[productionDetail.id] || productionDraftEdits?.[String(productionDetail.id)]
    if (!draft) return productionDetail || {}

    const merged = { ...productionDetail, ...draft }
    const hasActHankDraft = Object.prototype.hasOwnProperty.call(draft, 'act_hank')
    const hasActProdnDraft = Object.prototype.hasOwnProperty.call(draft, 'act_prodn')

    // If Act Hank is edited without Act Prodn, force formula to derive Act Prodn from Act Hank.
    if (hasActHankDraft && !hasActProdnDraft) {
      merged.act_prodn = null
    }

    return merged
  }, [productionDraftEdits])

  const getEffectiveSetup = useCallback((machineId, setupMap = machineSetups) => {
    const baseSetup = setupMap[machineId]
    if (!baseSetup) return undefined

    const directDraft =
      setupDraftEdits?.[baseSetup.id] ||
      setupDraftEdits?.[String(baseSetup.id)] ||
      setupDraftEdits?.[machineId] ||
      setupDraftEdits?.[String(machineId)]

    if (directDraft) {
      return { ...baseSetup, ...directDraft }
    }

    const setupIdKey = normalizeDraftKey(baseSetup.id)
    const machineIdKey = normalizeDraftKey(machineId)
    for (const [key, value] of Object.entries(setupDraftEdits || {})) {
      const normalizedKey = normalizeDraftKey(key)
      if (normalizedKey === setupIdKey || normalizedKey === machineIdKey) {
        return { ...baseSetup, ...value }
      }
    }

    return baseSetup
  }, [machineSetups, setupDraftEdits])

  const mergeServerRowsWithDrafts = useCallback((rows) => {
    const drafts = editedRowsRef.current || {}
    const rowIds = new Set((rows || []).map(row => String(row.id)))

    setEditedRows(prev => {
      const next = {}
      for (const [id, value] of Object.entries(prev || {})) {
        if (rowIds.has(String(id))) {
          next[id] = value
        }
      }
      return Object.keys(next).length === Object.keys(prev || {}).length ? prev : next
    })

    return (rows || []).map(row => {
      const rowDraft = drafts[row.id] || drafts[String(row.id)]
      const mergedRow = rowDraft ? { ...row, ...rowDraft } : { ...row }
      const totalStoppageTime =
        toNumber(mergedRow.stoppage1_time ?? 0) +
        toNumber(mergedRow.stoppage2_time ?? 0) +
        toNumber(mergedRow.stoppage3_time ?? 0) +
        toNumber(mergedRow.stoppage4_time ?? 0)

      const mergedProduction = mergeProductionDetailWithDraft(mergedRow.production_detail)
      const setup = getEffectiveSetup(mergedProduction?.machine_id)
      const derived = recalcProductionFromStoppage(mergedProduction, totalStoppageTime, totalTime, setup)

      return {
        ...mergedRow,
        total_stoppage_time: totalStoppageTime,
        production_detail: {
          ...mergedProduction,
          ...derived
        }
      }
    })
  }, [mergeProductionDetailWithDraft, setEditedRows, totalTime, getEffectiveSetup])

  const applyServerRowsToDrafts = useCallback((updatedRows = []) => {
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) return

    setEditedRows(prev => {
      const next = { ...(prev || {}) }
      for (const row of updatedRows) {
        if (!row?.id) continue
        const rowId = row.id
        const existing = next[rowId] || {}
        next[rowId] = {
          ...existing,
          ...(row.stoppage1_id !== undefined ? { stoppage1_id: row.stoppage1_id } : {}),
          ...(row.stoppage1_time !== undefined ? { stoppage1_time: toNumber(row.stoppage1_time) } : {}),
          ...(row.stoppage2_id !== undefined ? { stoppage2_id: row.stoppage2_id } : {}),
          ...(row.stoppage2_time !== undefined ? { stoppage2_time: toNumber(row.stoppage2_time) } : {}),
          ...(row.stoppage3_id !== undefined ? { stoppage3_id: row.stoppage3_id } : {}),
          ...(row.stoppage3_time !== undefined ? { stoppage3_time: toNumber(row.stoppage3_time) } : {}),
          ...(row.stoppage4_id !== undefined ? { stoppage4_id: row.stoppage4_id } : {}),
          ...(row.stoppage4_time !== undefined ? { stoppage4_time: toNumber(row.stoppage4_time) } : {}),
          ...(row.total_stoppage_time !== undefined ? { total_stoppage_time: toNumber(row.total_stoppage_time) } : {})
        }
      }
      return next
    })
  }, [setEditedRows])

  const getStoppageDisplayValue = useCallback((stoppageObj) => {
    if (!stoppageObj) return ''
    return stoppageObj.stoppage_name || ''
  }, [])

  // Full stoppage form
  const [fullStoppage, setFullStoppage] = useState({
    reason: '',
    time: ''
  })

  // Partial stoppage form
  const [partialStoppage, setPartialStoppage] = useState({
    reason: '',
    fromMachine: '',
    toMachine: '',
    time: ''
  })

  // Load data
  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!headerId) {
      console.warn('BreakerDrawingStoppageTab: No headerId provided')
      return
    }
    const loadKey = `${headerId}|${shift}|${totalTime}`
    if (!force && lastLoadKeyRef.current === loadKey) return
    lastLoadKeyRef.current = loadKey
    
    setIsLoading(true)
    try {
      // Sync any newly added machines to this header first
      await syncNewMachinesToBreakerDrawingHeaderAction(headerId, shift)
      
      const [stoppagesRes, reasonsRes, machineListRes, setupsRes] = await Promise.all([
        getBreakerDrawingStoppageEntriesAction(headerId),
        getBreakerDrawingStoppageReasonsAction(),
        getBreakerDrawingMachinesAction(),
        getBreakerDrawingMachineSetupsAction(shift, headerId)
      ])
      
      // Check for errors in responses
      if (!stoppagesRes?.success) {
        console.error('Failed to load stoppages:', stoppagesRes?.error)
        toast.error('Failed to load stoppage entries')
      }
      if (!reasonsRes?.success) {
        console.error('Failed to load reasons:', reasonsRes?.error)
      }
      if (!machineListRes?.success) {
        console.error('Failed to load machines:', machineListRes?.error)
      }
      if (!setupsRes?.success) {
        console.error('Failed to load setups:', setupsRes?.error)
      }
      
      const stoppages = stoppagesRes?.data || []
      const reasons = reasonsRes?.data || []
      const machineList = machineListRes?.data || []
      const setups = setupsRes?.data || []
      
      console.log('Loaded stoppage data:', {
        stoppagesCount: stoppages.length,
        reasonsCount: reasons.length,
        machinesCount: machineList.length,
        setupsCount: setups.length
      })
      
      // Sort by natural machine number order (BD1, BD2, BD3, BD4)
      const sortedStoppages = stoppages?.sort((a, b) => {
        const aNum = parseInt(a.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.production_detail?.machine?.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      
      // Validate stoppage data structure
      sortedStoppages.forEach((s, idx) => {
        if (!s.production_detail) {
          console.error(`Stoppage entry ${idx} missing production_detail:`, s)
        } else if (!s.production_detail.machine) {
          console.error(`Stoppage entry ${idx} missing machine in production_detail:`, s)
        }
      })
      
      // Sort machines list for dropdowns
      const sortedMachines = machineList?.sort((a, b) => {
        const aNum = parseInt(a.machine_no?.replace(/\D/g, '') || '0')
        const bNum = parseInt(b.machine_no?.replace(/\D/g, '') || '0')
        return aNum - bNum
      }) || []
      
      // Create machine setup map
      const setupMap = {}
      setups?.forEach(s => {
        setupMap[s.machine_id] = s
      })
      
      const withDerivedProduction = sortedStoppages.map(row => {
        const setup = getEffectiveSetup(row.production_detail?.machine_id, setupMap)
        const derived = recalcProductionFromStoppage(
          row.production_detail,
          row.total_stoppage_time || 0,
          totalTime,
          setup
        )
        return {
          ...row,
          production_detail: {
            ...(row.production_detail || {}),
            ...derived
          }
        }
      })

      const mergedRows = mergeServerRowsWithDrafts(withDerivedProduction)
      setStoppageData(mergedRows)
      setStoppageReasons(reasons || [])
      setMachines(sortedMachines)
      setMachineSetups(setupMap)
    } catch (error) {
      lastLoadKeyRef.current = ''
      console.error('Error loading stoppage data:', error)
      toast.error('Failed to load stoppage data')
    } finally {
      setIsLoading(false)
    }
  }, [headerId, shift, totalTime, mergeServerRowsWithDrafts, getEffectiveSetup])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!stoppageData.length) return

    setStoppageData(prev => prev.map(row => {
      const rowDraft = editedRowsRef.current?.[row.id] || editedRowsRef.current?.[String(row.id)] || null
      const mergedRow = rowDraft ? { ...row, ...rowDraft } : row
      const totalStoppageTime =
        toNumber(mergedRow.stoppage1_time ?? 0) +
        toNumber(mergedRow.stoppage2_time ?? 0) +
        toNumber(mergedRow.stoppage3_time ?? 0) +
        toNumber(mergedRow.stoppage4_time ?? 0)

      const mergedProduction = mergeProductionDetailWithDraft(mergedRow.production_detail)
      const setup = getEffectiveSetup(mergedProduction?.machine_id)
      const derived = recalcProductionFromStoppage(mergedProduction, totalStoppageTime, totalTime, setup)

      return {
        ...mergedRow,
        total_stoppage_time: totalStoppageTime,
        production_detail: {
          ...mergedProduction,
          ...derived
        }
      }
    }))
  }, [productionDraftEdits, setupDraftEdits, totalTime, getEffectiveSetup, mergeProductionDetailWithDraft, stoppageData.length])

  // Handle stoppage time change
  const handleTimeChange = (rowId, field, value) => {
    const numValue = parseInt(value) || 0
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: numValue
      }
    }))

    setStoppageData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: numValue }
        // Recalculate total
        updatedRow.total_stoppage_time = 
          (updatedRow.stoppage1_time || 0) +
          (updatedRow.stoppage2_time || 0) +
          (updatedRow.stoppage3_time || 0) +
          (updatedRow.stoppage4_time || 0)

        const mergedProduction = mergeProductionDetailWithDraft(updatedRow.production_detail)
        const setup = getEffectiveSetup(mergedProduction?.machine_id)
        updatedRow.production_detail = {
          ...mergedProduction,
          ...recalcProductionFromStoppage(
            mergedProduction,
            updatedRow.total_stoppage_time,
            totalTime,
            setup
          )
        }
        return updatedRow
      }
      return row
    }))
  }

  // Handle stoppage reason change
  const handleStoppageReasonChange = (rowId, field, value) => {
    // Get the time field name (e.g., 'stoppage1_id' -> 'stoppage1_time')
    const timeField = field.replace('_id', '_time')
    
    setEditedRows(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value || null,
        // Clear time when NONE is selected
        ...(value === 'NONE' ? { [timeField]: 0 } : {})
      }
    }))

    // Find the selected reason to update the display
    const selectedReason = stoppageReasons.find(r => r.id === value)
    const stoppageField = field.replace('_id', '') // e.g., 'stoppage1_id' -> 'stoppage1'

    setStoppageData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { 
          ...row, 
          [field]: value, 
          [stoppageField]: selectedReason,
          // Clear time when NONE is selected
          ...(value === 'NONE' ? { [timeField]: 0 } : {})
        }
        // Recalculate total if time was cleared
        if (value === 'NONE') {
          updatedRow.total_stoppage_time = 
            (updatedRow.stoppage1_time || 0) +
            (updatedRow.stoppage2_time || 0) +
            (updatedRow.stoppage3_time || 0) +
            (updatedRow.stoppage4_time || 0)
        }

        const mergedProduction = mergeProductionDetailWithDraft(updatedRow.production_detail)
        const setup = getEffectiveSetup(mergedProduction?.machine_id)
        updatedRow.production_detail = {
          ...mergedProduction,
          ...recalcProductionFromStoppage(
            mergedProduction,
            updatedRow.total_stoppage_time || 0,
            totalTime,
            setup
          )
        }
        return updatedRow
      }
      return row
    }))
  }

  // Save changes
  const handleSave = async ({ suppressNoChangesToast = false, suppressSuccessToast = false, skipParentRefresh = false } = {}) => {
    if (hasExceededError) {
      toast.error(`Stoppage minutes cannot exceed the ${shiftTimeVal}-minute shift.`)
      return { success: false, error: 'cannot exceed shift time' }
    }
    if (Object.keys(editedRows).length === 0) {
      if (!suppressNoChangesToast) {
        toast.info('No changes to save')
      }
      return { success: true, saved: 0 }
    }

    setIsSaving(true)
    try {
      // First update stoppage entries
      const updatePromises = Object.entries(editedRows).map(([rowId, changes]) => 
        updateStoppageEntryAction(rowId, changes)
      )

      await Promise.all(updatePromises)
      
      // Now recalculate production details based on updated stoppages
      const productionUpdatePromises = Object.keys(editedRows).map(async (rowId) => {
        const stoppageRow = stoppageData.find(s => s.id === rowId)
        if (!stoppageRow || !stoppageRow.production_detail) return null
        
        const prodDetail = stoppageRow.production_detail
        const mergedProduction = mergeProductionDetailWithDraft(prodDetail)
        const machineId = mergedProduction.machine_id
        const setup = getEffectiveSetup(machineId)
        // Setup speed first so unsaved setup edits are reflected dynamically.
        const machineSpeed = setup?.speed ?? mergedProduction.machine?.speed ?? BREAKER_DRAWING_FORMULA_FALLBACK.speed
        
        // Calculate new total stoppage
        const editedChanges = editedRows[rowId]
        const newTotalStoppage = 
          (editedChanges.stoppage1_time ?? stoppageRow.stoppage1_time ?? 0) +
          (editedChanges.stoppage2_time ?? stoppageRow.stoppage2_time ?? 0) +
          (editedChanges.stoppage3_time ?? stoppageRow.stoppage3_time ?? 0) +
          (editedChanges.stoppage4_time ?? stoppageRow.stoppage4_time ?? 0)

        const actHank = toNumber(mergedProduction.act_hank)
        const actProdnInput = resolveActProdnInput(mergedProduction)
        
        // Recalculate production values with new stoppage and machine speed
        const calculated = calculateBreakerDrawingValues(
          actHank,
          actProdnInput,
          totalTime,
          newTotalStoppage,
          setup,
          machineSpeed,  // Pass machine speed explicitly (source of truth)
          mergedProduction.waste
        )

        const payload = {
          ...calculated,
          act_hank: actHank
        }
        
        // Update production detail
        return updateBreakerDrawingDetailAction(mergedProduction.id, payload)
      })
      
      await Promise.all(productionUpdatePromises.filter(Boolean))
      
      const savedCount = Object.keys(editedRows).length
      setEditedRows({})
      if (!suppressSuccessToast) {
        toast.success('Stoppage data saved and production recalculated')
      }
      
      await loadData({ force: true })
      if (!skipParentRefresh) {
        onRefresh?.()
      }
      return { success: true, saved: savedCount }
    } catch (error) {
      console.error('Error saving stoppage data:', error)
      toast.error('Failed to save stoppage data')
      return { success: false, saved: 0, error: error.message }
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshClick = async () => {
    if (Object.keys(editedRows).length > 0) {
      const shouldDiscard = window.confirm('You have unsaved changes in Stoppage. Refresh will discard them. Continue?')
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

  const confirmDiscardLocalEdits = () => {
    if (Object.keys(editedRows).length === 0) return true
    return window.confirm('You have unsaved stoppage row edits. This action will reload data and discard them. Continue?')
  }

  useImperativeHandle(ref, () => ({
    saveChanges: handleSave,
    getEditedCount: () => Object.keys(editedRows).length,
    isSaving: () => isSaving,
    discardChanges
  }), [handleSave, editedRows, isSaving, discardChanges])

  // Apply full stoppage (draft-safe: does not force save/discard of unsaved row edits)
  const handleApplyFullStoppage = async () => {
    const parsedTime = parseInt(fullStoppage.time)
    if (!fullStoppage.reason) {
      toast.warning('Please select a stoppage reason')
      return
    }
    if (!fullStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
      toast.error('Enter a valid stoppage time greater than 0 minutes.')
      return
    }

    const wouldExceed = stoppageData.some(row => {
      const hasFreeSlot = !row.stoppage1_id || !row.stoppage2_id || !row.stoppage3_id || !row.stoppage4_id
      const currentTotal = [1, 2, 3, 4].reduce(
        (total, slot) => total + (Number(row[`stoppage${slot}_time`]) || 0),
        0
      )
      return hasFreeSlot && currentTotal + parsedTime > shiftTimeVal
    })
    if (wouldExceed) {
      toast.error(`Stoppage minutes cannot exceed the ${shiftTimeVal}-minute shift.`)
      return
    }

    setIsSaving(true)
    try {
      const result = await applyBreakerDrawingFullStoppageAction(headerId, fullStoppage.reason, parsedTime)
      if (!result.success) throw new Error(result.error)

      applyServerRowsToDrafts(result.data || [])
      const updated = result.data?.length || 0
      const skipped = Math.max(0, stoppageData.length - updated)
      toast.success(`Full stoppage applied: updated ${updated}, skipped ${skipped}`)
      setFullStoppage({ reason: '', time: '' })
      await loadData({ force: true })
    } catch (error) {
      console.error('Error applying full stoppage:', error)
      toast.error(error.message || 'Failed to apply full stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  // Apply partial stoppage (draft-safe: does not force save/discard of unsaved row edits)
  const handleApplyPartialStoppage = async () => {
    const parsedTime = parseInt(partialStoppage.time)
    if (!partialStoppage.reason || !partialStoppage.fromMachine || !partialStoppage.toMachine) {
      toast.warning('Please fill all fields for partial stoppage')
      return
    }
    if (!partialStoppage.time || Number.isNaN(parsedTime) || parsedTime <= 0) {
      toast.error('Enter a valid stoppage time greater than 0 minutes.')
      return
    }

    const fromNum = parseInt(String(partialStoppage.fromMachine || '').replace(/\D/g, '') || '0')
    const toNum = parseInt(String(partialStoppage.toMachine || '').replace(/\D/g, '') || '0')
    const minNum = Math.min(fromNum, toNum)
    const maxNum = Math.max(fromNum, toNum)

    let partialWouldExceed = false
    for (const row of stoppageData) {
      const mcNo = row.production_detail?.machine?.machine_no
      if (!mcNo) continue
      const mcNum = parseInt(mcNo.replace(/\D/g, ''))
      if (mcNum >= minNum && mcNum <= maxNum) {
        const hasSlot = !row.stoppage1_id || !row.stoppage2_id || !row.stoppage3_id || !row.stoppage4_id
        if (hasSlot) {
          const currentTotal = (Number(row.stoppage1_time) || 0) + (Number(row.stoppage2_time) || 0) + (Number(row.stoppage3_time) || 0) + (Number(row.stoppage4_time) || 0)
          if (currentTotal + parsedTime > shiftTimeVal) {
            partialWouldExceed = true
            break
          }
        }
      }
    }
    if (partialWouldExceed) {
      toast.error(`Stoppage minutes cannot exceed the ${shiftTimeVal}-minute shift.`)
      return
    }

    setIsSaving(true)
    try {
      const response = await applyBreakerDrawingPartialStoppageAction(
        headerId,
        partialStoppage.fromMachine,
        partialStoppage.toMachine,
        partialStoppage.reason,
        parsedTime
      )

      if (!response?.success) throw new Error(response?.error || 'Failed to apply partial stoppage')

      applyServerRowsToDrafts(response.data?.appliedRows || [])

      const updated = response.data?.updatedCount || 0
      const overflow = response.data?.overflowCount || 0
      const skipped = response.data?.skippedCount || 0

      if (updated === 0) {
        toast.warning('No machines updated. All target machines may already have all 4 stoppage slots filled.')
      } else {
        toast.success(`Partial stoppage applied: updated ${updated}, skipped ${skipped}, overflow ${overflow}`)
      }

      setPartialStoppage({ reason: '', fromMachine: '', toMachine: '', time: '' })
      await loadData({ force: true })
    } catch (error) {
      console.error('Error applying partial stoppage:', error)
      toast.error(error.message || 'Failed to apply partial stoppage')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading stoppage data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasExceededError && (
        <div className="p-3 bg-red-100 border-2 border-red-500 text-red-700 rounded font-semibold text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Total stoppage cannot exceed the shift time.</span>
        </div>
      )}
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {stoppageData.length} machines | Shift Time: {totalTime} mins
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

      {/* Stoppage Grid */}
      <div className="border-2 border-gray-400 rounded overflow-hidden">
        <div className="overflow-x-auto max-h-87.5 overflow-y-auto">
          <table ref={tableRef} className="w-max min-w-full border-collapse text-sm table-fixed">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-14 whitespace-nowrap">Mc.No.</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-14 whitespace-nowrap">Session</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-14 whitespace-nowrap">Effi</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">ShiftTime</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 1</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time1</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 2</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time2</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 3</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time3</th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold w-36 whitespace-nowrap">Stoppage 4</th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold w-16 whitespace-nowrap">S.Time4</th>
                <th className="border border-gray-300 px-2 py-2 text-center font-semibold w-16 whitespace-nowrap">Total Stopp</th>
              </tr>
            </thead>
            <tbody>
              {stoppageData.map((row, index) => (
                <tr 
                  key={row.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editedRows[row.id] ? 'bg-yellow-50' : ''} hover:bg-blue-50`}
                >
                  <td className="border border-gray-300 px-2 py-1 font-medium text-blue-700 whitespace-nowrap">
                    {row.production_detail?.machine?.machine_no}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center tabular-nums whitespace-nowrap">
                    {row.production_detail?.session_no || 1}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {formatNumber(row.production_detail?.effi_percent)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {totalTime}
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage1_id">
                    <StoppageAutocomplete
                      value={row.stoppage1?.id || ''}
                      displayValue={row.stoppage1?.stoppage_name || ''}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage1_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage1_id', 'NONE')}
                      data-row={index}
                      data-col="stoppage1_id"
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage1_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage1_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage1?.id ? (row.stoppage1_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage1_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage1_time')}
                      data-row={index}
                      data-col="stoppage1_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage2_id">
                    <StoppageAutocomplete
                      value={row.stoppage2?.id || ''}
                      displayValue={row.stoppage2?.stoppage_name || ''}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage2_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage2_id', 'NONE')}
                      data-row={index}
                      data-col="stoppage2_id"
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage2_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage2_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage2?.id ? (row.stoppage2_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage2_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage2_time')}
                      data-row={index}
                      data-col="stoppage2_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage3_id">
                    <StoppageAutocomplete
                      value={row.stoppage3?.id || ''}
                      displayValue={row.stoppage3?.stoppage_name || ''}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage3_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage3_id', 'NONE')}
                      data-row={index}
                      data-col="stoppage3_id"
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage3_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage3_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage3?.id ? (row.stoppage3_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage3_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage3_time')}
                      data-row={index}
                      data-col="stoppage3_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage4_id">
                    <StoppageAutocomplete
                      value={row.stoppage4?.id || ''}
                      displayValue={row.stoppage4?.stoppage_name || ''}
                      reasons={stoppageReasons}
                      onSelect={(id) => handleStoppageReasonChange(row.id, 'stoppage4_id', id)}
                      onClear={() => handleStoppageReasonChange(row.id, 'stoppage4_id', 'NONE')}
                      data-row={index}
                      data-col="stoppage4_id"
                      cleanCell
                      editingHighlight
                      compact
                      className="h-9 w-full"
                      onEnterNavigation={() => focusNextRow(index, 'stoppage4_id')}
                    />
                  </td>
                  <td className="border border-gray-300 px-0 py-0" data-row={index} data-col="stoppage4_time">
                    <NumberInput
                      type="number"
                      value={row.stoppage4?.id ? (row.stoppage4_time ?? '') : ''}
                      onChange={(e) => handleTimeChange(row.id, 'stoppage4_time', e.target.value)}
                      onKeyDown={(e) => handleEnterNavigation(e, index, 'stoppage4_time')}
                      data-row={index}
                      data-col="stoppage4_time"
                      className="h-9 w-full rounded-none border-0 bg-transparent px-1 text-right text-xs tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100"
                      zeroAsEmpty
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-orange-600 font-medium tabular-nums whitespace-nowrap">
                    {row.total_stoppage_time || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stoppage Application Forms */}
      <div className="grid grid-cols-2 gap-6">
        {/* Full Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-4 bg-gray-50">
            <CardTitle className="text-base font-semibold">Full Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
                <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
                <Input
                  type="number"
                  min="1"
                  max={shiftTimeVal}
                  placeholder="Minutes"
                  value={fullStoppage.time}
                  onChange={(e) => setFullStoppage(prev => ({ ...prev, time: e.target.value }))}
                  className="h-10 text-sm"
                />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Stoppage Reason</Label>
              <StoppageAutocomplete
                value={fullStoppage.reason || ''}
                displayValue={getStoppageDisplayValue(stoppageReasons.find(r => String(r.id) === fullStoppage.reason))}
                reasons={stoppageReasons}
                onSelect={(id) => setFullStoppage(prev => ({ ...prev, reason: String(id) }))}
                onClear={() => setFullStoppage(prev => ({ ...prev, reason: '' }))}
                placeholder="Search stoppage reason..."
              />
            </div>
            <Button 
              onClick={handleApplyFullStoppage}
              disabled={isSaving}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply
            </Button>
          </CardContent>
        </Card>

        {/* Partial Stoppage */}
        <Card className="border-2">
          <CardHeader className="py-4 bg-gray-50">
            <CardTitle className="text-base font-semibold">Partial Stoppage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Time (mins)</Label>
              <Input
                type="number"
                min="1"
                max={shiftTimeVal}
                placeholder="Minutes"
                value={partialStoppage.time}
                onChange={(e) => setPartialStoppage(prev => ({ ...prev, time: e.target.value }))}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Stoppage Reason</Label>
              <StoppageAutocomplete
                value={partialStoppage.reason || ''}
                displayValue={getStoppageDisplayValue(stoppageReasons.find(r => String(r.id) === partialStoppage.reason))}
                reasons={stoppageReasons}
                onSelect={(id) => setPartialStoppage(prev => ({ ...prev, reason: String(id) }))}
                onClear={() => setPartialStoppage(prev => ({ ...prev, reason: '' }))}
                placeholder="Search stoppage reason..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">From M/c No.</Label>
                <Select
                  value={partialStoppage.fromMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, fromMachine: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="From" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.machine_no}>
                        {m.machine_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">To M/c No.</Label>
                <Select
                  value={partialStoppage.toMachine || undefined}
                  onValueChange={(value) => setPartialStoppage(prev => ({ ...prev, toMachine: value }))}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="To" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.machine_no}>
                        {m.machine_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleApplyPartialStoppage}
              disabled={isSaving}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Apply
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
})

export default BreakerDrawingStoppageTab
