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
  assert.match(helper, /buildSetupFromMachineMaster\(moduleName, machine, header\)/)
  assert.doesNotMatch(helper, /const inherited = source/)
})

test('all Add Master Machine dialogs look up Master values before entry creation', () => {
  const dialogs = [
    'src/components/modules/preparatory-entry/CardingMachineSetupTab.jsx',
    'src/components/modules/preparatory-entry/BreakerDrawingMachineSetupTab.jsx',
    'src/components/modules/preparatory-entry/ComberMachineSetupTab.jsx',
    'src/components/modules/preparatory-entry/FinisherDrawingMachineSetupTab.jsx',
    'src/components/modules/preparatory-entry/LapFormerMachineSetupTab.jsx',
    'src/components/modules/preparatory-entry/SimplexMachineSetupTab.jsx',
    'src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx',
    'src/components/modules/post-preparatory/autoconer/AutoconerMachineSetupTab.jsx'
  ]

  for (const file of dialogs) {
    const source = read(file)
    assert.match(source, /handleMachineNoLookup/)
    assert.match(source, /onBlur=\{\(e\) => handleMachineNoLookup/)
  }
})

test('Carding and Autoconer do not auto-enroll newly created Master machines', () => {
  const carding = read('src/lib/queries/cardingEntryQueries.js')
  const autoconer = read('src/lib/queries/autoconerEntryQueries.js')

  assert.doesNotMatch(carding, /missingSetups\s*=\s*missingMachines\.map/)
  assert.doesNotMatch(carding, /allDataToInsert\s*=\s*\[\.\.\.cloneData,\s*\.\.\.missingSetups\]/)
  assert.doesNotMatch(autoconer, /activeMachines\.forEach\(machine\s*=>\s*\{[\s\S]*?cloneDataMap\.set/)
  assert.match(carding, /data:\s*cloneData/)
  assert.match(autoconer, /const cloneData = Array\.from\(cloneDataMap\.values\(\)\)/)
})

test('new Spinning Master machines start with an empty installed date', () => {
  const source = read('src/components/modules/masters/SpinningMachineForm.jsx')
  assert.match(source, /installed_date:\s*'',/)
  assert.doesNotMatch(source, /installed_date:\s*'2015-04-01'/)
})

test('run storage remains migration-compatible while Count Change is restricted in application code', () => {
  const schema = read('prisma/schema.prisma')
  assert.equal((schema.match(/@@unique\(\[entry_date, shift\], name: "uq_/g) || []).length, 8)
  assert.equal((schema.match(/@@unique\(\[header_id, machine_id, run_sequence\], name: "uq_/g) || []).length, 8)
  assert.equal((schema.match(/@@unique\(\[machine_id, entry_date, shift, run_sequence\], name: "idx_/g) || []).length, 8)
  assert.equal((schema.match(/@@unique\(\[production_detail_id\], name: "uq_/g) || []).length, 8)
  assert.equal((schema.match(/is_included\s+Boolean\s+@default\(true\)/g) || []).length, 8)

  for (const model of ['carding_machine_setup', 'breaker_drawing_machine_setup', 'lap_former_machine_setup']) {
    const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] || ''
    assert.match(block, /prodn_mixing\s+String\?/)
  }
})

test('split Count Change is exposed only by the selected-row Spinning workflow', () => {
  const spinning = read('src/components/modules/post-preparatory/spinning/SpinningMachineSetupTab.jsx')
  assert.match(spinning, /changeEntryMachineCountRunAction\('spinning'/)
  assert.match(spinning, /selectedRows\.length !== 1/)
  assert.match(spinning, /has_multiple_runs/)

  for (const [folder, file] of [
    ['preparatory-entry', 'CardingMachineSetupTab.jsx'],
    ['preparatory-entry', 'BreakerDrawingMachineSetupTab.jsx'],
    ['preparatory-entry', 'ComberMachineSetupTab.jsx'],
    ['preparatory-entry', 'FinisherDrawingMachineSetupTab.jsx'],
    ['preparatory-entry', 'LapFormerMachineSetupTab.jsx'],
    ['preparatory-entry', 'SimplexMachineSetupTab.jsx'],
    ['post-preparatory/autoconer', 'AutoconerMachineSetupTab.jsx'],
  ]) assert.doesNotMatch(read(`src/components/modules/${folder}/${file}`), /ChangeCountRunButton/)

  const helper = read('src/lib/queries/entryMachineSnapshot.js')
  assert.match(helper, /Only the latest count run can be changed/)
  assert.match(helper, /run_sequence: nextSequence/)
  assert.match(helper, /buildSpinningCountSnapshot/)
  assert.match(helper, /Count Change is supported only for Spinning entries/)
  assert.match(spinning, /countId: selectedCount\.id/)
  assert.match(helper, /where: \{ id: countId, is_active: true \}/)
  assert.match(helper, /work_time: elapsed - currentStoppageTime/)
  assert.match(helper, /const remaining = currentRuntime - elapsed/)
})

test('Spinning carries only the latest count into the next entry and refreshes machine defaults', () => {
  const source = read('src/lib/queries/spinningEntryQueries.js')
  assert.match(source, /run_sequence: 'desc'/)
  assert.match(source, /if \(!latestByMachine\.has\(row\.machine_id\)\)/)
  assert.match(source, /buildSpinningCountSnapshot\(count, \{ machineSpeed: machine\?\.speed \}\)/)
  assert.match(source, /run_sequence: 1/)
  assert.match(source, /run_time: targetShiftTime/)
})

test('all initialization families copy one exact prior entry and preserve its count selection', () => {
  const shared = read('src/lib/queries/dateScopedMachineSetup.js')
  const carding = read('src/lib/queries/cardingEntryQueries.js')
  const spinning = read('src/lib/queries/spinningEntryQueries.js')
  const autoconer = read('src/lib/queries/autoconerEntryQueries.js')

  assert.match(shared, /findPreviousEntrySetupSnapshot/)
  assert.doesNotMatch(shared, /Promise\.all\(\(idsToMaterialize/)
  for (const source of [carding, spinning, autoconer]) {
    assert.match(source, /findPreviousEntrySetupSnapshot/)
  }

  for (const file of [
    'breakerDrawingQueries.js',
    'comberEntryQueries.js',
    'finisherDrawingEntryQueries.js',
    'lapFormerQueries.js',
    'simplexEntryQueries.js'
  ]) {
    const source = read(`src/lib/queries/${file}`)
    const overrideBlocks = [...source.matchAll(/machineSetupOverridesMap\[m\.id\]\s*=\s*\{([\s\S]*?)\n\s*\}/g)]
    assert.ok(overrideBlocks.length > 0, file)
    for (const block of overrideBlocks) {
      assert.doesNotMatch(block[1], /prodn_mixing/, file)
    }
  }

  assert.match(spinning, /countById\.get\(source\.count_id\) \|\| countByName\.get\(source\.count_name\)/)
  assert.match(autoconer, /countById\.get\(s\.count_id\) \|\| countByName\.get\(s\.count_name\)/)
})

test('new entries reset operational values and historical Finisher setup visibility is date-scoped', () => {
  const carding = read('src/lib/queries/cardingEntryQueries.js')
  const finisher = read('src/lib/queries/finisherDrawingEntryQueries.js')

  assert.doesNotMatch(carding, /getCardingInheritedMachineSetups/)
  assert.match(carding, /const sessionNo = 1/)
  assert.match(carding, /const wasteVal = setup\.default_waste \?\? null/)
  assert.match(finisher, /Historical entry grids use lifecycle state on the entry date/)
  assert.match(finisher, /deactivated_at: \{ gt: header\.entry_date \}/)
})

test('every separately initialized preparatory page rejects a failed detail initialization', () => {
  for (const file of [
    'src/app/preparatory-entry/carding/entry/page.jsx',
    'src/app/preparatory-entry/breaker-drawing/entry/page.jsx',
    'src/app/preparatory-entry/comber/entry/page.jsx',
    'src/app/preparatory-entry/finisher-drawing/entry/page.jsx',
    'src/app/preparatory-entry/lap-former/entry/page.jsx',
    'src/app/preparatory-entry/simplex/entry/page.jsx'
  ]) {
    const source = read(file)
    assert.match(source, /if \(!init(?:ialization)?Result\.success\)/, file)
  }
})

test('Spinning count-run time and count stay distinct across all three tabs', () => {
  const actions = read('src/app/actions/spinning-entry.js')
  const queries = read('src/lib/queries/spinningEntryQueries.js')
  const production = read('src/components/modules/post-preparatory/spinning/SpinningProductionTab.jsx')
  const stoppage = read('src/components/modules/post-preparatory/spinning/SpinningStoppageTab.jsx')

  assert.doesNotMatch(actions, /run_time:\s*shiftTime/)
  assert.match(queries, /setupMap\[`\$\{s\.machine_id\}:\$\{runSequence\}`\] = s/)
  assert.match(production, /normalizedRow\.run_time \?\? effectiveSetup\?\.run_time/)
  assert.match(production, /resolveProductionTime\(rowRunTime, requestedStoppageMins\)/)
  assert.match(production, /onMachineSetupFieldChange/)
  assert.match(stoppage, /mergedRow\.run_time \?\? effectiveTotalTime/)
  assert.match(stoppage, /findSetupDraftForMachine\(row\.machine_id, row\.setup_id\)/)
  assert.match(stoppage, /onMachineSetupFieldChange/)
})

test('re-adding an excluded machine normalizes its local run structure before detail sync', () => {
  const helper = read('src/lib/queries/entryMachineSnapshot.js')
  assert.match(helper, /const setupRows = await tx\[models\.setup\]\.findMany/)
  assert.match(helper, /const redundantIds = setupRows\.filter/)
  assert.match(helper, /data: \{ \.\.\.safeOverrides, run_sequence: 1, is_included: true \}/)
  assert.match(helper, /staleDetails = await tx\[models\.detail\]\.findMany/)
})

test('all Autoconer add paths use the entry snapshot and direct setup deletion is unavailable', () => {
  const component = read('src/components/modules/post-preparatory/autoconer/AutoconerMachineSetupTab.jsx')
  const actions = read('src/app/actions/autoconerEntryActions.js')
  const queries = read('src/lib/queries/autoconerEntryQueries.js')

  assert.doesNotMatch(component, /upsertAutoconerMachineSetupAction/)
  assert.ok((component.match(/addAutoconerMachineAction\(/g) || []).length >= 2)
  assert.doesNotMatch(actions, /removeAutoconerMachineSetupsAction/)
  assert.doesNotMatch(queries, /export async function removeAutoconerMachineSetups/)
})

test('Spinning bulk stoppage is atomic and targets only the current count run', () => {
  const queries = read('src/lib/queries/spinningEntryQueries.js')
  assert.match(queries, /export async function applyFullStoppage[\s\S]*?return prisma\.\$transaction\(async tx =>/)
  assert.match(queries, /export async function applyPartialStoppage[\s\S]*?return prisma\.\$transaction\(async tx =>/)
  assert.match(queries, /const latestByMachine = new Map\(\)/)
  assert.doesNotMatch(queries, /export async function removeSpinningMachineSetups/)
})

test('all eight machine lookups are entry-date scoped and accept floor names', () => {
  const lifecycle = read('src/lib/machineLifecycle.js')
  assert.match(lifecycle, /description: \{ equals: value \}/)
  assert.match(lifecycle, /machineAvailableOnDateWhere\(entryDate\)/)

  for (const [, actionFile] of modules) {
    const action = read(`src/app/actions/${actionFile}`)
    assert.match(action, /MachineByNoAction\(machineNo, entryDate = null\)/)
    assert.match(action, /MachineByNo\(machineNo, entryDate\)/)
  }
})

test('adding a Spinning Master machine normalizes an empty count foreign key to null', () => {
  const source = read('src/lib/queries/spinningEntryQueries.js')
  assert.match(source, /count_id: selectedCount\?\.id \?\? null/)
  assert.match(source, /count_name: selectedCount\?\.count_name \?\? null/)
})

test('forward repair preserves legacy rows after the rejected destructive collapse', () => {
  const migration = read('prisma/migrations/20260820_spinning_only_count_runs/migration.sql')
  assert.doesNotMatch(migration, /DROP COLUMN `run_sequence`/)
  assert.match(migration, /autoconer_machine_setup.*ADD COLUMN `run_sequence`/)
  assert.match(migration, /breaker_drawing_machine_setup.*ADD COLUMN `run_sequence`/)
  assert.doesNotMatch(migration, /ALTER TABLE `spinning_/)
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


  const autoconer = read('src/components/modules/post-preparatory/autoconer/AutoconerMachineSetupTab.jsx')
  const autoconerBulkHandler = autoconer.match(/const handleBulkCountChange = \(\) => \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  \/\/ Save all changes/)?.[1] || ''
  assert.match(autoconerBulkHandler, /Click Update to save\./)
})

test('Carding count selection updates the controlled setup value and saves the exact setup row', () => {
  const source = read('src/components/modules/preparatory-entry/CardingMachineSetupTab.jsx')

  assert.match(source, /const updatedRow = \{\s*\.\.\.row,\s*prodn_mixing: value,/)
  assert.match(source, /return \{ id: rowId, updates: changes, entryDate: formattedDate, shift \}/)
  assert.match(source, /runCardingEntryBatchAction\('setup-update', updates\)/)
  assert.doesNotMatch(source, /id: machineId \|\| rowId/)
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
