import {
  buildDerived,
  collectFailedLeaves,
  collectUnknownLeaves,
  evaluateRuleTree,
} from "./evaluate";
import { combineCertainty } from "./benefit";
import { DOC_BY_TYPE } from "@data/documents";
import type {
  DocumentRequirement,
  Evaluation,
  EvaluationStatus,
  HeldDocument,
  MatchReport,
  Scheme,
  StudentProfile,
  Confidence,
} from "./types";

/**
 * Match a profile against a set of schemes and produce a report the UI can
 * render without re-deriving anything.
 */

export function documentWarnings(
  scheme: Scheme,
  held: HeldDocument[],
  now: string,
): string[] {
  const warnings: string[] = [];
  for (const h of held) {
    // The requirement carries only the type; the label and issuing-authority
    // rules live in the shared document registry.
    const required = scheme.documents.find((d) => d.type === h.type);
    if (!required) continue;

    const spec = DOC_BY_TYPE[h.type];
    if (h.expiresOn && h.expiresOn < now) {
      warnings.push(
        `Your ${spec?.label ?? h.type} expired on ${h.expiresOn}. Most Tamil Nadu revenue certificates must be valid on the date of application.`,
      );
    }
    if (spec?.eCertificateOnly && !h.issuingAuthority?.toLowerCase().includes("tahsildar")) {
      warnings.push(
        `${spec.label} is normally accepted only as a digitally signed e-Certificate from ${spec.issuingAuthority}. A counter printout may be rejected.`,
      );
    }
  }
  return warnings;
}

function schemeConfidence(scheme: Scheme): Confidence {
  const official = scheme.sourceRefs.filter((s) => s.official);
  if (official.length === 0) return "low";
  if (official.length >= 2) return "high";
  const single = official[0]!;
  return single.confidence === "high" ? "medium" : "low";
}

export function evaluateScheme(
  scheme: Scheme,
  profile: StudentProfile,
  heldDocuments: HeldDocument[] = [],
  now = new Date().toISOString().slice(0, 10),
): Evaluation {
  const enriched: StudentProfile = { ...profile, heldDocuments } as StudentProfile;
  void buildDerived(enriched);
  const trace = evaluateRuleTree(enriched, scheme.rules);

  const heldTypes = new Set(heldDocuments.map((d) => d.type));
  const missingDocuments: DocumentRequirement[] = scheme.documents.filter(
    (d) => d.mandatory && !heldTypes.has(d.type),
  );

  let status: EvaluationStatus;
  if (trace.outcome === "pass") {
    status = missingDocuments.length > 0 ? "needs_document" : "eligible";
  } else if (trace.outcome === "unknown") {
    status = "unknown";
  } else {
    status = "ineligible";
  }

  return {
    scheme,
    status,
    trace,
    blockingReasons: status === "ineligible" ? collectFailedLeaves(trace) : [],
    openQuestions: status === "unknown" ? collectUnknownLeaves(trace) : [],
    missingDocuments,
    heldDocuments,
    documentWarnings: documentWarnings(scheme, heldDocuments, now),
    confidence: schemeConfidence(scheme),
  };
}

export function matchSchemes(
  schemes: Scheme[],
  profile: StudentProfile,
  heldDocuments: HeldDocument[] = [],
  now = new Date().toISOString().slice(0, 10),
): MatchReport {
  const live = schemes.filter((s) => s.status === "live" || s.status === "announced");
  const evaluations = live.map((s) => evaluateScheme(s, profile, heldDocuments, now));

  const eligible = evaluations.filter((e) => e.status === "eligible");
  const needsDocument = evaluations.filter((e) => e.status === "needs_document");
  const ineligible = evaluations.filter((e) => e.status === "ineligible");
  const unknown = evaluations.filter((e) => e.status === "unknown");

  // Combined total counts schemes the student could claim once documents arrive.
  const claimable = [...eligible, ...needsDocument];
  const totalAnnualEstimate = claimable.reduce(
    (sum, e) => sum + e.scheme.benefit.annualEstimate,
    0,
  );

  const retrieved = live.map((s) => s.lastVerifiedAt).sort();

  // Questions that would unlock the most schemes, computed here so every consumer
  // (API, results page, tests) sees the same prioritised list.
  const blocked = new Map<string, number>();
  for (const e of unknown) {
    for (const q of e.openQuestions) blocked.set(q, (blocked.get(q) ?? 0) + 1);
  }
  const ranked = [...blocked.entries()].sort((a, b) => b[1] - a[1]);

  return {
    profile,
    evaluations,
    eligible,
    ineligible,
    needsDocument,
    unknown,
    totalAnnualEstimate,
    benefitCertainty: combineCertainty(claimable.map((e) => e.scheme.benefit.certainty)),
    // "Any non-official source", not "every source is non-official": one
    // unofficial page in a scheme's provenance is enough to flag the total.
    hasNonOfficialSource: claimable.some((e) => e.scheme.sourceRefs.some((r) => !r.official)),
    oldestSourceRetrievedAt: retrieved[0] ?? now,
    topQuestions: ranked.slice(0, 12).map(([q]) => q),
    blockedBy: Object.fromEntries(ranked.slice(0, 12)),
  };
}

/**
 * The profile inputs that, once answered, would unlock the most schemes.
 * Ordered by how many schemes are waiting on each question.
 */
export function gapsToClose(report: MatchReport, limit = 12): string[] {
  return report.topQuestions.slice(0, limit);
}
