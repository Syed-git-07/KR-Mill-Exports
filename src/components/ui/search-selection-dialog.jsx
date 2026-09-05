'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Shared keyboard-accessible search dialog for dense production-entry grids.
 * The caller retains ownership of the query and selected value while this
 * component owns only the temporary highlighted result.
 */
export default function SearchSelectionDialog({
  open,
  onOpenChange,
  title,
  description,
  searchValue,
  onSearchValueChange,
  searchPlaceholder = 'Search...',
  items = [],
  getItemKey,
  isItemSelected,
  renderItem,
  onSelect,
  isLoading = false,
  emptyMessage = 'No matching results found',
  listHeader = null,
  footer = null,
  returnFocusRef,
  contentClassName = '',
}) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const highlightedRef = useRef(null)
  const dialogId = useId().replaceAll(':', '')

  useEffect(() => {
    setHighlightedIndex(open && items.length > 0 ? 0 : -1)
  }, [open, searchValue, items.length])

  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const selectItem = (item) => {
    if (!item) return
    onSelect?.(item)
    onOpenChange?.(false)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      if (items.length === 0) return
      setHighlightedIndex((previous) => Math.min(previous + 1, items.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      if (items.length === 0) return
      setHighlightedIndex((previous) => Math.max(previous - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (highlightedIndex >= 0) selectItem(items[highlightedIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(86vh,50rem)] w-[min(96vw,64rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl',
          contentClassName
        )}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef?.current?.focus()
        }}
      >
        <DialogHeader className="border-b border-slate-200 px-6 pb-4 pt-5 pr-14">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>
            {description || 'Search and select a value.'}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
          <label className="sr-only" htmlFor={`${dialogId}-search`}>{searchPlaceholder}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id={`${dialogId}-search`}
              value={searchValue}
              onChange={(event) => onSearchValueChange?.(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 bg-white pl-10 pr-3 text-[13px]"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={`${dialogId}-results`}
              aria-expanded={open}
              aria-activedescendant={highlightedIndex >= 0 ? `${dialogId}-option-${highlightedIndex}` : undefined}
              autoFocus
            />
          </div>
        </div>

        {listHeader && items.length > 0 && (
          <div className="border-b border-slate-200 bg-white px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {listHeader}
          </div>
        )}

        <div
          id={`${dialogId}-results`}
          role="listbox"
          aria-label={`${title} results`}
          className="min-h-40 flex-1 overflow-auto bg-white p-2"
        >
          {isLoading && items.length === 0 ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating results...
                </div>
              )}
              {items.map((item, index) => {
                const highlighted = highlightedIndex === index
                const selected = isItemSelected?.(item) || false
                return (
                  <button
                    id={`${dialogId}-option-${index}`}
                    key={getItemKey?.(item) ?? index}
                    ref={highlighted ? highlightedRef : null}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectItem(item)}
                    className={cn(
                      'flex w-full items-start rounded-md px-3 py-2.5 text-left outline-none transition-colors',
                      highlighted
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-900 hover:bg-slate-100 focus-visible:bg-slate-100'
                    )}
                  >
                    <Check className={cn(
                      'mr-3 mt-0.5 h-4 w-4 shrink-0',
                      selected ? (highlighted ? 'text-white' : 'text-blue-600') : 'opacity-0'
                    )} />
                    <div className="min-w-0 flex-1">
                      {renderItem?.(item, { highlighted, selected })}
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {footer && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
