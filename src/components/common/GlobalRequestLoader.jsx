'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import LoadingOverlay from '@/components/common/LoadingOverlay'

const SHOW_DELAY_MS = 120
const MIN_VISIBLE_MS = 400
const NAVIGATION_TIMEOUT_MS = 15000

export default function GlobalRequestLoader() {
  const pathname = usePathname()
  const pendingRequests = useRef(0)
  const navigationPending = useRef(false)
  const showTimer = useRef(null)
  const hideTimer = useRef(null)
  const safetyTimer = useRef(null)
  const visibleSince = useRef(0)
  const visibleRef = useRef(false)
  const [visible, setVisible] = useState(false)

  const showSoon = useCallback(() => {
    clearTimeout(hideTimer.current)
    if (visibleRef.current || showTimer.current) return
    showTimer.current = setTimeout(() => {
      showTimer.current = null
      visibleSince.current = Date.now()
      visibleRef.current = true
      setVisible(true)
    }, SHOW_DELAY_MS)
  }, [])

  const hideWhenFinished = useCallback(() => {
    if (pendingRequests.current > 0 || navigationPending.current) return
    clearTimeout(showTimer.current)
    showTimer.current = null
    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - visibleSince.current))
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      visibleRef.current = false
      setVisible(false)
    }, remaining)
  }, [])

  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      pendingRequests.current += 1
      showSoon()
      try {
        return await originalFetch(...args)
      } finally {
        pendingRequests.current = Math.max(0, pendingRequests.current - 1)
        hideWhenFinished()
      }
    }
    return () => { window.fetch = originalFetch }
  }, [showSoon, hideWhenFinished])

  useEffect(() => {
    const handleClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.href === window.location.href || url.hash) return

      navigationPending.current = true
      showSoon()
      clearTimeout(safetyTimer.current)
      safetyTimer.current = setTimeout(() => {
        navigationPending.current = false
        hideWhenFinished()
      }, NAVIGATION_TIMEOUT_MS)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [showSoon, hideWhenFinished])

  useEffect(() => {
    navigationPending.current = false
    clearTimeout(safetyTimer.current)
    hideWhenFinished()
  }, [pathname, hideWhenFinished])

  useEffect(() => () => {
    clearTimeout(showTimer.current)
    clearTimeout(hideTimer.current)
    clearTimeout(safetyTimer.current)
  }, [])

  return visible ? <LoadingOverlay /> : null
}
