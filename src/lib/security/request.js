export function getClientIp(headersList) {
  const forwarded = headersList.get("x-forwarded-for");
  const value =
    forwarded?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";
  return value.slice(0, 64);
}

export function getRequestContext(headersList) {
  return {
    requestId:
      headersList.get("x-request-id") ||
      globalThis.crypto?.randomUUID?.() ||
      "unknown",
    ipAddress: getClientIp(headersList),
    userAgent: (headersList.get("user-agent") || "unknown").slice(0, 512),
  };
}

export function normalizeUsername(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function isValidUsername(value) {
  return /^[a-z0-9._-]{3,64}$/.test(value);
}

export function safeReturnPath(value) {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  try {
    const parsed = new URL(path, "http://internal");
    return parsed.origin === "http://internal"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}

