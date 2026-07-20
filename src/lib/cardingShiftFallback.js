/**
 * Fallback-only shift runtime resolver for Carding.
 * Primary source remains shift_config; use this only when DB config is unavailable.
 */
export function resolveCardingShiftFallbackTime(shift) {
  const shiftNo = Number.parseInt(String(shift), 10)
  return shiftNo === 3 ? 420 : 510
}
