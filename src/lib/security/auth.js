import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionToken, hashSessionToken } from "@/lib/security/session";
import {
  ALLOWED_ROLES,
  AUTH_CONTEXT_HEADER,
} from "@/lib/security/constants";
import { logger } from "@/lib/security/logger";

function parseMiddlewareUser(value) {
  if (!value) return null;

  try {
    const user = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof user?.id !== "string" ||
      typeof user?.username !== "string" ||
      typeof user?.display_name !== "string" ||
      !ALLOWED_ROLES.includes(user?.role) ||
      typeof user?.must_change_password !== "boolean"
    ) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async () => {
  // Middleware has already verified the database-backed session for every
  // application request and overwrites this internal header. Reusing that
  // context avoids a second session query during rendering and Server Actions.
  const middlewareUser = parseMiddlewareUser(
    (await headers()).get(AUTH_CONTEXT_HEADER),
  );
  if (middlewareUser) return middlewareUser;

  // Keep a fail-closed database fallback for non-standard execution contexts.
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const session = await prisma.auth_sessions.findUnique({
      where: {
        token_hash: hashSessionToken(token),
      },
      select: {
        id: true,
        expires_at: true,
        revoked_at: true,
        user: {
          select: {
            id: true,
            username: true,
            display_name: true,
            role: true,
            is_active: true,
            must_change_password: true,
          },
        },
      },
    });

    if (
      !session ||
      session.revoked_at ||
      session.expires_at <= new Date() ||
      !session.user?.is_active ||
      !ALLOWED_ROLES.includes(session.user.role)
    ) {
      return null;
    }

    return session.user;
  } catch (error) {
    logger.error("Session lookup failed", { error });
    return null;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
