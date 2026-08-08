import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('autoconer default setup creation tolerates concurrent initialization', async () => {
  const source = await readFile(
    path.resolve('src/lib/queries/autoconerEntryQueries.js'),
    'utf8'
  )
  const defaultSetupBranch = source.match(
    /if \(defaultSetups\.length > 0\) \{([\s\S]*?)\n    \}/
  )

  assert.ok(defaultSetupBranch, 'default machine setup creation branch should exist')
  assert.match(defaultSetupBranch[1], /createMany\(\{[\s\S]*?data: defaultSetups,[\s\S]*?skipDuplicates: true/)
})
