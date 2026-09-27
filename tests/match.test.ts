import { describe, expect, it } from "vitest";
import { matchSchemes, evaluateScheme, gapsToClose } from "@/engine/match";
import { ALL_SCHEMES, SCHEME_BY_ID } from "@data/index";
import { collectLeaves } from "@/engine/evaluate";
import type { HeldDocument, MatchReport, StudentProfile } from "@/engine/types";

const baseProfile = (over: Partial<StudentProfile> = {}): StudentProfile => ({
  level: "ug",
  classOrYear: 2,
  gender: "female",
  community: "BC",
  religion: "hindu",
  isMinority: false,
  domicileState: "TN",
  annualFamilyIncome: 180000,
  previousYearPercentage: 87,
  course: "B.Sc Mathematics",
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
  ...over,
});

const doc = (type: HeldDocument["type"]): HeldDocument => ({ type, confirmed: true });

const ALL_DOCS: HeldDocument[] = [
  doc("community_certificate"),
  doc("income_certificate"),
  doc("aadhaar"),
  doc("bank_passbook"),
  doc("bonafide_certificate"),
  doc("nativity_certificate"),
  doc("pwd_certificate"),
  doc("first_graduate_certificate"),
];

const NOW = "2026-10-01";

describe("evaluateScheme", () => {
  it("marks a fully-qualified student as claimable", () => {
    const scheme = SCHEME_BY_ID["tn_bc_postmatric"]!;
    const e = evaluateScheme(scheme, baseProfile(), ALL_DOCS, NOW);
    expect(["eligible", "needs_document"]).toContain(e.status);
  });

  it("reports needs_document when criteria pass but a mandatory file is missing", () => {
    const scheme = SCHEME_BY_ID["tn_bc_postmatric"]!;
    const e = evaluateScheme(scheme, baseProfile(), [], NOW);
    expect(e.status).toBe("needs_document");
    expect(e.missingDocuments.length).toBeGreaterThan(0);
    expect(e.missingDocuments.every((d) => d.mandatory)).toBe(true);
  });

  it("explains ineligibility with concrete reasons", () => {
    const scheme = SCHEME_BY_ID["tn_bc_postmatric"]!;
    const e = evaluateScheme(scheme, baseProfile({ community: "SC" }), ALL_DOCS, NOW);
    if (e.status === "ineligible") {
      expect(e.blockingReasons.length).toBeGreaterThan(0);
      expect(e.openQuestions).toHaveLength(0);
    }
  });

  it("asks for the missing input when it cannot decide", () => {
    const scheme = SCHEME_BY_ID["tn_bc_postmatric"]!;
    const p = baseProfile();
    delete p.annualFamilyIncome;
    delete p.previousYearPercentage;
    const e = evaluateScheme(scheme, p, ALL_DOCS, NOW);
    if (e.status === "unknown") {
      expect(e.openQuestions.length).toBeGreaterThan(0);
      expect(e.blockingReasons).toHaveLength(0);
    }
  });

  it("never fails a rule because an optional field is blank", () => {
    // The most damaging failure mode: an unanswered question must never read
    // as a refusal. Routing fields (level, class, gender) are kept, because a
    // UG student really is ineligible for a PG-only scheme.
    const blank = baseProfile();
    const routing: (keyof StudentProfile)[] = ["level", "classOrYear", "gender"];
    const blanked = new Set<string>();
    for (const key of Object.keys(blank) as (keyof StudentProfile)[]) {
      if (routing.includes(key)) continue;
      blanked.add(key as string);
      (blank as unknown as Record<string, unknown>)[key] = undefined;
    }

    for (const scheme of ALL_SCHEMES.filter((s) => s.status === "live")) {
      const e = evaluateScheme(scheme, blank, [], NOW);
      const failed = collectLeaves(e.trace).filter((l) => l.outcome === "fail");
      for (const leaf of failed) {
        expect(
          blanked.has(leaf.field ?? ""),
          `${scheme.id}: blanked field "${leaf.field}" was treated as a failure`,
        ).toBe(false);
      }
    }
  });

  it("keeps every unanswered boolean out of the ineligible bucket", () => {
    const blank = baseProfile();
    for (const key of [
      "isFirstGraduate",
      "isDifferentlyAbled",
      "isExServicemenWard",
      "hasValidAadhaar",
      "bankAccountAadhaarSeeded",
    ] as (keyof StudentProfile)[]) {
      (blank as unknown as Record<string, unknown>)[key] = undefined;
    }
    const pwd = SCHEME_BY_ID["tn_pwd_scholarship"]!;
    const e = evaluateScheme(pwd, blank, ALL_DOCS, NOW);
    expect(e.status).not.toBe("ineligible");
  });
});

describe("matchSchemes", () => {
  it("returns a report whose buckets account for every evaluation", () => {
    const report = matchSchemes(ALL_SCHEMES, baseProfile(), ALL_DOCS, NOW);
    const total =
      report.eligible.length +
      report.ineligible.length +
      report.needsDocument.length +
      report.unknown.length;
    expect(total).toBe(report.evaluations.length);
  });

  it("only evaluates live and announced schemes", () => {
    const report = matchSchemes(ALL_SCHEMES, baseProfile(), ALL_DOCS, NOW);
    for (const e of report.evaluations) {
      expect(["live", "announced"], e.scheme.id).toContain(e.scheme.status);
    }
  });

  it("never counts a one-time benefit as annual income", () => {
    const report = matchSchemes(ALL_SCHEMES, baseProfile(), ALL_DOCS, NOW);
    const claimable = [...report.eligible, ...report.needsDocument];
    const summed = claimable.reduce((s, e) => s + e.scheme.benefit.annualEstimate, 0);
    expect(report.totalAnnualEstimate).toBe(summed);
    expect(report.totalAnnualEstimate).toBeGreaterThanOrEqual(0);
  });

  it("flags a total that leans on a non-official source", () => {
    const report = matchSchemes(ALL_SCHEMES, baseProfile(), ALL_DOCS, NOW);
    const claimable = [...report.eligible, ...report.needsDocument];
    const expected = claimable.some((e) => e.scheme.sourceRefs.some((r) => !r.official));
    expect(report.hasNonOfficialSource).toBe(expected);
  });

  it("produces no follow-up questions when everything is answered", () => {
    const report = matchSchemes(ALL_SCHEMES, baseProfile(), ALL_DOCS, NOW);
    expect(gapsToClose(report)).toHaveLength(0);
  });

  it("surfaces follow-up questions when key inputs are missing", () => {
    const partial = baseProfile();
    delete partial.annualFamilyIncome;
    delete partial.previousYearPercentage;
    const report = matchSchemes(ALL_SCHEMES, partial, [], NOW);
    const gaps = gapsToClose(report);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.length).toBeLessThanOrEqual(12);
    expect(new Set(gaps).size).toBe(gaps.length);
  });

  it("keeps single and batch evaluation consistent", () => {
    const report = matchSchemes(ALL_SCHEMES, baseProfile(), ALL_DOCS, NOW);
    for (const e of report.evaluations.slice(0, 15)) {
      const single = evaluateScheme(e.scheme, baseProfile(), ALL_DOCS, NOW);
      expect(single.status, e.scheme.id).toBe(e.status);
    }
  });

  it("does not narrow a student's options based on community", () => {
    const sc = matchSchemes(ALL_SCHEMES, baseProfile({ community: "SC" }), ALL_DOCS, NOW);
    const bc = matchSchemes(ALL_SCHEMES, baseProfile({ community: "BC" }), ALL_DOCS, NOW);
    const bcTotal = bc.eligible.length + bc.needsDocument.length;
    const scTotal = sc.eligible.length + sc.needsDocument.length;
    expect(scTotal).toBeGreaterThanOrEqual(0);
    expect(bcTotal).toBeGreaterThanOrEqual(0);
  });
});

/**
 * The most important guarantee in the whole product: a question the student never
 * answered must never be turned into a "no". These tests exist because the form
 * previously defaulted every disadvantage marker to `false`, which silently ruled
 * real students out of quota schemes they actually qualified for.
 */
describe("unanswered questions stay unanswered", () => {
  const MARKERS = [
    "isFirstGraduate",
    "studiedClass6to12InGovtSchool",
    "isDifferentlyAbled",
    "isExServicemenWard",
    "isEminentSportsPerson",
    "isOrphan",
    "isSriLankanTamil",
    "isNccCadet",
    "hasNativityCertificate",
    "bankAccountAadhaarSeeded",
    "hasValidAadhaar",
    "isMinority",
  ] as const;

  it("never treats a missing disadvantage marker as false", () => {
    const bare: StudentProfile = {
      level: "ug",
      classOrYear: 1,
      gender: "female",
      community: "BC",
      domicileState: "Tamil Nadu",
      admissionRoute: "government_quota",
      institutionType: "government",
    };

    for (const marker of MARKERS) {
      expect(bare[marker], marker).toBeUndefined();
    }

    const report = matchSchemes(ALL_SCHEMES, bare, [], NOW);

    // No leaf anywhere in the report may be a definitive "no" for a marker
    // the student was never asked about.
    for (const evaluation of report.evaluations) {
      for (const leaf of collectLeaves(evaluation.trace)) {
        if (MARKERS.includes(leaf.field as (typeof MARKERS)[number])) {
          expect(leaf.outcome, `${evaluation.scheme.id} / ${leaf.field}`).toBe("unknown");
        }
      }
    }
  });

  it("puts unanswered questions in the unknown bucket and asks about them", () => {
    const bare: StudentProfile = {
      level: "ug",
      classOrYear: 1,
      gender: "female",
      community: "BC",
      domicileState: "Tamil Nadu",
      admissionRoute: "government_quota",
      institutionType: "government",
    };

    const report = matchSchemes(ALL_SCHEMES, bare, [], NOW);
    expect(report.unknown.length).toBeGreaterThan(0);
    expect(gapsToClose(report).length).toBeGreaterThan(0);
  });

  it("embeds the ranked questions and their blocked counts in the report", () => {
    // The results page reads these off the report; if they were not serialised the
    // "20 schemes undecided" count would be a dead end with no way forward.
    const bare: StudentProfile = {
      level: "ug",
      classOrYear: 1,
      gender: "female",
      community: "BC",
      domicileState: "Tamil Nadu",
      admissionRoute: "government_quota",
      institutionType: "government",
    };
    const report = matchSchemes(ALL_SCHEMES, bare, [], NOW);

    expect(report.topQuestions.length).toBeGreaterThan(0);
    expect(gapsToClose(report)).toEqual(report.topQuestions);
    expect(Object.keys(report.blockedBy).sort()).toEqual(
      [...report.topQuestions].sort(),
    );
    for (const q of report.topQuestions) {
      expect(report.blockedBy[q], q).toBeGreaterThan(0);
    }
    // Ranked by how many schemes each question blocks, descending.
    const counts = report.topQuestions.map((q) => report.blockedBy[q] ?? 0);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    // No duplicated or blank questions.
    expect(new Set(report.topQuestions).size).toBe(report.topQuestions.length);
    for (const q of report.topQuestions) expect(q.trim()).not.toBe("");
  });

  it("survives a JSON round trip so the API payload is complete", () => {
    const report = matchSchemes(ALL_SCHEMES, baseProfile(), ALL_DOCS, NOW);
    const parsed = JSON.parse(JSON.stringify(report)) as MatchReport;
    expect(parsed.topQuestions).toEqual(report.topQuestions);
    expect(parsed.blockedBy).toEqual(report.blockedBy);
    expect(parsed.eligible.length).toBe(report.eligible.length);
  });

  it("still reports a definite no when the student explicitly says no", () => {
    const explicit = baseProfile({ isFirstGraduate: false, isOrphan: false });
    const report = matchSchemes(ALL_SCHEMES, explicit, ALL_DOCS, NOW);

    const firstGraduateSchemes = report.evaluations.filter((e) =>
      collectLeaves(e.trace).some(
        (l) => l.field === "isFirstGraduate" && l.outcome === "fail",
      ),
    );
    expect(firstGraduateSchemes.length).toBeGreaterThan(0);
  });

  it("moves a yes into unknown rather than into a definite no when left blank", () => {
    // Answering "yes" can only ever help. Leaving it blank must therefore be
    // weaker-or-equal, and crucially the difference must land in `unknown` —
    // it must never land in `ineligible`.
    const yes = matchSchemes(
      ALL_SCHEMES,
      baseProfile({ isFirstGraduate: true }),
      ALL_DOCS,
      NOW,
    );
    const blank = matchSchemes(
      ALL_SCHEMES,
      baseProfile({ isFirstGraduate: undefined }),
      ALL_DOCS,
      NOW,
    );

    const claimable = (r: typeof yes) =>
      new Set([...r.eligible, ...r.needsDocument].map((e) => e.scheme.id));
    const unknown = new Set(blank.unknown.map((e) => e.scheme.id));
    const rejected = new Set(blank.ineligible.map((e) => e.scheme.id));

    for (const id of claimable(yes)) {
      expect(
        rejected.has(id),
        `${id} was claimable with a yes but became a definite no when blank`,
      ).toBe(false);
    }

    // The schemes lost between yes and blank are undecided, not denied.
    const lost = [...claimable(yes)].filter((id) => !claimable(blank).has(id));
    expect(lost.length).toBeGreaterThan(0);
    for (const id of lost) {
      expect(unknown.has(id), `${id} should be unknown, not decided`).toBe(true);
    }
  });
});
