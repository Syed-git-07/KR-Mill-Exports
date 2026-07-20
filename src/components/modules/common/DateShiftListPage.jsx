'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Loader2, ChevronLeft, ChevronRight, Search, ListFilter, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getDateShiftListAction } from '@/app/actions/date-shift-list'
import { getHolidayListsAction, getHolidaysByListIdAction } from '@/app/actions/holiday-list'

const ROWS_PER_PAGE = 30 // 10 dates × 3 shifts per page

const ALL_MODULES = [
  { value: '/post-preparatory/spinning', label: 'Spinning', category: 'Post Preparatory' },
  { value: '/post-preparatory/autoconer', label: 'Autoconer', category: 'Post Preparatory' },
  { value: '/preparatory-entry/carding', label: 'Carding', category: 'Preparatory' },
  { value: '/preparatory-entry/breaker-drawing', label: 'Breaker Drawing', category: 'Preparatory' },
  { value: '/preparatory-entry/finisher-drawing', label: 'Finisher Drawing', category: 'Preparatory' },
  { value: '/preparatory-entry/simplex', label: 'Simplex', category: 'Preparatory' },
  { value: '/preparatory-entry/lap-former', label: 'Lap Former', category: 'Preparatory' },
  { value: '/preparatory-entry/comber', label: 'Comber', category: 'Preparatory' },
]

export default function DateShiftListPage({
  moduleName,          // Display name e.g. "Carding Entry"
  tableName,           // DB table e.g. "carding_production_header"
  entryPath,           // Route path e.g. "/preparatory-entry/carding/entry"
  initializeAction,    // Optional: Server action to initialize a new entry
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Date range filter
  const [fromDate, setFromDate] = useState(() => startOfMonth(new Date()))
  const [toDate, setToDate] = useState(() => endOfMonth(new Date()))

  // Add Entry Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newEntryDate, setNewEntryDate] = useState(() => new Date())
  const [newEntryShift, setNewEntryShift] = useState('1')

  // Data
  const [entries, setEntries] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [existingCount, setExistingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Search/Filter
  const [searchShift, setSearchShift] = useState('all') // 'all', '1', '2', '3'
  const [searchValue, setSearchValue] = useState('')

  // Selected row
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isCheckingHoliday, setIsCheckingHoliday] = useState(false)
  const [holidaysList, setHolidaysList] = useState([])

  const loadHolidayDates = useCallback(async () => {
    setIsCheckingHoliday(true)
    try {
      const companyId = '1' // DEFAULT_COMPANY_ID
      const listsRes = await getHolidayListsAction(companyId)
      if (listsRes.success && listsRes.data) {
        // Filter active lists
        const activeLists = listsRes.data.filter(list => list.status === 'Active')
        
        // Fetch holidays for all active lists
        const allHolidays = []
        for (const list of activeLists) {
          const holidaysRes = await getHolidaysByListIdAction(list.id)
          if (holidaysRes.success && holidaysRes.data) {
            allHolidays.push(...holidaysRes.data)
          }
        }
        
        setHolidaysList(allHolidays)
      }
    } catch (err) {
      console.error('Failed to load holiday dates from Holiday List Management page:', err)
    } finally {
      setIsCheckingHoliday(false)
    }
  }, [])

  useEffect(() => {
    if (isAddDialogOpen && (moduleName === 'Spinning' || moduleName === 'Autoconer')) {
      loadHolidayDates()
    }
  }, [isAddDialogOpen, moduleName, loadHolidayDates])

  const isDateAHoliday = useCallback((date) => {
    if (moduleName !== 'Spinning' && moduleName !== 'Autoconer') return false
    if (!date) return false
    const dateStr = format(date, 'yyyy-MM-dd')
    return holidaysList.some(h => {
      const hdStr = h.date ? String(h.date).split('T')[0] : ''
      return dateStr === hdStr
    })
  }, [moduleName, holidaysList])

  // Fetch data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const fromStr = format(fromDate, 'yyyy-MM-dd')
      const toStr = format(toDate, 'yyyy-MM-dd')

      const result = await getDateShiftListAction(tableName, fromStr, toStr)
      if (result.success) {
        setEntries(result.data.entries || [])
        setTotalCount(result.data.totalCount || 0)
        setExistingCount(result.data.existingCount || 0)
      } else {
        console.error('Error loading date/shift list:', result.error)
        setEntries([])
      }
    } catch (error) {
      console.error('Error loading date/shift list:', error)
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [tableName, fromDate, toDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // After data loads, jump to the page containing today's date
  useEffect(() => {
    if (entries.length === 0) return

    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Apply the same filters to find today's index in filtered list
    let filtered = entries
    if (searchShift !== 'all') {
      filtered = filtered.filter(e => String(e.shift) === searchShift)
    }
    if (searchValue.trim()) {
      const search = searchValue.trim().toLowerCase()
      filtered = filtered.filter(e => {
        const formatted = format(new Date(e.entry_date + 'T00:00:00'), 'dd-MMM-yy').toLowerCase()
        return formatted.includes(search) || e.entry_date.includes(search)
      })
    }

    // Find the first entry matching today's date
    const todayIndex = filtered.findIndex(e => e.entry_date === todayStr)
    if (todayIndex >= 0) {
      const page = Math.floor(todayIndex / ROWS_PER_PAGE) + 1
      setCurrentPage(page)
      // Select the row of today (shift 1) within that page
      setSelectedIndex(todayIndex % ROWS_PER_PAGE)
    } else {
      setCurrentPage(1)
      setSelectedIndex(-1)
    }
  }, [entries]) // Only on data load, not on filter changes

  // Reset page when filters change (but not on initial load — handled above)
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  useEffect(() => {
    if (!filtersInitialized) {
      setFiltersInitialized(true)
      return
    }
    setCurrentPage(1)
    setSelectedIndex(-1)
  }, [searchShift, searchValue])

  // When date range changes, data reloads via loadData, so the entries effect handles page jump

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let filtered = entries

    // Filter by shift
    if (searchShift !== 'all') {
      filtered = filtered.filter(e => String(e.shift) === searchShift)
    }

    // Filter by search value (date text)
    if (searchValue.trim()) {
      const search = searchValue.trim().toLowerCase()
      filtered = filtered.filter(e => {
        const formatted = format(new Date(e.entry_date + 'T00:00:00'), 'dd-MMM-yy').toLowerCase()
        return formatted.includes(search) || e.entry_date.includes(search)
      })
    }

    return filtered
  }, [entries, searchShift, searchValue])

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / ROWS_PER_PAGE)
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return filteredEntries.slice(start, start + ROWS_PER_PAGE)
  }, [filteredEntries, currentPage])

  // Navigation handlers
  const handleRowClick = (entry, index) => {
    setSelectedIndex(index)
  }

  const handleRowDoubleClick = (entry) => {
    navigateToEntry(entry)
  }

  const navigateToEntry = (entry) => {
    const params = new URLSearchParams({
      date: entry.entry_date,
      shift: String(entry.shift),
    })
    router.push(`${entryPath}?${params.toString()}`)
  }

  // Handle Enter key on selected row
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < paginatedEntries.length) {
      navigateToEntry(paginatedEntries[selectedIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, paginatedEntries.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    }
  }, [selectedIndex, paginatedEntries, entryPath])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Quick date range presets
  const setThisMonth = () => {
    setFromDate(startOfMonth(new Date()))
    setToDate(endOfMonth(new Date()))
  }

  const setPrevMonth = () => {
    const prev = subMonths(new Date(), 1)
    setFromDate(startOfMonth(prev))
    setToDate(endOfMonth(prev))
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="py-3 px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-blue-700 whitespace-nowrap">
              {moduleName} - Date & Shift List
            </CardTitle>
            
            <div className="flex flex-wrap items-center gap-4 md:ml-auto">
              {/* Module Switcher Dropdown */}
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Module:</Label>
                <Select 
                  value={ALL_MODULES.find(m => pathname?.startsWith(m.value))?.value || ''} 
                  onValueChange={(val) => router.push(val)}
                >
                  <SelectTrigger className="w-[180px] h-9 text-sm">
                    <SelectValue placeholder="Select Module..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled className="text-xs font-bold text-gray-400">Post Preparatory</SelectItem>
                    {ALL_MODULES.filter(m => m.category === 'Post Preparatory').map(m => (
                      <SelectItem key={m.value} value={m.value} className="pl-4">{m.label}</SelectItem>
                    ))}
                    <SelectItem disabled className="text-xs font-bold text-gray-400 mt-2">Preparatory</SelectItem>
                    {ALL_MODULES.filter(m => m.category === 'Preparatory').map(m => (
                      <SelectItem key={m.value} value={m.value} className="pl-4">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-sm h-9 px-4"
                  disabled={selectedIndex < 0}
                  onClick={() => {
                    if (selectedIndex >= 0 && selectedIndex < paginatedEntries.length) {
                      navigateToEntry(paginatedEntries[selectedIndex])
                    }
                  }}
                >
                  Open Entry
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-sm h-9 px-4 flex items-center gap-1"
                  onClick={() => {
                    setNewEntryDate(new Date())
                    setNewEntryShift('1')
                    setIsAddDialogOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add Data
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex gap-4">
        {/* Main Table */}
        <div className="flex-1">
          <Card>
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="bg-blue-600 text-white">
                <div className="grid grid-cols-[2fr_1fr_1fr] px-4 py-2.5 text-sm font-semibold">
                  <div>Date</div>
                  <div className="text-center">Shift</div>
                  <div className="text-center">Status</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500">Loading entries...</span>
                  </div>
                ) : paginatedEntries.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 flex flex-col items-center justify-center space-y-4">
                    <CalendarIcon className="h-12 w-12 text-gray-300" />
                    <div>
                      <p className="text-base font-semibold text-gray-700">No production entries found</p>
                      <p className="text-xs text-gray-400">There are no initialized entries for this date range.</p>
                    </div>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-xs h-8"
                      onClick={() => setIsAddDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Initialize New Entry
                    </Button>
                  </div>
                ) : (
                  paginatedEntries.map((entry, idx) => {
                    const isSelected = idx === selectedIndex
                    const isFirstOfDate = idx === 0 || entry.entry_date !== paginatedEntries[idx - 1]?.entry_date

                    return (
                      <div
                        key={`${entry.entry_date}-${entry.shift}`}
                        className={cn(
                          'grid grid-cols-[2fr_1fr_1fr] px-4 py-2 text-sm cursor-pointer border-b border-gray-100 transition-colors',
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : entry.hasData
                              ? 'bg-orange-50 hover:bg-blue-100'
                              : 'hover:bg-gray-50',
                          isFirstOfDate && idx > 0 && 'border-t border-gray-200'
                        )}
                        onClick={() => handleRowClick(entry, idx)}
                        onDoubleClick={() => handleRowDoubleClick(entry)}
                      >
                        <div className={cn(
                          'font-medium',
                          isSelected ? 'text-white' : 'text-gray-800'
                        )}>
                          {format(new Date(entry.entry_date + 'T00:00:00'), 'dd-MMM-yy')}
                        </div>
                        <div className={cn(
                          'text-center font-semibold',
                          isSelected
                            ? 'text-white'
                            : entry.shift === 1
                              ? 'text-blue-700'
                              : entry.shift === 2
                                ? 'text-green-700'
                                : 'text-orange-700'
                        )}>
                          {entry.shift}
                        </div>
                        <div className="text-center">
                          {entry.hasData ? (
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-green-100 text-green-700'
                            )}>
                              ● Data
                            </span>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-100 text-gray-400'
                            )}>
                              ○ Empty
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t bg-gray-50">
                  <div className="text-xs text-gray-500">
                    Page {currentPage} of {totalPages} ({filteredEntries.length} rows)
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={currentPage <= 1}
                      onClick={() => { setCurrentPage(1); setSelectedIndex(-1) }}
                    >
                      ««
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={currentPage <= 1}
                      onClick={() => { setCurrentPage(p => p - 1); setSelectedIndex(-1) }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === currentPage ? 'default' : 'outline'}
                          size="sm"
                          className={cn('h-7 min-w-[28px] p-0 text-xs', pageNum === currentPage && 'bg-blue-600')}
                          onClick={() => { setCurrentPage(pageNum); setSelectedIndex(-1) }}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={currentPage >= totalPages}
                      onClick={() => { setCurrentPage(p => p + 1); setSelectedIndex(-1) }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={currentPage >= totalPages}
                      onClick={() => { setCurrentPage(totalPages); setSelectedIndex(-1) }}
                    >
                      »»
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Filters */}
        <div className="w-64 space-y-4">
          {/* Date Filter */}
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700">Date Filter</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left text-sm h-9">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(fromDate, 'dd-MMM-yy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={(d) => d && setFromDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-500">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left text-sm h-9">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(toDate, 'dd-MMM-yy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={(d) => d && setToDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={setPrevMonth}>
                  Prev Month
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={setThisMonth}>
                  This Month
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search Filter */}
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700">Search</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Search Field: Shift</Label>
                <Select value={searchShift} onValueChange={setSearchShift}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    <SelectItem value="1">Shift 1</SelectItem>
                    <SelectItem value="2">Shift 2</SelectItem>
                    <SelectItem value="3">Shift 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Value</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="Search date..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>

              <div className="flex gap-1">
                <Button size="sm" className="flex-1 text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={loadData}>
                  <Search className="h-3.5 w-3.5 mr-1" />
                  Search
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => {
                    setSearchShift('all')
                    setSearchValue('')
                  }}
                >
                  <ListFilter className="h-3.5 w-3.5 mr-1" />
                  Show All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Hint text */}
          <div className="px-1 text-center">
            <p className="text-[10px] text-gray-400">
              Double-click a row or select & click Open in the top section
            </p>
          </div>
        </div>
      </div>

      {/* Add Data Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Production Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newEntryDate ? format(newEntryDate, "dd-MMM-yyyy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newEntryDate}
                    onSelect={(d) => d && setNewEntryDate(d)}
                    disabled={isDateAHoliday}
                    classNames={{
                      disabled: "text-red-500 bg-red-50 line-through cursor-not-allowed opacity-75 font-semibold hover:bg-red-50 hover:text-red-500"
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Select Shift</Label>
              <Select value={newEntryShift} onValueChange={setNewEntryShift}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Shift 1</SelectItem>
                  <SelectItem value="2">Shift 2</SelectItem>
                  <SelectItem value="3">Shift 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isCheckingHoliday}
              onClick={() => {
                const formattedDate = format(newEntryDate, 'yyyy-MM-dd')
                const exists = entries.some(e => e.entry_date === formattedDate && String(e.shift) === String(newEntryShift))
                
                if (exists) {
                  toast.warning(`Entry for ${format(newEntryDate, 'dd-MMM-yyyy')} Shift ${newEntryShift} already exists. Opening it.`)
                  navigateToEntry({ entry_date: formattedDate, shift: parseInt(newEntryShift) })
                  setIsAddDialogOpen(false)
                } else {
                  if (moduleName === 'Spinning' || moduleName === 'Autoconer') {
                    const matchingHoliday = holidaysList.find(h => {
                      const hdStr = h.date ? String(h.date).split('T')[0] : ''
                      return formattedDate === hdStr
                    })
                    if (matchingHoliday) {
                      toast.error(`Cannot add entry. ${format(newEntryDate, 'dd-MMM-yyyy')} is a holiday: ${matchingHoliday.description || 'Holiday'}`)
                      return
                    }
                  }

                  navigateToEntry({ entry_date: formattedDate, shift: parseInt(newEntryShift) })
                  setIsAddDialogOpen(false)
                }
              }}
            >
              {isCheckingHoliday ? 'Loading...' : 'Enter Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
