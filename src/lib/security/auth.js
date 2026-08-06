import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionToken, hashSessionToken } from "@/lib/security/session";
import { logger } from "@/lib/security/logger";
import { withBasePath } from "@/lib/app-path";

export const getCurrentUser = cache(async () => {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const session = await prisma.auth_sessions.findFirst({
      where: {
        token_hash: hashSessionToken(token),
        revoked_at: null,
        expires_at: { gt: new Date() },
        user: { is_active: true },
      },
      select: {
        id: true,
        expires_at: true,
        user: {
          select: {
            id: true,
            username: true,
            display_name: true,
            role: true,
            must_change_password: true,
          },
        },
      },
    });

    return session?.user || null;
  } catch (error) {
    logger.error("Session lookup failed", { error });
    return null;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(withBasePath("/login"));
  return user;
}

export async function requireRole(...roles) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(withBasePath("/"));
  return user;
}
