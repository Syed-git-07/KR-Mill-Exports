'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { getEntryKeysForIds, getEntryRowKey, getSelectedEntryIds, selectEntryRow } from '@/lib/entryRowSelection'

const EntryRowSelectionContext = createContext(null)
const emptyRows = []

export function EntryRowSelectionProvider({ children }) {
  const [selectedKeys, setSelectedKeys] = useState([])
  const value = useMemo(() => ({ selectedKeys, setSelectedKeys }), [selectedKeys])
  return <EntryRowSelectionContext.Provider value={value}>{children}</EntryRowSelectionContext.Provider>
}

export function useEntryRowSelection(rows = emptyRows, idType = 'setup') {
  const context = useContext(EntryRowSelectionContext)
  if (!context) throw new Error('Entry grids require EntryRowSelectionProvider')
  const { selectedKeys, setSelectedKeys } = context
  const selectedRows = useMemo(() => getSelectedEntryIds(rows, selectedKeys, idType), [rows, selectedKeys, idType])

  // Keep the existing checkbox and action handlers' ID contracts. No machine
  // action needs to know whether selection came from a checkbox or an editor.
  const setSelectedRows = useCallback(updater => {
    setSelectedKeys(previous => {
      const previousIds = getSelectedEntryIds(rows, previous, idType)
      const ids = typeof updater === 'function' ? updater(previousIds) : updater
      return getEntryKeysForIds(rows, ids, idType)
    })
  }, [rows, idType, setSelectedKeys])

  const getRowProps = row => {
    const key = getEntryRowKey(row)
    const selected = key != null && selectedKeys.includes(key)
    const activate = event => {
      // Portalled selectors still bubble React events through their source
      // row. Only interactions inside the actual row should select it.
      if (!event.currentTarget.contains(event.target)) return
      const cell = event.target.closest?.('td')
      if (cell?.querySelector('input[type="checkbox"], [role="checkbox"]')) return
      setSelectedKeys(previous => selectEntryRow(previous, key))
    }
    return {
      'aria-selected': selected,
      'data-entry-selected': selected,
      onPointerDownCapture: activate,
      onClick: activate,
      onFocusCapture: activate,
    }
  }

  return { selectedRows, setSelectedRows, getRowProps }
}
