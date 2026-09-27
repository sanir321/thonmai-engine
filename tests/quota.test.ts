import { describe, expect, it } from "vitest";
import {
  allCodes,
  blockShare,
  CENTRAL_EWS_RULE,
  CENTRAL_RESERVATION,
  TN_HORIZONTAL_QUOTAS,
  TN_QUOTA_BLOCKS,
  TN_QUOTA_ROSTER,
  TN_SPECIAL_QUOTAS,
} from "@data/quota";

/** Percentage of a block, treating sub-quotas (null) as absent. */
const pct = (code: string): number =>
  TN_QUOTA_ROSTER.find((c) => c.code === code)?.percentage ?? 0;

describe("Tamil Nadu reservation arithmetic", () => {
  it("allocates the top-level blocks to exactly 100%", () => {
    const total = TN_QUOTA_BLOCKS.reduce((s, b) => s + blockShare(b), 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("gives every top-level block a numeric percentage", () => {
    for (const b of TN_QUOTA_BLOCKS) {
      expect(typeof b.percentage, b.code).toBe("number");
    }
  });

  it("reserves 69% and leaves 31% for the open category", () => {
    expect(pct("OC")).toBe(31);
    const reserved = 100 - pct("OC");
    expect(reserved).toBeCloseTo(69, 5);
  });

  it("keeps BC and BCM inside the 30% BC block", () => {
    expect(pct("BC")).toBe(26.5);
    expect(pct("BCM")).toBe(3.5);
    expect(pct("BC") + pct("BCM")).toBeCloseTo(30, 5);
  });

  it("uses the block total, not the category share, for 100% arithmetic", () => {
    const bc = TN_QUOTA_BLOCKS.find((b) => b.code === "BC");
    // BC's own share is 26.5%, but the block it heads is 30%.
    expect(bc?.percentage).toBe(26.5);
    expect(blockShare(bc!)).toBe(30);
  });

  it("keeps SC and SCA inside the 18% SC block", () => {
    expect(pct("SC")).toBe(15);
    expect(pct("SCA")).toBe(3);
    expect(pct("SC") + pct("SCA")).toBeCloseTo(18, 5);
  });

  it("splits the 20% MBC/DNC block into 10.5 / 7 / 2.5", () => {
    const subs = TN_QUOTA_ROSTER.filter((c) => c.parentCode === "MBC");
    const sum = subs.reduce((s, c) => s + (c.percentage ?? 0), 0);
    expect(sum).toBeCloseTo(20, 5);
    expect(subs).toHaveLength(3);
    expect(pct("MBCV")).toBe(10.5);
    expect(pct("MBCDNC")).toBe(7);
    expect(pct("MBC_OTHER")).toBe(2.5);
    expect(pct("MBC")).toBe(20);
  });

  it("never lets a sub-quota exceed its parent block", () => {
    for (const sub of TN_QUOTA_ROSTER.filter((c) => c.isSubQuota)) {
      const parent = TN_QUOTA_ROSTER.find((c) => c.code === sub.parentCode);
      expect(parent, `${sub.code} has no parent block`).toBeDefined();
      expect(sub.percentage ?? 0).toBeLessThanOrEqual(parent!.percentage ?? 0);
      expect(sub.nameTa, sub.code).toBeTruthy();
    }
  });

  it("cites a source for every category", () => {
    for (const c of TN_QUOTA_ROSTER) {
      expect(c.sourceRefs.length, c.code).toBeGreaterThan(0);
    }
  });

  it("does not invent a Tamil Nadu EWS quota", () => {
    // Tamil Nadu has not implemented EWS; it must never appear as a TN category.
    expect(allCodes()).not.toContain("EWS");
  });
});

describe("horizontal and special quotas", () => {
  it("carries the 7.5% government-school horizontal reservation", () => {
    const govt = TN_HORIZONTAL_QUOTAS.find((q) => q.code === "GOVT_SCHOOL_7_5");
    expect(govt).toBeDefined();
    expect(govt?.quota).toMatch(/7\.5%/);
    expect(govt?.scope).toBe("all_institutions");
  });

  it("scopes the government-school quota to Classes 6-12", () => {
    const govt = TN_HORIZONTAL_QUOTAS.find((q) => q.code === "GOVT_SCHOOL_7_5");
    expect(govt?.conditions.join(" ")).toMatch(/VI to XII|Classes 6|6 to 12/i);
  });

  it("states that the 7.5% quota is additional to the 69% reservation", () => {
    const govt = TN_HORIZONTAL_QUOTAS.find((q) => q.code === "GOVT_SCHOOL_7_5");
    expect(govt?.conditions.join(" ")).toMatch(/does not reduce/i);
  });

  it("describes the disability reservation with its 5% share", () => {
    const pwd = TN_SPECIAL_QUOTAS.find((q) => /disab/i.test(q.name));
    expect(pwd).toBeDefined();
    expect(pwd?.quota).toMatch(/5\s*%/);
  });

  it("gives every special quota a Tamil label and at least one condition", () => {
    for (const q of [...TN_HORIZONTAL_QUOTAS, ...TN_SPECIAL_QUOTAS]) {
      expect(q.nameTa, q.code).toBeTruthy();
      expect(q.conditions.length, q.code).toBeGreaterThan(0);
      expect(q.sourceRefs.length, q.code).toBeGreaterThan(0);
    }
  });
});

describe("central reservation", () => {
  it("sums the central roster to 100%", () => {
    const total = CENTRAL_RESERVATION.reduce((s, c) => s + c.percentage, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("offers a 10% EWS quota for central institutions, unlike TN", () => {
    const ews = CENTRAL_RESERVATION.find((c) => c.code === "EWS");
    expect(ews?.percentage).toBe(10);
    expect(CENTRAL_EWS_RULE.annualIncomeCeiling).toBe(800000);
  });
});
