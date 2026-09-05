import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const { transform } = require('next/dist/build/swc')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

test('entry row attributes render static cells without key warnings through the Next compiler', async t => {
  const folders = ['preparatory-entry', 'post-preparatory/spinning', 'post-preparatory/autoconer']
  let checked = 0
  for (const folder of folders) {
    const directory = new URL(`../src/components/modules/${folder}/`, import.meta.url)
    for (const file of await readdir(directory)) {
      if (!/(Production|Stoppage|MachineSetup)Tab\.jsx$/.test(file)) continue
      const source = await readFile(new URL(file, directory), 'utf8')
      const opening = source.match(/<tr\b[^>]*\{\.\.\.getRowProps\(row\)\}[^>]*>/)?.[0]
      assert.ok(opening, `${file}: missing selectable row`)
      checked++
      await t.test(file, async () => {
        // Compile the real row attributes with Next's development transform.
        // A key after a spread uses createElement with an unvalidated children
        // array, which warns even when the row itself has a unique key.
        const { code } = await transform(`
          export default function EntryRow() {
            const row = { id: 'row-1', machine_id: 'machine-1', machine: { id: 'machine-1' } }
            const rowKey = row.id, index = 0, editedRows = {}, selectedRows = []
            const isEdited = false, isSelected = false, bgClass = ''
            const getRowProps = () => ({ 'data-entry-selected': false })
            return <table><tbody>{[row].map(row => (
              ${opening}<td>Machine</td><td><input defaultValue="10" /></td></tr>
            ))}</tbody></table>
          }
        `, {
          filename: file,
          jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic', development: true } } },
          module: { type: 'commonjs' },
        })
        const exports = {}
        runInNewContext(code, { exports, require })
        const errors = []
        const original = console.error
        console.error = (...args) => errors.push(args.map(String).join(' '))
        try {
          const html = renderToStaticMarkup(React.createElement(exports.default))
          assert.match(html, /data-entry-selected="false"/)
          assert.deepEqual(errors, [], `${file}: React render warnings`)
        } finally {
          console.error = original
        }
      })
    }
  }
  assert.equal(checked, 24)
})
