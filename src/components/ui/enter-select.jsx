'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * EnterSelect — dropdown where:
 *   - Click option → highlights only (does NOT confirm)
 *   - Enter → confirms highlighted option, closes, calls onNextRow
 *   - Escape → closes without changing value
 *   - searchable=true → shows a search box inside the dropdown, filters options,
 *     and auto-highlights the first match as you type
 */
export default function EnterSelect({
  value = null,
  options = [],
  onChange,
  onNextRow,
  placeholder = '-',
  className = '',
  cleanCell = false,
  editingHighlight = false,
  disabled = false,
  searchable = false,
}) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(null)
  const [search, setSearch] = useState('')
  const triggerRef = useRef(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const highlightedRef = useRef(null)

  // Filtered options based on search term
  const filtered = searchable && search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  // Scroll highlighted item into view
  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  // When search changes, auto-highlight first filtered result
  useEffect(() => {
    if (filtered.length > 0) {
      setHighlighted(filtered[0].value)
    }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const openDropdown = useCallback(() => {
    setSearch('')
    setHighlighted(value ?? null)
    setOpen(true)
    // focus search input on next tick
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [value])

  const confirm = useCallback((visibleOptions) => {
    const list = visibleOptions ?? filtered
    const match = list.find(o => o.value === highlighted)
    if (match) {
      onChange?.(match.value)
    }
    setOpen(false)
    setSearch('')
    setTimeout(() => onNextRow?.(), 0)
  }, [highlighted, filtered, onChange, onNextRow])

  // Keyboard handler shared by trigger button and search input
  const handleKeyDown = useCallback((e) => {
    if (disabled) return

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        openDropdown()
      }
      return
    }

    const idx = filtered.findIndex(o => o.value === highlighted)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(filtered[Math.min(idx + 1, filtered.length - 1)]?.value ?? null)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(filtered[Math.max(idx - 1, 0)]?.value ?? null)
        break
      case 'Enter':
        e.preventDefault()
        confirm(filtered)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setSearch('')
        triggerRef.current?.focus()
        break
    }
  }, [open, filtered, highlighted, openDropdown, confirm, disabled])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!triggerRef.current?.closest('[data-enter-select]')?.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const displayLabel = options.find(o => o.value === value)?.label ?? placeholder

  return (
    <div className="relative" data-enter-select onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openDropdown()}
        className={cn(
          'group h-6 text-xs w-full border border-gray-300 rounded px-2 flex items-center justify-between bg-white',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          cleanCell && 'h-full rounded-none border-0 shadow-none focus:ring-0 focus:border-transparent bg-transparent',
          editingHighlight && 'focus:bg-orange-500 focus:text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        <span className={cn('truncate', !value ? 'text-gray-400' : '', editingHighlight && 'group-focus:text-white')}>
          {displayLabel}
        </span>
        <ChevronDown className={cn('h-3 w-3 text-gray-400 shrink-0 ml-1', editingHighlight && 'group-focus:text-white')} />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 min-w-full bg-white border border-gray-200 rounded shadow-lg"
          style={{ minWidth: '160px' }}
        >
          {/* Search box */}
          {searchable && (
            <div className="p-1 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-6 pl-6 pr-2 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div ref={listRef} className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-400 text-center">No results</div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  ref={highlighted === opt.value ? highlightedRef : null}
                  onClick={() => {
                    onChange?.(opt.value)
                    setOpen(false)
                    setSearch('')
                    setTimeout(() => onNextRow?.(), 0)
                  }}
                  className={cn(
                    'px-2 py-1 text-xs cursor-pointer select-none',
                    highlighted === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 text-gray-800'
                  )}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
