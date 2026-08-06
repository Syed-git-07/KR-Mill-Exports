"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security/auth";
import { withoutBasePath } from "@/lib/app-path";
import { writeAuditLog } from "@/lib/security/audit";
import {
  LOGIN_WINDOW_MS,
  MAX_IP_FAILURES,
  MAX_USERNAME_FAILURES,
} from "@/lib/security/constants";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/security/password";
import {
  getRequestContext,
  isValidUsername,
  normalizeUsername,
  safeReturnPath,
} from "@/lib/security/request";
import {
  clearSessionCookie,
  createSession,
  getSessionToken,
  hashSessionToken,
  revokeSession,
  setSessionCookie,
} from "@/lib/security/session";

const GENERIC_LOGIN_ERROR = "The username or password is incorrect.";
let dummyHashPromise;

function getDummyHash() {
  dummyHashPromise ||= hashPassword(
    "Not-A-Real-Account-Password!9284",
  );
  return dummyHashPromise;
}

async function recordFailedLogin(
  user,
  username,
  context,
  reason,
  recentFailureCount,
) {
  const attemptedAt = new Date();
  await prisma.login_attempts.create({
    data: {
      username,
      ip_address: context.ipAddress,
      was_successful: false,
      attempted_at: attemptedAt,
    },
  });

  if (user) {
    const failures = recentFailureCount + 1;
    await prisma.app_users.update({
      where: { id: user.id },
      data: {
        failed_login_count: failures,
        locked_until:
          failures >= MAX_USERNAME_FAILURES
            ? new Date(Date.now() + LOGIN_WINDOW_MS)
            : null,
      },
    });
  }

  await writeAuditLog({
    eventType: "AUTH_LOGIN",
    outcome: "FAILURE",
    action: "login",
    username,
    context,
    details: { reason },
  });
}

export async function loginAction(_previousState, formData) {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") || "");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  const context = getRequestContext(await headers());
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS);

  if (!isValidUsername(username) || password.length < 1 || password.length > 128) {
    await verifyPassword(password || "invalid", await getDummyHash());
    await writeAuditLog({
      eventType: "AUTH_LOGIN",
      outcome: "FAILURE",
      action: "login",
      username: username || "(invalid)",
      context,
      details: { reason: "invalid_input" },
    });
    return { error: GENERIC_LOGIN_ERROR, username };
  }

  const [usernameFailures, ipFailures] = await Promise.all([
    prisma.login_attempts.count({
      where: {
        username,
        was_successful: false,
        attempted_at: { gte: windowStart },
      },
    }),
    prisma.login_attempts.count({
      where: {
        ip_address: context.ipAddress,
        was_successful: false,
        attempted_at: { gte: windowStart },
      },
    }),
  ]);

  if (
    usernameFailures >= MAX_USERNAME_FAILURES ||
    ipFailures >= MAX_IP_FAILURES
  ) {
    await verifyPassword(password, await getDummyHash());
    await writeAuditLog({
      eventType: "AUTH_RATE_LIMIT",
      outcome: "DENIED",
      action: "login",
      username,
      context,
      details: { reason: "rate_limited" },
    });
    return {
      error: "Too many sign-in attempts. Please wait 15 minutes and try again.",
      username,
    };
  }

  const user = await prisma.app_users.findUnique({ where: { username } });
  const passwordMatches = await verifyPassword(
    password,
    user?.password_hash || (await getDummyHash()),
  );
  const isLocked = user?.locked_until && user.locked_until > new Date();

  if (!user || !passwordMatches || !user.is_active || isLocked) {
    await recordFailedLogin(
      user,
      username,
      context,
      !user
        ? "unknown_user"
        : !user.is_active
          ? "inactive_user"
          : isLocked
            ? "locked_user"
            : "invalid_password",
      usernameFailures,
    );
    return { error: GENERIC_LOGIN_ERROR, username };
  }

  const { token, expiresAt } = await createSession(user.id, context);
  await prisma.$transaction([
    prisma.app_users.update({
      where: { id: user.id },
      data: {
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    }),
    prisma.login_attempts.create({
      data: {
        username,
        ip_address: context.ipAddress,
        was_successful: true,
      },
    }),
  ]);

  const excessSessions = await prisma.auth_sessions.findMany({
    where: {
      user_id: user.id,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: "desc" },
    skip: 5,
    select: { id: true },
  });
  if (excessSessions.length) {
    await prisma.auth_sessions.updateMany({
      where: { id: { in: excessSessions.map(({ id }) => id) } },
      data: { revoked_at: new Date() },
    });
  }

  await setSessionCookie(token, expiresAt);
  await writeAuditLog({
    eventType: "AUTH_LOGIN",
    outcome: "SUCCESS",
    action: "login",
    user,
    context,
  });

  redirect(
    user.must_change_password
      ? "/account/security"
      : withoutBasePath(returnTo),
  );
}

export async function logoutAction() {
  const headerList = await headers();
  const context = getRequestContext(headerList);
  const token = await getSessionToken();
  const user = await requireUser();

  await revokeSession(token);
  await clearSessionCookie();
  await writeAuditLog({
    eventType: "AUTH_LOGOUT",
    outcome: "SUCCESS",
    action: "logout",
    user,
    context,
  });

  redirect("/login");
}

export async function changePasswordAction(_previousState, formData) {
  const user = await requireUser();
  const context = getRequestContext(await headers());
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (currentPassword.length < 1 || currentPassword.length > 128) {
    return { error: "The current password is incorrect." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "The new passwords do not match." };
  }

  const policyError = validatePassword(newPassword, {
    username: user.username,
  });
  if (policyError) return { error: policyError };

  const storedUser = await prisma.app_users.findUnique({
    where: { id: user.id },
  });
  if (
    !storedUser ||
    !(await verifyPassword(currentPassword, storedUser.password_hash))
  ) {
    await writeAuditLog({
      eventType: "AUTH_PASSWORD_CHANGE",
      outcome: "FAILURE",
      action: "change_password",
      user,
      context,
      details: { reason: "invalid_current_password" },
    });
    return { error: "The current password is incorrect." };
  }

  if (await verifyPassword(newPassword, storedUser.password_hash)) {
    return { error: "Choose a password different from the current password." };
  }

  const newHash = await hashPassword(newPassword);
  const currentToken = await getSessionToken();
  const currentTokenHash = currentToken
    ? hashSessionToken(currentToken)
    : "missing";

  await prisma.$transaction([
    prisma.app_users.update({
      where: { id: user.id },
      data: {
        password_hash: newHash,
        must_change_password: false,
        password_changed_at: new Date(),
        failed_login_count: 0,
        locked_until: null,
      },
    }),
    prisma.auth_sessions.updateMany({
      where: {
        user_id: user.id,
        token_hash: { not: currentTokenHash },
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    }),
  ]);

  await writeAuditLog({
    eventType: "AUTH_PASSWORD_CHANGE",
    outcome: "SUCCESS",
    action: "change_password",
    user,
    context,
    details: { other_sessions_revoked: true },
  });

  return { success: "Password updated. Your other sessions were signed out." };
}
