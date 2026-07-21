'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import LoadingOverlay from '@/components/common/LoadingOverlay'

const SHOW_DELAY_MS = 800
const MIN_VISIBLE_MS = 0
const NAVIGATION_TIMEOUT_MS = 15000

let activeFetchCount = 0

if (typeof window !== 'undefined') {
  window.__activeFetchCount = () => activeFetchCount
}

function isPageNavigationFetch(input, init) {
  try {
    // 1. Get method
    let method = 'GET'
    if (init && typeof init.method === 'string') {
      method = init.method
    } else if (input && typeof input === 'object' && typeof input.method === 'string') {
      method = input.method
    }
    
    if (typeof method !== 'string' || method.toUpperCase() !== 'GET') {
      return false
    }

    // Helper to get header value case-insensitively
    const getHeader = (name) => {
      try {
        const lowerName = name.toLowerCase()
        
        // Check in init.headers first
        if (init && init.headers) {
          if (typeof init.headers.get === 'function') {
            return init.headers.get(lowerName)
          } else if (Array.isArray(init.headers)) {
            const found = init.headers.find(([key]) => key && String(key).toLowerCase() === lowerName)
            if (found) return found[1]
          } else if (typeof init.headers === 'object') {
            const foundKey = Object.keys(init.headers).find(key => key && String(key).toLowerCase() === lowerName)
            if (foundKey) return init.headers[foundKey]
          }
        }
        
        // Check in Request object if input is a Request
        if (input && typeof input === 'object' && input.headers) {
          if (typeof input.headers.get === 'function') {
            return input.headers.get(lowerName)
          } else if (Array.isArray(input.headers)) {
            const found = input.headers.find(([key]) => key && String(key).toLowerCase() === lowerName)
            if (found) return found[1]
          } else if (typeof input.headers === 'object') {
            const foundKey = Object.keys(input.headers).find(key => key && String(key).toLowerCase() === lowerName)
            if (foundKey) return input.headers[foundKey]
          }
        }
      } catch (e) {
        console.error('Error getting header:', name, e)
      }
      return null
    }

    // 2. Filter out prefetches (background fetch for links in viewport)
    const isPrefetch = 
      getHeader('x-nextjs-prefetch') === '1' || 
      getHeader('next-router-prefetch') === '1' ||
      String(getHeader('purpose') || '').toLowerCase() === 'prefetch'

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
  } catch (err) {
    console.error('Error in isPageNavigationFetch:', err)
    return false
  }
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
      activeFetchCount += 1
      try {
        return await originalFetch(...args)
      } finally {
        activeFetchCount = Math.max(0, activeFetchCount - 1)
        if (isNav) {
          pendingRequests.current = Math.max(0, pendingRequests.current - 1)
          hideWhenFinished()
        }
      }
    }
    return () => { window.fetch = originalFetch }
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
