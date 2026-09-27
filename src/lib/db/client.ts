import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { MIGRATIONS } from "./migrations";

/**
 * Node 24 ships SQLite in core, so there is no native module to compile. The
 * previous `better-sqlite3` attempt took over 12 minutes and never finished.
 *
 * The connection is cached on `globalThis` because Next.js re-evaluates modules
 * on hot reload, and a second handle to the same file would fight the first one
 * over the write lock.
 */
const CACHE_KEY = Symbol.for("thonmai.db");

type GlobalWithDb = typeof globalThis & { [CACHE_KEY]?: DatabaseSync };

export function dbPath(): string {
  const configured = process.env.THONMAI_DB_PATH;
  const target = configured && configured.length > 0 ? configured : ".thonmai/app.db";
  return path.isAbsolute(target) ? target : path.join(process.cwd(), target);
}

function open(file: string = dbPath()): DatabaseSync {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  }

  const handle = new DatabaseSync(file);

  // The 0700 directory already blocks other users, but the file itself should
  // not be world-readable either: it holds password hashes and saved answers.
  if (file !== ":memory:") {
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // Some filesystems (and mounted volumes) reject chmod; the directory
      // permissions are the real control, so this is not fatal.
    }
  }

  // WAL lets a reader run while a write is in flight. NORMAL synchronous is the
  // standard durability/throughput trade-off for a single-process app; it still
  // survives a process crash, only risking the last transaction on power loss.
  if (file !== ":memory:") {
    handle.exec("PRAGMA journal_mode = WAL");
  }
  handle.exec("PRAGMA foreign_keys = ON");
  handle.exec("PRAGMA busy_timeout = 5000");

  migrate(handle);
  return handle;
}

function migrate(handle: DatabaseSync): void {
  const current = handle.prepare("PRAGMA user_version").get() as { user_version: number };
  const from = Number(current?.user_version ?? 0);

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    handle.exec("BEGIN");
    try {
      handle.exec(migration.sql);
      // PRAGMA will not accept a bound parameter, and the value is a literal
      // from our own migration table, never user input.
      handle.exec(`PRAGMA user_version = ${migration.version}`);
      handle.exec("COMMIT");
    } catch (error) {
      handle.exec("ROLLBACK");
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

export function getDb(): DatabaseSync {
  const scope = globalThis as GlobalWithDb;
  scope[CACHE_KEY] ??= open();
  return scope[CACHE_KEY];
}

/** Test helper: swap the cached handle for a fresh, isolated in-memory database. */
export function useInMemoryDb(): DatabaseSync {
  const scope = globalThis as GlobalWithDb;
  scope[CACHE_KEY] = open(":memory:");
  return scope[CACHE_KEY];
}

/** Test helper: forget the cached handle so the next call reopens from disk. */
export function closeDb(): void {
  const scope = globalThis as GlobalWithDb;
  const handle = scope[CACHE_KEY];
  if (handle) {
    handle.close();
    delete scope[CACHE_KEY];
  }
}
