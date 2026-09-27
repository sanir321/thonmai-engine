import { describe, expect, it } from "vitest";
import {
  all,
  any,
  between,
  contains,
  containsAny,
  eq,
  gte,
  inList,
  isTrue,
  lte,
  not,
  notSet,
} from "@/engine/rules";
import type { StudentProfile } from "@/engine/types";
import {
  collectFailedLeaves,
  collectLeaves,
  collectUnknownLeaves,
  evaluateRuleTree,
} from "@/engine/evaluate";

const profile = (over: Partial<StudentProfile> = {}): StudentProfile =>
  ({
    level: "ug",
    classOrYear: 2,
    gender: "female",
    community: "BC",
    isMinority: false,
    domicileState: "TN",
    isFirstGraduate: false,
    studiedClass6to12InGovtSchool: true,
    isDifferentlyAbled: false,
    isExServicemenWard: false,
    isEminentSportsPerson: false,
    isOrphan: false,
    isCovidAffectedWard: false,
    isArmedForcesMartyrWard: false,
    isSriLankanTamil: false,
    isNccCadet: false,
    admissionRoute: "merit",
    institutionType: "government",
    hasNativityCertificate: false,
    bankAccountAadhaarSeeded: true,
    hasValidAadhaar: true,
    ...over,
  }) as StudentProfile;

describe("condition operators", () => {
  it("treats a missing input as unknown, not as a pass or a fail", () => {
    const t = evaluateRuleTree(profile(), gte("annualFamilyIncome", 100000));
    expect(t.outcome).toBe("unknown");
  });

  it("compares numbers with lte and gte", () => {
    expect(evaluateRuleTree(profile({ annualFamilyIncome: 80000 }), lte("annualFamilyIncome", 100000)).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ annualFamilyIncome: 120000 }), lte("annualFamilyIncome", 100000)).outcome).toBe("fail");
    expect(evaluateRuleTree(profile({ previousYearPercentage: 92 }), gte("previousYearPercentage", 80)).outcome).toBe("pass");
  });

  it("evaluates an inclusive between range", () => {
    const rule = between("previousYearPercentage", 50, 90);
    expect(evaluateRuleTree(profile({ previousYearPercentage: 50 }), rule).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ previousYearPercentage: 90 }), rule).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ previousYearPercentage: 91 }), rule).outcome).toBe("fail");
  });

  it("matches list membership", () => {
    expect(evaluateRuleTree(profile({ level: "pg" }), inList("level", ["ug", "pg"])).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ level: "school" }), inList("level", ["ug", "pg"])).outcome).toBe("fail");
  });

  it("reads booleans with isTrue", () => {
    expect(evaluateRuleTree(profile({ isFirstGraduate: true }), isTrue("isFirstGraduate")).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ isFirstGraduate: false }), isTrue("isFirstGraduate")).outcome).toBe("fail");
  });

  it("treats an unanswered boolean as unknown, never as false", () => {
    // Regression: a blank disadvantage marker once read as "no", which ruled
    // students out of every scheme gated on it.
    const p = profile();
    (p as unknown as Record<string, unknown>).isFirstGraduate = undefined;
    expect(evaluateRuleTree(p, isTrue("isFirstGraduate")).outcome).toBe("unknown");
  });

  it("keeps an unanswered boolean from failing a whole AND", () => {
    const p = profile({ annualFamilyIncome: 50000 });
    (p as unknown as Record<string, unknown>).isFirstGraduate = undefined;
    const rule = all(lte("annualFamilyIncome", 100000), isTrue("isFirstGraduate"));
    expect(evaluateRuleTree(p, rule).outcome).toBe("unknown");
  });

  it("matches substrings case-insensitively with contains", () => {
    expect(evaluateRuleTree(profile({ course: "B.Sc Mathematics" }), contains("course", "bsc")).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ course: "B.Com" }), contains("course", "bsc")).outcome).toBe("fail");
  });

  it("matches any alternative with containsAny", () => {
    const p = profile({ course: "Integrated M.Sc" });
    expect(evaluateRuleTree(p, containsAny("course", ["bsc", "integrated msc"])).outcome).toBe("pass");
    expect(evaluateRuleTree(p, containsAny("course", ["bsc", "bs"])).outcome).toBe("fail");
  });

  it("does not let a missing value satisfy containsAny", () => {
    expect(evaluateRuleTree(profile(), containsAny("course", ["bsc"])).outcome).toBe("unknown");
  });

  it("resolves notSet on an empty field", () => {
    expect(evaluateRuleTree(profile(), notSet("nccCert")).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ nccCert: "A" }), notSet("nccCert")).outcome).toBe("fail");
  });

  it("inverts a condition with not", () => {
    expect(evaluateRuleTree(profile({ level: "ug" }), not(eq("level", "pg"))).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ level: "pg" }), not(eq("level", "pg"))).outcome).toBe("fail");
  });
});

describe("boolean combination", () => {
  it("passes an AND only when every branch passes", () => {
    const rule = all(eq("level", "ug"), lte("annualFamilyIncome", 100000));
    expect(evaluateRuleTree(profile({ level: "ug", annualFamilyIncome: 50000 }), rule).outcome).toBe("pass");
    expect(evaluateRuleTree(profile({ level: "ug", annualFamilyIncome: 900000 }), rule).outcome).toBe("fail");
  });

  it("lets a definite fail dominate an unknown inside an AND", () => {
    // Income is far too high (definite fail) but marks are unanswered. The
    // conjunction is certainly false, so it must not read as "unknown".
    const rule = all(lte("annualFamilyIncome", 100000), gte("previousYearPercentage", 80));
    const t = evaluateRuleTree(profile({ annualFamilyIncome: 900000 }), rule);
    expect(t.outcome).toBe("fail");
    expect(collectFailedLeaves(t).join(" ")).toMatch(/income/i);
  });

  it("returns unknown for an AND with no definite failure", () => {
    const rule = all(lte("annualFamilyIncome", 100000), gte("previousYearPercentage", 80));
    expect(evaluateRuleTree(profile({ annualFamilyIncome: 50000 }), rule).outcome).toBe("unknown");
  });

  it("passes an OR when a single branch passes despite an unknown", () => {
    const rule = any(eq("level", "pg"), eq("level", "ug"));
    expect(evaluateRuleTree(profile({ level: "ug" }), rule).outcome).toBe("pass");
  });

  it("returns unknown for an OR where nothing passes yet", () => {
    const rule = any(gte("previousYearPercentage", 90), gte("attendancePercentage", 95));
    expect(evaluateRuleTree(profile({ previousYearPercentage: 95 }), rule).outcome).toBe("pass");
    expect(evaluateRuleTree(profile(), rule).outcome).toBe("unknown");
  });
});

describe("trace helpers", () => {
  it("flattens every leaf of a nested rule", () => {
    const rule = all(eq("level", "ug"), any(lte("annualFamilyIncome", 100000), isTrue("isFirstGraduate")));
    const leaves = collectLeaves(evaluateRuleTree(profile(), rule));
    expect(leaves.length).toBe(3);
    expect(leaves.every((l) => !l.children?.length)).toBe(true);
  });

  it("collects only definite failures, not the unanswered questions", () => {
    const rule = all(lte("annualFamilyIncome", 100000), gte("previousYearPercentage", 80));
    const t = evaluateRuleTree(profile({ annualFamilyIncome: 900000 }), rule);
    expect(collectFailedLeaves(t)).toHaveLength(1);
    expect(collectUnknownLeaves(t)).toHaveLength(1);
  });

  it("de-duplicates repeated unknown questions", () => {
    const rule = all(gte("previousYearPercentage", 80), gte("previousYearPercentage", 90));
    expect(collectUnknownLeaves(evaluateRuleTree(profile(), rule))).toHaveLength(1);
  });

  it("gives every trace node a path and a human detail string", () => {
    const rule = all(eq("level", "ug"), lte("annualFamilyIncome", 100000));
    const walk = (t: { path: string; detail: string; children?: unknown[] }) => {
      expect(t.path).toBeTruthy();
      expect(t.detail).toBeTruthy();
      (t.children ?? []).forEach((c) => walk(c as typeof t));
    };
    walk(evaluateRuleTree(profile({ annualFamilyIncome: 50000 }), rule));
  });
});
