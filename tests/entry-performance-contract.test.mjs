import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = path => readFileSync(join(root, path), 'utf8')

const entryModules = [
  {
    actionFile: 'carding-entry.js',
    readAction: 'getCardingEntryTabDataAction',
    batchAction: 'runCardingEntryBatchAction',
    components: ['CardingMachineSetupTab.jsx', 'CardingProductionTab.jsx', 'CardingStoppageTab.jsx'],
  },
  {
    actionFile: 'breaker-drawing-entry.js',
    readAction: 'getBreakerDrawingEntryTabDataAction',
    batchAction: 'runBreakerDrawingEntryBatchAction',
    components: ['BreakerDrawingMachineSetupTab.jsx', 'BreakerDrawingProductionTab.jsx', 'BreakerDrawingStoppageTab.jsx'],
  },
  {
    actionFile: 'comber-entry.js',
    readAction: 'getComberEntryTabDataAction',
    batchAction: 'runComberEntryBatchAction',
    components: ['ComberMachineSetupTab.jsx', 'ComberProductionTab.jsx', 'ComberStoppageTab.jsx'],
  },
  {
    actionFile: 'finisher-drawing-entry.js',
    readAction: 'getFinisherDrawingEntryTabDataAction',
    batchAction: 'runFinisherDrawingEntryBatchAction',
    components: ['FinisherDrawingMachineSetupTab.jsx', 'FinisherDrawingProductionTab.jsx', 'FinisherDrawingStoppageTab.jsx'],
  },
  {
    actionFile: 'lapFormerEntryActions.js',
    readAction: 'getLapFormerEntryTabDataAction',
    batchAction: 'runLapFormerEntryBatchAction',
    components: ['LapFormerMachineSetupTab.jsx', 'LapFormerProductionTab.jsx', 'LapFormerStoppageTab.jsx'],
  },
  {
    actionFile: 'simplexEntryActions.js',
    readAction: 'getSimplexEntryTabDataAction',
    batchAction: 'runSimplexEntryBatchAction',
    components: ['SimplexMachineSetupTab.jsx', 'SimplexProductionTab.jsx', 'SimplexStoppageTab.jsx'],
  },
]

const postEntryModules = [
  {
    folder: 'spinning',
    actionFile: 'spinning-entry.js',
    readAction: 'getSpinningEntryTabDataAction',
    batchAction: 'runSpinningEntryBatchAction',
    components: ['SpinningMachineSetupTab.jsx', 'SpinningProductionTab.jsx', 'SpinningStoppageTab.jsx'],
  },
  {
    folder: 'autoconer',
    actionFile: 'autoconerEntryActions.js',
    readAction: 'getAutoconerEntryTabDataAction',
    batchAction: 'runAutoconerEntryBatchAction',
    components: ['AutoconerMachineSetupTab.jsx', 'AutoconerProductionTab.jsx', 'AutoconerStoppageTab.jsx'],
  },
]

test('all eight entry modules consolidate each tab load into one Server Action request', () => {
  for (const entryModule of [...entryModules, ...postEntryModules]) {
    const actionSource = read(`src/app/actions/${entryModule.actionFile}`)
    assert.match(actionSource, new RegExp(`export async function ${entryModule.readAction}\\(`), entryModule.actionFile)
    assert.match(actionSource, /if \(tab === 'setup'\)/, entryModule.actionFile)
    assert.match(actionSource, /if \(tab === 'production'\)/, entryModule.actionFile)
    assert.match(actionSource, /if \(tab === 'stoppage'\)/, entryModule.actionFile)

    for (const component of entryModule.components) {
      const path = entryModule.folder
        ? `src/components/modules/post-preparatory/${entryModule.folder}/${component}`
        : `src/components/modules/preparatory-entry/${component}`
      assert.match(read(path), new RegExp(`${entryModule.readAction}\\('(?:setup|production|stoppage)'`), path)
    }
  }
})

test('multi-row entry writes and removals no longer create one browser request per row', () => {
  for (const entryModule of [...entryModules, ...postEntryModules]) {
    const actionSource = read(`src/app/actions/${entryModule.actionFile}`)
    assert.match(actionSource, new RegExp(`export async function ${entryModule.batchAction}\\(`), entryModule.actionFile)
    assert.match(
      actionSource,
      /(?:const results = await Promise\.all\(items\.map\(handler\)\)|for \(const item of items\))/,
      entryModule.actionFile,
    )
  }

  const componentPaths = [
    ...entryModules.flatMap(entryModule => entryModule.components.map(component =>
      `src/components/modules/preparatory-entry/${component}`)),
    ...postEntryModules.flatMap(entryModule => entryModule.components.map(component =>
      `src/components/modules/post-preparatory/${entryModule.folder}/${component}`)),
  ]

  for (const path of componentPaths) {
    const source = read(path)
    assert.doesNotMatch(
      source,
      /Promise\.all\((?:updatePromises|removePromises|productionUpdatePromises|promises)/,
      path,
    )
  }
})

test('tab saves use one parent refresh instead of loading the same source tab twice', () => {
  const componentPaths = [
    ...entryModules.flatMap(entryModule => entryModule.components.map(component =>
      `src/components/modules/preparatory-entry/${component}`)),
    ...postEntryModules.flatMap(entryModule => entryModule.components.map(component =>
      `src/components/modules/post-preparatory/${entryModule.folder}/${component}`)),
  ]

  for (const path of componentPaths) {
    const source = read(path)
    assert.doesNotMatch(source, /await loadData\([^\n]*\)\r?\n\s+onRefresh\?\.\(\)/, path)
    assert.doesNotMatch(source, /await loadData\(\)\r?\n\s+onRefresh\?\.\(\)/, path)
  }
})
