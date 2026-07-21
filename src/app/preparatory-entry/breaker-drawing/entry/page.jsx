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
import { CalendarIcon, Loader2, Save, Copy, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"
import { resolveBreakerDrawingShiftFallbackTime } from '@/lib/breakerDrawingShiftFallback'

import BreakerDrawingProductionTab from '@/components/modules/preparatory-entry/BreakerDrawingProductionTab'
import BreakerDrawingStoppageTab from '@/components/modules/preparatory-entry/BreakerDrawingStoppageTab'
import BreakerDrawingMachineSetupTab from '@/components/modules/preparatory-entry/BreakerDrawingMachineSetupTab'

import {
  getBreakerDrawingProductionByDateShiftAction,
  getOrCreateBreakerDrawingHeaderAction,
  updateBreakerDrawingHeaderAction,
  getSupervisorsAction,
  initializeBreakerDrawingDetailsAction,
  copyBreakerDrawingFromPreviousDateAction,
  getBreakerDrawingAvailableDatesAction,
  getBreakerDrawingShiftConfigAction
} from '@/app/actions/breaker-drawing-entry'

function BreakerDrawingEntryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const paramDate = searchParams.get('date')
  const paramShift = searchParams.get('shift')

  const [date, setDate] = useState(() => {
    if (paramDate) return new Date(paramDate + 'T00:00:00')
    return new Date()
  })
  const [shift, setShift] = useState(paramShift || '1')
  const [supervisorId, setSupervisorId] = useState('')
  const [maisitryId, setMaisitryId] = useState('')
  const [supervisors, setSupervisors] = useState([])
  const [headerId, setHeaderId] = useState(null)
  const [headerData, setHeaderData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [shiftTime, setShiftTime] = useState(resolveBreakerDrawingShiftFallbackTime(shift)) // Dynamic shift time from database
  // Copy Previous Data states
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [availableDates, setAvailableDates] = useState([])
  const [selectedSourceDate, setSelectedSourceDate] = useState(null)
  const [isLoadingDates, setIsLoadingDates] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [activeTab, setActiveTab] = useState('production')
  const [refreshKey, setRefreshKey] = useState(0) // Key to force tab refresh
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [sharedDrafts, setSharedDrafts] = useState({ production: {}, stoppage: {}, setup: {} })
  const productionTabRef = useRef(null)
  const stoppageTabRef = useRef(null)
  const setupTabRef = useRef(null)

  const updateTabDrafts = useCallback((tabKey, nextDraftOrUpdater) => {
    setSharedDrafts(prev => {
      const currentTabDrafts = prev?.[tabKey] || {}
      const nextTabDrafts = typeof nextDraftOrUpdater === 'function'
        ? nextDraftOrUpdater(currentTabDrafts)
        : (nextDraftOrUpdater || {})
      if (nextTabDrafts === currentTabDrafts) {
        return prev
      }
      return {
        ...prev,
        [tabKey]: nextTabDrafts
      }
    })
  }, [])

  const clearAllDrafts = useCallback(() => {
    setSharedDrafts({ production: {}, stoppage: {}, setup: {} })
  }, [])

  const handleProductionDraftsChange = useCallback((nextDrafts) => {
    updateTabDrafts('production', nextDrafts)
  }, [updateTabDrafts])

  const handleStoppageDraftsChange = useCallback((nextDrafts) => {
    updateTabDrafts('stoppage', nextDrafts)
  }, [updateTabDrafts])

  const handleSetupDraftsChange = useCallback((nextDrafts) => {
    updateTabDrafts('setup', nextDrafts)
  }, [updateTabDrafts])

  const getUnsavedEditCount = useCallback(() => {
    const sharedCount =
      Object.keys(sharedDrafts.production || {}).length +
      Object.keys(sharedDrafts.stoppage || {}).length +
      Object.keys(sharedDrafts.setup || {}).length

    if (sharedCount > 0) return sharedCount

    const refs = [productionTabRef.current, stoppageTabRef.current, setupTabRef.current]
    return refs.reduce((sum, tab) => sum + (tab?.getEditedCount?.() || 0), 0)
  }, [sharedDrafts])

  // Load supervisors
  useEffect(() => {
    const loadSupervisors = async () => {
      try {
        const result = await getSupervisorsAction()
        setSupervisors(result?.data || [])
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
        const result = await getBreakerDrawingShiftConfigAction(parseInt(shift))
        if (result.success && result.data) {
          setShiftTime(result.data.shiftTime || resolveBreakerDrawingShiftFallbackTime(shift))
        } else {
          // Use defaults if database fetch fails
          setShiftTime(resolveBreakerDrawingShiftFallbackTime(shift))
        }
      } catch (error) {
        console.error('Error loading shift time:', error)
        setShiftTime(resolveBreakerDrawingShiftFallbackTime(shift))
      }
    }
    loadShiftTime()
  }, [shift])

  // Load or create production header when date/shift changes
  const loadProductionHeader = useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getBreakerDrawingProductionByDateShiftAction(dateStr, parseInt(shift))
      const existing = result?.data
      
      if (existing) {
        setHeaderId(existing.id)
        setHeaderData(existing)
        setSupervisorId(existing.supervisor_id || '')
        setMaisitryId(existing.maisitry_id || '')
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
      const result = await getOrCreateBreakerDrawingHeaderAction(
        dateStr,
        parseInt(shift),
        supervisorId || null,
        maisitryId || null
      )
      
      if (!result?.success || !result?.data) {
        throw new Error(result?.error || 'Failed to create production header')
      }
      
      const header = result.data
      
      // Initialize details for all machines with shift parameter
      await initializeBreakerDrawingDetailsAction(header.id, parseInt(shift))
      
      setHeaderId(header.id)
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
      const result = await getBreakerDrawingAvailableDatesAction(dateStr, parseInt(shift))
      const dates = result?.data || []
      setAvailableDates(dates)
      // Pre-select the most recent date if available
      if (dates.length > 0) {
        // Convert Date to ISO string for select value
        const dateValue = dates[0].entry_date instanceof Date 
          ? dates[0].entry_date.toISOString().split('T')[0]
          : dates[0].entry_date
        setSelectedSourceDate(dateValue)
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
      const response = await copyBreakerDrawingFromPreviousDateAction(
        dateStr, 
        parseInt(shift), 
        headerId, 
        selectedSourceDate
      )
      
      if (!response?.success || !response?.data) {
        throw new Error(response?.error || 'Failed to copy data')
      }
      
      const result = response.data
      
      toast.success(`Copied data from ${result.copiedFrom} - ${result.machinesUpdated} machines updated`)
      setCopyDialogOpen(false)
      
      // Refresh data
      loadProductionHeader()
      setRefreshKey(prev => prev + 1)
      
    } catch (error) {
      console.error('Error copying previous data:', error)
      toast.error(error.message || 'Failed to copy data')
    } finally {
      setIsCopying(false)
    }
  }

  // Update supervisor
  const handleSupervisorChange = async (value) => {
    setSupervisorId(value)
    
    if (headerId) {
      try {
        await updateBreakerDrawingHeaderAction(headerId, { supervisor_id: value || null })
      } catch (error) {
        console.error('Error updating supervisor:', error)
      }
    }
  }

  // Update maisitry
  const handleMaisitryChange = async (value) => {
    setMaisitryId(value)
    
    if (headerId) {
      try {
        await updateBreakerDrawingHeaderAction(headerId, { maisitry_id: value || null })
      } catch (error) {
        console.error('Error updating maisitry:', error)
      }
    }
  }

  // Refresh data
  const handleRefresh = () => {
    loadProductionHeader()
    setRefreshKey(prev => prev + 1)
  }

  const handleSaveAllTabs = async () => {
    if (!headerId || isSavingAll) return

    const refs = [productionTabRef.current, stoppageTabRef.current, setupTabRef.current]
    const totalPending = refs.reduce((sum, tab) => sum + (tab?.getEditedCount?.() || 0), 0)

    if (totalPending === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSavingAll(true)
    try {
      // Save in sequence to avoid cross-tab overwrite races.
      const prodResult = await (
        productionTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true
        }) || Promise.resolve({ success: true, saved: 0 })
      )

      const setupResult = await (
        setupTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true
        }) || Promise.resolve({ success: true, saved: 0 })
      )

      const stoppageResult = await (
        stoppageTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true
        }) || Promise.resolve({ success: true, saved: 0 })
      )

      const results = [prodResult, stoppageResult, setupResult]
      const failures = results.filter(r => !r?.success)
      const totalSaved = results.reduce((sum, r) => sum + (r?.saved || 0), 0)

      if (failures.length > 0) {
        toast.error(`Saved ${totalSaved} change(s), but ${failures.length} tab(s) failed`)
      } else {
        toast.success(`Saved ${totalSaved} change(s) across all tabs`)
      }

      handleRefresh()
    } finally {
      setIsSavingAll(false)
    }
  }

  const confirmIfUnsaved = useCallback((message) => {
    const unsaved = getUnsavedEditCount()
    if (!unsaved) return true
    return window.confirm(`${message}\n\nYou have ${unsaved} unsaved edit(s). Continue and discard in-memory edits?`)
  }, [getUnsavedEditCount])

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

    toast.success('Unsaved changes discarded')
  }

  const handleDateChange = (nextDate) => {
    if (!nextDate) return
    if (!confirmIfUnsaved('Changing date will reload entry data.')) return
    setDate(nextDate)
  }

  const handleShiftChange = (nextShift) => {
    if (!confirmIfUnsaved('Changing shift will reload entry data.')) return
    setShift(nextShift)
  }

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab)
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Breaker Drawing Machine Entry</h1>
      </div>

      {/* Control Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Back to List */}
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={() => router.push('/preparatory-entry/breaker-drawing')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
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
                      "w-[180px] justify-start text-left font-normal",
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
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Shift */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Shift</Label>
              <Select value={shift} onValueChange={handleShiftChange}>
                <SelectTrigger className="w-[80px]">
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
                <SelectTrigger className="w-[200px]">
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
                <SelectTrigger className="w-[150px]">
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

            {/* Copy Previous Data + Common Save */}
            {headerId && (
              <div className="ml-auto flex flex-col items-end gap-2">
                <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={handleOpenCopyDialog}
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Previous Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Copy Previous Data</DialogTitle>
                      <DialogDescription>
                        Select a previous date to copy production data from.
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
                          No previous data found for Shift {shift}
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
                                const dateValue = item.entry_date instanceof Date 
                                  ? item.entry_date.toISOString().split('T')[0]
                                  : item.entry_date
                                const dateObj = item.entry_date instanceof Date 
                                  ? item.entry_date 
                                  : new Date(item.entry_date)
                                return (
                                  <SelectItem 
                                    key={dateValue} 
                                    value={dateValue}
                                  >
                                    {format(dateObj, 'dd-MMM-yyyy')} (Shift {item.shift})
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
                        Copy Data
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  onClick={handleSaveAllTabs}
                  disabled={isSavingAll}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSavingAll ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save Changes
                </Button>
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
                <BreakerDrawingProductionTab 
                  ref={productionTabRef}
                  key={`prod-${refreshKey}`}
                  headerId={headerId} 
                  totalTime={shiftTime}
                  shift={parseInt(shift)}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.production}
                  onSharedDraftEditsChange={handleProductionDraftsChange}
                  setupDraftEdits={sharedDrafts.setup}
                  stoppageDraftEdits={sharedDrafts.stoppage}
                />
              </TabsContent>

              <TabsContent value="stoppage" className="m-0 data-[state=inactive]:hidden" forceMount>
                <BreakerDrawingStoppageTab 
                  ref={stoppageTabRef}
                  key={`stop-${refreshKey}`}
                  headerId={headerId}
                  totalTime={shiftTime}
                  shift={parseInt(shift)}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.stoppage}
                  onSharedDraftEditsChange={handleStoppageDraftsChange}
                  setupDraftEdits={sharedDrafts.setup}
                  productionDraftEdits={sharedDrafts.production}
                />
              </TabsContent>

              <TabsContent value="setup" className="m-0 data-[state=inactive]:hidden" forceMount>
                <BreakerDrawingMachineSetupTab 
                  ref={setupTabRef}
                  key={`setup-${refreshKey}`} 
                  headerId={headerId}
                  shift={parseInt(shift)}
                  totalTime={shiftTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.setup}
                  onSharedDraftEditsChange={handleSetupDraftsChange}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-4">No production entry found for this date and shift.</p>
            <p className="text-sm mb-6">Click "Initialize Entry" to create a new production entry for all Breaker Drawing machines (BD1-BD4).</p>
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
                  <Save className="h-4 w-4 mr-1" />
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

export default function BreakerDrawingEntryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="ml-2">Loading...</span>
      </div>
    }>
      <BreakerDrawingEntryContent />
    </Suspense>
  )
}
