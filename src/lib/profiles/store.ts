import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { HeldDocument, StudentProfile } from "@/engine/types";

/**
 * A saved profile is the student's own answers, stored so they can return
 * without retyping. It is deliberately the same shape the engine consumes, so
 * reloading cannot drift from what a live request would have produced.
 */
export interface SavedProfile {
  id: string;
  label: string;
  level: string;
  profile: StudentProfile;
  documents: HeldDocument[];
  createdAt: string;
  updatedAt: string;
}

interface ProfileRow {
  id: string;
  label: string;
  level: string;
  profile_json: string;
  documents_json: string;
  created_at: string;
  updated_at: string;
}

function toSaved(row: ProfileRow): SavedProfile {
  return {
    id: row.id,
    label: row.label,
    level: row.level,
    profile: JSON.parse(row.profile_json) as StudentProfile,
    documents: JSON.parse(row.documents_json) as HeldDocument[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProfiles(userId: string): SavedProfile[] {
  const rows = getDb()
    .prepare("SELECT * FROM profiles WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as unknown as ProfileRow[];
  return rows.map(toSaved);
}

export function getProfile(userId: string, id: string): SavedProfile | null {
  // user_id is part of the WHERE clause, not just checked afterwards, so one
  // account can never read another's saved profile by guessing an id.
  const row = getDb()
    .prepare("SELECT * FROM profiles WHERE user_id = ? AND id = ?")
    .get(userId, id) as unknown as ProfileRow | undefined;
  return row ? toSaved(row) : null;
}

export function saveProfile(input: {
  userId: string;
  label: string;
  profile: StudentProfile;
  documents: HeldDocument[];
  id?: string;
}): SavedProfile {
  const db = getDb();
  const at = new Date().toISOString();

  if (input.id) {
    const result = db
      .prepare(
        `UPDATE profiles
            SET label = ?, level = ?, profile_json = ?, documents_json = ?, updated_at = ?
          WHERE user_id = ? AND id = ?`,
      )
      .run(
        input.label,
        input.profile.level,
        JSON.stringify(input.profile),
        JSON.stringify(input.documents),
        at,
        input.userId,
        input.id,
      );
    if (Number(result.changes) > 0) {
      return getProfile(input.userId, input.id)!;
    }
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO profiles (id, user_id, label, level, profile_json, documents_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.label,
    input.profile.level,
    JSON.stringify(input.profile),
    JSON.stringify(input.documents),
    at,
    at,
  );

  return getProfile(input.userId, id)!;
}

export function deleteProfile(userId: string, id: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM profiles WHERE user_id = ? AND id = ?")
    .run(userId, id);
  return Number(result.changes) > 0;
}
