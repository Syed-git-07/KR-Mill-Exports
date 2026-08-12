'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Searchable stoppage selector used by every preparatory and post-preparatory
 * stoppage entry. Selection still returns the existing stoppage id; typing is
 * only used to filter the available reasons.
 */
export default function StoppageAutocomplete({
  value = '',
  displayValue = '',
  reasons = [],
  onSelect,
  onClear,
  placeholder = 'Enter stoppage',
  className = '',
  cleanCell = false,
  editingHighlight = false,
  disabled = false,
  compact = false,
  onEnterNavigation,
  'data-row': dataRow,
  'data-col': dataCol
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(displayValue || '')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const highlightedRef = useRef(null)

  useEffect(() => {
    if (!open) setQuery(displayValue || '')
  }, [displayValue, open])

  const filteredReasons = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return reasons

    return reasons.filter((reason) => {
      const head = reason.stoppage_head_name || reason.category || ''
      return (
        reason.stoppage_name?.toLowerCase().includes(term) ||
        reason.short_code?.toLowerCase().includes(term) ||
        head.toLowerCase().includes(term)
      )
    })
  }, [query, reasons])

  useEffect(() => {
    setHighlightedIndex(open && query.trim() && filteredReasons.length ? 0 : -1)
  }, [open, query, filteredReasons.length])

  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  useEffect(() => {
    if (!open) return undefined

    const handleOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery(displayValue || '')
      }
    }

    document.addEventListener('mousedown', handleOutsidePointer)
    return () => document.removeEventListener('mousedown', handleOutsidePointer)
  }, [open, displayValue])

  const selectReason = useCallback((reason) => {
    onSelect?.(reason.id, reason)
    setQuery(reason.stoppage_name || '')
    setOpen(false)
    setHighlightedIndex(-1)
  }, [onSelect])

  const handleChange = (event) => {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    // Keep the editing state active when the final character is removed so
    // the previous selected name is not restored by the display-value sync.
    setOpen(true)
    if (nextQuery.length === 0 && value) onClear?.()
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setHighlightedIndex((previous) => Math.min(previous + 1, filteredReasons.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((previous) => Math.max(previous - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && highlightedIndex >= 0 && filteredReasons[highlightedIndex]) {
        selectReason(filteredReasons[highlightedIndex])
      } else if (!open) {
        onEnterNavigation?.()
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setQuery(displayValue || '')
    }
  }

  const clearSelection = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setQuery('')
    setOpen(false)
    onClear?.()
    inputRef.current?.focus()
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      data-row={dataRow}
      data-col={dataCol}
      data-autocomplete="stoppage"
    >
      <div className={cn(
        'flex items-center border border-gray-300 rounded bg-white',
        compact ? 'h-6' : 'h-7',
        cleanCell && 'h-full rounded-none border-0 shadow-none bg-transparent',
        className
      )}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          onChange={handleChange}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 min-w-0 bg-transparent px-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded',
            cleanCell && 'h-full rounded-none focus:ring-0',
            editingHighlight && 'focus:bg-orange-500 focus:text-white focus:placeholder:text-orange-100',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            cleanCell ? 'text-xs' : (compact ? 'text-xs h-6' : 'text-xs h-7')
          )}
        />

        {value && !disabled ? (
          <button
            type="button"
            onClick={clearSelection}
            className="px-1 text-gray-400 hover:text-red-500 focus:outline-none"
            tabIndex={-1}
            aria-label="Clear stoppage"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0 mr-1" />
        )}
      </div>

      {open && query.length > 0 && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-max min-w-full max-w-[28rem] max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filteredReasons.length === 0 ? (
            <div className="px-3 py-3 text-center text-sm text-gray-500">No stoppage found</div>
          ) : filteredReasons.map((reason, index) => {
            const isHighlighted = highlightedIndex === index
            const isSelected = String(value || '') === String(reason.id)
            const head = reason.stoppage_head_name || reason.category || 'General'

            return (
              <button
                key={reason.id}
                ref={isHighlighted ? highlightedRef : null}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectReason(reason)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'flex w-full items-start px-3 py-2 text-left select-none',
                  isHighlighted ? 'bg-blue-600 text-white' : 'text-gray-900 hover:bg-gray-100'
                )}
              >
                <Check className={cn(
                  'mr-2 mt-0.5 h-4 w-4 shrink-0',
                  isSelected ? (isHighlighted ? 'text-white opacity-100' : 'text-blue-600 opacity-100') : 'opacity-0'
                )} />
                <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="truncate text-sm font-medium">{reason.stoppage_name}</span>
                  <span className={cn('truncate text-xs font-semibold', isHighlighted ? 'text-blue-100' : 'text-gray-500')}>
                    {head}
                  </span>
                  {reason.short_code && (
                    <span className={cn('col-span-2 truncate text-xs', isHighlighted ? 'text-blue-100' : 'text-gray-500')}>
                      {reason.short_code}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
