import type {
  DocumentRequirement,
  HeldDocument,
  Rule,
  RuleTrace,
  StudentProfile,
  TraceOutcome,
} from "./types";

/**
 * The evaluator.
 *
 * Two properties matter more than speed here:
 *  1. It never throws on a partial profile. A student who has not told us
 *     their income gets `unknown`, not a crash and not a silent `false`.
 *  2. It always returns a full trace. "You are not eligible" is only useful
 *     if we can say which single condition failed.
 */

export interface EvalContext {
  profile: StudentProfile;
  /** Field overrides supplied by the evaluator itself, e.g. derived doc flags. */
  derived: Record<string, unknown>;
}

const MONTHS_PER_YEAR = 12;

function readField(ctx: EvalContext, field: string): unknown {
  if (Object.prototype.hasOwnProperty.call(ctx.derived, field)) {
    return ctx.derived[field];
  }
  // Support "a.b" and "a|b" (truthyList) lookups.
  if (field.includes("|")) {
    return field.split("|");
  }
  return getPath(ctx.profile, field);
}

function getPath(obj: unknown, path: string): unknown {
  if (!path.includes(".")) return (obj as Record<string, unknown>)?.[path];
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function isUnset(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === "") return "not provided";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  if (typeof v === "number") {
    return v >= 100000
      ? `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`
      : `₹${v.toLocaleString("en-IN")}`;
  }
  return String(v);
}

/**
 * Fallback wording for conditions whose rule carries no explicit label. Handing
 * the student a raw field name like "classOrYear" is worse than useless, so
 * every field gets a readable phrase.
 */
const FIELD_LABELS: Record<string, string> = {
  level: "Study level",
  classOrYear: "Class or year of study",
  course: "Course studied",
  stream: "Stream",
  community: "Social category",
  domicileState: "Domicile state",
  religion: "Religion",
  gender: "Gender",
  annualFamilyIncome: "Annual family income",
  incomeCertificateValidOn: "Income certificate validity",
  previousYearPercentage: "Previous year marks",
  attendancePercentage: "Attendance",
  admissionRoute: "Admission route",
  institutionType: "Institution type",
  isFirstGraduate: "First graduate in the family",
  studiedClass6to12InGovtSchool: "Studied Classes 6-12 in a government school",
  isDifferentlyAbled: "Certified as differently abled",
  isExServicemenWard: "Ward of ex-servicemen or serving personnel",
  isEminentSportsPerson: "Eminent sports person",
  isOrphan: "Orphan or ward",
  isMinority: "Belongs to a notified minority community",
  isSriLankanTamil: "Sri Lankan Tamil",
  isNccCadet: "NCC cadet",
  nccCert: "NCC certificate",
  disabilityPercentage: "Disability percentage",
  hasNativityCertificate: "Holds a nativity certificate",
  bankAccountAadhaarSeeded: "Bank account seeded with Aadhaar",
  hasValidAadhaar: "Valid Aadhaar on record",
  udid: "UDID number",
  schoolEmisId: "School EMIS number",
  dateOfBirth: "Date of birth",
  sportsLevel: "Sports level",
};

/** Turn an unknown field id into a sentence fragment. */
function humaniseField(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^is/, "Is ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const OP_WORDS: Record<string, string> = {
  eq: "is",
  neq: "is not",
  in: "is one of",
  nin: "is not one of",
  lte: "is at most",
  gte: "is at least",
  between: "is between",
  exists: "is recorded",
  notSet: "is not recorded",
  contains: "contains",
  containsAny: "contains one of",
  truthy: "is true",
  truthyList: "are all recorded",
};

function evaluateCondition(
  ctx: EvalContext,
  rule: Extract<Rule, { cmp: string }>,
  path: string,
): RuleTrace {
  const label = rule.label ?? humaniseField(rule.field);
  const actual = readField(ctx, rule.field);
  const isUnsetActual = isUnset(actual);

  // "we don't know yet" — the student has not filled this in.
  // `notSet` inverts the question so it must not be short-circuited here.
  const openEnded = new Set(["truthy", "neq", "nin", "notSet"]);
  if (!openEnded.has(rule.cmp) && isUnsetActual) {
    return {
      path,
      label,
      field: rule.field,
      outcome: "unknown",
      detail: `${label} has not been provided, so this condition cannot be decided yet.`,
      actual: "not provided",
    };
  }

  if (rule.cmp === "truthy") {
    // An unanswered boolean must never read as a "no": the disadvantage
    // markers (first graduate, ex-servicemen ward, disability) gate most of
    // this catalogue, so treating a blank as false would wrongly rule a
    // student out of nearly every scheme.
    if (isUnset(actual)) {
      return {
        path,
        label,
        outcome: "unknown",
        detail: `${label} has not been answered yet.`,
        actual: fmt(actual),
      };
    }
    const ok = Boolean(actual);
    return {
      path,
      label,
      field: rule.field,
      outcome: ok ? "pass" : "fail",
      detail: ok ? `${label}: yes.` : `${label}: no.`,
      actual: fmt(actual),
    };
  }

  if (rule.cmp === "truthyList") {
    // `value` lists other profile fields that must all be set.
    const fields = Array.isArray(rule.value) ? (rule.value as string[]) : [];
    const missing = fields.filter((f) => isUnset(readField(ctx, f)));
    if (missing.length === fields.length && fields.length > 0) {
      return {
        path,
        label,
        outcome: "unknown",
        detail: `None of these have been answered yet.`,
        actual: `0/${fields.length} present`,
      };
    }
    const ok = missing.length === 0;
    return {
      path,
      label,
      field: rule.field,
      outcome: ok ? "pass" : "fail",
      detail: ok ? `All required records are present.` : `Missing: ${missing.join(", ")}.`,
      actual: `${fields.length - missing.length}/${fields.length} present`,
    };
  }

  if (rule.cmp === "exists") {
    const ok = !isUnset(actual);
    return {
      path,
      label,
      field: rule.field,
      outcome: ok ? "pass" : "fail",
      detail: ok ? `${label} is recorded.` : `${label} is not recorded.`,
      actual: fmt(actual),
    };
  }

  if (rule.cmp === "notSet") {
    const ok = isUnset(actual);
    return {
      path,
      label,
      field: rule.field,
      outcome: ok ? "pass" : "fail",
      detail: ok ? `${label} has not been filled in, which this condition allows.` : `${label} is recorded.`,
      actual: fmt(actual),
    };
  }

  if (rule.cmp === "contains" || rule.cmp === "containsAny") {
    // Indian degree abbreviations are punctuated inconsistently ("B.Sc", "BSc",
    // "B S"), so compare on letters and digits only.
    const flatten = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const needles = (Array.isArray(rule.value) ? rule.value : [rule.value])
      .filter((v): v is string => typeof v === "string")
      .map(flatten);
    const haystack = flatten(String(actual ?? ""));
    const hits = needles.filter((n) => haystack.includes(n));
    const ok = rule.cmp === "contains" ? hits.length === needles.length : hits.length > 0;
    return {
      path,
      label,
      field: rule.field,
      outcome: ok ? "pass" : "fail",
      detail: ok
        ? `${label} matched ${hits.join(", ")}.`
        : `${label} does not match ${needles.join(" or ")}.`,
      actual: fmt(actual),
      expected: (Array.isArray(rule.value) ? rule.value : [rule.value]).join(" or "),
    };
  }

  const expected = rule.value;
  const opWord = OP_WORDS[rule.cmp] ?? rule.cmp;
  const expectedText =
    rule.cmp === "between" && Array.isArray(expected)
      ? `${fmt((expected as number[])[0])} and ${fmt((expected as number[])[1])}`
      : fmt(expected);

  let ok = false;
  switch (rule.cmp) {
    case "eq":
      ok = actual === expected;
      break;
    case "neq":
      ok = actual !== expected;
      break;
    case "in":
      ok = Array.isArray(expected) && (expected as unknown[]).includes(actual);
      break;
    case "nin":
      ok = Array.isArray(expected) && !(expected as unknown[]).includes(actual);
      break;
    case "lte":
      ok = typeof actual === "number" && actual <= (expected as number);
      break;
    case "gte":
      ok = typeof actual === "number" && actual >= (expected as number);
      break;
    case "between":
      ok =
        Array.isArray(expected) &&
        typeof actual === "number" &&
        actual >= (expected as number[])[0]! &&
        actual <= (expected as number[])[1]!;
      break;
  }

  return {
    path,
    label,
    outcome: ok ? "pass" : "fail",
    detail: `${label} ${opWord} ${expectedText}.`,
    actual: fmt(actual),
    expected: expectedText,
  };
}

function evaluateRule(ctx: EvalContext, rule: Rule, path: string): RuleTrace {
  if ("cmp" in rule) {
    return evaluateCondition(ctx, rule, path);
  }
  if (rule.op === "not") {
    const child = evaluateRule(ctx, rule.rule, `${path}.not`);
    return {
      path,
      label: `Not (${child.label})`,
      outcome: child.outcome === "fail" ? "pass" : child.outcome === "pass" ? "fail" : "unknown",
      detail:
        child.outcome === "fail"
          ? "This exclusion does not apply to you."
          : child.outcome === "pass"
            ? "This exclusion applies to you."
            : "Cannot decide until the underlying detail is provided.",
      children: [child],
    };
  }

  const children = rule.rules.map((r, i) => evaluateRule(ctx, r, `${path}.${i}`));
  const anyUnknown = children.some((c) => c.outcome === "unknown");
  const allPass = children.every((c) => c.outcome === "pass");
  const anyPass = children.some((c) => c.outcome === "pass");
  const anyFail = children.some((c) => c.outcome === "fail");

  let outcome: TraceOutcome;
  if (rule.op === "and") {
    // Short-circuit order matters: one definite failure is enough to make the
    // whole conjunction false, even if other criteria are still unknown.
    outcome = allPass ? "pass" : anyFail ? "fail" : "unknown";
  } else {
    // A single definite pass is enough for a disjunction, even if others are
    // unknown. Only when nothing passes do unknowns keep it undecided.
    outcome = anyPass ? "pass" : anyUnknown ? "unknown" : "fail";
  }

  return {
    path,
    label: rule.op === "and" ? "All of the following" : "Any one of the following",
    outcome,
    detail: `${children.length} condition${children.length === 1 ? "" : "s"} evaluated (${rule.op.toUpperCase()}).`,
    children,
  };
}

export function evaluateRuleTree(profile: StudentProfile, rule: Rule): RuleTrace {
  const ctx: EvalContext = { profile, derived: buildDerived(profile) };
  return evaluateRule(ctx, rule, "root");
}

/**
 * Derived fields the rule tree can read but the form does not collect directly.
 * Keeping them here means the scheme dataset never has to know how a
 * certificate upload works.
 */
export function buildDerived(profile: StudentProfile): Record<string, unknown> {
  const held = new Set(heldDocKeys(profile));
  const out: Record<string, unknown> = {};

  for (const key of held) out[key] = true;

  // Every held certificate, mandatory or not, satisfies a mandatory requirement
  // only if the scheme explicitly says so. We expose both variants so a scheme
  // can be strict ("must hold this") or lenient ("holding this unlocks it").
  out["docs.anyCommunityCertificate"] = held.has("docs.community_certificate");
  out["docs.anyIncomeCertificate"] = held.has("docs.income_certificate");
  out["docs.anyNativityCertificate"] = held.has("docs.nativity_certificate");
  out["docs.anyFirstGraduateCertificate"] = held.has("docs.first_graduate_certificate");
  out["docs.anyPwdCertificate"] = held.has("docs.pwd_certificate");
  out["docs.anyBonafideCertificate"] = held.has("docs.bonafide_certificate");
  out["docs.anyEmisId"] = held.has("docs.emis_id");

  return out;
}

/**
 * Held document keys, derived from `profile` if the caller attached them, or
 * from the explicit `heldDocuments` list passed by the matcher.
 */
export function heldDocKeys(profile: StudentProfile): string[] {
  const list = (profile as StudentProfile & { heldDocuments?: HeldDocument[] }).heldDocuments ?? [];
  return list.map((d) => `docs.${d.type}`);
}

/** Every leaf condition in a rule tree, in evaluation order. */
export function collectLeaves(trace: RuleTrace, acc: RuleTrace[] = []): RuleTrace[] {
  if (trace.children?.length) {
    for (const c of trace.children) collectLeaves(c, acc);
  } else {
    acc.push(trace);
  }
  return acc;
}

export function collectFailedLeaves(trace: RuleTrace, acc: string[] = []): string[] {
  if (trace.outcome === "fail" && !trace.children?.length) {
    acc.push(trace.detail);
    return acc;
  }
  for (const c of trace.children ?? []) collectFailedLeaves(c, acc);
  return acc;
}

/**
 * The profile inputs that are still missing, phrased as questions. This is what
 * drives the "answer these to unlock N more schemes" prompt, so it must be
 * de-duplicated by path — the same field is often checked by several branches.
 */
export function collectUnknownLeaves(trace: RuleTrace, acc: string[] = []): string[] {
  if (trace.outcome === "unknown" && !trace.children?.length) {
    const question = trace.expected
      ? `${trace.label} — we need this to continue (looking for ${trace.expected}).`
      : trace.label;
    if (!acc.includes(question)) acc.push(question);
    return acc;
  }
  for (const c of trace.children ?? []) collectUnknownLeaves(c, acc);
  return acc;
}

export function hasUnknown(trace: RuleTrace): boolean {
  if (trace.outcome === "unknown" && !trace.children?.length) return true;
  return (trace.children ?? []).some(hasUnknown);
}

export { MONTHS_PER_YEAR };
