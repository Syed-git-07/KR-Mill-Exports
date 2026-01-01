'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Loader2, RefreshCw, Save, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"

import ComberProductionTab from '@/components/modules/preparatory-entry/ComberProductionTab'
import ComberStoppageTab from '@/components/modules/preparatory-entry/ComberStoppageTab'
import ComberMachineSetupTab from '@/components/modules/preparatory-entry/ComberMachineSetupTab'

import {
  getComberProductionByDateShift,
  getOrCreateComberProductionHeader,
  updateComberProductionHeader,
  getSupervisors,
  initializeComberProductionDetails,
  copyComberFromPreviousDate,
  getComberAvailablePreviousDates
} from '@/lib/supabase/comberEntryQueries'

export default function ComberEntryPage() {
  const [date, setDate] = useState(new Date())
  const [shift, setShift] = useState('1')
  const [supervisorId, setSupervisorId] = useState('')
  const [maisitryId, setMaisitryId] = useState('')
  const [supervisors, setSupervisors] = useState([])
  const [headerId, setHeaderId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [activeTab, setActiveTab] = useState('production')
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
        const data = await getSupervisors()
        setSupervisors(data || [])
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
      const existing = await getComberProductionByDateShift(dateStr, parseInt(shift))
      
      if (existing) {
        setHeaderId(existing.id)
        setSupervisorId(existing.supervisor_id || '')
        setMaisitryId(existing.maisitry_id || '')
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
      const header = await getOrCreateComberProductionHeader(
        dateStr,
        parseInt(shift),
        supervisorId || null,
        maisitryId || null
      )
      
      // Initialize details for all machines
      await initializeComberProductionDetails(header.id)
      
      setHeaderId(header.id)
      toast.success('Production entry initialized successfully')
      
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
        await updateComberProductionHeader(headerId, { supervisor_id: value || null })
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
        await updateComberProductionHeader(headerId, { maisitry_id: value || null })
      } catch (error) {
        console.error('Error updating maisitry:', error)
      }
    }
  }

  // Refresh data
  const handleRefresh = () => {
    loadProductionHeader()
  }

  // Load available previous dates for copy
  const loadAvailableDates = async () => {
    if (!headerId) return
    
    setIsLoadingDates(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dates = await getComberAvailablePreviousDates(dateStr, parseInt(shift))
      setAvailableDates(dates)
      // Pre-select the most recent date if available
      if (dates.length > 0) {
        setSelectedSourceDate(dates[0].entry_date)
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
      const result = await copyComberFromPreviousDate(
        dateStr, 
        parseInt(shift), 
        headerId, 
        selectedSourceDate
      )
      
      toast.success(`Copied data from ${result.copiedFrom} - ${result.machinesUpdated} machines updated`)
      setCopyDialogOpen(false)
      
      // Refresh data
      loadProductionHeader()
      
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
        <h1 className="text-2xl font-bold text-blue-700">Comber Entry</h1>
        <span className="text-sm text-gray-500">Preparatory Entry</span>
      </div>

      {/* Control Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-6 flex-wrap">
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
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Shift */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Shift</Label>
              <Select value={shift} onValueChange={setShift}>
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

            {/* Copy Previous Data Button with Dialog */}
            {headerId && (
              <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleOpenCopyDialog}
                    variant="outline"
                    className="ml-auto border-orange-500 text-orange-600 hover:bg-orange-50"
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
                            {availableDates.map((item) => (
                              <SelectItem 
                                key={item.entry_date} 
                                value={item.entry_date}
                              >
                                {format(new Date(item.entry_date + 'T00:00:00'), 'dd-MMM-yyyy')} (Shift {item.shift})
                              </SelectItem>
                            ))}
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
              <TabsContent value="production" className="m-0">
                <ComberProductionTab 
                  headerId={headerId} 
                  totalTime={510}
                  onRefresh={handleRefresh}
                />
              </TabsContent>

              <TabsContent value="stoppage" className="m-0">
                <ComberStoppageTab 
                  headerId={headerId}
                  totalTime={510}
                  onRefresh={handleRefresh}
                />
              </TabsContent>

              <TabsContent value="setup" className="m-0">
                <ComberMachineSetupTab onRefresh={handleRefresh} />
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
                <Button variant="default">
                  <Save className="h-4 w-4 mr-1" />
                  Update
                </Button>
                <Button variant="destructive">
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date List Panel (Bottom Left) */}
      <Card className="w-48 absolute bottom-20 left-6">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs">Recent Entries</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>{format(date, 'dd-MMM-yy')}</span>
              <span>{shift}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
