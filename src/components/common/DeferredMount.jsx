'use client'

import { useEffect, useState } from 'react'

/**
 * Defers expensive children until their panel is selected for the first time.
 * Once mounted, children stay mounted so local edits, refs, and form state are
 * preserved exactly as they are with force-mounted tabs.
 */
export default function DeferredMount({ active, children }) {
  const [hasMounted, setHasMounted] = useState(active)

  useEffect(() => {
    if (active) setHasMounted(true)
  }, [active])

  return active || hasMounted ? children : null
}
