import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { getEntryKeysForIds, getEntryRowKey, getSelectedEntryIds, selectEntryRow } from '../src/lib/entryRowSelection.js'

test('production and stoppage focus resolve to the same setup machine', () => {
  const production = { id: 'production-1', machine: { id: 'machine-1' } }
  const stoppage = { id: 'stoppage-1', production_detail: { machine_id: 'machine-1' } }
  const setup = { id: 'setup-1', machine_id: 'machine-1' }
  assert.equal(getEntryRowKey(production), getEntryRowKey(stoppage))
  assert.equal(getEntryRowKey(stoppage), getEntryRowKey(setup))
  assert.deepEqual(getSelectedEntryIds([setup], [getEntryRowKey(production)], 'machine'), ['machine-1'])
  assert.deepEqual(getSelectedEntryIds([setup], [getEntryRowKey(production)], 'setup'), ['setup-1'])
})

test('spinning count runs select the exact run, not another run of the machine', () => {
  const setups = [1, 2].map(run_sequence => ({ id: `setup-${run_sequence}`, machine_id: 'machine-1', run_sequence }))
  const production = { id: 'production-2', machine_id: 'machine-1', setup: { run_sequence: 2 } }
  const stoppage = { id: 'stoppage-2', machine_id: 'machine-1', run_sequence: 2 }
  assert.equal(getEntryRowKey(production), getEntryRowKey(stoppage))
  assert.deepEqual(getSelectedEntryIds(setups, [getEntryRowKey(production)], 'setup'), ['setup-2'])
})

test('focusing a new row replaces selection; editing a checked row retains the batch', () => {
  const batch = ['machine-a', 'machine-b']
  assert.equal(selectEntryRow(batch, 'machine-b'), batch)
  assert.deepEqual(selectEntryRow(batch, 'machine-c'), ['machine-c'])
  assert.equal(selectEntryRow(batch, null), batch)
})

test('checkbox selection maps back to the correct row keys and can be cleared', () => {
  const rows = [{ id: 12, machine_id: 100 }, { id: 13, machine_id: 101 }]
  const keys = getEntryKeysForIds(rows, [12, 13], 'setup')
  assert.deepEqual(getSelectedEntryIds(rows, keys, 'setup'), [12, 13])
  assert.deepEqual(getSelectedEntryIds(rows, keys, 'machine'), [100, 101])
  assert.deepEqual(getEntryKeysForIds(rows, [], 'setup'), [])
  assert.deepEqual(getEntryKeysForIds(rows, [12, 12], 'setup'), [getEntryRowKey(rows[0])])
})

test('missing and removed machines cannot become an operation target', () => {
  assert.equal(getEntryRowKey({ id: 'setup-without-machine' }), null)
  const removedKey = getEntryRowKey({ machine_id: 'removed' })
  assert.deepEqual(getSelectedEntryIds([{ id: 'other', machine_id: 'other' }], [removedKey], 'setup'), [])
})

test('all eight modules share selection across every tab, scoped to the entry header', async () => {
  const modules = [
    ['preparatory-entry', 'carding', 'Carding'], ['preparatory-entry', 'breaker-drawing', 'BreakerDrawing'],
    ['preparatory-entry', 'comber', 'Comber'], ['preparatory-entry', 'finisher-drawing', 'FinisherDrawing'],
    ['preparatory-entry', 'lap-former', 'LapFormer'], ['preparatory-entry', 'simplex', 'Simplex'],
    ['post-preparatory', 'spinning', 'Spinning'], ['post-preparatory', 'autoconer', 'Autoconer'],
  ]
  for (const [group, module, prefix] of modules) {
    const page = await readFile(new URL(`../src/app/${group}/${module}/entry/page.jsx`, import.meta.url), 'utf8')
    assert.match(page, /<EntryRowSelectionProvider key=\{headerId\}>/)
    for (const tab of ['Production', 'Stoppage', 'MachineSetup']) {
      const folder = group === 'preparatory-entry' ? group : `${group}/${module}`
      const source = await readFile(new URL(`../src/components/modules/${folder}/${prefix}${tab}Tab.jsx`, import.meta.url), 'utf8')
      assert.match(source, /<tr key=\{[^}]+\} \{\.\.\.getRowProps\(row\)\}/)
      assert.match(source, /data-entry-modified=\{Boolean\(editedRows\[row.id\]\)\}/)
      if (tab === 'MachineSetup') {
        assert.match(source, /\{ selectedRows, setSelectedRows, getRowProps \} = useEntryRowSelection\(setupData/)
        assert.doesNotMatch(source, /\[selectedRows, setSelectedRows\] = useState/)
      }
    }
  }
})
