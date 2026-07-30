import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/security/constants";

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId, context) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.auth_sessions.create({
    data: {
      user_id: userId,
      token_hash: hashSessionToken(token),
      ip_address: context.ipAddress,
      user_agent: context.userAgent,
      expires_at: expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token, expiresAt) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
    priority: "high",
  });
}

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function revokeSession(token) {
  if (!token) return;
  await prisma.auth_sessions.updateMany({
    where: {
      token_hash: hashSessionToken(token),
      revoked_at: null,
    },
    data: { revoked_at: new Date() },
  });
}

