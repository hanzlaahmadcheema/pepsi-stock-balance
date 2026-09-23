import crypto from "crypto";

/**
 * Generates a salted scrypt hash for local offline password verification.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Validates a password against a salted scrypt hash.
 */
export function verifyPassword(password: string, combinedHash: string | null | undefined): boolean {
  if (!combinedHash || !combinedHash.includes(":")) {
    return false;
  }

  try {
    const [salt, hash] = combinedHash.split(":");
    if (!salt || !hash) {
      return false;
    }

    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
  } catch {
    return false;
  }
}
