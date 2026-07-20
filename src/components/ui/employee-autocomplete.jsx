'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { searchEmployeesAction } from '@/app/actions/employee'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Employee Autocomplete Component
 * Provides typeahead/autocomplete functionality for employee name selection.
 * Click on an option → highlights only (does not confirm).
 * Press Enter → confirms highlighted option and moves to next row.
 */
export default function EmployeeAutocomplete({ 
  value = '', 
  onChange, 
  placeholder = "Type employee name...",
  className = "",
  cleanCell = false,
  editingHighlight = false,
  disabled = false,
  onEnterNavigation,
  'data-row': dataRow,
  'data-col': dataCol
}) {
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState(value)
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceTimer = useRef(null)
  const requestSeqRef = useRef(0)
  const searchInputRef = useRef(null)
  const highlightedRef = useRef(null)
  const menuRef = useRef(null)

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
    if (open) {
      debounceTimer.current = setTimeout(() => loadEmployees(searchTerm), 200)
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [searchTerm, open])

  // Focus search input when popup opens
  useEffect(() => {
    if (!open) return
    setMenuOpen(false)
    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }, 30)
    return () => clearTimeout(timer)
  }, [open])

  // Close copy/paste menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  const applySelection = (employeeName) => {
    const finalName = employeeName ?? searchTerm ?? ''
    setSearchTerm(finalName)
    onChange(finalName)
    setOpen(false)
    setHighlightedIndex(-1)
    setTimeout(() => onEnterNavigation?.(), 50)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || '')
    } catch (error) {
      console.error('Copy failed:', error)
    } finally {
      setMenuOpen(false)
      setTimeout(() => onEnterNavigation?.(), 50)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text != null) {
        onChange(String(text))
      }
    } catch (error) {
      console.error('Paste failed:', error)
    } finally {
      setMenuOpen(false)
      setTimeout(() => onEnterNavigation?.(), 50)
    }
  }

  // Confirm the currently highlighted employee
  const confirmHighlighted = () => {
    if (highlightedIndex >= 0 && highlightedIndex < employees.length) {
      applySelection(employees[highlightedIndex].emp_name)
    } else {
      // Nothing highlighted — commit typed value and navigate
      applySelection(searchTerm)
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
      <div className="relative">
        <Input
          value={value || ''}
          readOnly
          onClick={() => {
            if (disabled) return
            setMenuOpen(true)
          }}
          onKeyDown={(e) => {
            if (disabled) return
            if (/^[a-zA-Z]$/.test(e.key)) {
              e.preventDefault()
              setSearchTerm(e.key)
              setHighlightedIndex(-1)
              setMenuOpen(false)
              setOpen(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-full",
            cleanCell && "rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
            editingHighlight && "focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100",
            className
          )}
          autoComplete="off"
        />

        {menuOpen && !disabled && (
          <div
            ref={menuRef}
            className="absolute z-40 mt-1 w-36 rounded-md border bg-white p-1 shadow-md"
          >
            <button
              type="button"
              onClick={handleCopy}
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={handlePaste}
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100"
            >
              Paste
            </button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl w-[95vw] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle>Select Employee</DialogTitle>
          </DialogHeader>

          <div className="p-4 border-b">
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setHighlightedIndex(-1)
              }}
              onKeyDown={handleModalKeyDown}
              placeholder="Search employee name..."
              autoComplete="off"
            />
          </div>

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
              <p className="text-xs text-gray-400 mt-1">Type to search or add new name</p>
            </div>
          )}

          {employees.length > 0 && (
            <div className="py-1">
              {employees.map((emp, index) => (
                <div
                  key={emp.id}
                  ref={highlightedIndex === index ? highlightedRef : null}
                  onClick={() => applySelection(emp.emp_name)}
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
                      searchTerm === emp.emp_name
                        ? highlightedIndex === index ? "opacity-100 text-white" : "opacity-100 text-blue-600"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3 min-w-0">
                      <span className="font-medium text-sm truncate">{emp.emp_name}</span>
                      <span className="text-sm font-bold tabular-nums text-white">
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
              Press Enter to apply selected name and move to next employee cell.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
