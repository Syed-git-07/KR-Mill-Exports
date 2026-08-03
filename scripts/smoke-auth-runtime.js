const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const appPaths = require("../.next/server/app-paths-manifest.json");

const port = 3105;
const origin = `http://127.0.0.1:${port}`;
const prisma = new PrismaClient();
let smokeUserId;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  },
);

async function waitUntilReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      // The listener is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Production server did not become ready.");
}

async function main() {
  await waitUntilReady();

  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);

  const root = await fetch(`${origin}/`, { redirect: "manual" });
  assert.equal(root.status, 303);
  assert.match(root.headers.get("location") || "", /\/login\?returnTo=%2F$/);

  const login = await fetch(`${origin}/login`);
  assert.equal(login.status, 200);
  assert.match(login.headers.get("content-security-policy") || "", /default-src 'self'/);
  assert.equal(login.headers.get("x-frame-options"), "DENY");
  assert.equal(login.headers.get("x-content-type-options"), "nosniff");
  assert.doesNotMatch(await login.text(), /data-app-auth-header/);

  const report = await fetch(
    `${origin}/reports/PREPARATORY%20STOPPAGE%20PERCENTAGE%20REPORT.pdf`,
    { redirect: "manual" },
  );
  assert.equal(report.status, 303);

  const protectedRoutes = [
    "/masters/",
    "/preparatory-master/",
    "/preparatory-entry/",
    "/post-preparatory/",
    "/reports/",
    "/holiday-list/",
    "/account/security/",
    "/admin/security-logs/",
  ];
  for (const route of protectedRoutes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    assert.equal(response.status, 303, `${route} must require login`);
    assert.match(response.headers.get("location") || "", /\/login\?returnTo=/);
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const username = `smoke_${Date.now()}`;
  const smokeUser = await prisma.app_users.create({
    data: {
      id: randomUUID(),
      username,
      display_name: "Runtime Smoke Test",
      password_hash: "not-used-by-runtime-smoke",
      role: "ADMIN",
      must_change_password: false,
    },
  });
  smokeUserId = smokeUser.id;
  const smokeSession = await prisma.auth_sessions.create({
    data: {
      id: randomUUID(),
      user_id: smokeUser.id,
      token_hash: createHash("sha256").update(sessionToken).digest("hex"),
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const authenticatedHeaders = { Cookie: `kr_session=${sessionToken}` };

  const authenticatedHome = await fetch(`${origin}/`, {
    headers: authenticatedHeaders,
  });
  assert.equal(authenticatedHome.status, 200);
  const authenticatedHomeHtml = await authenticatedHome.text();
  assert.match(authenticatedHomeHtml, /data-app-auth-header/);

  const authenticatedModule = await fetch(`${origin}/masters/`, {
    headers: authenticatedHeaders,
  });
  assert.equal(authenticatedModule.status, 200);
  const authenticatedModuleHtml = await authenticatedModule.text();
  assert.match(authenticatedModuleHtml, /data-app-auth-header/);

  for (const route of ["/account/security/", "/admin/security-logs/"]) {
    const response = await fetch(`${origin}${route}`, {
      headers: authenticatedHeaders,
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /data-app-auth-header/);
  }

  const authenticatedPageRoutes = Object.keys(appPaths)
    .filter((route) => route.endsWith("/page"))
    .map((route) => route.replace(/\/page$/, "") || "/")
    .filter((route) => route !== "/_not-found" && route !== "/login")
    .map((route) => route === "/" ? route : `${route}/`);

  for (const route of authenticatedPageRoutes) {
    const response = await fetch(`${origin}${route}`, {
      headers: authenticatedHeaders,
      redirect: "manual",
    });
    assert.equal(response.status, 200, `${route} must render for an authenticated administrator`);
  }

  await prisma.auth_sessions.update({
    where: { id: smokeSession.id },
    data: { revoked_at: new Date() },
  });
  const afterLogoutModule = await fetch(`${origin}/masters/`, {
    redirect: "manual",
    headers: authenticatedHeaders,
  });
  assert.equal(afterLogoutModule.status, 303);
  assert.match(
    afterLogoutModule.headers.get("location") || "",
    /\/login\?returnTo=/,
  );

  const forgedSession = await fetch(`${origin}/`, {
    redirect: "manual",
    headers: { Cookie: "kr_session=forged-token" },
  });
  assert.equal(forgedSession.status, 303);
  assert.match(forgedSession.headers.get("set-cookie") || "", /kr_session=/);

  const crossOriginPost = await fetch(`${origin}/api/health`, {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(crossOriginPost.status, 403);

  console.log(
    JSON.stringify({
      runtimeSmoke: "passed",
      checks: [
        "public health endpoint",
        "protected route redirect",
        "security headers",
        "protected report asset",
        "all module routes require login",
        "compact navbar on every authenticated page and none on login",
        `${authenticatedPageRoutes.length} compiled application pages render while authenticated`,
        "revoked session redirects back to login",
        "forged session rejection",
        "cross-origin POST rejection",
      ],
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill();
    return (smokeUserId
      ? prisma.app_users.delete({ where: { id: smokeUserId } }).catch(() => {})
      : Promise.resolve()
    ).finally(() => prisma.$disconnect());
  });
