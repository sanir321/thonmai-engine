import { z } from "zod";

/**
 * The single definition of a student answer set.
 *
 * `/api/match` validates live requests with this, and `/api/profiles` validates
 * before persisting, so a saved profile can never be shaped differently from a
 * live one. If a rule changes here, both endpoints change together.
 */
export const heldDocumentSchema = z.object({
  type: z.string(),
  issuedOn: z.string().nullish(),
  expiresOn: z.string().nullish(),
  issuingAuthority: z.string().nullish(),
  ocrConfidence: z.number().nullish(),
  confirmed: z.boolean().default(true),
});

export const profileSchema = z.object({
  level: z.enum(["school", "iti", "diploma", "ug", "pg", "phd"]),
  // School and ITI run to class 12; degree levels cap at year 6. 12 is the widest
  // any single field can legitimately be, so the bound is checked here and the
  // level-specific limit is enforced in the form.
  classOrYear: z.number().int().min(1).max(12),
  gender: z.enum(["male", "female", "other"]),
  community: z.enum(["OC", "BC", "BCM", "MBC", "MBCV", "DNC", "SC", "SCA", "ST"]),
  religion: z.string().nullish(),
  // Disadvantage markers are OPTIONAL. An absent key means "not answered" and
  // must stay `unknown` all the way through the engine — never coerced to false.
  isMinority: z.boolean().optional(),
  domicileState: z.string(),
  course: z.string().nullish(),
  annualFamilyIncome: z.number().min(0).nullish(),
  previousYearPercentage: z.number().min(0).max(100).nullish(),
  attendancePercentage: z.number().min(0).max(100).nullish(),
  admissionRoute: z.enum([
    "government_quota",
    "management_quota",
    "nri_quota",
    "minority_quota",
    "not_applicable",
  ]),
  institutionType: z.enum(["government", "government_aided", "private"]),
  isFirstGraduate: z.boolean().optional(),
  studiedClass6to12InGovtSchool: z.boolean().optional(),
  isDifferentlyAbled: z.boolean().optional(),
  // Only meaningful alongside isDifferentlyAbled, and only above the 40% bar.
  disabilityPercentage: z.number().min(0).max(100).nullish(),
  isExServicemenWard: z.boolean().optional(),
  isEminentSportsPerson: z.boolean().optional(),
  isOrphan: z.boolean().optional(),
  isCovidAffectedWard: z.boolean().optional(),
  isArmedForcesMartyrWard: z.boolean().optional(),
  isSriLankanTamil: z.boolean().optional(),
  isNccCadet: z.boolean().optional(),
  hasNativityCertificate: z.boolean().optional(),
  bankAccountAadhaarSeeded: z.boolean().optional(),
  hasValidAadhaar: z.boolean().optional(),
});

export const matchBodySchema = z.object({
  profile: profileSchema,
  documents: z.array(heldDocumentSchema).default([]),
  now: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const saveProfileBodySchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(80),
  profile: profileSchema,
  documents: z.array(heldDocumentSchema).max(40).default([]),
});
