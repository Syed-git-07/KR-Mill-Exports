/**
 * Fallback-only shift runtime resolver for Spinning.
 * Primary source remains shift_config; use this only when DB config is unavailable.
 */
export function resolveSpinningShiftFallbackTime(shift) {
  const shiftNo = Number.parseInt(String(shift), 10)
  return shiftNo === 3 ? 420 : 510
}