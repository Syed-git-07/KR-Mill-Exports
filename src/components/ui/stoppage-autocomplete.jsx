'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import SearchSelectionDialog from '@/components/ui/search-selection-dialog'

/**
 * Searchable stoppage selector used by every preparatory and post-preparatory
 * stoppage entry. Reasons are selected in a modal so the grid is never covered
 * by an inline dropdown.
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
  'data-row': dataRow,
  'data-col': dataCol
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(displayValue || '')
  const inputRef = useRef(null)

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

  const selectReason = useCallback((reason) => {
    onSelect?.(reason.id, reason)
    setQuery(reason.stoppage_name || '')
    setOpen(false)
  }, [onSelect])

  const handleTriggerChange = (event) => {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    setOpen(nextQuery.trim().length > 0)
    if (nextQuery.length === 0 && value) onClear?.()
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
          aria-haspopup="dialog"
          aria-expanded={open}
          onChange={handleTriggerChange}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              setQuery(displayValue || '')
            }
          }}
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

      <SearchSelectionDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
        }}
        title="Select stoppage reason"
        searchValue={query}
        onSearchValueChange={setQuery}
        searchPlaceholder="Type a stoppage reason, code, or category..."
        items={filteredReasons}
        getItemKey={(reason) => reason.id}
        isItemSelected={(reason) => String(value || '') === String(reason.id)}
        onSelect={selectReason}
        emptyMessage="No matching stoppage reasons found"
        listHeader={(
          <div className="grid min-w-[42rem] grid-cols-[minmax(14rem,1.5fr)_minmax(9rem,0.8fr)_minmax(6rem,0.5fr)] gap-4 pl-7">
            <span>Stoppage reason</span>
            <span>Category</span>
            <span>Short code</span>
          </div>
        )}
        renderItem={(reason, { highlighted }) => {
          const head = reason.stoppage_head_name || reason.category || 'General'
          return (
            <div className="grid min-w-[42rem] grid-cols-[minmax(14rem,1.5fr)_minmax(9rem,0.8fr)_minmax(6rem,0.5fr)] items-center gap-4">
              <span className="break-words text-[13px] font-semibold leading-5">{reason.stoppage_name}</span>
              <span className={cn('break-words text-[13px] leading-5', highlighted ? 'text-blue-100' : 'text-slate-500')}>
                {head}
              </span>
              <span className={cn('break-words text-[13px] font-medium leading-5', highlighted ? 'text-blue-100' : 'text-slate-500')}>
                {reason.short_code || '-'}
              </span>
            </div>
          )
        }}
        returnFocusRef={inputRef}
      />
    </div>
  )
}
