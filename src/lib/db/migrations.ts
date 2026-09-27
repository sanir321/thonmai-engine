/**
 * Forward-only schema history. Append a new entry; never edit an applied one.
 * `PRAGMA user_version` records the highest version that has run, so applying
 * this file twice is a no-op.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "accounts-and-saved-profiles",
    sql: `
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash   TEXT NOT NULL UNIQUE,
        created_at   TEXT NOT NULL,
        expires_at   TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_user   ON sessions(user_id);
      CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

      CREATE TABLE profiles (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label           TEXT NOT NULL,
        level           TEXT NOT NULL,
        profile_json    TEXT NOT NULL,
        documents_json  TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );
      CREATE INDEX idx_profiles_user ON profiles(user_id, updated_at DESC);
    `,
  },
];
