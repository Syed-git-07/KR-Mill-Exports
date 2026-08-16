import test from 'node:test'
import assert from 'node:assert/strict'

import { compareMachineNumbers } from '../src/lib/machineNumberSort.js'

test('machine numbers use natural numeric order instead of insertion order', () => {
  const machineNumbers = ['LF100', 'LF2', 'LF48', 'LF1']
  assert.deepEqual(machineNumbers.sort(compareMachineNumbers), ['LF1', 'LF2', 'LF48', 'LF100'])
})

test('machine number suffixes remain deterministic', () => {
  const machineNumbers = ['LF2B', 'LF2', 'LF2A']
  assert.deepEqual(machineNumbers.sort(compareMachineNumbers), ['LF2', 'LF2A', 'LF2B'])
})
