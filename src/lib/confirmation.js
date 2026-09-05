/** One pending decision at a time. Repeated clicks must never queue writes. */
export function createConfirmationController() {
  let pending = null
  let resolvePending = null
  let nextId = 0
  const listeners = new Set()
  const notify = () => listeners.forEach(listener => listener())

  return {
    getSnapshot: () => pending,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    request(action, returnFocus = null) {
      if (pending) return Promise.resolve(false)
      return new Promise(resolve => {
        resolvePending = resolve
        pending = { id: ++nextId, action, returnFocus }
        notify()
      })
    },
    settle(id, accepted) {
      if (!pending || pending.id !== id) return
      const resolve = resolvePending
      pending = null
      resolvePending = null
      notify()
      resolve(accepted === true)
    },
  }
}

// Root-layout and route bundles must share the same pending decision, even
// when Fast Refresh re-evaluates this module while the layout stays mounted.
const controllerKey = Symbol.for('kr-production.action-confirmation')
const serverController = createConfirmationController()
function getController() {
  if (typeof window === 'undefined') return serverController
  if (!window[controllerKey]) window[controllerKey] = createConfirmationController()
  return window[controllerKey]
}

export const confirmationController = {
  getSnapshot: () => getController().getSnapshot(),
  subscribe: listener => getController().subscribe(listener),
  request: (action, returnFocus) => getController().request(action, returnFocus),
  settle: (id, accepted) => getController().settle(id, accepted),
}

export function confirmAction(action) {
  // No mounted application means no approval; never fall back to executing.
  if (typeof document === 'undefined') return Promise.resolve(false)
  return confirmationController.request(action, document.activeElement)
}
