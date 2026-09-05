'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { confirmationController } from '@/lib/confirmation'

const getServerSnapshot = () => null

export default function ActionConfirmation() {
  const pending = useSyncExternalStore(
    confirmationController.subscribe,
    confirmationController.getSnapshot,
    getServerSnapshot,
  )
  const noRef = useRef(null)
  const returnFocusRef = useRef(null)

  useEffect(() => {
    if (pending) returnFocusRef.current = pending.returnFocus
  }, [pending])

  useEffect(() => () => {
    const current = confirmationController.getSnapshot()
    if (current) confirmationController.settle(current.id, false)
  }, [])

  const answer = accepted => {
    if (pending) confirmationController.settle(pending.id, accepted)
  }

  return (
    <Dialog open={Boolean(pending)} onOpenChange={open => { if (!open) answer(false) }}>
      <DialogContent
        role="alertdialog"
        aria-describedby={undefined}
        showCloseButton={false}
        className="sm:max-w-sm gap-5 p-5"
        onOpenAutoFocus={event => {
          event.preventDefault()
          noRef.current?.focus()
        }}
        onCloseAutoFocus={event => {
          event.preventDefault()
          const trigger = returnFocusRef.current
          // Radix tabs activate on focus. Restoring an inactive trigger can
          // re-enter the action that just closed this confirmation.
          if (trigger?.isConnected && !(trigger.getAttribute('role') === 'tab' && trigger.getAttribute('aria-selected') !== 'true')) {
            trigger.focus({ preventScroll: true })
          }
        }}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogTitle className="text-base font-semibold leading-6">
          Are you sure you want to {pending?.action || 'continue'}?
        </DialogTitle>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button ref={noRef} type="button" variant="outline" className="min-w-20" onClick={() => answer(false)}>No</Button>
          <Button
            type="button"
            variant={/delete|remove|discard/.test(pending?.action || '') ? 'destructive' : 'default'}
            className="min-w-20"
            onClick={() => answer(true)}
          >Yes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
