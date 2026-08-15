import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

const modules = [
  ['carding', 'carding-entry.js', 'addCardingEntryMachine'],
  ['breaker-drawing', 'breaker-drawing-entry.js', 'addBreakerDrawingEntryMachine'],
  ['comber', 'comber-entry.js', 'addComberEntryMachine'],
  ['finisher-drawing', 'finisher-drawing-entry.js', 'addFinisherDrawingEntryMachine'],
  ['lap-former', 'lapFormerEntryActions.js', 'addLapFormerEntryMachine'],
  ['simplex', 'simplexEntryActions.js', 'addSimplexEntryMachine'],
  ['spinning', 'spinning-entry.js', 'addSpinningEntryMachine'],
  ['autoconer', 'autoconerEntryActions.js', 'addAutoconerEntryMachine'],
]

test('all eight entry add actions use entry snapshots rather than mutating Machine Master', () => {
  for (const [, actionFile, entryFunction] of modules) {
    const source = read(`src/app/actions/${actionFile}`)
    assert.match(source, new RegExp(`queries\\.${entryFunction}\\(machineData\\)`))
  }

  const helper = read('src/lib/queries/entryMachineSnapshot.js')
  assert.match(helper, /Adds an existing Machine Master record to one entry snapshot/)
  assert.match(helper, /data: \{ is_included: false \}/)
  assert.doesNotMatch(helper, /tx\[models\.machine\]\.(create|update|delete)/)
})

test('entry snapshot schema enforces one header, detail and stoppage row per context', () => {
  const schema = read('prisma/schema.prisma')
  assert.equal((schema.match(/@@unique\(\[entry_date, shift\], name: "uq_/g) || []).length, 8)
  assert.equal((schema.match(/@@unique\(\[header_id, machine_id\], name: "uq_/g) || []).length, 8)
  assert.equal((schema.match(/@@unique\(\[production_detail_id\], name: "uq_/g) || []).length, 8)
  assert.equal((schema.match(/is_included\s+Boolean\s+@default\(true\)/g) || []).length, 8)

  for (const model of ['carding_machine_setup', 'breaker_drawing_machine_setup', 'lap_former_machine_setup']) {
    const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] || ''
    assert.match(block, /prodn_mixing\s+String\?/)
  }
})

test('bulk Count and Mixing controls remain browser drafts until final Update', () => {
  const componentFiles = [
    'CardingMachineSetupTab.jsx',
    'BreakerDrawingMachineSetupTab.jsx',
    'ComberMachineSetupTab.jsx',
    'FinisherDrawingMachineSetupTab.jsx',
    'LapFormerMachineSetupTab.jsx',
    'SimplexMachineSetupTab.jsx',
  ]

  for (const file of componentFiles) {
    const source = read(`src/components/modules/preparatory-entry/${file}`)
    assert.match(source, /Click Update to save\./)
    assert.doesNotMatch(source, /await bulkUpdate(?:MachineCount|BreakerDrawingMachineMixing|ComberMachineCount|FinisherDrawingMachineMixing|LapFormerMachineMixing|SimplexMachineCount)Action/)
  }


  const spinning = read('src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx')
  const spinningBulkHandler = spinning.match(/const handleCountChange = \(\) => \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  const hasOptionSelected/)?.[1] || ''
  assert.match(spinningBulkHandler, /Click Update to save\./)
  assert.doesNotMatch(spinningBulkHandler, /batchUpdateSpinningMachineSetupsAction/)

  const autoconer = read('src/components/modules/post-preparatory/autoconer/AutoconerMachineSetupTab.jsx')
  const autoconerBulkHandler = autoconer.match(/const handleBulkCountChange = \(\) => \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  \/\/ Save all changes/)?.[1] || ''
  assert.match(autoconerBulkHandler, /Click Update to save\./)
})

test('Carding count selection updates the controlled setup value and saves the exact setup row', () => {
  const source = read('src/components/modules/preparatory-entry/CardingMachineSetupTab.jsx')

  assert.match(source, /const updatedRow = \{\s*\.\.\.row,\s*prodn_mixing: value,/)
  assert.match(source, /updateMachineSetupAction\(rowId, changes, formattedDate, shift\)/)
  assert.doesNotMatch(source, /updateMachineSetupAction\(machineId \|\| rowId/)
  assert.match(source, /toast\.error\(error\?\.message \|\| 'Failed to save machine setups'\)/)
})

test('Carding Production reflects the effective Machine Setup count before and after tab switches', () => {
  const source = read('src/components/modules/preparatory-entry/CardingProductionTab.jsx')

  assert.match(source, /count_mixing: setup\?\.prodn_mixing \?\? mergedRow\.count_mixing/)
  assert.match(source, /count_mixing: setup\?\.prodn_mixing \?\? row\.count_mixing/)
})

test('failed multi-tab Updates retain the complete draft snapshot for a safe retry', () => {
  const pages = [
    'src/app/preparatory-entry/carding/entry/page.jsx',
    'src/app/preparatory-entry/breaker-drawing/entry/page.jsx',
    'src/app/preparatory-entry/comber/entry/page.jsx',
    'src/app/preparatory-entry/finisher-drawing/entry/page.jsx',
    'src/app/preparatory-entry/lap-former/entry/page.jsx',
    'src/app/preparatory-entry/simplex/entry/page.jsx',
    'src/app/post-preparatory/spinning/entry/page.jsx',
    'src/app/post-preparatory/autoconer/entry/page.jsx',
  ]

  for (const page of pages) {
    const source = read(page)
    assert.match(source, /const draftsAtSaveStart = sharedDraftsRef\.current/, page)
    assert.match(source, /(?:replaceAllDrafts|setSharedDrafts)\(draftsAtSaveStart\)/, page)
    assert.match(source, /drafts were retained/i, page)
  }
})

test('all entry tabs and pages read the synchronous latest draft before Update', () => {
  const pageFiles = [
    'src/app/preparatory-entry/carding/entry/page.jsx',
    'src/app/preparatory-entry/breaker-drawing/entry/page.jsx',
    'src/app/preparatory-entry/comber/entry/page.jsx',
    'src/app/preparatory-entry/finisher-drawing/entry/page.jsx',
    'src/app/preparatory-entry/lap-former/entry/page.jsx',
    'src/app/preparatory-entry/simplex/entry/page.jsx',
    'src/app/post-preparatory/spinning/entry/page.jsx',
    'src/app/post-preparatory/autoconer/entry/page.jsx',
  ]
  for (const page of pageFiles) {
    const source = read(page)
    assert.match(source, /sharedDraftsRef = useRef\(sharedDrafts\)/, page)
    assert.match(source, /dependencyDrafts: draftsAtSaveStart/, page)
    assert.match(source, /saveInFlightRef\.current/, page)
  }

  const tabFiles = [
    ...['Carding', 'BreakerDrawing', 'Comber', 'FinisherDrawing', 'LapFormer', 'Simplex']
      .flatMap(name => [`${name}ProductionTab.jsx`, `${name}MachineSetupTab.jsx`, `${name}StoppageTab.jsx`])
      .map(file => `src/components/modules/preparatory-entry/${file}`),
    ...['Spinning', 'Autoconer']
      .flatMap(name => [`${name}ProductionTab.jsx`, `${name}MachineSetupTab.jsx`, `${name}StoppageTab.jsx`])
      .map(file => `src/components/modules/post-preparatory/${file.startsWith('Spinning') ? 'spinning' : 'autoconer'}/${file}`),
  ]
  for (const tab of tabFiles) {
    const source = read(tab)
    assert.match(source, /getEditedCount: \(\) => Object\.keys\(editedRowsRef\.current/, tab)
  }
})

test('confirmed date or shift changes clear drafts before loading another entry', () => {
  const pages = [
    'src/app/preparatory-entry/carding/entry/page.jsx',
    'src/app/preparatory-entry/breaker-drawing/entry/page.jsx',
    'src/app/preparatory-entry/comber/entry/page.jsx',
    'src/app/preparatory-entry/finisher-drawing/entry/page.jsx',
    'src/app/preparatory-entry/lap-former/entry/page.jsx',
    'src/app/post-preparatory/spinning/entry/page.jsx',
    'src/app/post-preparatory/autoconer/entry/page.jsx',
  ]
  for (const page of pages) {
    const source = read(page)
    const dateHandler = source.match(/const handleDateChange[\s\S]*?(?=\r?\n  const handleShiftChange)/)?.[0] || ''
    const shiftHandler = source.match(/const handleShiftChange[\s\S]*?(?=\r?\n  const )/)?.[0] || ''
    assert.match(dateHandler, /(?:clearAllDrafts|replaceAllDrafts)\(/, page)
    assert.match(shiftHandler, /(?:clearAllDrafts|replaceAllDrafts)\(/, page)
  }
})

test('all eight entry pages warn before browser navigation with unsaved drafts', () => {
  const pages = [
    'src/app/preparatory-entry/carding/entry/page.jsx',
    'src/app/preparatory-entry/breaker-drawing/entry/page.jsx',
    'src/app/preparatory-entry/comber/entry/page.jsx',
    'src/app/preparatory-entry/finisher-drawing/entry/page.jsx',
    'src/app/preparatory-entry/lap-former/entry/page.jsx',
    'src/app/preparatory-entry/simplex/entry/page.jsx',
    'src/app/post-preparatory/spinning/entry/page.jsx',
    'src/app/post-preparatory/autoconer/entry/page.jsx',
  ]

  for (const page of pages) {
    assert.match(read(page), /useUnsavedChangesWarning\(/, page)
  }
})

test('entry update validation excludes ownership, audit, lock and inclusion fields', () => {
  const source = read('src/lib/queries/entryUpdateValidation.js')
  const setupFields = source.match(/const SETUP_FIELDS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || ''
  for (const forbidden of ['machine_id', 'entry_date', 'shift', 'created_at', 'updated_at', 'is_included']) {
    assert.doesNotMatch(setupFields, new RegExp(`['"]${forbidden}['"]`))
  }
})

test('integrity migrations preserve historical rows and backfill missing stoppages', () => {
  const integrity = read('prisma/migrations/20260816_entry_snapshot_integrity/migration.sql')
  const countSnapshot = read('prisma/migrations/20260817_entry_count_snapshot/migration.sql')
  assert.equal((integrity.match(/ADD UNIQUE KEY uq_/g) || []).length, 24)
  assert.equal((integrity.match(/INSERT INTO [a-z_]+_stoppage_entry/g) || []).length, 8)
  assert.match(countSnapshot, /detail_row\.`count_mixing`/)
  assert.equal((countSnapshot.match(/ADD COLUMN `prodn_mixing`/g) || []).length, 3)
})
