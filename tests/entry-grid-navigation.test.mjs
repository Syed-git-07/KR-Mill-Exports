import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  ENTRY_GRID_ARROW_KEYS,
  findEntryGridNavigationTarget,
} from '../src/lib/entryGridNavigation.js'

function makeGrid(editorMatrix) {
  const rows = editorMatrix.map((editors) => {
    const row = { cells: [] }
    row.cells = editors.map(editor => ({
      parentElement: row,
      querySelector: () => editor,
    }))
    return row
  })
  const body = { rows }
  for (const row of rows) row.parentElement = body
  return rows
}

test('entry grid navigation moves in all four directions and skips fixed cells', () => {
  const editors = {
    employee1: {}, count1: {}, production1: {},
    employee2: {}, count2: {}, production2: {},
    employee3: {}, count3: {}, production3: {},
  }
  const rows = makeGrid([
    [null, editors.employee1, null, editors.count1, editors.production1],
    [null, editors.employee2, null, editors.count2, editors.production2],
    [null, editors.employee3, null, editors.count3, editors.production3],
  ])

  assert.deepEqual([...ENTRY_GRID_ARROW_KEYS].sort(), [
    'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp',
  ])
  assert.equal(findEntryGridNavigationTarget(rows[1].cells[3], 'ArrowLeft'), editors.employee2)
  assert.equal(findEntryGridNavigationTarget(rows[1].cells[3], 'ArrowRight'), editors.production2)
  assert.equal(findEntryGridNavigationTarget(rows[1].cells[3], 'ArrowUp'), editors.count1)
  assert.equal(findEntryGridNavigationTarget(rows[1].cells[3], 'ArrowDown'), editors.count3)
})

test('entry grid navigation stays within the grid at its boundaries', () => {
  const first = {}
  const last = {}
  const rows = makeGrid([
    [first, null],
    [last, null],
  ])

  assert.equal(findEntryGridNavigationTarget(rows[0].cells[0], 'ArrowLeft'), null)
  assert.equal(findEntryGridNavigationTarget(rows[0].cells[0], 'ArrowUp'), null)
  assert.equal(findEntryGridNavigationTarget(rows[1].cells[0], 'ArrowRight'), null)
  assert.equal(findEntryGridNavigationTarget(rows[1].cells[0], 'ArrowDown'), null)
})

test('preparatory and post-preparatory layouts install shared grid navigation', async () => {
  const [component, preparatoryLayout, postPreparatoryLayout] = await Promise.all([
    readFile(path.resolve('src/components/ui/entry-grid-keyboard-navigation.jsx'), 'utf8'),
    readFile(path.resolve('src/app/preparatory-entry/layout.jsx'), 'utf8'),
    readFile(path.resolve('src/app/post-preparatory/layout.jsx'), 'utf8'),
  ])

  assert.match(component, /closest\('table\.entry-data-grid'\)/)
  assert.match(component, /event\.preventDefault\(\)/)
  assert.match(component, /findEntryGridNavigationTarget\(cell, event\.key\)/)
  assert.match(component, /editor\.scrollIntoView/)
  assert.match(preparatoryLayout, /<EntryGridKeyboardNavigation \/>/)
  assert.match(postPreparatoryLayout, /<EntryGridKeyboardNavigation \/>/)
})
