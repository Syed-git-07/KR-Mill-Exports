import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = Object.freeze({ N: 131072, r: 8, p: 1 });
const MAX_MEMORY = 256 * 1024 * 1024;
const HASH_VERSION = "scrypt-v1";

export function validatePassword(password, { username = "" } = {}) {
  if (typeof password !== "string" || password.length < 6) {
    return "Use at least 6 characters.";
  }
  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  const normalizedUsername = String(username).toLowerCase();
  if (
    normalizedUsername.length >= 3 &&
    password.toLowerCase().includes(normalizedUsername)
  ) {
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

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    ...SCRYPT_PARAMS,
    maxmem: MAX_MEMORY,
  });

  return [
    HASH_VERSION,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password, storedHash) {
  try {
    const [version, n, r, p, saltValue, hashValue] =
      String(storedHash).split("$");
    if (version !== HASH_VERSION) return false;

    const params = { N: Number(n), r: Number(r), p: Number(p) };
    if (
      params.N !== SCRYPT_PARAMS.N ||
      params.r !== SCRYPT_PARAMS.r ||
      params.p !== SCRYPT_PARAMS.p
    ) {
      return false;
    }

    const expected = Buffer.from(hashValue, "base64url");
    if (expected.length !== KEY_LENGTH) return false;

    const actual = Buffer.from(
      await scrypt(
        password,
        Buffer.from(saltValue, "base64url"),
        expected.length,
        { ...params, maxmem: MAX_MEMORY },
      ),
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
