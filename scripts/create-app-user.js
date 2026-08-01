const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("node:crypto");
const { promisify } = require("node:util");
const { scrypt: nodeScrypt } = require("node:crypto");

const prisma = new PrismaClient();
const scrypt = promisify(nodeScrypt);

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk;
    return value.replace(/\r?\n$/, "");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write("Temporary password: ");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(value);
    };

    process.stdin.on("data", (character) => {
      if (character === "\u0003") {
        process.stdin.setRawMode(false);
        reject(new Error("Cancelled."));
        return;
      }
      if (character === "\r" || character === "\n") {
        finish();
        return;
      }
      if (character === "\u007f" || character === "\b") {
        if (value.length) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      value += character;
      process.stdout.write("*");
    });
  });
}

function passwordPolicy(password, username) {
  if (password.length < 6 || password.length > 128) {
    return "Password must contain 6–128 characters.";
  }
  if (password.toLowerCase().includes(username)) {
    return "Password must not contain the username.";
  }
  if (
    /^(password|password123|qwerty|admin123|letmein|welcome|changeme|123456|12345678|abcdef|abc123)$/i.test(password) ||
    /^(.)\1+$/.test(password)
  ) {
    return "Choose a less predictable password.";
  }
  return null;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return [
    "scrypt-v1",
    131072,
    8,
    1,
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

async function main() {
  const username = String(argument("username", ""))
    .normalize("NFKC")
    .trim()
    .toLowerCase();
  const displayName = String(argument("name", "")).trim();
  const role = String(argument("role", "OPERATOR")).toUpperCase();
  const reset = hasFlag("reset");

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new Error(
      "Provide --username using 3–64 lowercase letters, numbers, dots, underscores, or hyphens.",
    );
  }
  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error("Provide --name with 2–120 characters.");
  }
  if (!["ADMIN", "OPERATOR"].includes(role)) {
    throw new Error("--role must be ADMIN or OPERATOR.");
  }

  const password = await readPassword();
  const policyError = passwordPolicy(password, username);
  if (policyError) throw new Error(policyError);
  const passwordHash = await hashPassword(password);
  const existing = await prisma.app_users.findUnique({ where: { username } });

  if (existing && !reset) {
    throw new Error(
      `User "${username}" already exists. Add --reset to replace its password and revoke its sessions.`,
    );
  }

  let user;
  if (existing) {
    [user] = await prisma.$transaction([
      prisma.app_users.update({
        where: { id: existing.id },
        data: {
          display_name: displayName,
          role,
          password_hash: passwordHash,
          is_active: true,
          must_change_password: true,
          failed_login_count: 0,
          locked_until: null,
          password_changed_at: new Date(),
        },
      }),
      prisma.auth_sessions.updateMany({
        where: { user_id: existing.id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);
  } else {
    user = await prisma.app_users.create({
      data: {
        username,
        display_name: displayName,
        role,
        password_hash: passwordHash,
        must_change_password: true,
      },
    });
  }

  await prisma.audit_logs.create({
    data: {
      user_id: user.id,
      username: user.username,
      event_type: existing ? "USER_RESET" : "USER_CREATED",
      outcome: "SUCCESS",
      action: existing ? "reset_user" : "create_user",
      resource: `app_user:${user.id}`,
      details: { role, source: "create-app-user script" },
    },
  });

  console.log(
    `User "${username}" is ready with role ${role}. A password change is required at first sign-in.`,
  );
}

main()
  .catch((error) => {
    console.error(`User creation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
