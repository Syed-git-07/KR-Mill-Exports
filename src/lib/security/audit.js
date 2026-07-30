import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/security/logger";

function jsonSafeDetails(details) {
  if (!details) return undefined;
  return JSON.parse(
    JSON.stringify(details, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

export async function writeAuditLog({
  eventType,
  outcome,
  action,
  resource,
  user,
  username,
  context = {},
  details,
}) {
  const logContext = {
    eventType,
    outcome,
    action,
    resource,
    userId: user?.id,
    username: user?.username || username,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    details,
  };

  if (outcome === "FAILURE" || outcome === "DENIED") {
    logger.warn("Security audit event", logContext);
  } else {
    logger.info("Security audit event", logContext);
  }

  try {
    await prisma.audit_logs.create({
      data: {
        event_type: eventType,
        outcome,
        action,
        resource: resource?.slice(0, 255),
        user_id: user?.id || null,
        username: (user?.username || username || null)?.slice(0, 64),
        request_id: context.requestId?.slice(0, 64),
        ip_address: context.ipAddress?.slice(0, 64),
        user_agent: context.userAgent?.slice(0, 512),
        details: jsonSafeDetails(details),
      },
    });
  } catch (error) {
    logger.error("Failed to persist audit event", {
      error,
      eventType,
      requestId: context.requestId,
    });
  }
}

