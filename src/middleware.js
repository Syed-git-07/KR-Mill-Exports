import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_ROLES,
  AUTH_CONTEXT_HEADER,
  SESSION_COOKIE_NAME,
} from "@/lib/security/constants";
import { withBasePath, withoutBasePath } from "@/lib/app-path";

const PUBLIC_PATHS = new Set([
  "/login",
  "/header-logo.png",
  "/icon.png",
  "/api/health",
]);

function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

function isSafeOrigin(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;

  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  let requestOrigin;
  try {
    requestOrigin = new URL(origin);
  } catch {
    return false;
  }
  const normalizedOrigin = requestOrigin.origin;

  const configured = (process.env.AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const configuredOrigin = new URL(value);
        const normalizedValue = value.replace(/\/$/, "");
        if (configuredOrigin.origin !== normalizedValue) return [];
        if (
          process.env.NODE_ENV === "production" &&
          configuredOrigin.protocol !== "https:"
        ) {
          return [];
        }
        return [configuredOrigin.origin];
      } catch {
        return [];
      }
    });

  // Production trusts only explicit public origins. Forwarded host headers are
  // useful for local development but are safe in production only when every
  // reverse proxy is configured perfectly, so do not use them as an authority.
  if (process.env.NODE_ENV === "production") {
    return (
      requestOrigin.protocol === "https:" && configured.includes(normalizedOrigin)
    );
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  const expected = host ? `${protocol}://${host}` : null;

  if (normalizedOrigin === expected || configured.includes(normalizedOrigin)) {
    return true;
  }

  // A TLS-terminating reverse proxy may omit x-forwarded-proto. In that case,
  // the public Origin is still safe when its host exactly matches Host.
  if (!forwardedProtocol && host) {
    try {
      return new URL(normalizedOrigin).host === host;
    } catch {
      return false;
    }
  }

  return false;
}

function withSecurityHeaders(response, requestId, nonce) {
  const scriptPolicy =
    process.env.NODE_ENV === "development"
      ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const directives = [
    "default-src 'self'",
    `script-src ${scriptPolicy}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://res.cloudinary.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }
  const csp = directives.join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Request-Id", requestId);
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  return response;
}

function redirectToLogin(request, requestId, nonce, clearCookie = false) {
  const url = new URL(withBasePath("/login"), request.url);
  if (request.method === "GET") {
    url.searchParams.set(
      "returnTo",
      `${withoutBasePath(request.nextUrl.pathname)}${request.nextUrl.search}`,
    );
  }
  const response = NextResponse.redirect(url, 303);
  if (clearCookie) response.cookies.delete(SESSION_COOKIE_NAME);
  return withSecurityHeaders(response, requestId, nonce);
}

function safeRequestId(value) {
  return /^[A-Za-z0-9._:-]{1,64}$/.test(value || "")
    ? value
    : randomUUID();
}

function encodeAuthContext(user) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

export async function middleware(request, event) {
  const requestId = safeRequestId(request.headers.get("x-request-id"));
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const backgroundTasks = [];
  const finish = (response) => {
    if (backgroundTasks.length > 0) {
      event?.waitUntil?.(Promise.allSettled(backgroundTasks));
    }
    return withSecurityHeaders(response, requestId, nonce);
  };

  if (!isSafeOrigin(request)) {
    return finish(
      NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
    );
  }

  const pathname =
    withoutBasePath(request.nextUrl.pathname).replace(/\/+$/, "") || "/";
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;

  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    try {
      const candidate = await prisma.auth_sessions.findUnique({
        where: { token_hash: tokenHash },
        select: {
          id: true,
          expires_at: true,
          revoked_at: true,
          last_seen_at: true,
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
        candidate &&
        !candidate.revoked_at &&
        candidate.expires_at > new Date() &&
        candidate.user.is_active &&
        ALLOWED_ROLES.includes(candidate.user.role)
      ) {
        session = candidate;
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "kr-production",
          message: "Session verification failed",
          requestId,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
      return finish(
        NextResponse.json(
          { error: "Service temporarily unavailable." },
          { status: 503 },
        ),
      );
    }

    if (
      session &&
      Date.now() - session.last_seen_at.getTime() > 15 * 60 * 1000
    ) {
      backgroundTasks.push(
        prisma.auth_sessions
          .update({
            where: { id: session.id },
            data: { last_seen_at: new Date() },
          })
          .catch(() => undefined),
      );
    }
  }

  if (pathname === "/login" && session) {
    return finish(
      NextResponse.redirect(new URL(withBasePath("/"), request.url), 303),
    );
  }

  if (!isPublicPath(pathname) && !session) {
    return redirectToLogin(request, requestId, nonce, Boolean(token));
  }

  if (
    session?.user.must_change_password &&
    pathname !== "/account/security"
  ) {
    return finish(
      NextResponse.redirect(
        new URL(withBasePath("/account/security"), request.url),
        303,
      ),
    );
  }

  if (pathname.startsWith("/admin") && session?.user.role !== "ADMIN") {
    return finish(
      NextResponse.redirect(new URL(withBasePath("/"), request.url), 303),
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_CONTEXT_HEADER);
  if (session) {
    requestHeaders.set(
      AUTH_CONTEXT_HEADER,
      encodeAuthContext({
        id: session.user.id,
        username: session.user.username,
        display_name: session.user.display_name,
        role: session.user.role,
        must_change_password: session.user.must_change_password,
      }),
    );
  }
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (
    session &&
    request.method === "POST" &&
    process.env.AUDIT_SERVER_ACTIONS !== "false"
  ) {
    try {
      backgroundTasks.push(
        prisma.audit_logs
          .create({
            data: {
              user_id: session.user.id,
              username: session.user.username,
              event_type: "SERVER_ACTION_REQUEST",
              outcome: "ACCEPTED",
              action: "server_action",
              resource: pathname.slice(0, 255),
              request_id: requestId,
              ip_address: (
                request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                request.headers.get("x-real-ip") ||
                "unknown"
              ).slice(0, 64),
              user_agent: (request.headers.get("user-agent") || "unknown").slice(
                0,
                512,
              ),
            },
          })
          .catch((error) => {
            console.error(
              JSON.stringify({
                timestamp: new Date().toISOString(),
                level: "error",
                service: "kr-production",
                message: "Failed to persist server action audit event",
                requestId,
                error: error instanceof Error ? error.message : "unknown",
              }),
            );
          }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "kr-production",
          message: "Failed to persist server action audit event",
          requestId,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }

  return finish(response);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|header-logo.png).*)"],
};
