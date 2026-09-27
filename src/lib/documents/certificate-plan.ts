import type { DocumentType } from "@/engine/types";
import { DOCUMENT_SPECS } from "@data/documents";

/**
 * The certificate plan: what to upload, what we read off it, and what you still
 * have to type.
 *
 * This file is the single source of truth for three things that would otherwise
 * drift apart — the document guide page, the certificate picker in the scanner,
 * and the API response that says which fields it expected to find. Keeping one
 * list means the page can never promise "upload your income certificate" while
 * the reader looks for something else.
 */

/** Fields a student answers in the form, in the order the form asks them. */
export type ProfileField =
  | "level"
  | "classOrYear"
  | "gender"
  | "community"
  | "domicileState"
  | "course"
  | "institutionType"
  | "admissionRoute"
  | "isFirstGraduate"
  | "studiedClass6to12InGovtSchool"
  | "isDifferentlyAbled"
  | "disabilityPercentage"
  | "isExServicemenWard"
  | "isEminentSportsPerson"
  | "isOrphan"
  | "isMinority"
  | "isSriLankanTamil"
  | "isNccCadet"
  | "hasNativityCertificate"
  | "annualFamilyIncome"
  | "previousYearPercentage"
  | "bankAccountAadhaarSeeded"
  | "hasValidAadhaar";

export interface CertificateGuide {
  /** Stable id used by the upload picker and the API `kind` field. */
  id: string;
  label: string;
  labelTa: string;
  /** One line: the question this certificate answers for a scheme. */
  proves: string;
  provesTa: string;
  /** The registry entry, for issuing authority and how to obtain it. */
  documentType: DocumentType | null;
  /**
   * Fields we can read off this certificate by OCR. Empty means the certificate
   * is a supporting document rather than a source of answers.
   */
  readableFields: ProfileField[];
  /**
   * Fields that must be typed by hand even if the certificate mentions them,
   * with the reason. This is the part students find most surprising, so it is
   * stated rather than implied.
   */
  manualFields: { field: ProfileField; label: string; why: string }[];
  /** The short line shown under the label in the picker. */
  pickerHint: string;
}

/**
 * Ordered by how many schemes each one unlocks, because that is the order a
 * student should be asked to gather them in.
 */
export const CERTIFICATE_GUIDES: CertificateGuide[] = [
  {
    id: "community_certificate",
    label: "Community Certificate",
    labelTa: "சமுதாய சான்றிதழ்",
    proves: "Your category (OC, BC, MBC, SC, ST), which decides your quota seat.",
    provesTa: "உங்கள் சமுதாய வகை, இது உங்கள் கிடைமட்ட இடத்தை தீர்மானிக்கிறது.",
    documentType: "community_certificate",
    readableFields: ["community"],
    manualFields: [
      {
        field: "domicileState",
        label: "Domicile state",
        why: "A Tamil Nadu certificate proves your category, not where you were born. Domicile comes from your nativity or residence record.",
      },
    ],
    pickerHint: "Has your category — OC, BC, MBC, SC or ST",
  },
  {
    id: "income_certificate",
    label: "Family Income Certificate",
    labelTa: "குடும்ப வருமானச் சான்றிதழ்",
    proves: "Your family's annual income, which is the cut-off for most schemes.",
    provesTa: "உங்கள் குடும்ப ஆண்டு வருமானம், பெரும்பாலான திட்டங்களின் வரம்பு.",
    documentType: "income_certificate",
    readableFields: ["annualFamilyIncome"],
    manualFields: [
      {
        field: "annualFamilyIncome",
        label: "Annual family income",
        why: "We can read the figure, but you must confirm it — a misread digit changes which schemes you qualify for.",
      },
    ],
    pickerHint: "Has your family's annual income",
  },
  {
    id: "first_graduate_certificate",
    label: "First Graduate Certificate",
    labelTa: "முதல் பட்டதாரர் சான்றிதழ்",
    proves: "That no one in your family has had a professional degree — a concession worth 10%.",
    provesTa: "உங்கள் குடுமத்தில் யாருக்கும் பட்டம் இல்லை — 10% சலுகை.",
    documentType: "first_graduate_certificate",
    readableFields: ["isFirstGraduate"],
    manualFields: [
      {
        field: "isFirstGraduate",
        label: "First graduate in the family",
        why: "We look for the words on the certificate, but this also depends on siblings, which the certificate does not always list. Answer it as 'Not sure' if you are unsure.",
      },
    ],
    pickerHint: "Has your first-graduate status",
  },
  {
    id: "marksheet",
    label: "Class 10 or 12 Mark Sheet",
    labelTa: "10 அல்லது 12ஆம் வகுப்பு மதிப்பெண் பட்டியல்",
    proves: "Your marks, which set the minimum for merit schemes.",
    provesTa: "உங்கள் மதிப்பெண்கள், சிறப்புத் திட்டங்களின் குறைந்தபட்ச வரம்பு.",
    documentType: "marksheet_12",
    readableFields: ["previousYearPercentage", "classOrYear"],
    manualFields: [],
    pickerHint: "Has your marks and percentage",
  },
  {
    id: "pwd_certificate",
    label: "Differently Abled Certificate",
    labelTa: "மாற்றுத்திறனாளி சான்றிதழ்",
    proves: "Your disability percentage, which unlocks disability-specific schemes.",
    provesTa: "உங்கள் மாற்றுத்திறன் சதவீதம், இது சிறப்புத் திட்டங்களைத் திறக்கும்.",
    documentType: "pwd_certificate",
    readableFields: ["isDifferentlyAbled", "disabilityPercentage"],
    manualFields: [
      {
        field: "disabilityPercentage",
        label: "Disability percentage",
        why: "Most schemes need 40% or more, and the certificate alone is not enough — the UDID number is also required at application.",
      },
    ],
    pickerHint: "Has your disability percentage",
  },
  {
    id: "nativity_certificate",
    label: "Nativity Certificate",
    labelTa: "நாட்டினுரிமைச் சான்றிதழ்",
    proves: "That you are a native of Tamil Nadu, required if you studied outside the state.",
    provesTa: "நீங்கள் தமிழ்நாட்டினர், வெளியில் படித்தால் தேவை.",
    documentType: "nativity_certificate",
    readableFields: ["hasNativityCertificate"],
    manualFields: [],
    pickerHint: "Has your nativity status",
  },
  {
    id: "ex_servicemen_certificate",
    label: "Ex-Servicemen Certificate",
    labelTa: "ஓய்வுபெற்ற படைவீரர் சான்றிதழ்",
    proves: "That a parent or guardian served in the armed forces.",
    provesTa: "உங்கள் பெற்றோர் அல்லது பாதுகாப்புப் படையில் பணியாற்றினர்.",
    documentType: "ex_servicemen_certificate",
    readableFields: ["isExServicemenWard"],
    manualFields: [],
    pickerHint: "Has your ex-servicemen status",
  },
  {
    id: "orphan_certificate",
    label: "Orphan Certificate",
    labelTa: "அனாதைச் சான்றிதழ்",
    proves: "That you are an orphan or a ward, which is a quota category of its own.",
    provesTa: "நீங்கள் அனாதை அல்லது பாதுகாவல், இது தனி இடமாகும்.",
    documentType: "orphan_certificate",
    readableFields: ["isOrphan"],
    manualFields: [],
    pickerHint: "Has your orphan or ward status",
  },
  {
    id: "other",
    label: "Something else",
    labelTa: "ஏனையவை",
    proves:
      "We will still read it, but we may not recognise it. You can always fill the form by hand instead.",
    provesTa: "நாங்கள் படிக்க முயற்சிக்கலாம், ஆனால் அறியாமல் இருக்கலாம்.",
    documentType: null,
    readableFields: [],
    manualFields: [],
    pickerHint: "Read it and see what we find",
  },
];

const BY_ID = new Map(CERTIFICATE_GUIDES.map((g) => [g.id, g]));

export function getCertificateGuide(id: string): CertificateGuide | undefined {
  return BY_ID.get(id);
}

/** The parser can only ever produce these, so the picker can say "expected here". */
/**
 * Every field the document readers can produce.
 *
 * This list has to stay in step with what the readers actually return. It used to
 * name only four fields, which quietly hid a bug: the readers report
 * isFirstGraduate and the two disability fields, so `expectedFieldsFor` was
 * returning an empty list for the First Graduate and Disability certificates and
 * the UI was telling students that nothing on those documents was expected to be
 * read — the opposite of the truth. Deriving the union from a single list means
 * the compiler complains instead.
 */
export const READABLE_FIELDS = [
  "community",
  "annualFamilyIncome",
  "previousYearPercentage",
  "classOrYear",
  "isFirstGraduate",
  "isDifferentlyAbled",
  "disabilityPercentage",
] as const;

export type ReadableField = (typeof READABLE_FIELDS)[number];

const READABLE_FIELD_SET: ReadonlySet<string> = new Set(READABLE_FIELDS);

/**
 * Fields the OCR reader will actually try to pull for a given certificate.
 *
 * A Community Certificate has no income on it, so if the reader reports an
 * income from one, the student should be told the value is not from the field
 * they expect. Marking the expected fields lets the UI say that plainly instead
 * of presenting every value as equally trustworthy.
 */
export function expectedFieldsFor(id: string): ReadableField[] {
  const guide = getCertificateGuide(id);
  if (!guide) return [];
  return guide.readableFields.filter((f): f is ReadableField => READABLE_FIELD_SET.has(f));
}

/**
 * Everything we ask for that no certificate can give us.
 *
 * The pattern: a certificate proves a fact about the student or the family, but
 * almost nothing proves which course they are in, how they got in, or how they
 * were taught. Only the student or their college knows that, so we ask.
 */
export interface ManualOnlyField {
  field: ProfileField;
  label: string;
  labelTa: string;
  why: string;
  /** Where the answer comes from, so the student knows what to look at. */
  source: string;
}

export const MANUAL_ONLY_FIELDS: ManualOnlyField[] = [
  {
    field: "course",
    label: "Course",
    labelTa: "பாடம்",
    why: "Not every certificate names the course, and marksheets name the class, not the subject.",
    source: "Your college or school admission letter.",
  },
  {
    field: "admissionRoute",
    label: "Admission route (government or management quota)",
    labelTa: "சேர்க்கை வழி",
    why: "Only your college knows which quota you were admitted under. Getting this wrong changes your seat category.",
    source: "Your college allotment letter.",
  },
  {
    field: "institutionType",
    label: "Institution type",
    labelTa: "கல்வி நிலைய வகை",
    why: "Government, government-aided and private institutions are treated differently by several schemes.",
    source: "The name of your college or school.",
  },
  {
    field: "level",
    label: "Level of study",
    labelTa: "கல்வி நிலை",
    why: "Sets the whole rule set, from class 1 to PhD.",
    source: "Your current course.",
  },
  {
    field: "gender",
    label: "Gender",
    labelTa: "பாலினம்",
    why: "A few schemes differ by gender, and we will not infer it from a name or a photograph.",
    source: "Your own answer.",
  },
  {
    field: "domicileState",
    label: "Domicile state",
    labelTa: "வதிவிட மாநிலம்",
    why: "Your community certificate proves your category, not where you were born.",
    source: "Your nativity certificate or residence record.",
  },
  {
    field: "studiedClass6to12InGovtSchool",
    label: "Studied Classes 6-12 in a government school",
    labelTa: "6-12 ஆம் வகுப்புகளை அரசுப் பள்ளியில் படித்தேன்",
    why: "Unlocks a 7.5% horizontal quota, and no certificate records your full school history.",
    source: "Your school records.",
  },
  {
    field: "isMinority",
    label: "Belongs to a notified minority community",
    labelTa: "அறிவிக்கப்பட்ட சிறுப்பெயின் சமுதியைச் சேர்ந்தவன்",
    why: "There is no single certificate for all communities, so this has to be your answer.",
    source: "Your own answer.",
  },
  {
    field: "isEminentSportsPerson",
    label: "Eminent sportsperson",
    labelTa: "சிறப்பு விளையாட்டு வீரர்",
    why: "Proven by a government sports certificate we do not read.",
    source: "Your State Sports Council certificate.",
  },
  {
    field: "isSriLankanTamil",
    label: "Sri Lankan Tamil",
    labelTa: "இலங்கைத் தமிழரன்",
    why: "Rare, and the scheme documents treat it as a self-declaration.",
    source: "Your own answer.",
  },
  {
    field: "isNccCadet",
    label: "NCC cadet",
    labelTa: "NCC இளம் புறவீரன்",
    why: "Proven by your NCC 'A', 'B' or 'C' certificate.",
    source: "Your NCC certificate.",
  },
  {
    field: "bankAccountAadhaarSeeded",
    label: "Bank account seeded with Aadhaar",
    labelTa: "வங்கிக் கணக்கு ஆதாருடன் இணைக்கப்பட்டுள்ளது",
    why: "Most payments go by Direct Benefit Transfer, but we ask only yes or no — never the account number.",
    source: "Your bank passbook or net banking page.",
  },
  {
    field: "hasValidAadhaar",
    label: "A valid Aadhaar exists",
    labelTa: "சரியான ஆதார் உள்ளது",
    why: "Every scheme needs it, but we ask only whether you have one. The number itself is never requested, stored, or read.",
    source: "Your own answer.",
  },
];

/** Things we will never ask for, listed so the absence is deliberate and visible. */
export const NEVER_COLLECT: { label: string; labelTa: string; why: string }[] = [
  {
    label: "Aadhaar number",
    labelTa: "ஆதார் எண்",
    why: "No scheme needs us to hold it. We ask only whether you have one, and any 12-digit number found on a document you upload is masked before it reaches you.",
  },
  {
    label: "Bank account or IFSC number",
    labelTa: "வங்கிக் கணக்கு எண்",
    why: "Payments go straight to your account by the government. We have no reason to store it.",
  },
  {
    label: "Phone number or OTP",
    labelTa: "கைபேசி எண் அல்லது OTP",
    why: "We send no OTP, so there is nothing for an attacker to intercept.",
  },
  {
    label: "Your scanned document, after you read it",
    labelTa: "படித்தபின் உங்கள் ஆவணம்",
    why: "The file is written to a private temporary folder, read once, and deleted. Only the values you tick are kept.",
  },
];

/** Look up a registry document, for the authority and how-to-obtain lines. */
export function documentSpecFor(type: DocumentType | null) {
  if (!type) return undefined;
  return DOCUMENT_SPECS.find((d) => d.type === type);
}
