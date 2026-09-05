'use client'

import { EntryRowSelectionProvider } from '@/components/common/EntryRowSelection'

import { confirmAction } from '@/lib/confirmation'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CalendarIcon, Copy, Loader2, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import Calendar from '@/components/common/HolidayAwareCalendar'
import DeferredMount from '@/components/common/DeferredMount'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { resolveSimplexShiftFallbackTime } from '@/lib/simplexFormulaFallback'

import {
  getSimplexProductionByDateShiftAction,
  getOrCreateSimplexProductionHeaderAction,
  initializeSimplexProductionDetailsAction,
  addMissingSimplexProductionDetailsAction,
  getSimplexProductionWithSetupAction,
  updateSimplexProductionHeaderAction,
  getSimplexStoppageEntriesAction,
  getSimplexMachineSetupsAction,
  getSupervisorsAction,
  getSimplexMachinesAction,
  getSimplexShiftConfigAction
} from '@/app/actions/simplexEntryActions'

import SimplexProductionTab from '@/components/modules/preparatory-entry/SimplexProductionTab'
import SimplexStoppageTab from '@/components/modules/preparatory-entry/SimplexStoppageTab'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import SimplexMachineSetupTab from '@/components/modules/preparatory-entry/SimplexMachineSetupTab'

function SimplexEntryContent() {
  // State
  const searchParams = useSearchParams()
  const router = useRouter()
  const paramDate = searchParams.get('date')
  const paramShift = searchParams.get('shift')
  const [date, setDate] = useState(paramDate ? new Date(paramDate + 'T00:00:00') : new Date())
  const [shift, setShift] = useState(paramShift || '1')
  const [supervisorId, setSupervisorId] = useState('')
  const [maisitryId, setMaisitryId] = useState('')
  const [supervisors, setSupervisors] = useState([])
  const [headerId, setHeaderId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [activeTab, setActiveTab] = useState('production')
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [totalTime, setTotalTime] = useState(resolveSimplexShiftFallbackTime(paramShift || '1'))
  const [sharedDrafts, setSharedDrafts] = useState({
    header: {},
    production: {},
    stoppage: {},
    setup: {}
  })
  const sharedDraftsRef = useRef(sharedDrafts)

  const productionTabRef = useRef(null)
  const stoppageTabRef = useRef(null)
  const setupTabRef = useRef(null)
  const saveInFlightRef = useRef(false)

  // Load supervisors
  useEffect(() => {
    const loadSupervisors = async () => {
      try {
        const result = await getSupervisorsAction()
        if (result.success) {
          setSupervisors(result.data || [])
        }
      } catch (error) {
        console.error('Error loading supervisors:', error)
      }
    }
    loadSupervisors()
    loadMachines()
    loadMachineSetups()
  }, [])

  // Load shift time when shift changes
  useEffect(() => {
    const loadShiftTime = async () => {
      try {
        const result = await getSimplexShiftConfigAction(parseInt(shift))
        const fallbackShiftTime = resolveSimplexShiftFallbackTime(shift)
        if (result.success && result.data) {
          setTotalTime(result.data.shiftTime || fallbackShiftTime)
        } else {
          setTotalTime(fallbackShiftTime)
        }
      } catch (error) {
        console.error('Error loading shift config:', error)
        setTotalTime(resolveSimplexShiftFallbackTime(shift))
      }
    }
    loadShiftTime()
  }, [shift])

  const loadMachines = async () => {
    try {
      const result = await getSimplexMachinesAction()
      if (result.success) {
        // Kept for parity with old flow where machine list is preloaded.
      }
    } catch (error) {
      console.error('Error loading machines:', error)
    }
  }

  const loadMachineSetups = async () => {
    try {
      const result = await getSimplexMachineSetupsAction()
      if (result.success) {
        // Kept for parity with old flow where setup list is preloaded.
      }
    } catch (error) {
      console.error('Error loading machine setups:', error)
    }
  }

  // Load or create production header when date/shift changes
  const loadProductionHeader = useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getSimplexProductionByDateShiftAction(dateStr, shift)
      
      if (result.success && result.data) {
        const existing = result.data
        setHeaderId(existing.id)
        setSupervisorId(existing.supervisor_id || '')
        setMaisitryId(existing.maisitry_id || '')
        // Note: totalTime is set from shift config, not from header
        
        // Add missing production details for any newly added machines
        await addMissingSimplexProductionDetailsAction(existing.id)
        
        // Load production details
        const detailsResult = await getSimplexProductionWithSetupAction(existing.id)
        if (detailsResult.success) {
          // Data is loaded inside tab components.
        }
        
        // Load stoppage data
        const stoppagesResult = await getSimplexStoppageEntriesAction(existing.id)
        if (stoppagesResult.success) {
          // Data is loaded inside tab components.
        }
      } else {
        setHeaderId(null)
        setSupervisorId('')
        setMaisitryId('')
      }
    } catch (error) {
      console.error('Error loading production header:', error)
      toast.error('Failed to load production data')
    } finally {
      setIsLoading(false)
    }
  }, [date, shift])

  useEffect(() => {
    loadProductionHeader()
  }, [loadProductionHeader])

  const replaceAllDrafts = useCallback((next) => {
    sharedDraftsRef.current = next
    setSharedDrafts(next)
  }, [])

  const clearSharedDrafts = useCallback(() => {
    replaceAllDrafts({ header: {}, production: {}, stoppage: {}, setup: {} })
  }, [replaceAllDrafts])

  const setProductionDraftEdits = useCallback((updates) => {
    const next = { ...sharedDraftsRef.current, production: updates || {} }
    replaceAllDrafts(next)
  }, [replaceAllDrafts])

  const setStoppageDraftEdits = useCallback((updates) => {
    const next = { ...sharedDraftsRef.current, stoppage: updates || {} }
    replaceAllDrafts(next)
  }, [replaceAllDrafts])

  const setSetupDraftEdits = useCallback((updates) => {
    const next = { ...sharedDraftsRef.current, setup: updates || {} }
    replaceAllDrafts(next)
  }, [replaceAllDrafts])

  const editedCounts = {
    header: Object.keys(sharedDrafts.header || {}).length > 0 ? 1 : 0,
    production: Object.keys(sharedDrafts.production || {}).length,
    stoppage: Object.keys(sharedDrafts.stoppage || {}).length,
    setup: Object.keys(sharedDrafts.setup || {}).length
  }
  const totalEditedCount = editedCounts.header + editedCounts.production + editedCounts.stoppage + editedCounts.setup
  const getUnsavedEditCount = useCallback(() => {
    const drafts = sharedDraftsRef.current
    const sharedCount =
      (Object.keys(drafts.header || {}).length > 0 ? 1 : 0) +
      Object.keys(drafts.production || {}).length +
      Object.keys(drafts.stoppage || {}).length +
      Object.keys(drafts.setup || {}).length
    if (sharedCount > 0) return sharedCount
    return [productionTabRef.current, stoppageTabRef.current, setupTabRef.current]
      .reduce((sum, tab) => sum + (tab?.getEditedCount?.() || 0), 0)
  }, [])
  useUnsavedChangesWarning(getUnsavedEditCount() > 0)

  const confirmUnsavedDiscard = useCallback(async (actionLabel) => {
    const unsavedCount = getUnsavedEditCount()
    if (unsavedCount === 0) return true
    return await confirmAction('discard unsaved changes')
  }, [getUnsavedEditCount])

  const discardAllTabChanges = useCallback(async () => {
    await Promise.all([
      productionTabRef.current?.discardChanges?.() || Promise.resolve(),
      stoppageTabRef.current?.discardChanges?.() || Promise.resolve(),
      setupTabRef.current?.discardChanges?.() || Promise.resolve()
    ])
    clearSharedDrafts()
  }, [clearSharedDrafts])

  const handleBackToList = useCallback(async () => {
    const unsavedCount = getUnsavedEditCount()
    if (unsavedCount > 0 && !(await confirmUnsavedDiscard('Going back to list'))) return
    if (unsavedCount > 0) await discardAllTabChanges()
    router.push('/preparatory-entry/simplex')
  }, [router, getUnsavedEditCount, confirmUnsavedDiscard, discardAllTabChanges])

  const handleDateChange = useCallback(async (newDate) => {
    if (!newDate) return
    if (newDate.toDateString() === date.toDateString()) return
    if (!(await confirmUnsavedDiscard('Changing date'))) return
    if (getUnsavedEditCount() > 0) await discardAllTabChanges()
    setDate(newDate)
  }, [date, getUnsavedEditCount, confirmUnsavedDiscard, discardAllTabChanges])

  const handleShiftChange = useCallback(async (newShift) => {
    if (newShift === shift) return
    if (!(await confirmUnsavedDiscard('Changing shift'))) return
    if (getUnsavedEditCount() > 0) await discardAllTabChanges()
    setShift(newShift)
  }, [shift, getUnsavedEditCount, confirmUnsavedDiscard, discardAllTabChanges])

  // Initialize new production entry
  const handleInitialize = async () => {
    if (headerId) {
      toast.info('Production entry already exists for this date and shift')
      return
    }

    setIsInitializing(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      
      // Create header
      const headerResult = await getOrCreateSimplexProductionHeaderAction(
        dateStr,
        shift,
        supervisorId || null,
        maisitryId || null
      )
      
      if (!headerResult.success) {
        throw new Error(headerResult.error)
      }
      
      const header = headerResult.data
      
      // Initialize details for all machines
      const initializationResult = await initializeSimplexProductionDetailsAction(header.id)
      if (!initializationResult.success) {
        throw new Error(initializationResult.error || 'Failed to initialize production details')
      }
      
      setHeaderId(header.id)
      toast.success('Production entry initialized successfully')
      
      // Reload data
      await loadProductionHeader()
      
    } catch (error) {
      console.error('Error initializing production:', error)
      toast.error('Failed to initialize production entry')
    } finally {
      setIsInitializing(false)
    }
  }

  // Update supervisor
  const handleSupervisorChange = (value) => {
    setSupervisorId(value)
    if (headerId) {
      const current = sharedDraftsRef.current
      replaceAllDrafts({ ...current, header: { ...current.header, supervisor_id: value || null } })
    }
  }

  // Update maisitry
  const handleMaisitryChange = (value) => {
    setMaisitryId(value)
    if (headerId) {
      const current = sharedDraftsRef.current
      replaceAllDrafts({ ...current, header: { ...current.header, maisitry_id: value || null } })
    }
  }

  // Refresh data
  const handleRefresh = useCallback(async () => {
    if (!(await confirmUnsavedDiscard('Refreshing'))) return
    if (getUnsavedEditCount() > 0) await discardAllTabChanges()

    await loadProductionHeader()
    await Promise.all([
      productionTabRef.current?.refreshData?.() || Promise.resolve(),
      stoppageTabRef.current?.refreshData?.() || Promise.resolve(),
      setupTabRef.current?.refreshData?.() || Promise.resolve()
    ])
    loadMachineSetups()
  }, [confirmUnsavedDiscard, getUnsavedEditCount, discardAllTabChanges, loadProductionHeader])

  const handleSaveAllChanges = useCallback(async () => {
    if (!headerId || saveInFlightRef.current) return
    const livePendingCount = getUnsavedEditCount()
    if (livePendingCount === 0) {
      toast.info('No changes to save')
      return
    }

    if (!(await confirmAction('update'))) return
    if (saveInFlightRef.current) return

    const draftsAtSaveStart = sharedDraftsRef.current
    const liveEditedCounts = {
      header: Object.keys(draftsAtSaveStart.header || {}).length > 0 ? 1 : 0,
      production: Object.keys(draftsAtSaveStart.production || {}).length,
      stoppage: Object.keys(draftsAtSaveStart.stoppage || {}).length,
      setup: Object.keys(draftsAtSaveStart.setup || {}).length
    }
    saveInFlightRef.current = true
    setIsSavingAll(true)
    try {
      if (liveEditedCounts.header > 0) {
        const headerResult = await updateSimplexProductionHeaderAction(headerId, draftsAtSaveStart.header)
        if (!headerResult?.success) {
          throw new Error(headerResult?.error || 'Failed to update entry header')
        }
      }

      const hasDependentProductionChanges = liveEditedCounts.setup > 0 || liveEditedCounts.stoppage > 0
      const tabSaves = [
        { key: 'Machine Setup', count: liveEditedCounts.setup, ref: setupTabRef.current },
        { key: 'Stoppage', count: liveEditedCounts.stoppage, ref: stoppageTabRef.current },
        {
          key: 'Production',
          count: liveEditedCounts.production + (hasDependentProductionChanges ? 1 : 0),
          ref: productionTabRef.current
        }
      ].filter(tab => tab.count > 0)

      let totalSaved = 0
      const failures = []

      for (const tab of tabSaves) {
        const result = await tab.ref?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: draftsAtSaveStart
        })

        if (result?.success) {
          totalSaved += result.saved || 0
        } else {
          failures.push(tab.key)
        }
      }

      if (totalSaved > 0) {
        toast.success(`Saved ${totalSaved} row(s) across tabs`)
      }

      if (failures.length > 0) {
        replaceAllDrafts(draftsAtSaveStart)
        toast.error(`Update incomplete for ${failures.join(', ')}. Your drafts were retained; click Update to retry.`)
      } else {
        clearSharedDrafts()
        router.push('/preparatory-entry/simplex')
        return
      }
    } catch (error) {
      replaceAllDrafts(draftsAtSaveStart)
      console.error('Error saving all changes:', error)
      toast.error('Update failed. Your unsaved drafts were retained.')
    } finally {
      saveInFlightRef.current = false
      setIsSavingAll(false)
    }
  }, [getUnsavedEditCount, headerId, router, replaceAllDrafts, clearSharedDrafts])

  const handleCancelAllChanges = useCallback(async () => {
    if (getUnsavedEditCount() === 0) {
      toast.info('No unsaved changes to discard')
      return
    }
    if (!(await confirmAction('cancel'))) return

    await discardAllTabChanges()
    await loadProductionHeader()
    toast.success('Unsaved changes discarded')
  }, [getUnsavedEditCount, confirmUnsavedDiscard, discardAllTabChanges, loadProductionHeader])

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab)
  }

  return (
    <div className="entry-workspace">
      {/* Page Title */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-blue-700">Simplex Entry</h1>
        <span className="text-sm text-gray-500">Preparatory Entry</span>
      </div>

      {/* Control Bar */}
      <Card className="entry-controls">
        <CardContent className="py-4">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Back to List */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToList}
              className="flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to List
            </Button>
            {/* Date */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[144px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd-MMM-yy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateChange}
                    tableName="simplex_production_header"
                    shift={shift}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Shift */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Shift</Label>
              <Select value={shift} onValueChange={handleShiftChange}>
                <SelectTrigger className="w-[64px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supervisor */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Supervisor</Label>
              <Select value={supervisorId || undefined} onValueChange={handleSupervisorChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map(sup => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.supervisor_label || sup.supervisor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Maisitry */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Maisitry</Label>
              <Select value={maisitryId || 'nil'} onValueChange={(val) => handleMaisitryChange(val === 'nil' ? '' : val)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="NIL" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nil">NIL</SelectItem>
                  {supervisors.map(sup => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.supervisor_label || sup.supervisor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            {/* Initialize Button */}
            {!headerId && !isLoading && (
              <Button 
                onClick={handleInitialize}
                disabled={isInitializing}
                className="ml-auto"
              >
                {isInitializing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                Initialize Entry
              </Button>
            )}

            {/* Simplex speed is fixed, so the setup-only copy action is disabled. */}
            {headerId && activeTab === 'setup' && (
              <div className="ml-auto flex flex-col items-end gap-2">
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-600"
                  disabled
                  title="Simplex speed is fixed and cannot be copied"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Previous Speed
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      {isLoading ? (
        <div className="entry-loading flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2">Loading...</span>
        </div>
      ) : headerId ? (
        <Card className="entry-sheet">
          <EntryRowSelectionProvider key={headerId}>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full justify-start border-b-0 rounded-none bg-transparent p-0 gap-1">
              <TabsTrigger 
                value="production" 
                className="rounded-t-lg border border-b-0 px-6 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
              >
                Production Entry
              </TabsTrigger>
              <TabsTrigger 
                value="stoppage"
                className="rounded-t-lg border border-b-0 px-6 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
              >
                Stoppage Entry
              </TabsTrigger>
              <TabsTrigger 
                value="setup"
                className="rounded-t-lg border border-b-0 px-6 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
              >
                Machine Setup
              </TabsTrigger>
            </TabsList>

            <CardContent className="entry-sheet-content">
              <TabsContent value="production" forceMount className={cn('m-0', activeTab !== 'production' && 'hidden')}>
                <DeferredMount active={activeTab === 'production'}>
                <SimplexProductionTab 
                  ref={productionTabRef}
                  headerId={headerId}
                  entryDate={format(date, 'yyyy-MM-dd')}
                  totalTime={totalTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.production}
                  onSharedDraftEditsChange={setProductionDraftEdits}
                  stoppageDraftEdits={sharedDrafts.stoppage}
                  setupDraftEdits={sharedDrafts.setup}
                />
                </DeferredMount>
              </TabsContent>

              <TabsContent value="stoppage" forceMount className={cn('m-0', activeTab !== 'stoppage' && 'hidden')}>
                <DeferredMount active={activeTab === 'stoppage'}>
                <SimplexStoppageTab 
                  ref={stoppageTabRef}
                  headerId={headerId}
                  totalTime={totalTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.stoppage}
                  onSharedDraftEditsChange={setStoppageDraftEdits}
                  productionDraftEdits={sharedDrafts.production}
                  setupDraftEdits={sharedDrafts.setup}
                />
                </DeferredMount>
              </TabsContent>

              <TabsContent value="setup" forceMount className={cn('m-0', activeTab !== 'setup' && 'hidden')}>
                <DeferredMount active={activeTab === 'setup'}>
                <SimplexMachineSetupTab 
                  ref={setupTabRef}
                  headerId={headerId}
                  totalTime={totalTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.setup}
                  onSharedDraftEditsChange={setSetupDraftEdits}
                />
                </DeferredMount>
              </TabsContent>
            </CardContent>
          </Tabs>
          </EntryRowSelectionProvider>
        </Card>
      ) : (
        <Card className="entry-empty-state p-6">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-4">No production entry found for this date and shift.</p>
            <p className="text-sm mb-6">Click &quot;Initialize Entry&quot; to create a new production entry for all simplex machines.</p>
            <Button onClick={handleInitialize} disabled={isInitializing}>
              {isInitializing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              Initialize Production Entry
            </Button>
          </div>
        </Card>
      )}

      {/* Footer Actions */}
      {headerId && (
        <Card className="entry-footer">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="default" onClick={handleSaveAllChanges} disabled={isSavingAll || totalEditedCount === 0}>
                  {isSavingAll ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Update
                </Button>
                <Button variant="destructive" onClick={handleCancelAllChanges}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}

export default function SimplexEntryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <SimplexEntryContent />
    </Suspense>
  )
}
