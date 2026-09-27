/**
 * Core domain types for the Thonmai eligibility engine.
 *
 * Design rule: nothing in the dataset may exist without provenance. Every
 * scheme carries at least one SourceRef, and SourceRef.official is surfaced
 * in the UI. A number we cannot attribute to a source is a number we do not ship.
 */

export type Confidence = "high" | "medium" | "low";

export type Authority = "state" | "central";

export type EducationLevel =
  | "school"
  | "iti"
  | "diploma"
  | "ug"
  | "pg"
  | "phd";

/** Tamil Nadu / India backward class taxonomy, as used in TN revenue records. */
export type Community =
  | "OC"
  | "BC"
  | "BCM"
  | "MBC"
  | "MBCV"
  | "DNC"
  | "SC"
  | "SCA"
  | "ST";

export type Gender = "male" | "female" | "other";

export type MinorityReligion =
  | "muslim"
  | "christian"
  | "sikh"
  | "buddhist"
  | "parsi"
  | "jain";

export type InstitutionType =
  | "government"
  | "government_aided"
  | "private_self_finance"
  | "central_institute"
  | "not_applicable";

export type AdmissionRoute =
  | "government_quota"
  | "management_quota"
  | "nri_quota"
  | "minority_quota"
  | "not_applicable";

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export interface SourceRef {
  url: string;
  publisher: string;
  retrievedAt: string;
  /** Government order / notification / prospectus section reference. */
  docRef?: string;
  /** True only for .gov.in / .nic.in / .ac.in / .org government-run hosts. */
  official: boolean;
  confidence: Confidence;
  note?: string;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocumentType =
  | "community_certificate"
  | "income_certificate"
  | "nativity_certificate"
  | "first_graduate_certificate"
  | "pwd_certificate"
  | "ex_servicemen_certificate"
  | "aadhaar"
  | "bank_passbook"
  | "marksheet_10"
  | "marksheet_12"
  | "transfer_certificate"
  | "migration_certificate"
  | "bonafide_certificate"
  | "emis_id"
  | "udid"
  | "orphan_certificate"
  | "previous_year_marksheet";

export interface DocumentSpec {
  type: DocumentType;
  label: string;
  labelTa: string;
  /** Who actually issues this. This is the field students most often get wrong. */
  issuingAuthority: string;
  issuingAuthorityTa: string;
  /** Many TN revenue certificates are accepted only as digitally-signed e-certs. */
  eCertificateOnly: boolean;
  /** Where the student obtains it, when the government does not publish a rule. */
  howToObtain?: string;
  validityNote?: string;
  /** Can this be produced from an OCR upload, or must it be applied for? */
  acquisition: "apply" | "auto_from_enrolment" | "instant_derivable";
}

export interface DocumentRequirement {
  type: DocumentType;
  mandatory: boolean;
  note?: string;
}

export interface HeldDocument {
  type: DocumentType;
  issuedOn?: string;
  expiresOn?: string;
  issuingAuthority?: string;
  /** Populated by the OCR pipeline. */
  extracted?: Record<string, string | number | undefined>;
  /** Confidence of the OCR extraction, 0..1. */
  ocrConfidence?: number;
  /** User has confirmed the OCR result. Never auto-commit. */
  confirmed: boolean;
}

// ---------------------------------------------------------------------------
// Student profile
// ---------------------------------------------------------------------------

export interface StudentProfile {
  // Level routing
  level: EducationLevel;
  /** Numeric class for school students, year-of-study for college. */
  classOrYear: number;
  course?: string;
  stream?: string;

  // Identity
  gender: Gender;
  dateOfBirth?: string;
  community: Community;
  religion?: MinorityReligion | "hindu" | "other";
  isMinority?: boolean;
  domicileState: string;

  // Economic
  annualFamilyIncome?: number;
  incomeCertificateValidOn?: string;

  // Disadvantage markers — these unlock the horizontal/special quotas.
  // Every one is OPTIONAL on purpose: an unanswered question is `unknown`,
  // never a silent `false`. Only send `true`/`false` if the student actually said so.
  isFirstGraduate?: boolean;
  studiedClass6to12InGovtSchool?: boolean;
  schoolEmisId?: string;
  isDifferentlyAbled?: boolean;
  disabilityPercentage?: number;
  udid?: string;
  isExServicemenWard?: boolean;
  isEminentSportsPerson?: boolean;
  sportsLevel?: "district" | "divisional" | "state" | "national";
  isOrphan?: boolean;
  isCovidAffectedWard?: boolean;
  isArmedForcesMartyrWard?: boolean;
  isSriLankanTamil?: boolean;
  isNccCadet?: boolean;
  nccCert?: "A" | "C";

  // Admission context (college students)
  admissionRoute: AdmissionRoute;
  institutionType: InstitutionType;
  /** Only set when the student holds a management/NRI/minority seat. */
  hasNativityCertificate?: boolean;

  // Academic performance
  previousYearPercentage?: number;
  attendancePercentage?: number;

  // Compliance preconditions. Optional for the same reason as above.
  bankAccountAadhaarSeeded?: boolean;
  hasValidAadhaar?: boolean;
}

// ---------------------------------------------------------------------------
// Rules DSL
// ---------------------------------------------------------------------------

export type ProfileField = string;

export type CompareOp =
  | "eq"
  | "neq"
  | "in"
  | "nin"
  | "lte"
  | "gte"
  | "between"
  | "exists"
  | "truthy"
  | "truthyList"
  | "contains"
  | "containsAny"
  | "notSet";

export interface ConditionRule {
  field: ProfileField;
  cmp: CompareOp;
  value?: unknown;
  /** Human label used when rendering the trace, e.g. "Annual family income". */
  label?: string;
}

export interface GroupRule {
  op: "and" | "or";
  rules: Rule[];
}

export interface NotRule {
  op: "not";
  rule: Rule;
}

export type Rule = ConditionRule | GroupRule | NotRule;

// ---------------------------------------------------------------------------
// Benefits
// ---------------------------------------------------------------------------

export interface BenefitComponent {
  label: string;
  labelTa?: string;
  /** Point value, or the ceiling when `min`/`max` are also given. */
  amount?: number;
  min?: number;
  max?: number;
  period: "year" | "month" | "one_time" | "per_semester";
  /**
   * Components sharing a group are alternatives, not add-ons: a student claims
   * the single largest one (e.g. Classes 9-10 OR Classes 11-12). Without this
   * the total silently doubles for students in the later stage.
   */
  exclusiveGroup?: string;
  /**
   * Repeatable in later years, so it counts towards the annual income figure.
   * One-off items (laptops, cycles, devices) are listed but excluded. Defaults
   * to `false` for `one_time` components.
   */
  recurring?: boolean;
  /**
   * A loan is repayable debt, not income. It is excluded from every benefit
   * total and reported separately as `loanValue`, so a student is never told
   * they "earn" a sanctioned loan amount.
   */
  kind?: "grant" | "loan";
  /** Human note for variable/conditional components. */
  note?: string;
  sourceDocRef?: string;
}

export type BenefitCertainty = "exact" | "estimated" | "variable";

export interface BenefitSummary {
  components: BenefitComponent[];
  /**
   * Recurring, normalised to a per-year figure for comparability. One-time
   * benefits are deliberately excluded — a laptop is not annual income.
   */
  annualEstimate: number;
  /** Everything the scheme can give, annualised, including one-time items. */
  totalValue: number;
  oneTimeValue: number;
  /**
   * Repayable loan principal, annualised. Tracked apart from the benefit
   * figures above because borrowing is not money received.
   */
  loanValue: number;
  certainty: BenefitCertainty;
  /** Explains the gap between the headline figure and the underlying rules. */
  note?: string;
}

export interface ApplyChannel {
  portal: string;
  url: string;
  /** What the student must physically do; many TN schemes are offline. */
  channel: "online" | "institution" | "district_office" | "automatic";
  helpline?: string;
  deadlineNote?: string;
}

export interface SchemeConflict {
  field: string;
  note: string;
  sourceRefs: SourceRef[];
}

// ---------------------------------------------------------------------------
// Scheme
// ---------------------------------------------------------------------------

export type SchemeStatus = "live" | "superseded" | "closed" | "announced";

export interface Scheme {
  id: string;
  name: string;
  nameTa?: string;
  authority: Authority;
  department: string;
  level: EducationLevel[];
  categories: Community[] | "all";
  summary: string;
  summaryTa?: string;
  rules: Rule;
  /** Extra schemes a student cannot claim together with this one. */
  exclusiveWith?: string[];
  /** Whether this scheme can be combined with welfare schemes. */
  combinableWithWelfare: boolean;
  benefit: BenefitSummary;
  documents: DocumentRequirement[];
  apply: ApplyChannel;
  status: SchemeStatus;
  sourceRefs: SourceRef[];
  conflicts?: SchemeConflict[];
  /** Schemes the department retitled; e.g. laptop scheme rebrand. */
  supersedes?: string;
  tags: string[];
  lastVerifiedAt: string;
}

// ---------------------------------------------------------------------------
// Evaluation output
// ---------------------------------------------------------------------------

export type TraceOutcome = "pass" | "fail" | "unknown" | "skipped";

export interface RuleTrace {
  path: string;
  label: string;
  outcome: TraceOutcome;
  detail: string;
  /** Set on leaf conditions so the UI can link a reason to a form input. */
  field?: string;
  actual?: string;
  expected?: string;
  children?: RuleTrace[];
}

export type EvaluationStatus =
  | "eligible"
  | "ineligible"
  | "needs_document"
  | "unknown";

export interface Evaluation {
  scheme: Scheme;
  status: EvaluationStatus;
  trace: RuleTrace;
  /** Definite reasons the student does not qualify (empty unless ineligible). */
  blockingReasons: string[];
  /** Profile fields still needed before eligibility can be decided. */
  openQuestions: string[];
  missingDocuments: DocumentRequirement[];
  heldDocuments: HeldDocument[];
  /** Documents the student holds but that look expired or wrong-authority. */
  documentWarnings: string[];
  confidence: Confidence;
}

export interface MatchReport {
  profile: StudentProfile;
  evaluations: Evaluation[];
  eligible: Evaluation[];
  ineligible: Evaluation[];
  needsDocument: Evaluation[];
  unknown: Evaluation[];
  totalAnnualEstimate: number;
  benefitCertainty: BenefitCertainty;
  /** True when at least one eligible scheme rests on a non-official source. */
  hasNonOfficialSource: boolean;
  oldestSourceRetrievedAt: string;
  /**
   * The questions worth asking next, most valuable first. Embedded in the report
   * so the UI can always explain *why* something is undecided instead of leaving
   * the student with a dead end. See `gapsToClose` for the derivation.
   */
  topQuestions: string[];
  /** How many schemes each entry of `topQuestions` is currently blocking. */
  blockedBy: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Quota model
// ---------------------------------------------------------------------------

export interface QuotaCategory {
  code: string;
  stateCode: string;
  name: string;
  nameTa: string;
  /** Percentage of total seats, or null when a sub-quota of a parent block. */
  percentage: number | null;
  parentCode: string | null;
  blockTotal: number | null;
  isSubQuota: boolean;
  /**
   * A heading that holds no seats of its own — MBC is split entirely into
   * MBC(Vanniyar), MBC&DNC and Other MBC, so the 20% belongs to the sub-quotas.
   */
  isGroupingNode?: boolean;
  notes?: string;
  sourceRefs: SourceRef[];
}

export interface SpecialQuota {
  code: string;
  name: string;
  nameTa: string;
  scope: "all_institutions" | "government_colleges" | "engineering" | "medical" | "arts_science";
  quota: string;
  conditions: string[];
  sourceRefs: SourceRef[];
}
