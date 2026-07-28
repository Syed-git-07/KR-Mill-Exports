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
import Calendar from '@/components/common/HolidayAwareCalendar'
import { CalendarIcon, Loader2, RefreshCw, CheckCircle2, Copy, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"
import { resolveComberShiftFallbackTime } from '@/lib/comberShiftFallback'

import ComberProductionTab from '@/components/modules/preparatory-entry/ComberProductionTab'
import ComberStoppageTab from '@/components/modules/preparatory-entry/ComberStoppageTab'
import ComberMachineSetupTab from '@/components/modules/preparatory-entry/ComberMachineSetupTab'

import {
  getComberProductionByDateShiftAction,
  getOrCreateComberProductionHeaderAction,
  updateComberProductionHeaderAction,
  getSupervisorsAction,
  initializeComberProductionDetailsAction,
  getComberShiftConfigurationAction
} from '@/app/actions/comber-entry'

function ComberEntryContent() {
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
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [activeTab, setActiveTab] = useState('production')
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [sharedDrafts, setSharedDrafts] = useState({ header: {}, production: {}, stoppage: {}, setup: {} })
  const [shiftTime, setShiftTime] = useState(resolveComberShiftFallbackTime(shift))
  const productionTabRef = useRef(null)
  const stoppageTabRef = useRef(null)
  const setupTabRef = useRef(null)

  const updateTabDrafts = useCallback((tabKey, nextDraftOrUpdater) => {
    setSharedDrafts(prev => {
      const currentTabDrafts = prev?.[tabKey] || {}
      const nextTabDrafts = typeof nextDraftOrUpdater === 'function'
        ? nextDraftOrUpdater(currentTabDrafts)
        : (nextDraftOrUpdater || {})
      return {
        ...prev,
        [tabKey]: nextTabDrafts
      }
    })
  }, [])

  const clearAllDrafts = useCallback(() => {
    setSharedDrafts({ header: {}, production: {}, stoppage: {}, setup: {} })
  }, [])

  const getUnsavedEditCount = useCallback(() => {
    const sharedCount =
      Object.keys(sharedDrafts.production || {}).length +
      Object.keys(sharedDrafts.stoppage || {}).length +
      Object.keys(sharedDrafts.setup || {}).length +
      (Object.keys(sharedDrafts.header || {}).length > 0 ? 1 : 0)

    if (sharedCount > 0) return sharedCount

    const refs = [productionTabRef.current, stoppageTabRef.current, setupTabRef.current]
    return refs.reduce((sum, tab) => sum + (tab?.getEditedCount?.() || 0), 0)
  }, [sharedDrafts])

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

  // Load or create production header when date/shift changes
  const loadProductionHeader = useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getComberProductionByDateShiftAction(dateStr, parseInt(shift))
      
      if (result.success && result.data) {
        setHeaderId(result.data.id)
        setSupervisorId(result.data.supervisor_id || '')
        setMaisitryId(result.data.maisitry_id || '')
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

  // Load shift time when shift changes
  useEffect(() => {
    const loadShiftTime = async () => {
      try {
        const result = await getComberShiftConfigurationAction(parseInt(shift))
        if (result.success && result.data) {
          setShiftTime(result.data.totalTime || resolveComberShiftFallbackTime(shift))
        } else {
          setShiftTime(resolveComberShiftFallbackTime(shift))
        }
      } catch (error) {
        console.error('Error loading shift time:', error)
        setShiftTime(resolveComberShiftFallbackTime(shift))
      }
    }
    loadShiftTime()
  }, [shift])

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
      const headerResult = await getOrCreateComberProductionHeaderAction(
        dateStr,
        parseInt(shift),
        supervisorId || null,
        maisitryId || null
      )

      if (!headerResult.success) {
        throw new Error(headerResult.error || 'Failed to create production header')
      }
      
      // Initialize details for all machines
      await initializeComberProductionDetailsAction(headerResult.data.id, parseInt(shift))
      
      setHeaderId(headerResult.data.id)
      toast.success('Production entry initialized successfully')
      
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

  // Update maisitry
  const handleMaisitryChange = (value) => {
    setMaisitryId(value)
    if (headerId) updateTabDrafts('header', prev => ({ ...prev, maisitry_id: value || null }))
  }

  // Refresh data
  const handleRefresh = () => {
    loadProductionHeader()
  }

  const handleSaveAllTabs = async () => {
    if (!headerId || isSavingAll) return

    const totalPending = getUnsavedEditCount()

    if (totalPending === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSavingAll(true)
    try {
      // Persist dependencies first so the final production save uses current setup/stoppage values.
      const setupResult = await (
        setupTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: sharedDrafts
        }) || Promise.resolve({ success: true, saved: 0 })
      )

      const stoppageResult = await (
        stoppageTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: sharedDrafts
        }) || Promise.resolve({ success: true, saved: 0 })
      )

      const prodResult = await (
        productionTabRef.current?.saveChanges?.({
          suppressNoChangesToast: true,
          suppressSuccessToast: true,
          skipParentRefresh: true,
          dependencyDrafts: sharedDrafts
        }) || Promise.resolve({ success: true, saved: 0 })
      )
      const headerResult = Object.keys(sharedDrafts.header || {}).length > 0
        ? await updateComberProductionHeaderAction(headerId, sharedDrafts.header)
        : { success: true, saved: 0 }

      const results = [prodResult, stoppageResult, setupResult, headerResult]
      const failures = results.filter(r => !r?.success)
      const totalSaved = results.reduce((sum, r) => sum + (r?.saved || 0), 0)

      if (failures.length > 0) {
        toast.error(`Saved ${totalSaved} change(s), but ${failures.length} tab(s) failed`)
      } else {
        toast.success(`Saved ${totalSaved} change(s) across all tabs`)
        clearAllDrafts()
        router.push('/preparatory-entry/comber')
        return
      }

      handleRefresh()
    } finally {
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
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-blue-700">Comber Entry</h1>
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
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={() => router.push('/preparatory-entry/comber')}
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
                    tableName="comber_production_header"
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

            {/* Comber speed is fixed, so the setup-only copy action is disabled. */}
            {headerId && activeTab === 'setup' && (
              <div className="ml-auto flex flex-col items-end gap-2">
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-600"
                  disabled
                  title="Comber speed is fixed and cannot be copied"
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
                <ComberProductionTab 
                  ref={productionTabRef}
                  headerId={headerId} 
                  totalTime={shiftTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.production}
                  onSharedDraftEditsChange={(next) => updateTabDrafts('production', next)}
                  setupDraftEdits={sharedDrafts.setup}
                  stoppageDraftEdits={sharedDrafts.stoppage}
                />
              </TabsContent>

              <TabsContent value="stoppage" className="m-0 data-[state=inactive]:hidden" forceMount>
                <ComberStoppageTab 
                  ref={stoppageTabRef}
                  headerId={headerId}
                  totalTime={shiftTime}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.stoppage}
                  onSharedDraftEditsChange={(next) => updateTabDrafts('stoppage', next)}
                  setupDraftEdits={sharedDrafts.setup}
                  productionDraftEdits={sharedDrafts.production}
                />
              </TabsContent>

              <TabsContent value="setup" className="m-0 data-[state=inactive]:hidden" forceMount>
                <ComberMachineSetupTab
                  ref={setupTabRef}
                  headerId={headerId}
                  shift={parseInt(shift)}
                  onRefresh={handleRefresh}
                  sharedDraftEdits={sharedDrafts.setup}
                  onSharedDraftEditsChange={(next) => updateTabDrafts('setup', next)}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-4">No production entry found for this date and shift.</p>
            <p className="text-sm mb-6">Click "Initialize Entry" to create a new production entry for all comber machines (CO1-CO12).</p>
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

export default function ComberEntryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="ml-2">Loading...</span>
      </div>
    }>
      <ComberEntryContent />
    </Suspense>
  )
}
