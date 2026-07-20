'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CalendarIcon, Copy, Loader2, Save, RefreshCw, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import Calendar from '@/components/common/HolidayAwareCalendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  getSimplexAvailableDatesAction,
  copySimplexFromPreviousDateAction,
  getSimplexShiftConfigAction
} from '@/app/actions/simplexEntryActions'

import SimplexProductionTab from '@/components/modules/preparatory-entry/SimplexProductionTab'
import SimplexStoppageTab from '@/components/modules/preparatory-entry/SimplexStoppageTab'
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
    production: {},
    stoppage: {},
    setup: {}
  })

  const productionTabRef = useRef(null)
  const stoppageTabRef = useRef(null)
  const setupTabRef = useRef(null)

  // Copy Previous Data states
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [availableDates, setAvailableDates] = useState([])
  const [selectedSourceDate, setSelectedSourceDate] = useState(null)
  const [isLoadingDates, setIsLoadingDates] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

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

  const clearSharedDrafts = useCallback(() => {
    setSharedDrafts({ production: {}, stoppage: {}, setup: {} })
  }, [])

  const setProductionDraftEdits = useCallback((updates) => {
    setSharedDrafts(prev => ({ ...prev, production: updates || {} }))
  }, [])

  const setStoppageDraftEdits = useCallback((updates) => {
    setSharedDrafts(prev => ({ ...prev, stoppage: updates || {} }))
  }, [])

  const setSetupDraftEdits = useCallback((updates) => {
    setSharedDrafts(prev => ({ ...prev, setup: updates || {} }))
  }, [])

  const editedCounts = {
    production: Object.keys(sharedDrafts.production || {}).length,
    stoppage: Object.keys(sharedDrafts.stoppage || {}).length,
    setup: Object.keys(sharedDrafts.setup || {}).length
  }
  const totalEditedCount = editedCounts.production + editedCounts.stoppage + editedCounts.setup

  const confirmUnsavedDiscard = useCallback((actionLabel) => {
    if (totalEditedCount === 0) return true
    return window.confirm(
      `You have ${totalEditedCount} unsaved row change(s). ${actionLabel} will discard them. Continue?`
    )
  }, [totalEditedCount])

  const discardAllTabChanges = useCallback(async () => {
    await Promise.all([
      productionTabRef.current?.discardChanges?.() || Promise.resolve(),
      stoppageTabRef.current?.discardChanges?.() || Promise.resolve(),
      setupTabRef.current?.discardChanges?.() || Promise.resolve()
    ])
    clearSharedDrafts()
  }, [clearSharedDrafts])

  const handleBackToList = useCallback(async () => {
    if (totalEditedCount > 0 && !confirmUnsavedDiscard('Going back to list')) return
    if (totalEditedCount > 0) await discardAllTabChanges()
    router.push('/preparatory-entry/simplex')
  }, [router, totalEditedCount, confirmUnsavedDiscard, discardAllTabChanges])

  const handleDateChange = useCallback(async (newDate) => {
    if (!newDate) return
    if (newDate.toDateString() === date.toDateString()) return
    if (!confirmUnsavedDiscard('Changing date')) return
    if (totalEditedCount > 0) await discardAllTabChanges()
    setDate(newDate)
  }, [date, totalEditedCount, confirmUnsavedDiscard, discardAllTabChanges])

  const handleShiftChange = useCallback(async (newShift) => {
    if (newShift === shift) return
    if (!confirmUnsavedDiscard('Changing shift')) return
    if (totalEditedCount > 0) await discardAllTabChanges()
    setShift(newShift)
  }, [shift, totalEditedCount, confirmUnsavedDiscard, discardAllTabChanges])

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
      await initializeSimplexProductionDetailsAction(header.id)
      
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
  const handleSupervisorChange = async (value) => {
    setSupervisorId(value)
    
    if (headerId) {
      try {
        await updateSimplexProductionHeaderAction(headerId, { supervisor_id: value || null })
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
        await updateSimplexProductionHeaderAction(headerId, { maisitry_id: value || null })
      } catch (error) {
        console.error('Error updating maisitry:', error)
      }
    }
  }

  // Refresh data
  const handleRefresh = useCallback(async () => {
    if (!confirmUnsavedDiscard('Refreshing')) return
    if (totalEditedCount > 0) await discardAllTabChanges()

    await loadProductionHeader()
    await Promise.all([
      productionTabRef.current?.refreshData?.() || Promise.resolve(),
      stoppageTabRef.current?.refreshData?.() || Promise.resolve(),
      setupTabRef.current?.refreshData?.() || Promise.resolve()
    ])
    loadMachineSetups()
  }, [confirmUnsavedDiscard, totalEditedCount, discardAllTabChanges, loadProductionHeader])

  const handleSaveAllChanges = useCallback(async () => {
    if (totalEditedCount === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSavingAll(true)
    try {
      const tabSaves = [
        { key: 'Production', count: editedCounts.production, ref: productionTabRef.current },
        { key: 'Stoppage', count: editedCounts.stoppage, ref: stoppageTabRef.current },
        { key: 'Machine Setup', count: editedCounts.setup, ref: setupTabRef.current }
      ].filter(tab => tab.count > 0)

      let totalSaved = 0
      const failures = []

      for (const tab of tabSaves) {
        const result = await tab.ref?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true
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
        toast.error(`Failed to save: ${failures.join(', ')}`)
      }

      await Promise.all([
        productionTabRef.current?.refreshData?.() || Promise.resolve(),
        stoppageTabRef.current?.refreshData?.() || Promise.resolve(),
        setupTabRef.current?.refreshData?.() || Promise.resolve()
      ])
    } catch (error) {
      console.error('Error saving all changes:', error)
      toast.error('Failed to save all changes')
    } finally {
      setIsSavingAll(false)
    }
  }, [totalEditedCount, editedCounts])

  const handleCancelAllChanges = useCallback(async () => {
    if (totalEditedCount === 0) {
      toast.info('No unsaved changes to discard')
      return
    }
    if (!confirmUnsavedDiscard('Cancelling changes')) return

    await discardAllTabChanges()
    toast.success('Unsaved changes discarded')
  }, [totalEditedCount, confirmUnsavedDiscard, discardAllTabChanges])

  // Load available previous dates for copy
  const loadAvailableDates = async () => {
    if (!headerId) return
    
    setIsLoadingDates(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getSimplexAvailableDatesAction(dateStr, shift, 30)
      if (result.success) {
        setAvailableDates(result.data || [])
      } else {
        toast.error('Failed to load available dates')
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
    if (!confirmUnsavedDiscard('Copying previous data')) return
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
      if (totalEditedCount > 0) {
        await discardAllTabChanges()
      }
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await copySimplexFromPreviousDateAction(dateStr, shift, headerId, selectedSourceDate)
      if (result.success) {
        toast.success(`Data copied from ${selectedSourceDate}`)
        setCopyDialogOpen(false)
        setSelectedSourceDate(null)
        handleRefresh()
      } else {
        toast.error(result.error || 'Failed to copy data')
      }
    } catch (error) {
      console.error('Error copying previous data:', error)
      toast.error(error.message || 'Failed to copy data')
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Page Title */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-blue-700">Simplex Entry</h1>
        <span className="text-sm text-gray-500">Preparatory Entry</span>
      </div>

      {/* Control Bar */}
      <Card>
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
                      "w-44 justify-start text-left font-normal",
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
                <SelectTrigger className="w-52">
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
                <SelectTrigger className="w-36">
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

            {/* Copy Previous Data Button with Dialog */}
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
                                const dateStr = typeof item.entry_date === 'string' 
                                  ? item.entry_date.split('T')[0] 
                                  : format(new Date(item.entry_date), 'yyyy-MM-dd')
                                return (
                                  <SelectItem 
                                    key={dateStr} 
                                    value={dateStr}
                                  >
                                    {format(new Date(dateStr + 'T00:00:00'), 'dd-MMM-yyyy')} (Shift {item.shift})
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
                  onClick={handleSaveAllChanges}
                  disabled={isSavingAll || totalEditedCount === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSavingAll ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Update ({totalEditedCount})
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              <TabsContent value="production" forceMount className={cn('m-0', activeTab !== 'production' && 'hidden')}>
                <SimplexProductionTab 
                  ref={productionTabRef}
                  headerId={headerId}
                  totalTime={totalTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.production}
                  onSharedDraftEditsChange={setProductionDraftEdits}
                  stoppageDraftEdits={sharedDrafts.stoppage}
                  setupDraftEdits={sharedDrafts.setup}
                />
              </TabsContent>

              <TabsContent value="stoppage" forceMount className={cn('m-0', activeTab !== 'stoppage' && 'hidden')}>
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
              </TabsContent>

              <TabsContent value="setup" forceMount className={cn('m-0', activeTab !== 'setup' && 'hidden')}>
                <SimplexMachineSetupTab 
                  ref={setupTabRef}
                  totalTime={totalTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.setup}
                  onSharedDraftEditsChange={setSetupDraftEdits}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-4">No production entry found for this date and shift.</p>
            <p className="text-sm mb-6">Click "Initialize Entry" to create a new production entry for all simplex machines.</p>
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
                    <Save className="h-4 w-4 mr-1" />
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
