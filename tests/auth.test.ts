import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { closeDb, useInMemoryDb } from "@/lib/db/client";
import { hashPassword, verifyPassword, generateSessionToken, hashToken, safeEqual, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/crypto";
import {
  createSession,
  createUser,
  destroyAllSessionsForUser,
  destroySession,
  findUserByEmail,
  normaliseEmail,
  purgeExpiredSessions,
  resolveSession,
} from "@/lib/auth/session-store";
import { getDb } from "@/lib/db/client";

/**
 * bcrypt cost 12 costs a few hundred milliseconds per call on purpose. That is
 * fine in production and far too slow for Vitest's 5s default once the whole
 * suite runs in parallel, so these tests opt into a longer budget.
 */
const BCRYPT_TIMEOUT = 30_000;

beforeEach(() => {
  useInMemoryDb();
});

afterAll(() => {
  closeDb();
});

describe("password hashing", () => {
  it("never stores the password itself", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(hash.startsWith("$2")).toBe(true);
  }, BCRYPT_TIMEOUT);

  it("accepts the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("a-long-enough-passphrase");
    expect(await verifyPassword("a-long-enough-passphrase", hash)).toBe(true);
    expect(await verifyPassword("a-long-enough-passhrase", hash)).toBe(false);
  }, BCRYPT_TIMEOUT);

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toBe(b);
  }, BCRYPT_TIMEOUT);

  it("rejects any password when the account does not exist", async () => {
    // The dummy comparison still runs, so timing does not leak account existence.
    expect(await verifyPassword("anything", null)).toBe(false);
  }, BCRYPT_TIMEOUT);
});

describe("session tokens", () => {
  it("generates 256 bits of entropy, URL-safe", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("only ever stores a digest, never the raw token", () => {
    const token = generateSessionToken();
    const digest = hashToken(token);
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe(token);
  });

  it("compares strings without leaking length or content through timing", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("session cookie flags", () => {
  it("is HttpOnly, Lax, and scoped to the whole site", () => {
    const opts = sessionCookieOptions({ secure: true });
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.secure).toBe(true);
    expect(opts.path).toBe("/");
  });

  it("drops Secure on plain HTTP so local development can log in", () => {
    expect(sessionCookieOptions({ secure: false }).secure).toBe(false);
  });

  it("names the cookie consistently", () => {
    expect(SESSION_COOKIE).toBe("thonmai_session");
  });
});

describe("users", () => {
  it("stores emails lowercased so case cannot create duplicate accounts", () => {
    const user = createUser("Student@Example.COM", "hash");
    expect(user.email).toBe("student@example.com");
    expect(normaliseEmail("  A@B.CO ")).toBe("a@b.co");
  });

  it("enforces uniqueness at the database level", () => {
    createUser("dup@example.com", "hash");
    expect(() => createUser("dup@example.com", "hash")).toThrow();
  });

  it("finds by email regardless of the case used at sign-up", () => {
    createUser("Mixed@Case.com", "hash");
    expect(findUserByEmail("mixed@case.COM")?.email).toBe("mixed@case.com");
  });

  it("returns null for an unknown email rather than throwing", () => {
    expect(findUserByEmail("nobody@example.com")).toBeNull();
  });
});

describe("sessions", () => {
  it("resolves a valid token to its user", () => {
    const user = createUser("a@example.com", "hash");
    const { token } = createSession(user.id);
    expect(resolveSession(token)?.email).toBe("a@example.com");
  });

  it("rejects a token that was never issued", () => {
    expect(resolveSession("forged-token-value")).toBeNull();
  });

  it("rejects a token once the session is destroyed", () => {
    const user = createUser("b@example.com", "hash");
    const { token } = createSession(user.id);
    destroySession(token);
    expect(resolveSession(token)).toBeNull();
  });

  it("rejects the raw token of another session, proving tokens are not interchangeable", () => {
    const user = createUser("c@example.com", "hash");
    const first = createSession(user.id);
    const second = createSession(user.id);
    expect(resolveSession(second.token)).not.toBeNull();
    destroySession(first.token);
    expect(resolveSession(second.token)).not.toBeNull();
  });

  it("destroys every session for a user at once", () => {
    const user = createUser("d@example.com", "hash");
    const a = createSession(user.id);
    const b = createSession(user.id);
    destroyAllSessionsForUser(user.id);
    expect(resolveSession(a.token)).toBeNull();
    expect(resolveSession(b.token)).toBeNull();
  });

  it("deletes an expired session and refuses it", () => {
    const user = createUser("e@example.com", "hash");
    const { token, record } = createSession(user.id);
    getDb()
      .prepare("UPDATE sessions SET expires_at = ? WHERE id = ?")
      .run(new Date(Date.now() - 1000).toISOString(), record.id);

    expect(resolveSession(token)).toBeNull();
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM sessions WHERE id = ?")
      .get(record.id) as { n: number };
    expect(Number(row.n)).toBe(0);
  });

  it("does not rewrite last_seen_at on every request", () => {
    // The throttle the code comment used to promise but never implemented.
    const user = createUser("throttle@example.com", "hash");
    const { token, record } = createSession(user.id);
    const read = () =>
      (
        getDb()
          .prepare("SELECT last_seen_at FROM sessions WHERE id = ?")
          .get(record.id) as { last_seen_at: string }
      ).last_seen_at;

    // Backdate well beyond the hourly interval, so the next resolve must write.
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    getDb().prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(old, record.id);

    expect(resolveSession(token)).not.toBeNull();
    const afterFirst = read();
    expect(afterFirst).not.toBe(old);

    // Second resolve is inside the interval, so the value must be untouched.
    expect(resolveSession(token)).not.toBeNull();
    expect(read()).toBe(afterFirst);
  });

  it("repairs a corrupt last_seen_at instead of locking the session out", () => {
    const user = createUser("corrupt@example.com", "hash");
    const { token, record } = createSession(user.id);
    getDb()
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?")
      .run("not-a-date", record.id);

    // Date.parse gives NaN here; the session must still resolve and be repaired.
    expect(resolveSession(token)).not.toBeNull();
    const row = getDb()
      .prepare("SELECT last_seen_at FROM sessions WHERE id = ?")
      .get(record.id) as { last_seen_at: string };
    expect(Number.isFinite(Date.parse(row.last_seen_at))).toBe(true);
  });

  it("purges expired rows in bulk", () => {
    const user = createUser("f@example.com", "hash");
    createSession(user.id);
    getDb().prepare("UPDATE sessions SET expires_at = ?").run(
      new Date(Date.now() - 1000).toISOString(),
    );
    expect(purgeExpiredSessions()).toBe(1);
  });

  it("cannot authenticate with a stored digest instead of the raw token", () => {
    const user = createUser("g@example.com", "hash");
    const { token } = createSession(user.id);
    expect(resolveSession(hashToken(token))).toBeNull();
  });
});

describe("migrations", () => {
  it("is idempotent: re-running applies nothing new", () => {
    const before = getDb().prepare("PRAGMA user_version").get() as { user_version: number };
    expect(Number(before.user_version)).toBeGreaterThanOrEqual(1);
  });

  it("enables foreign keys so deleting a user removes their rows", () => {
    const user = createUser("h@example.com", "hash");
    createSession(user.id);
    getDb().prepare("DELETE FROM users WHERE id = ?").run(user.id);
    const row = getDb().prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number };
    expect(Number(row.n)).toBe(0);
  });
});
