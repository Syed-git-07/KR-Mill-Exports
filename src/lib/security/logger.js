const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|database_url|api[-_]?key/i;

function sanitize(value, depth = 0) {
  if (depth > 5) return "[TRUNCATED]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "development" ? value.stack : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : sanitize(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}…`;
  }
  return value;
}

function write(level, message, context = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "kr-production",
    environment: process.env.NODE_ENV || "development",
    message,
    ...sanitize(context),
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info(message, context) {
    write("info", message, context);
  },
  warn(message, context) {
    write("warn", message, context);
  },
  error(message, context) {
    write("error", message, context);
  },
};

