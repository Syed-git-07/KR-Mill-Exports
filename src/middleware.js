import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/security/constants";
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

  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "");
  const expected = `${protocol}://${host}`;
  const configured = (process.env.AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return origin === expected || configured.includes(origin);
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
      withBasePath(
        `${withoutBasePath(request.nextUrl.pathname)}${request.nextUrl.search}`,
      ),
    );
  }
  const response = NextResponse.redirect(url, 303);
  if (clearCookie) response.cookies.delete(SESSION_COOKIE_NAME);
  return withSecurityHeaders(response, requestId, nonce);
}

export async function middleware(request) {
  const requestId = request.headers.get("x-request-id") || randomUUID();
  const nonce = Buffer.from(randomUUID()).toString("base64");

  if (!isSafeOrigin(request)) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
      requestId,
      nonce,
    );
  }

  const pathname =
    withoutBasePath(request.nextUrl.pathname).replace(/\/+$/, "") || "/";
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;

  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    session = await prisma.auth_sessions.findFirst({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
        expires_at: { gt: new Date() },
        user: { is_active: true },
      },
      select: {
        id: true,
        last_seen_at: true,
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            must_change_password: true,
          },
        },
      },
    });

    if (
      session &&
      Date.now() - session.last_seen_at.getTime() > 15 * 60 * 1000
    ) {
      await prisma.auth_sessions.update({
        where: { id: session.id },
        data: { last_seen_at: new Date() },
      });
    }
  }

  if (pathname === "/login" && session) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL(withBasePath("/"), request.url), 303),
      requestId,
      nonce,
    );
  }

  if (!isPublicPath(pathname) && !session) {
    return redirectToLogin(request, requestId, nonce, Boolean(token));
  }

  if (
    session?.user.must_change_password &&
    pathname !== "/account/security"
  ) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(withBasePath("/account/security"), request.url),
        303,
      ),
      requestId,
      nonce,
    );
  }

  if (pathname.startsWith("/admin") && session?.user.role !== "ADMIN") {
    return withSecurityHeaders(
      NextResponse.redirect(new URL(withBasePath("/"), request.url), 303),
      requestId,
      nonce,
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (
    session &&
    request.method === "POST" &&
    process.env.AUDIT_SERVER_ACTIONS !== "false"
  ) {
    try {
      await prisma.audit_logs.create({
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
      });
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

  return withSecurityHeaders(response, requestId, nonce);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
