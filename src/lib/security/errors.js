import { logger } from "@/lib/security/logger";

const SAFE_DATABASE_ERRORS = {
  P2002: "A record with this value already exists.",
  P2003: "This record is still referenced by other data.",
  P2025: "The requested record was not found.",
  MACHINE_IN_USE: "This machine is used by production history and cannot be permanently removed. Deactivate it instead.",
  STOPPAGE_IN_USE: "This stoppage reason is used by production history and cannot be permanently removed. Deactivate it instead.",
  STOPPAGE_HEAD_IN_USE: "This stoppage head still has detail reasons and cannot be permanently removed. Deactivate it instead.",
  SUPERVISOR_IN_USE: "This supervisor is used by production history and cannot be permanently removed. Deactivate it instead.",
  DEPARTMENT_IN_USE: "This department is used by supervisors, stoppages, or HOK history and cannot be permanently removed. Deactivate it instead.",
  SPINNING_COUNT_IN_USE: "This spinning count is used by production setup or historical entries and cannot be permanently removed. Deactivate it instead.",
  INVALID_STOPPAGE: "Stoppage time must be a non-negative whole number of minutes and cannot exceed the shift.",
  INVALID_STOPPAGE_REASON: "Select an active stoppage reason before saving stoppage time.",
  INVALID_MACHINE_MIXING_UPDATE: "Select active machines and enter a valid mixing/count before applying.",
  MACHINE_REACTIVATION_REQUIRES_NEW: "This inactive machine is historical. Add a new machine with the same number to start a new lifecycle.",
  INVALID_DATE: "Enter a valid calendar date in YYYY-MM-DD format.",
  OPERATIONAL_DEPARTMENT_RENAME: "Operational production department names cannot be renamed; update their other attributes instead.",
};

// These errors are created only by our own validation/lifecycle helpers. Their
// messages identify the exact field or stale entry state and are safe (and much
// more useful) to show to operators in production.
const SAFE_VALIDATION_CODES = new Set([
  "INVALID_MACHINE_SETUP",
  "INVALID_MACHINE_MASTER",
  "INVALID_ENTRY_MACHINE_LIFECYCLE",
  "ENTRY_HEADER_NOT_FOUND",
  "STALE_ENTRY_CONTEXT",
  "ENTRY_LOCKED",
  "ACTIVE_MACHINE_EXISTS",
  "OVERLAPPING_MACHINE_LIFECYCLE",
  "STALE_MACHINE_STATE",
]);

export function safeActionError(error) {
  logger.error("Server action failed", {
    error,
    errorCode: error?.code,
  });

  if (SAFE_DATABASE_ERRORS[error?.code]) {
    return SAFE_DATABASE_ERRORS[error.code];
  }
  if (SAFE_VALIDATION_CODES.has(error?.code) && error instanceof Error) {
    return error.message;
  }
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : "The request failed.";
  }
  return "The request could not be completed. Please try again or contact an administrator.";
}
