'use client'

import { useEffect } from 'react'

/**
 * Native number inputs increment/decrement while focused when the mouse wheel
 * is used over them. Block that browser default globally so every numeric cell
 * keeps its entered value; typing and keyboard controls remain unchanged.
 */
export default function NumberInputWheelGuard() {
  useEffect(() => {
    const preventWheelStep = (event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'number') return
      if (document.activeElement !== target) return

      event.preventDefault()
      target.blur()
    }

    window.addEventListener('wheel', preventWheelStep, { capture: true, passive: false })
    return () => window.removeEventListener('wheel', preventWheelStep, true)
  }, [])

  return null
}
