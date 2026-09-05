import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

async function jsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const resolved = path.join(directory, entry.name)
    if (entry.isDirectory()) return jsxFiles(resolved)
    return entry.name.endsWith('.jsx') ? [resolved] : []
  }))
  return nested.flat()
}

test('entry selection dialog supports search, mouse selection, arrows and Enter', async () => {
  const source = await readFile(path.resolve('src/components/ui/search-selection-dialog.jsx'), 'utf8')

  assert.match(source, /role="combobox"/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /event\.key === 'ArrowDown'/)
  assert.match(source, /event\.key === 'ArrowUp'/)
  assert.match(source, /event\.key === 'Enter'/)
  assert.match(source, /onClick=\{\(\) => selectItem\(item\)\}/)
  assert.match(source, /w-\[min\(96vw,64rem\)\]/)
  assert.match(source, /sm:max-w-4xl/)
  assert.doesNotMatch(source, /Use the arrow keys|press Enter to select/)
})

test('entry fields open their dialogs only after typing, not on focus or click', async () => {
  const [employee, stoppage, select] = await Promise.all([
    readFile(path.resolve('src/components/ui/employee-autocomplete.jsx'), 'utf8'),
    readFile(path.resolve('src/components/ui/stoppage-autocomplete.jsx'), 'utf8'),
    readFile(path.resolve('src/components/ui/enter-select.jsx'), 'utf8')
  ])
  const dialogSelect = select.match(/if \(dialogMode\) \{[\s\S]*?\n  return \(/)?.[0] || ''

  assert.match(employee, /onChange=\{\(e\) => \{[\s\S]*?setOpen\(nextValue\.trim\(\)\.length > 0\)/)
  assert.match(employee, /if \(!dialogMode && !disabled && searchTerm\.trim\(\)\) setOpen\(true\)/)
  assert.match(stoppage, /onClick=\{\(event\) => event\.currentTarget\.select\(\)\}/)
  assert.match(stoppage, /setOpen\(nextQuery\.trim\(\)\.length > 0\)/)
  assert.match(dialogSelect, /type="text"/)
  assert.match(dialogSelect, /setOpen\(nextSearch\.trim\(\)\.length > 0\)/)
  assert.doesNotMatch(dialogSelect, /onClick=\{openDropdown\}/)
})

test('all requested employee assignment grids opt into the payroll dialog', async () => {
  const roots = [
    path.resolve('src/components/modules/preparatory-entry'),
    path.resolve('src/components/modules/post-preparatory')
  ]
  const files = (await Promise.all(roots.map(jsxFiles))).flat()
  let employeeFields = 0

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const calls = source.match(/<EmployeeAutocomplete[\s\S]*?\/>/g) || []
    employeeFields += calls.length
    for (const call of calls) assert.match(call, /\bdialogMode\b/, path.relative(process.cwd(), file))
  }

  assert.equal(employeeFields, 9)
})

test('entry counts and idle reasons use the modal wrapper without changing masters or reports', async () => {
  const roots = [
    path.resolve('src/components/modules/preparatory-entry'),
    path.resolve('src/components/modules/post-preparatory')
  ]
  const files = (await Promise.all(roots.map(jsxFiles))).flat()
  const selectFiles = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (!source.includes('<EnterSelect')) continue
    selectFiles.push(path.relative(process.cwd(), file))
    assert.match(source, /import EnterSelect from ['"]@\/components\/ui\/entry-select['"]/, path.relative(process.cwd(), file))
    assert.doesNotMatch(source, /import EnterSelect from ['"]@\/components\/ui\/enter-select['"]/, path.relative(process.cwd(), file))
  }

  assert.equal(selectFiles.length, 12)

  const idleReason = await readFile(
    path.resolve('src/components/modules/post-preparatory/autoconer/AutoconerProductionTab.jsx'),
    'utf8'
  )
  assert.match(idleReason, /value=\{row\.idle_reason \|\| 'none'\}[\s\S]*?dialogTitle="Select idle-drum reason"/)
})

test('employee and stoppage dialogs expose concise identifying result columns', async () => {
  const [employee, stoppage, payrollEmployees] = await Promise.all([
    readFile(path.resolve('src/components/ui/employee-autocomplete.jsx'), 'utf8'),
    readFile(path.resolve('src/components/ui/stoppage-autocomplete.jsx'), 'utf8'),
    readFile(path.resolve('src/lib/payroll/employees.js'), 'utf8')
  ])

  assert.match(employee, /Emp code/)
  assert.match(employee, /Employee name/)
  assert.match(employee, /Department/)
  assert.match(employee, /Designation/)
  assert.match(employee, /employeeReference\(emp\)/)
  assert.doesNotMatch(employee, />\s*ID \{employeeId\}\s*</)
  assert.match(payrollEmployees, /LEFT JOIN designations dg ON dg\.id = e\.designationId/)
  assert.match(payrollEmployees, /dg\.name AS designation/)
  assert.match(stoppage, /Select stoppage reason/)
  assert.match(stoppage, /Short code/)
  assert.doesNotMatch(stoppage, /Search by stoppage reason|Choose a stoppage reason/)
})
