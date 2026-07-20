'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * StoppageAutocomplete — modal stoppage picker with keyboard-first workflow.
 * - Trigger button shows selected stoppage full name.
 * - Clicking opens modal with search input.
 * - Typing any letter while focused opens modal and seeds search.
 * - Modal shows stoppage name + head/category.
 * - Enter confirms highlighted option and moves to next row.
 * - X button clears selection.
 */
export default function StoppageAutocomplete({
  value = '',
  displayValue = '',
  reasons = [],
  onSelect,
  onClear,
  placeholder = 'Select stoppage...',
  className = '',
  cleanCell = false,
  editingHighlight = false,
  disabled = false,
  compact = false,
  onEnterNavigation,
  'data-row': dataRow,
  'data-col': dataCol
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalHighlightedIndex, setModalHighlightedIndex] = useState(-1)
  const triggerRef = useRef(null)
  const modalSearchRef = useRef(null)
  const modalHighlightedRef = useRef(null)

  const modalFiltered = modalSearch.trim()
    ? reasons.filter(r => {
        const head = r.stoppage_head_name || r.category || ''
        const term = modalSearch.toLowerCase()
        return (
          r.stoppage_name?.toLowerCase().includes(term) ||
          r.short_code?.toLowerCase().includes(term) ||
          head.toLowerCase().includes(term)
        )
      })
    : reasons

  useEffect(() => {
    modalHighlightedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [modalHighlightedIndex])

  useEffect(() => {
    if (!modalOpen) return
    if (modalFiltered.length > 0) {
      setModalHighlightedIndex(0)
    } else {
      setModalHighlightedIndex(-1)
    }
  }, [modalOpen, modalSearch, modalFiltered.length])

  const confirmItem = useCallback((reason) => {
    onSelect?.(reason.id, reason)
    setModalOpen(false)
    setModalSearch('')
    setModalHighlightedIndex(-1)
    setTimeout(() => onEnterNavigation?.(), 50)
  }, [onSelect, onEnterNavigation])

  const openSearchModal = useCallback((initial = '') => {
    setModalSearch(initial)
    setModalHighlightedIndex(-1)
    setModalOpen(true)
    setTimeout(() => {
      modalSearchRef.current?.focus()
      if (initial) modalSearchRef.current?.setSelectionRange(initial.length, initial.length)
    }, 20)
  }, [])

  const handleClosedStateKeyDown = useCallback((e) => {
    if (disabled) return
    if (!modalOpen && /^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault()
      openSearchModal(e.key)
      return
    }

    if (!modalOpen) {
      if (e.key === 'Enter') {
        e.preventDefault()
        onEnterNavigation?.()
      }
    }
  }, [modalOpen, openSearchModal, disabled, onEnterNavigation])

  const handleModalKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setModalHighlightedIndex(prev => Math.min(prev + 1, modalFiltered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setModalHighlightedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (modalHighlightedIndex >= 0 && modalHighlightedIndex < modalFiltered.length) {
          confirmItem(modalFiltered[modalHighlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setModalOpen(false)
        setModalSearch('')
        setModalHighlightedIndex(-1)
        setTimeout(() => triggerRef.current?.focus(), 0)
        break
    }
  }, [modalFiltered, modalHighlightedIndex, confirmItem])

  return (
    <div
      className="relative"
      data-row={dataRow}
      data-col={dataCol}
      data-autocomplete="stoppage"
      onKeyDown={handleClosedStateKeyDown}
    >
      {/* Trigger button */}
      <div className={cn(
        'flex items-center border border-gray-300 rounded bg-white',
        compact ? 'h-6' : 'h-7',
        cleanCell && 'h-full rounded-none border-0 shadow-none bg-transparent',
        className
      )}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => triggerRef.current?.focus()}
          className={cn(
            'group flex-1 min-w-0 text-left px-2 flex items-center justify-between overflow-hidden',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 rounded',
            cleanCell && 'h-full rounded-none focus:ring-0',
            editingHighlight && 'focus:bg-orange-500 focus:text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            cleanCell ? 'text-xs' : (compact ? 'text-xs h-6' : 'text-xs h-7')
          )}
        >
          <span
            className={cn(
              'truncate',
              !value ? 'text-gray-400' : 'text-gray-900',
              editingHighlight && 'group-focus:text-white'
            )}
            title={value ? (displayValue || '') : ''}
          >
            {value ? (displayValue || placeholder) : placeholder}
          </span>
          <ChevronDown className={cn('h-3 w-3 text-gray-400 shrink-0 ml-1', editingHighlight && 'group-focus:text-white')} />
        </button>
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear?.() }}
            className="px-1 text-gray-400 hover:text-red-500 focus:outline-none"
            tabIndex={-1}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl w-[95vw] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle>Select Stoppage</DialogTitle>
          </DialogHeader>

          <div className="p-4 border-b">
            <Input
              ref={modalSearchRef}
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              onKeyDown={handleModalKeyDown}
              placeholder="Search stoppage name or head..."
              autoComplete="off"
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            {modalFiltered.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500">No stoppage found</p>
              </div>
            ) : (
              <div className="py-1">
                {modalFiltered.map((reason, index) => {
                  const isHighlighted = modalHighlightedIndex === index
                  const head = reason.stoppage_head_name || reason.category || 'General'
                  return (
                    <div
                      key={reason.id}
                      ref={isHighlighted ? modalHighlightedRef : null}
                      onClick={() => confirmItem(reason)}
                      onMouseEnter={() => setModalHighlightedIndex(index)}
                      className={cn(
                        'px-3 py-2 cursor-pointer flex items-start select-none',
                        isHighlighted ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-900'
                      )}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 mt-0.5 shrink-0',
                          String(value || '') === String(reason.id)
                            ? isHighlighted ? 'opacity-100 text-white' : 'opacity-100 text-blue-600'
                            : 'opacity-0'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-[1fr_auto] items-center gap-3 min-w-0">
                          <span className="font-medium text-sm truncate">{reason.stoppage_name}</span>
                          <span className={cn('text-xs font-semibold truncate', isHighlighted ? 'text-blue-100' : 'text-gray-500')}>
                            {head}
                          </span>
                        </div>
                        {reason.short_code && (
                          <div className={cn('text-xs truncate', isHighlighted ? 'text-blue-100' : 'text-gray-500')}>
                            {reason.short_code}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50">
              Type any letter to open this search and press Enter to select.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
