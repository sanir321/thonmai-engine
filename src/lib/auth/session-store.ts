import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import {
  generateSessionToken,
  hashToken,
  SESSION_TTL_DAYS,
} from "@/lib/auth/crypto";

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Emails are matched case-insensitively; the stored form is always lowercase. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const row = getDb()
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .get(normaliseEmail(email)) as UserRow & { password_hash: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    passwordHash: row.password_hash,
  };
}

export function findUserById(id: string): User | null {
  const row = getDb()
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export function createUser(email: string, passwordHash: string): User {
  const id = randomUUID();
  const at = nowIso();
  getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, normaliseEmail(email), passwordHash, at, at);
  return { id, email: normaliseEmail(email), createdAt: at };
}

export function createSession(userId: string): { token: string; record: SessionRecord } {
  const token = generateSessionToken();
  const id = randomUUID();
  const at = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();

  getDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, userId, hashToken(token), at, expiresAt, at);

  return { token, record: { id, userId, expiresAt } };
}

/**
 * Resolves a raw cookie value to its user, deleting the row if it has expired.
 * A stale or forged token yields `null` rather than an error, so callers have a
 * single "not signed in" path.
 */
/** How stale `last_seen_at` may get before we bother writing it again. */
const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

export function resolveSession(token: string | undefined | null): User | null {
  if (!token) return null;
  const digest = hashToken(token);
  const db = getDb();

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.created_at, s.expires_at, s.last_seen_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .get(digest) as (UserRow & { expires_at: string; last_seen_at: string }) | undefined;

  if (!row) return null;

  if (row.expires_at <= nowIso()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(digest);
    return null;
  }

  // Throttle the write to once an hour. The comment here used to promise this
  // while the code updated on every single request, so a student clicking
  // through the checker generated a write per page load for no benefit. The
  // column is only ever read for "when did we last see this session", which an
  // hour of resolution is accurate enough for.
  const now = nowIso();
  const nowMs = Date.parse(now);
  // Date.parse returns NaN for a corrupt value; treat that as "never seen" so a
  // bad row gets repaired on the next request instead of blocking the session.
  const lastSeen = Date.parse(row.last_seen_at);
  if (!Number.isFinite(lastSeen) || nowMs - lastSeen >= LAST_SEEN_INTERVAL_MS) {
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(now, digest);
  }

  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function destroyAllSessionsForUser(userId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/** Housekeeping: drop rows that can no longer authenticate anyone. */
export function purgeExpiredSessions(): number {
  const result = getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
  return Number(result.changes);
}
