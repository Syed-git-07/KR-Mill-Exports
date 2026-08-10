import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ENTRY_PAGES = [
  'src/app/post-preparatory/autoconer/entry/page.jsx',
  'src/app/post-preparatory/spinning/entry/page.jsx',
  'src/app/preparatory-entry/breaker-drawing/entry/page.jsx',
  'src/app/preparatory-entry/carding/entry/page.jsx',
  'src/app/preparatory-entry/comber/entry/page.jsx',
  'src/app/preparatory-entry/finisher-drawing/entry/page.jsx',
  'src/app/preparatory-entry/lap-former/entry/page.jsx',
  'src/app/preparatory-entry/simplex/entry/page.jsx'
]

test('entry pages defer inactive tabs and retain force-mounted visited tabs', async () => {
  for (const relativePath of ENTRY_PAGES) {
    const source = await readFile(path.resolve(relativePath), 'utf8')

    assert.match(source, /import DeferredMount from ['"]@\/components\/common\/DeferredMount['"]/, relativePath)
    assert.equal(source.match(/<DeferredMount active=/g)?.length, 3, relativePath)
    assert.equal(source.match(/<TabsContent[^>]*forceMount/g)?.length, 3, relativePath)
  }
})

test('deferred children remain mounted after their first activation', async () => {
  const source = await readFile(
    path.resolve('src/components/common/DeferredMount.jsx'),
    'utf8'
  )

  assert.match(source, /const \[hasMounted, setHasMounted\] = useState\(active\)/)
  assert.match(source, /if \(active\) setHasMounted\(true\)/)
  assert.match(source, /return active \|\| hasMounted \? children : null/)
})
