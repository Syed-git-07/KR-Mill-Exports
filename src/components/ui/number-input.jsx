'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from './input'

/**
 * NumberInput
 *
 * A controlled numeric Input that keeps a raw string in local state while the
 * user is actively typing so that partial values like "0." or "1." are never
 * overwritten by the parent's parseFloat/round cycle.
 *
 * - While focused  → display tracks what the user types (raw string)
 * - While blurred  → display syncs with the external `value` prop
 * - onChange fires with the raw synthetic event (e.target.value is the string)
 *   so parent handlers can call parseFloat themselves as before.
 * - onFocus selects all text so clicking immediately replaces the old value.
 * - zeroAsEmpty (bool) – treat 0 as null; the cell displays blank instead of "0".
 */
export function NumberInput({ value, onChange, onBlur, className, zeroAsEmpty, fixedDecimals, ...props }) {
  const isEmpty = (v) => v == null || (zeroAsEmpty && (v === 0 || v === '0' || v === 0.0))
  const formatValue = (v) => {
    if (fixedDecimals == null) return String(v)
    const parsed = parseFloat(v)
    if (Number.isNaN(parsed)) return String(v)
    return parsed.toFixed(fixedDecimals)
  }
  const toDisplay = (v) => isEmpty(v) ? '' : formatValue(v)

  const [display, setDisplay] = useState(() => toDisplay(value))
  const isFocused = useRef(false)

  // Sync external value only when the field is NOT actively focused
  useEffect(() => {
    if (!isFocused.current) {
      setDisplay(toDisplay(value))
    }
  }, [value, zeroAsEmpty]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Input
      {...props}
      className={className}
      value={display}
      onFocus={(e) => {
        isFocused.current = true
        // Select all text so typing immediately replaces the existing value
        e.target.select()
        props.onFocus?.(e)
      }}
      onChange={(e) => {
        setDisplay(e.target.value)
        onChange?.(e)           // bubble raw event to parent
      }}
      onBlur={(e) => {
        isFocused.current = false
        // Normalise display: if numeric, show clean number; otherwise revert
        const parsed = parseFloat(display)
        if (!isNaN(parsed)) {
          setDisplay(isEmpty(parsed) ? '' : formatValue(parsed))
        } else {
          setDisplay(toDisplay(value))
        }
        onBlur?.(e)
      }}
    />
  )
}
