export const ENTRY_GRID_ARROW_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
])

export const ENTRY_GRID_EDITOR_SELECTOR = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not(:disabled):not([readonly])',
  'textarea:not(:disabled):not([readonly])',
  'select:not(:disabled)',
  'button[role="combobox"]:not(:disabled)',
  '[contenteditable="true"]',
].join(',')

export function getEntryGridCellEditor(cell) {
  return cell?.querySelector?.(ENTRY_GRID_EDITOR_SELECTOR) || null
}

function findHorizontalEditor(row, originIndex, step) {
  const cells = Array.from(row?.cells || [])

  for (let index = originIndex + step; index >= 0 && index < cells.length; index += step) {
    const editor = getEntryGridCellEditor(cells[index])
    if (editor) return editor
  }

  return null
}

function findVerticalEditor(row, originIndex, step) {
  const rows = Array.from(row?.parentElement?.rows || [])
  const rowIndex = rows.indexOf(row)
  if (rowIndex < 0) return null

  for (let index = rowIndex + step; index >= 0 && index < rows.length; index += step) {
    const editor = getEntryGridCellEditor(rows[index]?.cells?.[originIndex])
    if (editor) return editor
  }

  return null
}

/**
 * Return the next editable control using spreadsheet-style grid navigation.
 * Fixed, disabled and read-only cells are skipped without wrapping at an edge.
 */
export function findEntryGridNavigationTarget(originCell, key) {
  const row = originCell?.parentElement
  const cells = Array.from(row?.cells || [])
  const originIndex = cells.indexOf(originCell)
  if (originIndex < 0) return null

  switch (key) {
    case 'ArrowLeft':
      return findHorizontalEditor(row, originIndex, -1)
    case 'ArrowRight':
      return findHorizontalEditor(row, originIndex, 1)
    case 'ArrowUp':
      return findVerticalEditor(row, originIndex, -1)
    case 'ArrowDown':
      return findVerticalEditor(row, originIndex, 1)
    default:
      return null
  }
}
