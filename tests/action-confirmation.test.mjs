import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createConfirmationController } from '../src/lib/confirmation.js'

test('layout and refreshed route modules share the same pending confirmation', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  try {
    const layout = await import('../src/lib/confirmation.js?layout-test')
    const route = await import('../src/lib/confirmation.js?refreshed-route-test')
    let displayedAction = null
    const unsubscribe = layout.confirmationController.subscribe(() => {
      displayedAction = layout.confirmationController.getSnapshot()?.action || null
    })
    const result = route.confirmationController.request('update')
    assert.equal(displayedAction, 'update')
    layout.confirmationController.settle(layout.confirmationController.getSnapshot().id, true)
    assert.equal(await result, true)
    assert.equal(route.confirmationController.getSnapshot(), null)
    unsubscribe()
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('confirmation waits for a decision and dismissing never grants approval', async () => {
  const controller = createConfirmationController()
  let completed = false
  const result = controller.request('update').then(value => { completed = true; return value })
  await Promise.resolve()
  assert.equal(completed, false)
  controller.settle(controller.getSnapshot().id, false)
  assert.equal(await result, false)
  assert.equal(controller.getSnapshot(), null)
})

test('rapid repeat clicks do not queue another operation and stale answers are ignored', async () => {
  const controller = createConfirmationController()
  const first = controller.request('delete')
  const firstId = controller.getSnapshot().id
  assert.equal(await controller.request('delete'), false)
  controller.settle(firstId, true)
  controller.settle(firstId, true)
  assert.equal(await first, true)
  const next = controller.request('cancel')
  controller.settle(firstId, true)
  assert.equal(controller.getSnapshot().action, 'cancel')
  controller.settle(controller.getSnapshot().id, false)
  assert.equal(await next, false)
})

test('dialog subscribers see open and closed state and can unsubscribe', async () => {
  const controller = createConfirmationController()
  const events = []
  const unsubscribe = controller.subscribe(() => events.push(controller.getSnapshot()?.action || null))
  const result = controller.request('update')
  controller.settle(controller.getSnapshot().id, true)
  assert.equal(await result, true)
  unsubscribe()
  const next = controller.request('cancel')
  controller.settle(controller.getSnapshot().id, false)
  await next
  assert.deepEqual(events, ['update', null])
})

const entryPaths = [
  'preparatory-entry/carding', 'preparatory-entry/breaker-drawing',
  'preparatory-entry/comber', 'preparatory-entry/finisher-drawing',
  'preparatory-entry/lap-former', 'preparatory-entry/simplex',
  'post-preparatory/spinning', 'post-preparatory/autoconer',
]

// Execute the actual handler up to its first write; declining must not even
// capture or clear the draft snapshot, enable saving, or navigate away.
for (const entryPath of entryPaths) {
  test(`${entryPath}: Yes runs the existing save flow once; failures retain drafts`, async () => {
    const source = await readFile(new URL(`../src/app/${entryPath}/entry/page.jsx`, import.meta.url), 'utf8')
    const body = source.slice(source.search(/const handleSaveAll(?:Tabs|Changes) = /))
    const start = body.indexOf('async () => {')
    const end = body.indexOf('\n  }', start) + '\n  }'.length
    for (const shouldFail of [false, true]) {
      const calls = []
      const drafts = { header: { supervisor_id: 'new' }, setup: { row: {} }, stoppage: { row: {} }, production: { row: {} } }
      const tab = name => ({ current: { saveChanges: async () => {
        calls.push(name)
        return { success: !(shouldFail && name === 'production'), saved: 1 }
      } } })
      const context = {
        headerId: 'existing-entry', saveInFlightRef: { current: false },
        getUnsavedEditCount: () => 4, confirmAction: async () => true,
        sharedDraftsRef: { current: drafts },
        setupTabRef: tab('setup'), stoppageTabRef: tab('stoppage'), productionTabRef: tab('production'),
        setIsSavingAll: () => {},
        clearAllDrafts: () => calls.push('clear'), clearSharedDrafts: () => calls.push('clear'),
        replaceAllDrafts: value => {
          if (Object.values(value).every(section => Object.keys(section).length === 0)) calls.push('clear')
          else { assert.equal(value, drafts); calls.push('retain') }
        },
        router: { push: () => calls.push('navigate') },
        toast: { info() {}, success() {}, error() {} }, console: { error() {} },
      }
      for (const [, action] of body.slice(start, end).matchAll(/await (update\w+Action)\(/g)) {
        context[action] = async () => { calls.push('header'); return { success: true, saved: 1 } }
      }
      const save = vm.runInNewContext(`(${body.slice(start, end)})`, context)
      await save()
      for (const name of ['header', 'setup', 'stoppage', 'production']) {
        assert.equal(calls.filter(value => value === name).length, 1, `${name} must execute exactly once`)
      }
      assert.ok(calls.indexOf('setup') < calls.indexOf('production'))
      assert.ok(calls.indexOf('stoppage') < calls.indexOf('production'))
      assert.equal(calls.includes('navigate'), !shouldFail)
      assert.equal(calls.includes('clear'), !shouldFail)
      assert.equal(calls.includes('retain'), shouldFail)
      assert.equal(context.saveInFlightRef.current, false)
    }
  })

  test(`${entryPath}: Update waits, and No preserves the draft and save state`, async () => {
    const source = await readFile(new URL(`../src/app/${entryPath}/entry/page.jsx`, import.meta.url), 'utf8')
    const start = source.search(/const handleSaveAll(?:Tabs|Changes) = /)
    assert.ok(start >= 0)
    const body = source.slice(start)
    const fnStart = body.indexOf('async () => {')
    const fnEnd = body.indexOf('\n  }', fnStart) + '\n  }'.length
    const controller = createConfirmationController()
    const saveInFlightRef = { current: false }
    const context = {
      headerId: 'existing-entry', saveInFlightRef,
      getUnsavedEditCount: () => 3,
      confirmAction: action => controller.request(action),
      sharedDraftsRef: { get current() { assert.fail('Draft snapshot accessed before approval') } },
      setIsSavingAll: () => assert.fail('Save state changed before approval'),
    }
    const save = vm.runInNewContext(`(${body.slice(fnStart, fnEnd)})`, context)
    const result = save()
    assert.equal(controller.getSnapshot().action, 'update')
    assert.equal(saveInFlightRef.current, false)
    assert.equal(await save(), undefined, 'second click must stop without a queued save')
    controller.settle(controller.getSnapshot().id, false)
    await result
    assert.equal(saveInFlightRef.current, false)
  })

  test(`${entryPath}: tabs switch immediately without confirmation and retain drafts`, async () => {
    const source = await readFile(new URL(`../src/app/${entryPath}/entry/page.jsx`, import.meta.url), 'utf8')
    const match = source.match(/const handleTabChange = (\(nextTab\) => \{[\s\S]*?\n  \})/)
    assert.ok(match)
    let active = 'production'
    const context = {
      setActiveTab: value => { active = value },
      confirmAction: () => assert.fail('Tab switching must not open a confirmation'),
    }
    const changeTab = vm.runInNewContext(`(${match[1]})`, context)
    for (const next of ['setup', 'stoppage', 'production']) {
      assert.equal(changeTab(next), undefined)
      assert.equal(active, next)
    }
    assert.match(source, /forceMount/)
  })
}
