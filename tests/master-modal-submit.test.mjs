import test from 'node:test'
import assert from 'node:assert/strict'
import { glob, readFile } from 'node:fs/promises'

test('master modal Save scopes form submission to its own dialog', async () => {
  const source = await readFile(
    new URL('../src/components/common/FormModal.jsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /const modalRoot = contentRef\.current/)
  assert.match(source, /modalRoot\?\.querySelector\("form"\)/)
  assert.doesNotMatch(source, /document\.querySelector\(["']form["']\)/)
  assert.match(source, /if \(submitForm\(modalForm\)\) return/)
})

test('master pages contain no global form submission fallback', async () => {
  const files = []
  for await (const file of glob('src/app/{masters,preparatory-master}/**/page.jsx')) {
    files.push(file)
  }

  assert.ok(files.length > 0)
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /document\.querySelector\(["']form["']\)/, file)
  }
})

test('master forms do not render a second submit button inside the modal body', async () => {
  const files = []
  for (const pattern of [
    'src/components/modules/masters/*Form.jsx',
    'src/components/modules/preparatory-master/*Form.jsx'
  ]) {
    for await (const file of glob(pattern)) {
      files.push(file)
    }
  }

  assert.ok(files.length > 0)
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /type=["']submit["']/, file)
  }
})
