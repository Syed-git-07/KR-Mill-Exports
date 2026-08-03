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
};

export function safeActionError(error) {
  logger.error("Server action failed", {
    error,
    errorCode: error?.code,
  });

  if (SAFE_DATABASE_ERRORS[error?.code]) {
    return SAFE_DATABASE_ERRORS[error.code];
  }
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : "The request failed.";
  }
  return "The request could not be completed. Please try again or contact an administrator.";
}
