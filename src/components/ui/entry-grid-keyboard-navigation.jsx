'use client'

import { useEffect } from 'react'
import {
  ENTRY_GRID_ARROW_KEYS,
  ENTRY_GRID_EDITOR_SELECTOR,
  findEntryGridNavigationTarget,
} from '@/lib/entryGridNavigation'

function focusEditor(editor) {
  try {
    editor.focus({ preventScroll: true })
  } catch {
    editor.focus()
  }

  editor.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })

  // Selecting an input's current value lets the next keystroke replace it,
  // which matches the existing entry-grid editing behaviour.
  if (typeof editor.select === 'function') {
    try {
      editor.select()
    } catch {
      // Some input types can receive focus but do not expose text selection.
    }
  }
}

/**
 * Installs arrow-key navigation for every entry-data-grid in the current route.
 * Dialogs are portalled outside their source table, so their own arrow-key
 * result navigation remains independent from grid navigation.
 */
export default function EntryGridKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        !ENTRY_GRID_ARROW_KEYS.has(event.key) ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return
      }

      const origin = event.target
      if (!(origin instanceof Element) || origin.closest('[role="dialog"]')) return

      const activeEditor = origin.closest(ENTRY_GRID_EDITOR_SELECTOR)
      const table = origin.closest('table.entry-data-grid')
      const cell = origin.closest('td')

      if (!activeEditor || !table || !cell || !table.contains(cell)) return

      // Arrow keys are navigation keys while an entry cell is active. Prevent
      // number inputs from changing value even when focus is at a grid edge.
      event.preventDefault()

      const destination = findEntryGridNavigationTarget(cell, event.key)
      if (destination) focusEditor(destination)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
