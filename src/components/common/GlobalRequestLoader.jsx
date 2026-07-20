'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import LoadingOverlay from '@/components/common/LoadingOverlay'

const SHOW_DELAY_MS = 120
const MIN_VISIBLE_MS = 400
const NAVIGATION_TIMEOUT_MS = 15000

function isPageNavigationFetch(input, init) {
  // 1. Get method
  let method = 'GET'
  if (init && init.method) {
    method = init.method
  } else if (input && typeof input === 'object' && input.method) {
    method = input.method
  }
  if (method.toUpperCase() !== 'GET') {
    return false
  }

  // Helper to get header value case-insensitively
  const getHeader = (name) => {
    const lowerName = name.toLowerCase()
    
    // Check in init.headers first
    if (init && init.headers) {
      if (typeof init.headers.get === 'function') {
        return init.headers.get(lowerName)
      } else if (Array.isArray(init.headers)) {
        const found = init.headers.find(([key]) => key.toLowerCase() === lowerName)
        if (found) return found[1]
      } else if (typeof init.headers === 'object') {
        const foundKey = Object.keys(init.headers).find(key => key.toLowerCase() === lowerName)
        if (foundKey) return init.headers[foundKey]
      }
    }
    
    // Check in Request object if input is a Request
    if (input && typeof input === 'object' && input.headers) {
      if (typeof input.headers.get === 'function') {
        return input.headers.get(lowerName)
      } else if (Array.isArray(input.headers)) {
        const found = input.headers.find(([key]) => key.toLowerCase() === lowerName)
        if (found) return found[1]
      } else if (typeof input.headers === 'object') {
        const foundKey = Object.keys(input.headers).find(key => key.toLowerCase() === lowerName)
        if (foundKey) return input.headers[foundKey]
      }
    }
    
    return null
  }

  // 2. Filter out prefetches (background fetch for links in viewport)
  const isPrefetch = 
    getHeader('x-nextjs-prefetch') === '1' || 
    getHeader('next-router-prefetch') === '1' ||
    String(getHeader('purpose')).toLowerCase() === 'prefetch'

  if (isPrefetch) {
    return false
  }

  // 3. Filter out Server Actions (POST requests, but check header to be safe)
  if (getHeader('next-action')) {
    return false
  }

  // 4. Must be a Next.js App Router Page Navigation fetch.
  // Next.js App Router GET page navigation requests will have the "Rsc" header.
  // (And are not prefetches, which we filtered out above).
  const isRsc = getHeader('rsc') === '1' || getHeader('next-router-state-tree')

  return !!isRsc
}

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
      const [input, init] = args
      const isNav = isPageNavigationFetch(input, init)
      if (isNav) {
        pendingRequests.current += 1
        showSoon()
      }
      try {
        return await originalFetch(...args)
      } finally {
        if (isNav) {
          pendingRequests.current = Math.max(0, pendingRequests.current - 1)
          hideWhenFinished()
        }
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
