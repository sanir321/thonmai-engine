import { describe, expect, it } from "vitest";
import { ALL_SCHEMES, DATASET_STATS, SCHEME_BY_ID, schemesForLevel, validateDataset } from "@data/index";
import { DOCUMENT_SPECS } from "@data/documents";
import { buildDerived, collectLeaves, evaluateRuleTree } from "@/engine/evaluate";
import type { Rule, StudentProfile } from "@/engine/types";

/** Every field the form collects, plus the derived document flags. */
function knownFields(): Set<string> {
  // Optional fields must be listed explicitly: `Object.keys` only sees keys
  // that are actually present on the object.
  const sample: StudentProfile = {
    level: "ug",
    classOrYear: 1,
    gender: "female",
    community: "BC",
    isMinority: false,
    domicileState: "TN",
    isFirstGraduate: false,
    studiedClass6to12InGovtSchool: false,
    isDifferentlyAbled: false,
    isExServicemenWard: false,
    isEminentSportsPerson: false,
    isOrphan: false,
    isCovidAffectedWard: false,
    isArmedForcesMartyrWard: false,
    isSriLankanTamil: false,
    isNccCadet: false,
    admissionRoute: "government_quota",
    institutionType: "government",
    hasNativityCertificate: false,
    bankAccountAadhaarSeeded: true,
    hasValidAadhaar: true,
    // optional profile fields
    course: undefined,
    stream: undefined,
    dateOfBirth: undefined,
    religion: undefined,
    annualFamilyIncome: undefined,
    incomeCertificateValidOn: undefined,
    schoolEmisId: undefined,
    disabilityPercentage: undefined,
    udid: undefined,
    sportsLevel: undefined,
    nccCert: undefined,
    previousYearPercentage: undefined,
    attendancePercentage: undefined,
  };
  return new Set([...Object.keys(sample), ...Object.keys(buildDerived(sample))]);
}

function ruleFields(rule: Rule, acc: string[] = []): string[] {
  if ("cmp" in rule) {
    acc.push(rule.field);
  } else if ("rule" in rule) {
    ruleFields(rule.rule, acc);
  } else {
    rule.rules.forEach((r) => ruleFields(r, acc));
  }
  return acc;
}

describe("dataset integrity", () => {
  it("passes every validation check", () => {
    expect(validateDataset()).toEqual([]);
  });

  it("has unique scheme ids", () => {
    expect(new Set(ALL_SCHEMES.map((s) => s.id)).size).toBe(ALL_SCHEMES.length);
  });

  it("gives every scheme a Tamil name, a summary and at least one source", () => {
    for (const s of ALL_SCHEMES) {
      expect(s.nameTa, s.id).toBeTruthy();
      expect(s.summary, s.id).toBeTruthy();
      expect(s.sourceRefs.length, s.id).toBeGreaterThan(0);
    }
  });

  it("only uses document types from the shared registry", () => {
    const known = new Set(DOCUMENT_SPECS.map((d) => d.type));
    for (const s of ALL_SCHEMES) {
      for (const d of s.documents) expect(known.has(d.type), `${s.id}: ${d.type}`).toBe(true);
    }
  });

  it("only references profile fields the form actually collects", () => {
    const known = knownFields();
    const unknown = new Set<string>();
    for (const s of ALL_SCHEMES) {
      for (const f of ruleFields(s.rules)) {
        if (!known.has(f)) unknown.add(`${s.id}: ${f}`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it("gives every evaluated condition a label students can read", () => {
    // A raw field id like "classOrYear" must never reach the UI, even when a
    // rule omits an explicit label.
    const p: StudentProfile = {
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
      admissionRoute: "government_quota",
      institutionType: "government",
      hasNativityCertificate: false,
      bankAccountAadhaarSeeded: true,
      hasValidAadhaar: true,
    };
    const problems: string[] = [];
    for (const s of ALL_SCHEMES) {
      for (const leaf of collectLeaves(evaluateRuleTree(p, s.rules))) {
        if (!leaf.label || leaf.label === leaf.field) {
          problems.push(`${s.id}: ${leaf.field} -> "${leaf.label}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("keeps every live scheme's benefit estimate finite and non-negative", () => {
    for (const s of ALL_SCHEMES) {
      expect(Number.isFinite(s.benefit.annualEstimate), s.id).toBe(true);
      expect(s.benefit.annualEstimate, s.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("only carries schemes from the two declared authorities", () => {
    for (const s of ALL_SCHEMES) {
      expect(["state", "central"], s.id).toContain(s.authority);
    }
  });

  it("gives every scheme at least one live level", () => {
    for (const s of ALL_SCHEMES) {
      expect(s.level.length, s.id).toBeGreaterThan(0);
    }
  });
});

describe("catalogue helpers", () => {
  it("indexes schemes by id without collisions", () => {
    expect(Object.keys(SCHEME_BY_ID)).toHaveLength(ALL_SCHEMES.length);
  });

  it("filters live schemes by level", () => {
    const ug = schemesForLevel("ug");
    expect(ug.length).toBeGreaterThan(0);
    for (const s of ug) expect(s.level).toContain("ug");
    expect(ug.every((s) => s.status === "live")).toBe(true);
  });

  it("reports dataset statistics consistent with the arrays", () => {
    expect(DATASET_STATS.totalSchemes).toBe(ALL_SCHEMES.length);
    expect(DATASET_STATS.stateSchemes + DATASET_STATS.centralSchemes).toBe(ALL_SCHEMES.length);
    expect(DATASET_STATS.documentTypes).toBe(DOCUMENT_SPECS.length);
  });

  it("regression-guards the curated coverage counts", () => {
    // These must only change deliberately, alongside a research note.
    expect(DATASET_STATS.stateSchemes).toBe(26);
    expect(DATASET_STATS.centralSchemes).toBe(24);
  });
});
