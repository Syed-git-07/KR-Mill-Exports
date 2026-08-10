import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const MASTER_PAGES = [
  ['src/app/preparatory-master/carding-machine/page.jsx', 'getCardingMachinePageDataAction'],
  ['src/app/preparatory-master/drawing-breaker/page.jsx', 'getDrawingBreakerPageDataAction'],
  ['src/app/preparatory-master/comber/page.jsx', 'getComberMachinePageDataAction'],
  ['src/app/preparatory-master/drawing-finisher/page.jsx', 'getDrawingFinisherPageDataAction'],
  ['src/app/preparatory-master/lap-former/page.jsx', 'getLapFormerPageDataAction'],
  ['src/app/preparatory-master/simplex/page.jsx', 'getSimplexMachinePageDataAction']
]

test('preparatory machine masters use one initial server action', async () => {
  for (const [relativePath, actionName] of MASTER_PAGES) {
    const source = await readFile(path.resolve(relativePath), 'utf8')
    const loadBlock = source.match(/const loadMachines = async \(\) => \{([\s\S]*?)\n  \};/)

    assert.ok(loadBlock, relativePath)
    assert.match(loadBlock[1], new RegExp(`await ${actionName}\\(\\)`), relativePath)
    assert.doesNotMatch(loadBlock[1], /await Promise\.all\(/, relativePath)
    assert.match(loadBlock[1], /result\.data\?\.machines/, relativePath)
    assert.match(loadBlock[1], /result\.data\?\.countOptions/, relativePath)
  }
})
