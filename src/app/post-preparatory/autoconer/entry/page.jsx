'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
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
import Calendar from '@/components/common/HolidayAwareCalendar'
import DeferredMount from '@/components/common/DeferredMount'
import { CalendarIcon, Loader2, RefreshCw, CheckCircle2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"
import { resolveAutoconerShiftFallbackTime } from '@/lib/autoconerShiftFallback'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { buildAutoconerCountSnapshot } from '@/lib/countMasterSnapshots'

import AutoconerProductionTab from '@/components/modules/post-preparatory/autoconer/AutoconerProductionTab'
import AutoconerStoppageTab from '@/components/modules/post-preparatory/autoconer/AutoconerStoppageTab'
import AutoconerMachineSetupTab from '@/components/modules/post-preparatory/autoconer/AutoconerMachineSetupTab'

import {
  getAutoconerProductionByDateShiftAction,
  getOrCreateAutoconerHeaderAction,
  updateAutoconerProductionHeaderAction,
  getSupervisorsAction,
  getAutoconerShiftConfigAction,
  getSpinningCountsAction
} from '@/app/actions/autoconerEntryActions'

function AutoconerEntryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paramDate = searchParams.get('date')
  const paramShift = searchParams.get('shift')
  const [date, setDate] = useState(paramDate ? new Date(paramDate + 'T00:00:00') : new Date())
  const [shift, setShift] = useState(paramShift || '1')
  const [supervisorId, setSupervisorId] = useState('')
  const [supervisors, setSupervisors] = useState([])
  const [counts, setCounts] = useState([])
  const [headerId, setHeaderId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [activeTab, setActiveTab] = useState('production')
  const [refreshKey, setRefreshKey] = useState(0) // Key to force tab refresh
  const [totalTime, setTotalTime] = useState(() => resolveAutoconerShiftFallbackTime(paramShift || '1')) // Dynamic shift time
  
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [sharedDrafts, setSharedDrafts] = useState({ header: {}, production: {}, stoppage: {}, setup: {} })
  const sharedDraftsRef = useRef(sharedDrafts)
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

  const handleProductionDraftsChange = useCallback((nextDrafts) => {
    updateTabDrafts('production', nextDrafts)
  }, [updateTabDrafts])

  const handleStoppageDraftsChange = useCallback((nextDrafts) => {
    updateTabDrafts('stoppage', nextDrafts)
  }, [updateTabDrafts])

  const handleSetupDraftsChange = useCallback((nextDrafts) => {
    updateTabDrafts('setup', nextDrafts)
  }, [updateTabDrafts])

  const handleMachineCountChange = useCallback((setupId, machineId, countId) => {
    const count = counts.find(item => String(item.id) === String(countId))
    if (!setupId || !count) return

    updateTabDrafts('setup', previous => ({
      ...previous,
      [setupId]: {
        ...(previous[setupId] || {}),
        ...(machineId ? { machine_id: machineId } : {}),
        ...buildAutoconerCountSnapshot(count)
      }
    }))
  }, [counts, updateTabDrafts])

  const getUnsavedEditCount = useCallback(() => {
    const currentDrafts = sharedDraftsRef.current
    const productionShared = Object.keys(currentDrafts.production || {}).length
    const stoppageShared = Object.keys(currentDrafts.stoppage || {}).length
    const setupShared = Object.keys(currentDrafts.setup || {}).length
    const headerShared = Object.keys(currentDrafts.header || {}).length > 0 ? 1 : 0

    const productionCount = productionShared || (productionTabRef.current?.getEditedCount?.() || 0)
    const stoppageCount = stoppageShared || (stoppageTabRef.current?.getEditedCount?.() || 0)
    const setupCount = setupShared || (setupTabRef.current?.getEditedCount?.() || 0)

    return headerShared + productionCount + stoppageCount + setupCount
  }, [sharedDrafts])

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
  }, [])

  useEffect(() => {
    const loadCounts = async () => {
      const result = await getSpinningCountsAction()
      if (result.success) setCounts(result.data || [])
    }
    loadCounts()
  }, [])

  // Load shift time when shift changes
  useEffect(() => {
    const loadShiftTime = async () => {
      const fallbackShiftTime = resolveAutoconerShiftFallbackTime(shift)
      try {
        const result = await getAutoconerShiftConfigAction(parseInt(shift))
        if (result.success && result.data) {
          setTotalTime(result.data.shiftTime || fallbackShiftTime)
        } else {
          setTotalTime(fallbackShiftTime)
        }
      } catch (error) {
        console.error('Error loading shift config:', error)
        setTotalTime(fallbackShiftTime)
      }
    }
    loadShiftTime()
  }, [shift])

  // Load or create production header when date/shift changes
  const loadProductionHeader = useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getAutoconerProductionByDateShiftAction(dateStr, parseInt(shift))
      
      if (result.success && result.data) {
        setHeaderId(result.data.id)
        setSupervisorId(result.data.supervisor_id || '')
      } else {
        setHeaderId(null)
        setSupervisorId('')
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
      
      // Create header and initialize details
      const result = await getOrCreateAutoconerHeaderAction(
        dateStr,
        parseInt(shift),
        supervisorId || null
      )
      
      if (result.success) {
        setHeaderId(result.data.id)
        toast.success('Autoconer production entry initialized successfully')
      } else {
        throw new Error(result.error)
      }
      
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
    if (headerId) updateTabDrafts('header', prev => ({ ...prev, supervisor_id: value || null }))
  }

  // Refresh data
  const handleRefresh = () => {
    loadProductionHeader()
  }

  useUnsavedChangesWarning(getUnsavedEditCount() > 0)

  const confirmIfUnsaved = useCallback((message) => {
    const unsaved = getUnsavedEditCount()
    if (!unsaved) return true
    return window.confirm(`${message}\n\nYou have ${unsaved} unsaved edit(s). Continue and discard in-memory edits?`)
  }, [getUnsavedEditCount])

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
      // Persist dependencies first so the final production save uses current setup/stoppage values.
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
      const prodResult = await (
        productionTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: draftsAtSaveStart
        }) || Promise.resolve({ success: true, saved: 0 })
      )
      const headerResult = Object.keys(draftsAtSaveStart.header || {}).length > 0
        ? await updateAutoconerProductionHeaderAction(headerId, draftsAtSaveStart.header)
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
        router.push('/post-preparatory/autoconer')
        return
      }
    } catch (error) {
      replaceAllDrafts(draftsAtSaveStart)
      console.error('Error saving Autoconer entry:', error)
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

  return (
    <div className="entry-workspace">
      {/* Page Title */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Autoconer Production Entry</h1>
        <p className="text-sm text-gray-600">Winding Machine Production Data Entry</p>
      </div>

      {/* Control Bar */}
      <Card className="entry-controls">
        <CardContent className="py-4">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Back to List */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => confirmIfUnsaved('Going back will discard unsaved edits.') && router.push('/post-preparatory/autoconer')}
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
                    tableName="autoconer_production_header"
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

            <CardContent className="entry-sheet-content">
              <TabsContent value="production" className="m-0 data-[state=inactive]:hidden" forceMount>
                <DeferredMount active={activeTab === 'production'}>
                <AutoconerProductionTab 
                  ref={productionTabRef}
                  key={`prod-${refreshKey}`}
                  headerId={headerId} 
                  totalTime={totalTime}
                  shiftNo={parseInt(shift)}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.production}
                  onSharedDraftEditsChange={handleProductionDraftsChange}
                  stoppageDraftEdits={sharedDrafts.stoppage}
                  setupDraftEdits={sharedDrafts.setup}
                  counts={counts}
                  onMachineCountChange={handleMachineCountChange}
                />
                </DeferredMount>
              </TabsContent>

              <TabsContent value="stoppage" className="m-0 data-[state=inactive]:hidden" forceMount>
                <DeferredMount active={activeTab === 'stoppage'}>
                <AutoconerStoppageTab 
                  ref={stoppageTabRef}
                  key={`stop-${refreshKey}`}
                  headerId={headerId}
                  totalTime={totalTime}
                  shiftNo={parseInt(shift)}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.stoppage}
                  onSharedDraftEditsChange={handleStoppageDraftsChange}
                  productionDraftEdits={sharedDrafts.production}
                  setupDraftEdits={sharedDrafts.setup}
                  counts={counts}
                  onMachineCountChange={handleMachineCountChange}
                />
                </DeferredMount>
              </TabsContent>

              <TabsContent value="setup" className="m-0 data-[state=inactive]:hidden" forceMount>
                <DeferredMount active={activeTab === 'setup'}>
                <AutoconerMachineSetupTab 
                  ref={setupTabRef}
                  headerId={headerId}
                  key={`setup-${refreshKey}`} 
                  shift={parseInt(shift)}
                  totalTime={totalTime}
                  onRefresh={handleRefresh}
                  entryDate={format(date, 'yyyy-MM-dd')}
                  sharedDraftEdits={sharedDrafts.setup}
                  onSharedDraftEditsChange={handleSetupDraftsChange}
                />
                </DeferredMount>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      ) : (
        <Card className="entry-empty-state p-6">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-4">No production entry found for this date and shift.</p>
            <p className="text-sm mb-6">Click &quot;Initialize Entry&quot; to create a new production entry for all autoconer machines (AC1-1 to AC14-1).</p>
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

export default function AutoconerEntryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <AutoconerEntryContent />
    </Suspense>
  )
}
