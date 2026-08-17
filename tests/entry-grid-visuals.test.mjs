import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

const entryGridFiles = [
  'src/components/modules/preparatory-entry/BreakerDrawingProductionTab.jsx',
  'src/components/modules/preparatory-entry/BreakerDrawingStoppageTab.jsx',
  'src/components/modules/preparatory-entry/BreakerDrawingMachineSetupTab.jsx',
  'src/components/modules/preparatory-entry/CardingProductionTab.jsx',
  'src/components/modules/preparatory-entry/CardingStoppageTab.jsx',
  'src/components/modules/preparatory-entry/CardingMachineSetupTab.jsx',
  'src/components/modules/preparatory-entry/ComberProductionTab.jsx',
  'src/components/modules/preparatory-entry/ComberStoppageTab.jsx',
  'src/components/modules/preparatory-entry/ComberMachineSetupTab.jsx',
  'src/components/modules/preparatory-entry/FinisherDrawingProductionTab.jsx',
  'src/components/modules/preparatory-entry/FinisherDrawingStoppageTab.jsx',
  'src/components/modules/preparatory-entry/FinisherDrawingMachineSetupTab.jsx',
  'src/components/modules/preparatory-entry/LapFormerProductionTab.jsx',
  'src/components/modules/preparatory-entry/LapFormerStoppageTab.jsx',
  'src/components/modules/preparatory-entry/LapFormerMachineSetupTab.jsx',
  'src/components/modules/preparatory-entry/SimplexProductionTab.jsx',
  'src/components/modules/preparatory-entry/SimplexStoppageTab.jsx',
  'src/components/modules/preparatory-entry/SimplexMachineSetupTab.jsx',
  'src/components/modules/post-preparatory/autoconer/AutoconerProductionTab.jsx',
  'src/components/modules/post-preparatory/autoconer/AutoconerStoppageTab.jsx',
  'src/components/modules/post-preparatory/autoconer/AutoconerMachineSetupTab.jsx',
  'src/components/modules/post-preparatory/spinning/SpinningProductionTab.jsx',
  'src/components/modules/post-preparatory/spinning/SpinningStoppageTab.jsx',
  'src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx',
]

test('all 24 entry grids use the shared semantic table styling', async () => {
  assert.equal(entryGridFiles.length, 24)

  for (const relativePath of entryGridFiles) {
    const source = await readFile(path.join(root, relativePath), 'utf8')
    const tableCount = source.match(/<table\b/g)?.length ?? 0
    const styledTableCount = source.match(/<table\b[^>]*className="[^"]*\bentry-data-grid\b[^"]*"/g)?.length ?? 0

    assert.equal(tableCount, 1, `${relativePath} should expose one entry grid`)
    assert.equal(styledTableCount, tableCount, `${relativePath} must use entry-data-grid`)
  }
})

test('entry grid CSS distinguishes editable and fixed cells without replacing alert colors', async () => {
  const css = await readFile(path.join(root, 'src/app/globals.css'), 'utf8')

  assert.match(css, /\.entry-data-grid tbody td:has\(/)
  assert.match(css, /input:not\(:disabled\):not\(\[readonly\]\)/)
  assert.match(css, /button\[role="combobox"\]:not\(:disabled\)/)
  assert.match(css, /\.entry-data-grid tbody tr:nth-child\(odd\) > td/)
  assert.match(css, /\.entry-data-grid tbody tr:nth-child\(even\) > td/)
  assert.match(css, /border-color: #94a3b8 !important/)
  assert.doesNotMatch(css, /\.entry-data-grid[^}]*text-red-600/)
})
