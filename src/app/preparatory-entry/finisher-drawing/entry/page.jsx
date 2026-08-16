'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import Calendar from '@/components/common/HolidayAwareCalendar'
import DeferredMount from '@/components/common/DeferredMount'
import { CalendarIcon, Loader2, CheckCircle2, Copy, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"
import { resolveFinisherDrawingShiftFallbackTime } from '@/lib/finisherDrawingShiftFallback'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'

import FinisherDrawingProductionTab from '@/components/modules/preparatory-entry/FinisherDrawingProductionTab'
import FinisherDrawingStoppageTab from '@/components/modules/preparatory-entry/FinisherDrawingStoppageTab'
import FinisherDrawingMachineSetupTab from '@/components/modules/preparatory-entry/FinisherDrawingMachineSetupTab'

import {
  getFinisherDrawingProductionByDateShiftAction,
  getOrCreateFinisherDrawingHeaderAction,
  updateFinisherDrawingHeaderAction,
  getSupervisorsAction,
  initializeFinisherDrawingDetailsAction,
  copyFinisherDrawingFromPreviousDateAction,
  getFinisherDrawingAvailableDatesAction,
  getFinisherDrawingShiftConfigAction
} from '@/app/actions/finisher-drawing-entry'

function FinisherDrawingEntryContent() {
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
  const [headerData, setHeaderData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [shiftTime, setShiftTime] = useState(resolveFinisherDrawingShiftFallbackTime(shift))
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [sharedDrafts, setSharedDrafts] = useState({ header: {}, production: {}, stoppage: {}, setup: {} })
  const sharedDraftsRef = useRef(sharedDrafts)
  // Copy Previous Speed states
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [availableDates, setAvailableDates] = useState([])
  const [selectedSourceDate, setSelectedSourceDate] = useState(null)
  const [isLoadingDates, setIsLoadingDates] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [activeTab, setActiveTab] = useState('production')
  const productionTabRef = useRef(null)
  const stoppageTabRef = useRef(null)
  const setupTabRef = useRef(null)
  const saveInFlightRef = useRef(false)

  const updateTabDrafts = useCallback((tabKey, nextDraftOrUpdater) => {
    const current = sharedDraftsRef.current
    const currentTabDrafts = current?.[tabKey] || {}
    const nextTabDrafts = typeof nextDraftOrUpdater === 'function'
      ? nextDraftOrUpdater(currentTabDrafts)
      : (nextDraftOrUpdater || {})
    if (nextTabDrafts === currentTabDrafts) return
    const next = { ...current, [tabKey]: nextTabDrafts }
    sharedDraftsRef.current = next
    setSharedDrafts(next)
  }, [])

  const replaceAllDrafts = useCallback((next) => {
    sharedDraftsRef.current = next
    setSharedDrafts(next)
  }, [])

  const clearAllDrafts = useCallback(() => {
    replaceAllDrafts({ header: {}, production: {}, stoppage: {}, setup: {} })
  }, [replaceAllDrafts])

  const handleProductionDraftsChange = useCallback((next) => {
    updateTabDrafts('production', next)
  }, [updateTabDrafts])

  const handleStoppageDraftsChange = useCallback((next) => {
    updateTabDrafts('stoppage', next)
  }, [updateTabDrafts])

  const handleSetupDraftsChange = useCallback((next) => {
    updateTabDrafts('setup', next)
  }, [updateTabDrafts])

  const getUnsavedEditCount = useCallback(() => {
    const currentDrafts = sharedDraftsRef.current
    const sharedCount =
      Object.keys(currentDrafts.production || {}).length +
      Object.keys(currentDrafts.stoppage || {}).length +
      Object.keys(currentDrafts.setup || {}).length +
      (Object.keys(currentDrafts.header || {}).length > 0 ? 1 : 0)

    if (sharedCount > 0) return sharedCount

    const refs = [productionTabRef.current, stoppageTabRef.current, setupTabRef.current]
    return refs.reduce((sum, tab) => sum + (tab?.getEditedCount?.() || 0), 0)
  }, [sharedDrafts])

  useUnsavedChangesWarning(getUnsavedEditCount() > 0)

  const confirmIfUnsaved = useCallback((message) => {
    const unsaved = getUnsavedEditCount()
    if (!unsaved) return true
    return window.confirm(`${message}\n\nYou have ${unsaved} unsaved edit(s). Continue and discard in-memory edits?`)
  }, [getUnsavedEditCount])

  // Load supervisors
  useEffect(() => {
    const loadSupervisors = async () => {
      try {
        const result = await getSupervisorsAction()
        if (result.success) {
          setSupervisors(result.data || [])
        } else {
          console.error('Error loading supervisors:', result.error)
        }
      } catch (error) {
        console.error('Error loading supervisors:', error)
      }
    }
    loadSupervisors()
  }, [])

  // Load shift time from database when shift changes
  useEffect(() => {
    const loadShiftTime = async () => {
      try {
        const result = await getFinisherDrawingShiftConfigAction(parseInt(shift))
        if (result.success && result.data) {
          setShiftTime(result.data.shiftTime || resolveFinisherDrawingShiftFallbackTime(shift))
        } else {
          // Fallback-only when shift_config is unavailable.
          setShiftTime(resolveFinisherDrawingShiftFallbackTime(shift))
        }
      } catch (error) {
        console.error('Error loading shift time:', error)
        setShiftTime(resolveFinisherDrawingShiftFallbackTime(shift))
      }
    }
    loadShiftTime()
  }, [shift])

  // Load or create production header when date/shift changes
  const loadProductionHeader = useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getFinisherDrawingProductionByDateShiftAction(dateStr, parseInt(shift))
      
      if (result.success && result.data) {
        setHeaderId(result.data.id)
        setHeaderData(result.data)
        setSupervisorId(result.data.supervisor_id || '')
        setMaisitryId(result.data.maisitry_id || '')
      } else {
        setHeaderId(null)
        setHeaderData(null)
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
      const headerResult = await getOrCreateFinisherDrawingHeaderAction(
        dateStr,
        parseInt(shift),
        supervisorId || null,
        maisitryId || null
      )
      
      if (!headerResult.success) {
        throw new Error(headerResult.error)
      }
      
      // Initialize details for all machines
      const initializationResult = await initializeFinisherDrawingDetailsAction(headerResult.data.id)
      if (!initializationResult.success) {
        throw new Error(initializationResult.error || 'Failed to initialize production details')
      }
      
      setHeaderId(headerResult.data.id)
      setHeaderData(headerResult.data)
      toast.success('Production entry initialized successfully')
      
    } catch (error) {
      console.error('Error initializing production:', error)
      toast.error('Failed to initialize production entry')
    } finally {
      setIsInitializing(false)
    }
  }

  // Load available previous dates for copy
  const loadAvailableDates = async () => {
    if (!headerId) return
    
    setIsLoadingDates(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getFinisherDrawingAvailableDatesAction(dateStr, parseInt(shift))
      if (result.success) {
        setAvailableDates(result.data || [])
        // Pre-select the most recent date if available
        if (result.data && result.data.length > 0) {
          setSelectedSourceDate(result.data[0].entry_date)
        }
      }
    } catch (error) {
      console.error('Error loading available dates:', error)
      toast.error('Failed to load available dates')
    } finally {
      setIsLoadingDates(false)
    }
  }

  // Handle opening copy dialog
  const handleOpenCopyDialog = () => {
    if (!headerId) {
      toast.warning('Please initialize the entry first')
      return
    }
    if (!confirmIfUnsaved('Copying previous data can overwrite current working values.')) {
      return
    }
    loadAvailableDates()
    setCopyDialogOpen(true)
  }

  // Copy from selected previous date
  const handleCopyPreviousData = async () => {
    if (!headerId || !selectedSourceDate) {
      toast.warning('Please select a date to copy from')
      return
    }

    setIsCopying(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      
      // Parse the selected item which contains both date and shift
      let sourceDateStr, sourceShift
      try {
        const selectedItem = JSON.parse(selectedSourceDate)
        const parsedDate = new Date(selectedItem.entry_date)
        if (!isNaN(parsedDate.getTime())) {
          sourceDateStr = format(parsedDate, 'yyyy-MM-dd')
          sourceShift = selectedItem.shift
        } else {
          throw new Error('Invalid date')
        }
      } catch (err) {
        console.error('Date parsing error:', err)
        toast.error('Invalid date format selected')
        setIsCopying(false)
        return
      }
      
      const result = await copyFinisherDrawingFromPreviousDateAction(
        dateStr, 
        parseInt(shift), 
        headerId, 
        sourceDateStr
      )
      
      if (result.success) {
        toast.success(`Copied speed from ${result.data.copiedFrom} shift ${shift} - ${result.data.machinesUpdated} machines updated`)
        setCopyDialogOpen(false)
        clearAllDrafts()
        
        // Refresh data
        await loadProductionHeader()
        await setupTabRef.current?.refreshData?.()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error copying previous speed:', error)
      toast.error(error.message || 'Failed to copy speed')
    } finally {
      setIsCopying(false)
    }
  }

  // Update supervisor
  const handleSupervisorChange = (value) => {
    setSupervisorId(value)
    if (headerId) updateTabDrafts('header', prev => ({ ...prev, supervisor_id: value || null }))
  }

  // Update maisitry
  const handleMaisitryChange = (value) => {
    setMaisitryId(value)
    if (headerId) updateTabDrafts('header', prev => ({ ...prev, maisitry_id: value || null }))
  }

  // Refresh data
  const handleRefresh = async () => {
    await loadProductionHeader()
    await Promise.all([
      productionTabRef.current?.refreshData?.() || Promise.resolve(),
      stoppageTabRef.current?.refreshData?.() || Promise.resolve(),
      setupTabRef.current?.refreshData?.() || Promise.resolve()
    ])
  }

  const handleSaveAllTabs = async () => {
    if (!headerId || saveInFlightRef.current) return

    const totalPending = getUnsavedEditCount()
    if (totalPending === 0) {
      toast.info('No changes to save')
      return
    }

    const draftsAtSaveStart = sharedDraftsRef.current
    saveInFlightRef.current = true
    setIsSavingAll(true)
    try {
      const setupResult = await (
        setupTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: draftsAtSaveStart
        }) || Promise.resolve({ success: true, saved: 0 })
      )

      const stoppageResult = await (
        stoppageTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: draftsAtSaveStart
        }) || Promise.resolve({ success: true, saved: 0 })
      )

      // Save production last so any stoppage-driven recalculation cannot overwrite latest waste edits.
      const prodResult = await (
        productionTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: draftsAtSaveStart
        }) || Promise.resolve({ success: true, saved: 0 })
      )
      const headerResult = Object.keys(draftsAtSaveStart.header || {}).length > 0
        ? await updateFinisherDrawingHeaderAction(headerId, draftsAtSaveStart.header)
        : { success: true, saved: 0 }

      const results = [prodResult, stoppageResult, setupResult, headerResult]
      const failures = results.filter(r => !r?.success)
      const totalSaved = results.reduce((sum, r) => sum + (r?.saved || 0), 0)

      if (failures.length > 0) {
        replaceAllDrafts(draftsAtSaveStart)
        toast.error(`Update incomplete: ${failures.length} section(s) failed. Your drafts were retained; click Update to retry.`)
      } else {
        toast.success(`Saved ${totalSaved} change(s) across all tabs`)
        clearAllDrafts()
        router.push('/preparatory-entry/finisher-drawing')
        return
      }
    } catch (error) {
      replaceAllDrafts(draftsAtSaveStart)
      console.error('Error saving Finisher Drawing entry:', error)
      toast.error('Update failed. Your unsaved drafts were retained.')
    } finally {
      saveInFlightRef.current = false
      setIsSavingAll(false)
    }
  }

  const handleCancelAllDrafts = async () => {
    const unsaved = getUnsavedEditCount()
    if (!unsaved) {
      toast.info('No unsaved changes to cancel')
      return
    }

    const confirmed = window.confirm(`Discard ${unsaved} unsaved edit(s) across all tabs?`)
    if (!confirmed) return

    await Promise.all([
      productionTabRef.current?.discardChanges?.() || Promise.resolve({ success: true }),
      stoppageTabRef.current?.discardChanges?.() || Promise.resolve({ success: true }),
      setupTabRef.current?.discardChanges?.() || Promise.resolve({ success: true })
    ])

    clearAllDrafts()
    await loadProductionHeader()
    toast.success('Unsaved changes discarded')
  }

  useEffect(() => {
    clearAllDrafts()
  }, [date, shift, clearAllDrafts])

  const handleDateChange = (nextDate) => {
    if (!nextDate) return
    if (!confirmIfUnsaved('Changing date will reload entry data.')) return
    clearAllDrafts()
    setDate(nextDate)
  }

  const handleShiftChange = (nextShift) => {
    if (!confirmIfUnsaved('Changing shift will reload entry data.')) return
    clearAllDrafts()
    setShift(nextShift)
  }

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab)
  }

  const tabTotalTime = Number(headerData?.total_time) || shiftTime

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Finisher Drawing Entry</h1>
      </div>

      {/* Control Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Back to List */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => confirmIfUnsaved('Going back will discard unsaved edits.') && router.push('/preparatory-entry/finisher-drawing')}
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
                      "w-45 justify-start text-left font-normal",
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
                    tableName="finisher_drawing_production_header"
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
                <SelectTrigger className="w-20">
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
                <SelectTrigger className="w-50">
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map(sup => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.supervisor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Maisitry */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Maisitry</Label>
              <Select value={maisitryId || 'nil'} onValueChange={(val) => handleMaisitryChange(val === 'nil' ? '' : val)}>
                <SelectTrigger className="w-37.5">
                  <SelectValue placeholder="NIL" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nil">NIL</SelectItem>
                  {supervisors.map(sup => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.supervisor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Initialize Button */}
            {!headerId && (
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

            {/* Copy Previous Speed is available only inside Machine Setup. */}
            {headerId && activeTab === 'setup' && (
              <div className="ml-auto flex flex-col items-end gap-2">
                <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={handleOpenCopyDialog}
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Previous Speed
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Copy Previous Speed</DialogTitle>
                      <DialogDescription>
                        Select a previous date to copy machine setup speeds from Shift {shift}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {isLoadingDates ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                          <span className="ml-2">Loading available dates...</span>
                        </div>
                      ) : availableDates.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">
                          No previous speeds found for Shift {shift}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <Label>Select Date</Label>
                          <Select 
                            value={selectedSourceDate || ''} 
                            onValueChange={setSelectedSourceDate}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a date" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDates.map((item) => {
                                const dateObj = item.entry_date instanceof Date 
                                  ? item.entry_date 
                                  : new Date(item.entry_date)
                                const formattedDate = !isNaN(dateObj.getTime()) 
                                  ? format(dateObj, 'dd-MMM-yyyy')
                                  : 'Invalid Date'
                                const itemValue = JSON.stringify({ entry_date: item.entry_date, shift: item.shift })
                                return (
                                  <SelectItem 
                                    key={`${item.entry_date}-${item.shift}`}
                                    value={itemValue}
                                  >
                                    {formattedDate} (Shift {item.shift})
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setCopyDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCopyPreviousData}
                        disabled={isCopying || !selectedSourceDate || availableDates.length === 0}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        {isCopying ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        Copy Speed
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2">Loading...</span>
        </div>
      ) : headerId ? (
        <Card>
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

            <CardContent className="pt-4">
              <TabsContent value="production" className="m-0 data-[state=inactive]:hidden" forceMount>
                <DeferredMount active={activeTab === 'production'}>
                <FinisherDrawingProductionTab 
                  ref={productionTabRef}
                  headerId={headerId} 
                  totalTime={tabTotalTime}
                  shift={parseInt(shift)}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.production}
                  onSharedDraftEditsChange={handleProductionDraftsChange}
                  setupDraftEdits={sharedDrafts.setup}
                  stoppageDraftEdits={sharedDrafts.stoppage}
                />
                </DeferredMount>
              </TabsContent>

              <TabsContent value="stoppage" className="m-0 data-[state=inactive]:hidden" forceMount>
                <DeferredMount active={activeTab === 'stoppage'}>
                <FinisherDrawingStoppageTab 
                  ref={stoppageTabRef}
                  headerId={headerId}
                  totalTime={tabTotalTime}
                  shift={parseInt(shift)}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.stoppage}
                  onSharedDraftEditsChange={handleStoppageDraftsChange}
                  setupDraftEdits={sharedDrafts.setup}
                  productionDraftEdits={sharedDrafts.production}
                />
                </DeferredMount>
              </TabsContent>

              <TabsContent value="setup" className="m-0 data-[state=inactive]:hidden" forceMount>
                <DeferredMount active={activeTab === 'setup'}>
                <FinisherDrawingMachineSetupTab
                  ref={setupTabRef}
                  headerId={headerId}
                  entryDate={format(date, 'yyyy-MM-dd')}
                  shift={parseInt(shift)}
                  totalTime={tabTotalTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.setup}
                  onSharedDraftEditsChange={handleSetupDraftsChange}
                />
                </DeferredMount>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-4">No production entry found for this date and shift.</p>
            <p className="text-sm mb-6">Click "Initialize Entry" to create a new production entry for all Finisher Drawing machines (FD4-FD10).</p>
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
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" disabled>
                  EL Measure Data
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="default" onClick={handleSaveAllTabs} disabled={isSavingAll}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Update
                </Button>
                <Button variant="destructive" onClick={handleCancelAllDrafts}>
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

export default function FinisherDrawingEntryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <FinisherDrawingEntryContent />
    </Suspense>
  )
}
