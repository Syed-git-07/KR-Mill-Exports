import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

import { Prisma } from '@prisma/client'
import { parse } from 'espree'

const queryDirectory = new URL('../src/lib/queries/', import.meta.url)
const prismaModels = new Set(Prisma.dmmf.datamodel.models.map(model => model.name))
const fieldsByModel = new Map(
  Prisma.dmmf.datamodel.models.map(model => [
    model.name,
    new Set(model.fields.map(field => field.name))
  ])
)

function propertyName(property) {
  if (!property.computed && property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'Literal') return String(property.key.value)
  return null
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return
  callback(node)

  for (const [key, child] of Object.entries(node)) {
    if (key === 'loc' || key === 'range' || key === 'parent') continue
    if (Array.isArray(child)) {
      child.forEach(item => visit(item, callback))
    } else if (child?.type) {
      visit(child, callback)
    }
  }
}

test('query modules only call Prisma delegates that exist in the generated client', async () => {
  const files = (await readdir(queryDirectory)).filter(file => file.endsWith('.js'))
  const invalidDelegates = []

  for (const file of files) {
    const source = await readFile(new URL(file, queryDirectory), 'utf8')
    const delegatePattern = /\b(?:prisma|tx)\.([A-Za-z_]\w*)\s*\./g

    for (const match of source.matchAll(delegatePattern)) {
      const delegate = match[1]
      if (!prismaModels.has(delegate)) {
        invalidDelegates.push(`${file}: prisma.${delegate}`)
      }
    }
  }

  assert.deepEqual(invalidDelegates, [], invalidDelegates.join('\n'))
})

test('literal Prisma write fields exist on their target model', async () => {
  const files = (await readdir(queryDirectory)).filter(file => file.endsWith('.js'))
  const invalidFields = []

  for (const file of files) {
    const source = await readFile(new URL(file, queryDirectory), 'utf8')
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module', loc: true })

    visit(tree, node => {
      if (node.type !== 'CallExpression' || node.callee?.type !== 'MemberExpression') return

      const method = node.callee.property?.name
      const delegate = node.callee.object
      const model = delegate?.property?.name
      const owner = delegate?.object?.name
      if (!['prisma', 'tx'].includes(owner) || !fieldsByModel.has(model)) return
      if (!['create', 'createMany', 'update', 'updateMany', 'upsert'].includes(method)) return

      const options = node.arguments[0]
      if (options?.type !== 'ObjectExpression') return

      for (const option of options.properties) {
        if (option.type !== 'Property') continue
        const section = propertyName(option)
        if (!['data', 'create', 'update'].includes(section)) continue
        if (option.value.type !== 'ObjectExpression') continue

        for (const field of option.value.properties) {
          if (field.type !== 'Property' || field.computed) continue
          const name = propertyName(field)
          if (name && !fieldsByModel.get(model).has(name)) {
            invalidFields.push(`${file}:${field.loc.start.line} prisma.${model}.${method} ${section}.${name}`)
          }
        }
      }
    })
  }

  assert.deepEqual(invalidFields, [], invalidFields.join('\n'))
})

test('production-detail allowlists match every client-editable Prisma scalar', async () => {
  const { sanitizeProductionDetailUpdate } = await import(
    '../src/lib/queries/productionDetailUpdate.js'
  )
  const productionModels = [...prismaModels].filter(model => model.endsWith('_production_detail'))
  const serverManagedFields = new Set(['id', 'header_id', 'machine_id', 'created_at', 'updated_at'])

  for (const modelName of productionModels) {
    const model = Prisma.dmmf.datamodel.models.find(candidate => candidate.name === modelName)
    const scalarFields = model.fields
      .filter(field => field.kind === 'scalar' && !serverManagedFields.has(field.name))
      .map(field => field.name)
      .sort()
    const sample = Object.fromEntries(model.fields.map(field => [field.name, 1]))
    const sanitizedFields = Object.keys(
      sanitizeProductionDetailUpdate(modelName, sample)
    ).sort()

    assert.deepEqual(sanitizedFields, scalarFields, `${modelName} allowlist drifted from schema.prisma`)
  }
})

test('production-header allowlists match every client-editable Prisma scalar', async () => {
  const { sanitizeProductionHeaderUpdate } = await import(
    '../src/lib/queries/productionDetailUpdate.js'
  )
  const headerModels = [...prismaModels].filter(model => model.endsWith('_production_header'))
  const serverManagedFields = new Set([
    'id',
    'entry_id',
    'entry_date',
    'shift',
    'created_at',
    'updated_at'
  ])

  for (const modelName of headerModels) {
    const model = Prisma.dmmf.datamodel.models.find(candidate => candidate.name === modelName)
    const scalarFields = model.fields
      .filter(field => field.kind === 'scalar' && !serverManagedFields.has(field.name))
      .map(field => field.name)
      .sort()
    const sample = Object.fromEntries(model.fields.map(field => [field.name, 1]))
    const sanitizedFields = Object.keys(
      sanitizeProductionHeaderUpdate(modelName, sample)
    ).sort()

    assert.deepEqual(sanitizedFields, scalarFields, `${modelName} allowlist drifted from schema.prisma`)
  }
})

test('server-action serialization emits plain numbers, dates, and nested values', async () => {
  const { serializeData } = await import('../src/lib/serialize.js')
  const date = new Date('2026-08-03T00:00:00.000Z')

  assert.deepEqual(
    serializeData({
      amount: new Prisma.Decimal('15.20'),
      date,
      nested: [new Prisma.Decimal('0.85'), undefined],
      sequence: 10n,
      ignored: undefined
    }),
    {
      amount: 15.2,
      date: '2026-08-03T00:00:00.000Z',
      nested: [0.85, null],
      sequence: '10'
    }
  )
})
