'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { searchEmployeesAction } from '@/app/actions/employee'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

/**
 * Employee Autocomplete Component
 * Provides typeahead/autocomplete functionality for employee selection.
 * Clicking an option or pressing Enter on the highlighted option selects its
 * payroll ID. Typed text alone is never treated as an employee identity.
 */
export default function EmployeeAutocomplete({ 
  value = '', 
  employeeId = null,
  onChange, 
  placeholder = "Type employee name...",
  className = "",
  cleanCell = false,
  editingHighlight = false,
  disabled = false,
  'data-row': dataRow,
  'data-col': dataCol
}) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState(value)
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceTimer = useRef(null)
  const requestSeqRef = useRef(0)
  const highlightedRef = useRef(null)

  // Update searchTerm when value prop changes (external sync)
  useEffect(() => {
    setSearchTerm(value)
  }, [value])

  // Scroll highlighted item into view
  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  // Load employees based on search term
  const loadEmployees = async (term) => {
    const requestSeq = ++requestSeqRef.current
    setIsLoading(true)
    try {
      const result = await searchEmployeesAction(term, 15)
      if (requestSeq === requestSeqRef.current && result.success) {
        setEmployees(result.data || [])
      }
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setIsLoading(false)
      }
    }
  }

  // Auto-highlight first result whenever employee list updates
  useEffect(() => {
    if (employees.length > 0) {
      setHighlightedIndex(0)
    }
  }, [employees])

  // Debounced search — fires whenever searchTerm or popup open changes
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (open && searchTerm.trim().length > 0) {
      debounceTimer.current = setTimeout(() => loadEmployees(searchTerm), 200)
    } else if (!searchTerm.trim()) {
      setEmployees([])
      setIsLoading(false)
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [searchTerm, open])

  const applySelection = (employee) => {
    if (!employee) return
    const finalName = employee.emp_name || ''
    setSearchTerm(finalName)
    onChange(finalName, employee)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  // Confirm the currently highlighted employee
  const confirmHighlighted = () => {
    if (highlightedIndex >= 0 && highlightedIndex < employees.length) {
      applySelection(employees[highlightedIndex])
    }
  }

  // Handle keyboard navigation inside popup search input
  const handleModalKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => Math.min(prev + 1, employees.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        confirmHighlighted()
        break
      case 'Escape':
        setOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  return (
    <div className="relative h-full" data-row={dataRow} data-col={dataCol} data-autocomplete="employee">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => {
                const nextValue = e.target.value
                setSearchTerm(nextValue)
                onChange(nextValue, null)
                setHighlightedIndex(-1)
                setOpen(nextValue.trim().length > 0)
              }}
              onKeyDown={handleModalKeyDown}
              onClick={() => {
                if (!disabled && searchTerm.trim()) setOpen(true)
              }}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "h-full",
                employeeId != null && "pr-20",
                cleanCell && "rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                editingHighlight && "focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100",
                className
              )}
              autoComplete="off"
            />
            {employeeId != null && (
              <span
                className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600"
                aria-label={`Payroll employee ID ${employeeId}`}
              >
                ID {employeeId}
              </span>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={2}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[95vw] p-0 overflow-hidden"
        >
          <div className="max-h-80 overflow-y-auto">
          {isLoading && employees.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
              <span>Updating results...</span>
            </div>
          )}

          {isLoading && employees.length === 0 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading...</span>
            </div>
          )}

          {!isLoading && employees.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">No employees found</p>
              <p className="text-xs text-gray-400 mt-1">A payroll employee must be selected</p>
            </div>
          )}

          {employees.length > 0 && (
            <div className="py-1">
              {employees.map((emp, index) => (
                <div
                  key={emp.id}
                  ref={highlightedIndex === index ? highlightedRef : null}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySelection(emp)}
                  className={cn(
                    "px-3 py-2 cursor-pointer flex items-start select-none",
                    highlightedIndex === index
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-100 text-gray-900"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 mt-0.5 shrink-0",
                      employeeId != null && String(employeeId) === String(emp.payroll_employee_id)
                        ? highlightedIndex === index ? "opacity-100 text-white" : "opacity-100 text-blue-600"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3 min-w-0">
                      <span className="font-medium text-sm truncate">{emp.emp_name}</span>
                      <span className={cn("text-sm font-bold tabular-nums", highlightedIndex === index ? "text-white" : "text-slate-700")}>
                        {emp.emp_code || ''}
                      </span>
                    </div>
                    {emp.department && (
                      <div className={cn("text-xs truncate", highlightedIndex === index ? "text-blue-100" : "text-gray-500")}>
                        {emp.department}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

            <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50">
              Search first, middle, last name, or token; then select a payroll employee.
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
