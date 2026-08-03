import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const importSourceModule = async relativePath => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const {
  createLatestRequestGate,
  getCurrentRowsByIdentity,
  reconcileVisibleRowState
} = await importSourceModule('../src/lib/latestRows.js')

test('only the newest list request may replace visible rows', () => {
  const gate = createLatestRequestGate()
  const slowRequest = gate.begin()
  const newerRequest = gate.begin()

  assert.equal(gate.isLatest(slowRequest), false)
  assert.equal(gate.isLatest(newerRequest), true)
  gate.invalidate()
  assert.equal(gate.isLatest(newerRequest), false)
})

test('row replacement revalidates selections and closes a stale edit target', () => {
  const oldA = { id: 'a', name: 'old A' }
  const oldB = { id: 'b', name: 'old B' }
  const newA = { id: 'a', name: 'new A' }
  const state = reconcileVisibleRowState({
    rows: [newA, { id: 'c' }],
    selectedId: 'b',
    selectedRows: [oldA, oldB],
    selectedItem: oldA,
    editingItem: oldB
  })

  assert.equal(state.selectedId, null)
  assert.deepEqual(state.selectedRows, [newA])
  assert.equal(state.selectedItem, newA)
  assert.equal(state.editingItem, null)
  assert.equal(state.selectedItemBecameStale, false)
  assert.equal(state.editingItemBecameStale, true)
})

test('destructive target resolution returns only IDs still visible now', () => {
  const visibleRows = [{ id: 'a', is_active: false }, { id: 'c', is_active: true }]
  assert.deepEqual(
    getCurrentRowsByIdentity(visibleRows, [{ id: 'a', is_active: true }, { id: 'b' }]),
    [visibleRows[0]]
  )
})

test('a selected edit target that disappears is marked stale and cleared', () => {
  const state = reconcileVisibleRowState({
    rows: [{ id: 'still-visible' }],
    selectedItem: { id: 'removed' }
  })

  assert.equal(state.selectedItem, null)
  assert.equal(state.selectedItemBecameStale, true)
})

const masterPages = [
  '../src/app/masters/autoconer/page.jsx',
  '../src/app/masters/department/page.jsx',
  '../src/app/masters/hok-strength/page.jsx',
  '../src/app/masters/spinning-count/page.jsx',
  '../src/app/masters/spinning-machine/page.jsx',
  '../src/app/masters/stoppage-detail/page.jsx',
  '../src/app/masters/stoppage-head/page.jsx',
  '../src/app/masters/supervisor/page.jsx',
  '../src/app/masters/tpi-entry/page.jsx',
  '../src/app/masters/twc-entry/page.jsx',
  '../src/app/preparatory-master/carding-machine/page.jsx',
  '../src/app/preparatory-master/comber/page.jsx',
  '../src/app/preparatory-master/drawing-breaker/page.jsx',
  '../src/app/preparatory-master/drawing-finisher/page.jsx',
  '../src/app/preparatory-master/lap-former/page.jsx',
  '../src/app/preparatory-master/simplex/page.jsx'
]

test('every master list uses guarded replacement and current-row action targets', async () => {
  for (const page of masterPages) {
    const source = await readFile(new URL(page, import.meta.url), 'utf8')
    assert.match(source, /useLatestRows\(/, `${page} must coordinate list state`)
    assert.match(source, /runLatestRowsRequest\(/, `${page} must reject stale list responses`)
    assert.match(source, /getCurrentRow/, `${page} must revalidate action targets`)
    assert.match(source, /resetInteractionState\(/, `${page} must synchronously clear action state`)
    assert.match(source, /openRowEditor\(/, `${page} must synchronize edit state`)
  }
})
