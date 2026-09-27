import bcrypt from "bcryptjs";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Cost 12 is roughly 250ms on current hardware: slow enough to make offline
 * cracking expensive, fast enough that a login still feels instant.
 */
const BCRYPT_COST = 12;

/**
 * A real hash of a value nobody can log in with. When an email is unknown we
 * still run a comparison against this, so a missing account and a wrong
 * password take the same time and cannot be told apart by an attacker.
 */
const DUMMY_HASH = bcrypt.hashSync("thonmai-timing-equaliser", BCRYPT_COST);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Returns true only for a correct password. Always performs a comparison so the
 * response time does not reveal whether the account exists.
 */
export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  const target = hash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(plain, target);
  // `hash === null` means "no such user": report failure, but only after the
  // dummy comparison above has already burned the same time.
  return hash !== null && ok;
}

/** 256 bits of entropy, URL-safe. Only the digest of this is ever stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare for anything an attacker could iterate on. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const SESSION_TTL_DAYS = 30;
export const SESSION_COOKIE = "thonmai_session";

export interface SessionCookieOptions {
  secure: boolean;
}

export function sessionCookieOptions({ secure }: SessionCookieOptions): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    // No JavaScript access, so an XSS bug cannot steal the session.
    httpOnly: true,
    // Lax still sends the cookie on top-level navigation, which keeps the
    // login redirect working while blocking cross-site POSTs.
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}
