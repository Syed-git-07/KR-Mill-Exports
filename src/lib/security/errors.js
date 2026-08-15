import { logger } from "@/lib/security/logger";
import { ZodError } from "zod";

const SAFE_DATABASE_ERRORS = {
  P2002: "A record with this value already exists.",
  P2003: "This record is still referenced by other data.",
  P2025: "The requested record was not found.",
};

export function safeActionError(error) {
  logger.error("Server action failed", {
    error,
    errorCode: error?.code,
  });

  if (SAFE_DATABASE_ERRORS[error?.code]) {
    return SAFE_DATABASE_ERRORS[error.code];
  }
  if (error instanceof ZodError) {
    return error.issues[0]?.message || "The submitted data is invalid.";
  }
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : "The request failed.";
  }
  return "The request could not be completed. Please try again or contact an administrator.";
}

