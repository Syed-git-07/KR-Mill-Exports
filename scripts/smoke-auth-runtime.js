const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");

const port = 3105;
const origin = `http://127.0.0.1:${port}`;
const basePathCandidates = ["", process.env.NEXT_PUBLIC_BASE_PATH];
for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    basePathCandidates.push(dotenv.parse(readFileSync(envFile)).NEXT_PUBLIC_BASE_PATH);
  }
}
const normalizedBasePaths = [...new Set(basePathCandidates
  .filter((value) => typeof value === "string")
  .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
  .map((value) => value && value !== "/" ? `/${value.replace(/^\/+|\/+$/g, "")}` : ""))];
let activeBasePath = "";
const prisma = new PrismaClient();
let smokeUserId;
let serverOutput = "";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-8192);
  });
}

async function waitUntilReady() {
  // Larger production bundles can take longer than 15 seconds to become ready
  // on the Windows server hardware used for deployment and CI validation.
  let lastResponse = "no HTTP response";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    for (const basePath of normalizedBasePaths) {
      try {
        const response = await fetch(`${origin}${basePath}/api/health`);
        if (response.ok) {
          activeBasePath = basePath;
          return;
        }
        lastResponse = `${response.status} ${response.url}`;
      } catch {
        // The listener is still starting.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Production server did not become ready (exit ${server.exitCode ?? "pending"}; ${lastResponse}).\n${serverOutput}`,
  );
}

function appUrl(path) {
  return `${origin}${activeBasePath}${path}`;
}

async function main() {
  await waitUntilReady();

  const health = await fetch(appUrl("/api/health"));
  assert.equal(health.status, 200);

  const root = await fetch(appUrl("/"), { redirect: "manual" });
  assert.equal(root.status, 303);
  assert.match(root.headers.get("location") || "", /\/login\?returnTo=%2F$/);

  const login = await fetch(appUrl("/login"));
  assert.equal(login.status, 200);
  assert.match(login.headers.get("content-security-policy") || "", /default-src 'self'/);
  assert.equal(login.headers.get("x-frame-options"), "DENY");
  assert.equal(login.headers.get("x-content-type-options"), "nosniff");
  assert.doesNotMatch(await login.text(), /data-app-auth-header/);

  const report = await fetch(
    appUrl("/reports/PREPARATORY%20STOPPAGE%20PERCENTAGE%20REPORT.pdf"),
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
    "/admin/payroll-mapping/",
  ];
  for (const route of protectedRoutes) {
    const response = await fetch(appUrl(route), { redirect: "manual" });
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

  const authenticatedHome = await fetch(appUrl("/"), {
    headers: authenticatedHeaders,
  });
  assert.equal(authenticatedHome.status, 200);
  const authenticatedHomeHtml = await authenticatedHome.text();
  assert.match(authenticatedHomeHtml, /data-app-auth-header/);

  const authenticatedModule = await fetch(appUrl("/masters/"), {
    headers: authenticatedHeaders,
  });
  assert.equal(authenticatedModule.status, 200);
  const authenticatedModuleHtml = await authenticatedModule.text();
  assert.match(authenticatedModuleHtml, /data-app-auth-header/);

  const authenticatedReportRoutes = [
    "/reports/",
    "/reports/autoconer/abstract/",
    "/reports/autoconer/count-wise-production/",
    "/reports/autoconer/efficiency/",
    "/reports/autoconer/low-efficiency/",
    "/reports/autoconer/particular-sider/",
    "/reports/autoconer/stoppage-percentage/",
    "/reports/preparatory/sider-performance/",
    "/reports/preparatory/stoppage-percentage/",
    "/reports/preparatory/waste-abstract/",
    "/reports/spinning/daily-production/",
    "/reports/spinning/machine-wise-production/",
    "/reports/spinning/production-abstract/",
    "/reports/spinning/shift-count-production/",
    "/reports/spinning/sider-monthly/",
    "/reports/spinning/stoppage-percentage/",
    "/reports/final/preparatory-abstract/",
    "/reports/final/preparatory-particular-sider/",
    "/reports/final/preparatory-shift-production/",
    "/reports/final/autoconer-shift-production/",
    "/reports/final/autoconer-sider-monthly/",
    "/reports/final/spinning-count-gps/",
    "/reports/final/spinning-sider-wise/",
    "/reports/final/spinning-daily-shift/",
    "/reports/final/spinning-particular-sider/",
    "/reports/final/spinning-stoppage-abstract/",
  ];
  for (const route of authenticatedReportRoutes) {
    const response = await fetch(appUrl(route), { headers: authenticatedHeaders });
    assert.equal(response.status, 200, `${route} must render for an authenticated user`);
    assert.match(await response.text(), /data-app-auth-header/);
  }

  for (const route of ["/account/security/", "/admin/security-logs/", "/admin/payroll-mapping/"]) {
    const response = await fetch(appUrl(route), {
      headers: authenticatedHeaders,
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /data-app-auth-header/);
  }

  await prisma.auth_sessions.update({
    where: { id: smokeSession.id },
    data: { revoked_at: new Date() },
  });
  const afterLogoutModule = await fetch(appUrl("/masters/"), {
    redirect: "manual",
    headers: authenticatedHeaders,
  });
  assert.equal(afterLogoutModule.status, 303);
  assert.match(
    afterLogoutModule.headers.get("location") || "",
    /\/login\?returnTo=/,
  );

  const forgedSession = await fetch(appUrl("/"), {
    redirect: "manual",
    headers: { Cookie: "kr_session=forged-token" },
  });
  assert.equal(forgedSession.status, 303);
  assert.match(forgedSession.headers.get("set-cookie") || "", /kr_session=/);

  const crossOriginPost = await fetch(appUrl("/api/health"), {
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
        "all authenticated report routes render",
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
