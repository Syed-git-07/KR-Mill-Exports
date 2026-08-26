import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = path => readFileSync(join(root, path), 'utf8')

const modelBlock = (schema, model) =>
  schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] || ''

test('all production waste columns default to zero while setup waste stays optional', () => {
  const schema = read('prisma/schema.prisma')
  const productionModels = [
    ['autoconer_production_detail', 'waste_kg'],
    ['breaker_drawing_production_detail', 'waste'],
    ['carding_production_detail', 'waste'],
    ['comber_production_detail', 'waste'],
    ['finisher_drawing_production_detail', 'waste'],
    ['lap_former_production_detail', 'waste'],
    ['simplex_production_detail', 'waste'],
    ['spinning_production_detail', 'waste'],
  ]

  for (const [model, field] of productionModels) {
    const block = modelBlock(schema, model)
    assert.match(block, new RegExp(`\\b${field}\\s+Decimal\\?\\s+@default\\(0\\.0000\\)`), model)
  }

  for (const model of [
    'breaker_drawing_machine_setup',
    'carding_machine_setup',
    'comber_machine_setup',
    'finisher_drawing_machine_setup',
    'lap_former_machine_setup',
    'simplex_machine_setup',
  ]) {
    const defaultWasteLine = modelBlock(schema, model)
      .split(/\r?\n/)
      .find(line => /\bdefault_waste\b/.test(line)) || ''
    assert.match(defaultWasteLine, /default_waste\s+Decimal\?/, model)
    assert.doesNotMatch(defaultWasteLine, /@default\(/, model)
  }
})

test('entry initialization never copies setup default waste into actual production', () => {
  const sources = [
    'src/lib/queries/autoconerEntryQueries.js',
    'src/lib/queries/breakerDrawingQueries.js',
    'src/lib/queries/cardingEntryQueries.js',
    'src/lib/queries/comberEntryQueries.js',
    'src/lib/queries/finisherDrawingEntryQueries.js',
    'src/lib/queries/lapFormerQueries.js',
    'src/lib/queries/simplexEntryQueries.js',
    'src/lib/queries/spinningEntryQueries.js',
  ].map(read)

  for (const source of sources) {
    assert.doesNotMatch(source, /waste:\s*setup\.default_waste/, 'actual waste must not inherit setup.default_waste')
  }

  assert.ok((sources[0].match(/waste_kg:\s*0/g) || []).length >= 2, 'Autoconer initialize and sync')
  assert.ok((sources[2].match(/const wasteVal = 0/g) || []).length >= 2, 'Carding initialize and sync')
  for (const [index, module] of [[1, 'Breaker'], [3, 'Comber'], [4, 'Finisher'], [5, 'Lap Former'], [6, 'Simplex'], [7, 'Spinning']]) {
    assert.ok((sources[index].match(/waste:\s*0/g) || []).length >= 2, `${module} initialize and sync`)
  }
})

test('preparatory formula helpers use current actual waste, never setup default waste', () => {
  for (const file of [
    'src/lib/queries/breakerDrawingQueries.js',
    'src/lib/queries/cardingEntryQueries.js',
    'src/lib/queries/lapFormerQueries.js',
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /currentWaste\s*\?\?\s*setup\?\.default_waste/, file)
    assert.doesNotMatch(source, /const waste(?:Value)?\s*=\s*setup\?\.default_waste/, file)
  }
})
