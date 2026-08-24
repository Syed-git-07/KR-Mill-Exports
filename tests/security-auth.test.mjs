import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "../src/lib/security/password.js";
import {
  isValidUsername,
  normalizeUsername,
  safeReturnPath,
} from "../src/lib/security/request.js";
import { sanitizeProductionDetailUpdate } from "../src/lib/queries/productionDetailUpdate.js";

test("password hashes are salted, opaque, and verifiable", async () => {
  const password = "Correct-Horse-Factory-29!";
  const [firstHash, secondHash] = await Promise.all([
    hashPassword(password),
    hashPassword(password),
  ]);

  assert.notEqual(firstHash, secondHash);
  assert.equal(firstHash.includes(password), false);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword("Wrong-Password-29!", firstHash), false);
  assert.equal(await verifyPassword(password, "malformed"), false);
});

test("password policy rejects weak and identity-derived passwords", () => {
  assert.match(validatePassword("short"), /6 characters/);
  assert.equal(validatePassword("Ab3!xy"), null);
  assert.match(validatePassword("123456"), /less predictable/);
  assert.match(
    validatePassword("Admin-operator1-Password-29!", {
      username: "operator1",
    }),
    /username/,
  );
  assert.equal(
    validatePassword("Mill-Production-27", { username: "operator1" }),
    null,
  );
});

test("usernames are normalized and constrained", () => {
  assert.equal(normalizeUsername("  Shift.Admin  "), "shift.admin");
  assert.equal(isValidUsername("shift.admin"), true);
  assert.equal(isValidUsername("../admin"), false);
  assert.equal(isValidUsername("ab"), false);
});

test("post-login return paths cannot escape the application origin", () => {
  assert.equal(safeReturnPath("/reports?day=1"), "/reports?day=1");
  assert.equal(safeReturnPath("https://evil.example"), "/");
  assert.equal(safeReturnPath("//evil.example/path"), "/");
  assert.equal(safeReturnPath("javascript:alert(1)"), "/");
});

test("server actions leave base-path application to Next.js", async () => {
  const authActions = await readFile(
    path.resolve("src/app/actions/auth.js"),
    "utf8",
  );

  assert.doesNotMatch(authActions, /redirect\(\s*withBasePath/);
  assert.match(authActions, /withoutBasePath\(returnTo\)/);
  assert.match(authActions, /redirect\("\/login"\)/);
});

test("production detail updates cannot change ownership or audit fields", () => {
  assert.deepEqual(
    sanitizeProductionDetailUpdate({
      id: "replacement-id",
      header_id: "other-header",
      machine_id: "other-machine",
      created_at: new Date(0),
      updated_at: new Date(0),
      is_verified: true,
      verified_at: new Date(0),
      is_locked: true,
      machine: { id: "synthetic" },
      stoppage: { id: "synthetic" },
      speed: 99999,
      act_prodn: 125.5,
      remarks: "valid edit",
    }),
    { act_prodn: 125.5, remarks: "valid edit" },
  );
});

test("login uses a browser-session cookie with an eight-hour server limit", async () => {
  const [sessionSource, constantsSource, authActions] = await Promise.all([
    readFile(path.resolve("src/lib/security/session.js"), "utf8"),
    readFile(path.resolve("src/lib/security/constants.js"), "utf8"),
    readFile(path.resolve("src/app/actions/auth.js"), "utf8"),
  ]);
  const setCookieSource = sessionSource.slice(
    sessionSource.indexOf("export async function setSessionCookie"),
    sessionSource.indexOf("export async function clearSessionCookie"),
  );

  assert.match(constantsSource, /SESSION_DURATION_MS\s*=\s*8\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(setCookieSource, /httpOnly:\s*true/);
  assert.match(setCookieSource, /sameSite:\s*"strict"/);
  assert.doesNotMatch(setCookieSource, /\bexpires\s*:/);
  assert.doesNotMatch(setCookieSource, /\bmaxAge\s*:/);
  assert.match(authActions, /await setSessionCookie\(token\)/);
});

test("every exported application Server Action performs its own authentication check", async () => {
  const actionFiles = (await sourceFiles(path.resolve("src/app"))).filter(
    (file) =>
      !file.endsWith(`${path.sep}auth.js`) &&
      /^["']use server["'];?/m.test(readFileSync(file, "utf8")),
  );

  assert.ok(actionFiles.length > 0);
  for (const file of actionFiles) {
    const source = await readFile(file, "utf8");
    assert.match(
      source,
      /import \{[^}]*(?:requireUser|requireRole)[^}]*\} from ["']@\/lib\/security\/auth["']/,
      `${file} does not import an authentication or role guard`,
    );
    assert.doesNotMatch(
      source,
      /^export async function .*\{\r?\n(?!\s+(?:const user = )?await require(?:User|Role)\()/gm,
      `${file} exports an action without an authentication or role guard`,
    );
  }
});

test("middleware passes only its verified user context and defers audit writes", async () => {
  const source = await readFile(path.resolve("src/middleware.js"), "utf8");

  assert.match(source, /requestHeaders\.delete\(AUTH_CONTEXT_HEADER\)/);
  assert.match(source, /requestHeaders\.set\(\s*AUTH_CONTEXT_HEADER/);
  assert.match(source, /event\?\.waitUntil\?\./);
  assert.match(source, /private, no-store, max-age=0/);
});

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

test("runtime source does not use unsafe raw database APIs", async () => {
  const files = [
    ...(await sourceFiles(path.resolve("src"))),
    ...(await sourceFiles(path.resolve("scripts"))),
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /\$(?:queryRawUnsafe|executeRawUnsafe)/,
      `${file} uses a non-parameterized database API`,
    );
  }
});

test("customer login copy describes the product, not its security internals", async () => {
  const loginPage = await readFile(
    path.resolve("src/app/login/page.jsx"),
    "utf8",
  );
  const loginForm = await readFile(
    path.resolve("src/components/auth/LoginForm.jsx"),
    "utf8",
  );
  const customerCopy = `${loginPage}\n${loginForm}`;

  assert.doesNotMatch(
    customerCopy,
    /secure access|sign in securely|authenticated|revocable|hashing|audit trail/i,
  );
});

test("authenticated pages share one compact navbar and login remains separate", async () => {
  const rootLayout = await readFile(path.resolve("src/app/layout.js"), "utf8");
  const homePage = await readFile(path.resolve("src/app/page.js"), "utf8");
  const loginPage = await readFile(
    path.resolve("src/app/login/page.jsx"),
    "utf8",
  );
  const appHeader = await readFile(
    path.resolve("src/components/layout/AppHeader.jsx"),
    "utf8",
  );

  assert.match(rootLayout, /\{user && <AppHeader user=\{user\} \/>\}/);
  assert.doesNotMatch(homePage, /AppHeader/);
  assert.doesNotMatch(loginPage, /AppHeader/);
  assert.match(appHeader, /data-app-auth-header/);
  assert.match(appHeader, /router\.back\(\)/);
  assert.match(appHeader, /href="\/"/);
  assert.match(appHeader, /href="\/admin\/security-logs"/);
  assert.match(appHeader, /href="\/account\/security"/);
  assert.match(appHeader, /logoutAction/);
});
