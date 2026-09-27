import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb, useInMemoryDb } from "@/lib/db/client";
import { deleteProfile, getProfile, listProfiles, saveProfile } from "@/lib/profiles/store";
import { createUser, destroyAllSessionsForUser } from "@/lib/auth/session-store";
import type { StudentProfile } from "@/engine/types";

const base: StudentProfile = {
  level: "ug",
  classOrYear: 2,
  gender: "female",
  community: "BC",
  domicileState: "Tamil Nadu",
  admissionRoute: "government_quota",
  institutionType: "government",
} as StudentProfile;

beforeEach(() => {
  useInMemoryDb();
});

afterAll(() => {
  closeDb();
});

describe("saved profiles", () => {
  it("round-trips a profile without losing any field", () => {
    const user = createUser("a@example.com", "hash");
    const profile = { ...base, annualFamilyIncome: 180000, isFirstGraduate: true } as StudentProfile;
    const saved = saveProfile({ userId: user.id, label: "Engineering", profile, documents: [] });

    const loaded = getProfile(user.id, saved.id);
    expect(loaded?.profile.annualFamilyIncome).toBe(180000);
    expect(loaded?.profile.isFirstGraduate).toBe(true);
    expect(loaded?.profile.level).toBe("ug");
    expect(loaded?.label).toBe("Engineering");
  });

  it("keeps an unanswered marker absent rather than defaulting it to false", () => {
    const user = createUser("b@example.com", "hash");
    const saved = saveProfile({ userId: user.id, label: "Bare", profile: base, documents: [] });
    const loaded = getProfile(user.id, saved.id);
    expect(loaded?.profile.isFirstGraduate).toBeUndefined();
    expect("isFirstGraduate" in (loaded?.profile ?? {})).toBe(false);
  });

  it("updates in place when an id is supplied", () => {
    const user = createUser("c@example.com", "hash");
    const first = saveProfile({ userId: user.id, label: "Old", profile: base, documents: [] });
    const updated = saveProfile({
      userId: user.id,
      id: first.id,
      label: "New",
      profile: { ...base, course: "MBBS" } as StudentProfile,
      documents: [],
    });

    expect(updated.id).toBe(first.id);
    expect(updated.label).toBe("New");
    expect(listProfiles(user.id)).toHaveLength(1);
  });

  it("lists a user's profiles newest first", async () => {
    const user = createUser("d@example.com", "hash");
    const first = saveProfile({ userId: user.id, label: "First", profile: base, documents: [] });
    // SQLite timestamps have second precision, so separate the rows explicitly.
    await new Promise((r) => setTimeout(r, 1100));
    saveProfile({ userId: user.id, label: "Second", profile: base, documents: [] });

    const list = listProfiles(user.id);
    expect(list.map((p) => p.label)).toEqual(["Second", "First"]);
    expect(list[0]?.id).not.toBe(first.id);
  });

  it("never shows one account another account's profiles", () => {
    const alice = createUser("alice@example.com", "hash");
    const bob = createUser("bob@example.com", "hash");
    const saved = saveProfile({ userId: alice.id, label: "Alice's", profile: base, documents: [] });

    expect(listProfiles(bob.id)).toEqual([]);
    expect(getProfile(bob.id, saved.id)).toBeNull();
  });

  it("does not let one account overwrite another account's profile", () => {
    const alice = createUser("alice2@example.com", "hash");
    const bob = createUser("bob2@example.com", "hash");
    const saved = saveProfile({ userId: alice.id, label: "Alice's", profile: base, documents: [] });

    // Bob supplies Alice's id; the UPDATE is scoped to his user_id, so it is a
    // no-op and the code falls through to inserting a new row of his own.
    saveProfile({
      userId: bob.id,
      id: saved.id,
      label: "Hijacked",
      profile: base,
      documents: [],
    });

    expect(getProfile(alice.id, saved.id)?.label).toBe("Alice's");
    expect(listProfiles(bob.id)).toHaveLength(1);
  });

  it("refuses to delete another account's profile", () => {
    const alice = createUser("alice3@example.com", "hash");
    const bob = createUser("bob3@example.com", "hash");
    const saved = saveProfile({ userId: alice.id, label: "Alice's", profile: base, documents: [] });

    expect(deleteProfile(bob.id, saved.id)).toBe(false);
    expect(getProfile(alice.id, saved.id)).not.toBeNull();
  });

  it("deletes its own profile", () => {
    const user = createUser("e@example.com", "hash");
    const saved = saveProfile({ userId: user.id, label: "Temp", profile: base, documents: [] });
    expect(deleteProfile(user.id, saved.id)).toBe(true);
    expect(getProfile(user.id, saved.id)).toBeNull();
  });

  it("stores held documents alongside the profile", () => {
    const user = createUser("f@example.com", "hash");
    const saved = saveProfile({
      userId: user.id,
      label: "With docs",
      profile: base,
      documents: [{ type: "community_certificate", confirmed: true }] as never,
    });
    expect(getProfile(user.id, saved.id)?.documents).toHaveLength(1);
  });

  it("removes a user's profiles when the account is deleted", () => {
    const user = createUser("g@example.com", "hash");
    saveProfile({ userId: user.id, label: "Doomed", profile: base, documents: [] });
    saveProfile({ userId: user.id, label: "Doomed too", profile: base, documents: [] });

    // ON DELETE CASCADE only fires because the client turns foreign_keys on.
    getDb().prepare("DELETE FROM users WHERE id = ?").run(user.id);

    expect(listProfiles(user.id)).toEqual([]);
    destroyAllSessionsForUser(user.id);
  });
});
