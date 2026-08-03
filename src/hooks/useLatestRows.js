'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  createLatestRequestGate,
  getCurrentRowByIdentity,
  getCurrentRowsByIdentity,
  reconcileVisibleRowState,
  rowIdentity
} from '@/lib/latestRows'

/**
 * Coordinates async list/search requests and keeps row selections tied to the
 * currently visible result set. All mutable values live in refs so destructive
 * handlers can validate against the last accepted response, even before React
 * has committed the corresponding render.
 */
export function useLatestRows({
  rows,
  setRows,
  selectedId,
  setSelectedId,
  selectedRows,
  setSelectedRows,
  selectedItem,
  setSelectedItem,
  editingItem,
  setEditingItem,
  setIsEditing,
  setIsSelectMode,
  setIsModalOpen,
  closeModalWhenSelectedItemStale = false,
  idKey = 'id'
}) {
  const gateRef = useRef(null)
  const rowsRef = useRef(Array.isArray(rows) ? rows : [])
  const stateRef = useRef({})

  if (!gateRef.current) gateRef.current = createLatestRequestGate()

  rowsRef.current = Array.isArray(rows) ? rows : []
  stateRef.current = {
    selectedId,
    selectedRows,
    selectedItem,
    editingItem,
    setSelectedId,
    setSelectedRows,
    setSelectedItem,
    setEditingItem,
    setIsEditing,
    setIsSelectMode,
    setIsModalOpen,
    closeModalWhenSelectedItemStale,
    idKey
  }

  useEffect(() => () => gateRef.current?.invalidate(), [])

  const replaceRows = useCallback(nextRows => {
    const safeRows = Array.isArray(nextRows) ? nextRows : []
    const current = stateRef.current
    const reconciled = reconcileVisibleRowState({
      rows: safeRows,
      selectedId: current.selectedId,
      selectedRows: current.selectedRows,
      selectedItem: current.selectedItem,
      editingItem: current.editingItem,
      idKey: current.idKey
    })

    rowsRef.current = safeRows
    setRows(safeRows)

    if (current.setSelectedId) current.setSelectedId(reconciled.selectedId)
    if (current.setSelectedRows) current.setSelectedRows(reconciled.selectedRows)
    if (current.setSelectedItem) current.setSelectedItem(reconciled.selectedItem)
    if (current.setEditingItem) current.setEditingItem(reconciled.editingItem)
    const editTargetBecameStale = reconciled.editingItemBecameStale ||
      (current.closeModalWhenSelectedItemStale && reconciled.selectedItemBecameStale)

    if (editTargetBecameStale) {
      current.setIsEditing?.(false)
      current.setIsModalOpen?.(false)
    }

    return safeRows
  }, [setRows])

  const runLatestRowsRequest = useCallback(async (request, callbacks = {}) => {
    const requestId = gateRef.current.begin()
    callbacks.onStart?.()

    try {
      const result = await request()
      if (!gateRef.current.isLatest(requestId)) return { accepted: false, result }

      await callbacks.onSuccess?.(result, { replaceRows })
      return { accepted: true, result }
    } catch (error) {
      if (!gateRef.current.isLatest(requestId)) return { accepted: false, error }

      await callbacks.onError?.(error)
      return { accepted: true, error }
    } finally {
      if (gateRef.current.isLatest(requestId)) callbacks.onFinally?.()
    }
  }, [replaceRows])

  const getCurrentRow = useCallback(
    candidate => getCurrentRowByIdentity(rowsRef.current, candidate, stateRef.current.idKey),
    []
  )
  const getCurrentRows = useCallback(
    candidates => getCurrentRowsByIdentity(rowsRef.current, candidates, stateRef.current.idKey),
    []
  )

  const resetInteractionState = useCallback(({ closeModal = false } = {}) => {
    const current = stateRef.current
    stateRef.current = {
      ...current,
      selectedId: null,
      selectedRows: [],
      selectedItem: null,
      editingItem: null
    }

    current.setSelectedId?.(null)
    current.setSelectedRows?.([])
    current.setSelectedItem?.(null)
    current.setEditingItem?.(null)
    current.setIsEditing?.(false)
    current.setIsSelectMode?.(false)
    if (closeModal) current.setIsModalOpen?.(false)
  }, [])

  const openRowEditor = useCallback((candidate, options = {}) => {
    const current = stateRef.current
    const currentRow = getCurrentRowByIdentity(rowsRef.current, candidate, current.idKey)
    if (!currentRow) return null

    const editingValue = Object.prototype.hasOwnProperty.call(options, 'editingItem')
      ? options.editingItem
      : currentRow
    stateRef.current = {
      ...current,
      selectedId: rowIdentity(currentRow, current.idKey),
      selectedRows: [],
      selectedItem: currentRow,
      editingItem: current.setEditingItem ? editingValue : null
    }

    current.setSelectedId?.(rowIdentity(currentRow, current.idKey))
    current.setSelectedRows?.([])
    current.setSelectedItem?.(currentRow)
    current.setEditingItem?.(editingValue)
    current.setIsEditing?.(true)
    current.setIsSelectMode?.(false)
    current.setIsModalOpen?.(true)
    return currentRow
  }, [])

  return {
    getCurrentRow,
    getCurrentRows,
    openRowEditor,
    replaceRows,
    resetInteractionState,
    runLatestRowsRequest
  }
}
