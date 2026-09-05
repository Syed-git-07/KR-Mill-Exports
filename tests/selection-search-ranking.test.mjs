import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  normalizeSelectionSearch,
  rankSelectionResults,
  selectionMatchRank,
} from '../src/lib/selectionSearch.js'

test('selection search ranks exact and beginning-of-name matches before later matches', () => {
  const people = [
    { name: 'AMESH KUMAR' },
    { name: 'RAVI ESWAR' },
    { name: 'ESHWAR' },
    { name: 'ES' },
    { name: 'DESAI' },
  ]

  const ranked = rankSelectionResults(people, 'es', {
    getPrimaryText: (person) => person.name,
  })

  assert.deepEqual(ranked.map((person) => person.name), [
    'ES',
    'ESHWAR',
    'RAVI ESWAR',
    'AMESH KUMAR',
    'DESAI',
  ])
})

test('primary labels rank ahead of metadata while metadata remains searchable', () => {
  const reasons = [
    { name: 'POWER FAILURE', code: 'ES', category: 'ELECTRICAL' },
    { name: 'ES STOP', code: 'ZZ', category: 'GENERAL' },
    { name: 'FRAME ES ISSUE', code: 'AA', category: 'MECHANICAL' },
  ]

  const ranked = rankSelectionResults(reasons, 'es', {
    getPrimaryText: (reason) => reason.name,
    getSecondaryTexts: (reason) => [reason.code, reason.category],
  })

  assert.deepEqual(ranked.map((reason) => reason.name), [
    'ES STOP',
    'FRAME ES ISSUE',
    'POWER FAILURE',
  ])
})

test('selection search is case, spacing, accent and punctuation tolerant', () => {
  assert.equal(normalizeSelectionSearch('  ÉS-WAR  '), 'es war')
  assert.equal(selectionMatchRank('su du', 'SU-DU COUNT'), 1)
  assert.equal(selectionMatchRank('idle', 'MACHINE STOP', ['Idle Drum']), 4)
  assert.equal(selectionMatchRank('missing', 'MACHINE STOP', ['Idle Drum']), null)
})

test('payroll search prioritizes first-name prefixes before middle, last and contains matches', async () => {
  const source = await readFile(path.resolve('src/lib/payroll/employees.js'), 'utf8')

  assert.match(source, /CASE[\s\S]*?WHEN e\.firstName LIKE \$\{prefixTerm\}[\s\S]*?THEN 1/)
  assert.match(source, /middleName[\s\S]*?LIKE \$\{prefixTerm\}[\s\S]*?lastName[\s\S]*?LIKE \$\{prefixTerm\} THEN 2/)
  assert.match(source, /ELSE 4[\s\S]*?END ASC/)
  assert.match(source, /ORDER BY \$\{priorityClause\} e\.firstName ASC/)
})
