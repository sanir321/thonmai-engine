import type { QuotaCategory, SpecialQuota } from "@/engine/types";
import { src, src1 } from "./sources";

/**
 * Tamil Nadu reservation roster.
 *
 * Structure matters and is easy to get wrong. BCM (3.5%) is a sub-quota
 * INSIDE the 30% BC block — it is not 3.5 points on top of BC. Likewise SCA
 * (3%) sits inside the 18% SC block. The engineering seat matrix displays them
 * as separate columns, which is where most confusion and most wrong calculators
 * come from.
 *
 * Source: G.O.(Ms) 167/2021 corroborated by TNEA 2026 Brochure §4 and the
 * MBBS/BDS Government Quota Prospectus 2026-27 pp. 52-53.
 */

const stateCode = "TN";

export const TN_QUOTA_ROSTER: QuotaCategory[] = [
  {
    code: "OC",
    stateCode,
    name: "Open Competition",
    nameTa: "திறந்த போட்டி",
    percentage: 31,
    parentCode: null,
    blockTotal: null,
    isSubQuota: false,
    notes:
      "Merit-based across all communities. Roughly 11% of the population is outside the 69% reservation, which is why the State has not exercised EWS powers.",
    sourceRefs: src("go167", "tneaBrochure", "dmeGovQ"),
  },
  {
    code: "BC",
    stateCode,
    name: "Backward Class (non-Muslim)",
    nameTa: "பிற்படைவினர் (முஸ்லிம் அல்ல)",
    percentage: 26.5,
    parentCode: null,
    blockTotal: 30,
    isSubQuota: false,
    sourceRefs: src("go167", "tneaBrochure"),
  },
  {
    code: "BCM",
    stateCode,
    name: "Backward Class Muslim",
    nameTa: "பிற்படைவினர் முஸ்லிம்",
    percentage: 3.5,
    parentCode: "BC",
    blockTotal: null,
    isSubQuota: true,
    notes: "Sub-quota inside the 30% BC block. Shown as its own column in the seat matrix but not additive to BC.",
    sourceRefs: src("go167", "dmeGovQ"),
  },
  {
    code: "MBC",
    stateCode,
    name: "Most Backward Class & Denotified Communities",
    nameTa: "மிகப் பிற்படைவினர் மற்றும் குடியாளர்கள்",
    percentage: 20,
    parentCode: null,
    blockTotal: 20,
    isSubQuota: false,
    isGroupingNode: true,
    notes: "Broken into MBC Vanniyar 10.5%, MBC & DNC 7%, and other MBC 2.5%.",
    sourceRefs: src("go167", "tneaBrochure", "dmeGovQ"),
  },
  {
    code: "MBCV",
    stateCode,
    name: "MBC Vanniyar",
    nameTa: "மிகப் பிற்படைவினர் வண்ணியர்",
    percentage: 10.5,
    parentCode: "MBC",
    blockTotal: null,
    isSubQuota: true,
    sourceRefs: src("go167"),
  },
  {
    code: "MBCDNC",
    stateCode,
    name: "MBC & DNC (non-Vanniyar)",
    nameTa: "மிகப் பிற்படைவினர் மற்றும் குடியாளர் (வண்ணியர் அல்ல)",
    percentage: 7,
    parentCode: "MBC",
    blockTotal: null,
    isSubQuota: true,
    sourceRefs: src("go167"),
  },
  {
    code: "MBC_OTHER",
    stateCode,
    name: "Other MBC (including Vanniyar, Telugu, Malayalam and allied communities)",
    nameTa: "ஏனைய மிகப் பிற்படைவினர் (வண்ணியர், தெலுங்கு, மலையாள மற்றும் மற்ற சமூதிகள் உட்பட)",
    percentage: 2.5,
    parentCode: "MBC",
    blockTotal: null,
    isSubQuota: true,
    notes:
      "Residual of the 20% MBC/DNC block: 10.5% MBC(Vanniyar) + 7% MBC&DNC + 2.5% other Backward Classes = 20%.",
    sourceRefs: src("go167"),
  },
  {
    code: "SC",
    stateCode,
    name: "Scheduled Caste",
    nameTa: "அரசு ஒழுங்கு வகை",
    percentage: 15,
    parentCode: null,
    blockTotal: 18,
    isSubQuota: false,
    notes: "No creamy layer and no income ceiling for SC quota reservation in TN admissions.",
    sourceRefs: src("go167", "tneaBrochure"),
  },
  {
    code: "SCA",
    stateCode,
    name: "Scheduled Caste — Arunthathiyar",
    nameTa: "அரசு ஒழுங்கு வகை — அருந்தாத்தார்",
    percentage: 3,
    parentCode: "SC",
    blockTotal: null,
    isSubQuota: true,
    notes: "Sub-quota inside the 18% SC block, for the Arunthathiyar community only (TN Act No. 4 of 2009).",
    sourceRefs: src("go167", "dmeGovQ"),
  },
  {
    code: "ST",
    stateCode,
    name: "Scheduled Tribe",
    nameTa: "அரசு ஒழுங்கு பகுதி",
    percentage: 1,
    parentCode: null,
    blockTotal: null,
    isSubQuota: false,
    notes: "Low because Tamil Nadu has the smallest tribal share of any large Indian state.",
    sourceRefs: src("go167", "tneaBrochure"),
  },
];

/** Top-level blocks only — the numbers that actually add up to 100. */
export const TN_QUOTA_BLOCKS = TN_QUOTA_ROSTER.filter((q) => !q.isSubQuota);

/**
 * The share of total seats a block actually occupies.
 *
 * `percentage` is a category's own seat share, so BC reads 26.5% while the BC
 * *block* is 30% once BCM's 3.5% is added. Summing `percentage` across blocks
 * therefore under-counts by the sub-quotas; this helper returns the figure that
 * belongs in the 100% arithmetic.
 */
export function blockShare(q: QuotaCategory): number {
  return q.blockTotal ?? q.percentage ?? 0;
}

/** Every category code the app can offer, for dropdowns and validation. */
export function allCodes(): string[] {
  return TN_QUOTA_ROSTER.map((q) => q.code);
}

/**
 * Horizontal quotas that cut across every vertical category. This is the
 * single most misunderstood part of Tamil Nadu admissions, so the app shows
 * these separately from the vertical roster.
 */
export const TN_HORIZONTAL_QUOTAS: SpecialQuota[] = [
  {
    code: "GOVT_SCHOOL_7_5",
    name: "Government School Students — 7.5% horizontal quota",
    nameTa: "அரசுப் பள்ளி மாணவர்கள் — 7.5% கிடைமட்டம்",
    scope: "all_institutions",
    quota: "7.5% of every vertical category, horizontally",
    conditions: [
      "Must have studied Classes VI to XII in a State Government school (includes Corporation, Municipal, Adi Dravidar & Tribal Welfare, Kallar Reclamation and Forest Department schools).",
      "Government bears the full tuition, hostel and development fee (G.O. 221, Higher Education (J2), 15.11.2021).",
      "Does not reduce the existing 69% vertical reservation.",
      "For BC/MBC/DNC/OC students admitted under this quota to MBBS/BDS, course and mess fees are fully reimbursed to the Directorate of Medical Education by the Directorate of Backward Classes Welfare.",
      "Proof is a bonafide certificate carrying the school's EMIS number — not a separate certificate from the revenue department.",
    ],
    sourceRefs: src("go167", "bcwScholarship", "dmeGovQ"),
  },
];

export const TN_SPECIAL_QUOTAS: SpecialQuota[] = [
  {
    code: "PWD_5",
    name: "Persons with Benchmark Disabilities — 5%",
    nameTa: "மாற்றுத்திறனாளி — 5%",
    scope: "all_institutions",
    quota: "5% of seats in all institutions (Arts & Science: 5 per 100 seats in each of the OC, BC/MBC/DNC and SC/ST blocks)",
    conditions: [
      "Minimum 40% benchmark disability.",
      "Certificate from a Medical Board of at least 3 doctors for TNEA; for MBBS/BDS, a Regional Medical Board at RGGGH Chennai or the designated centres at Madurai, Coimbatore and Thanjavur.",
      "5% of vocational stream seats for TNEA; vocational diploma allotment is published as a separate seat matrix.",
      "UDID registration is required before applying on the National Scholarship Portal.",
    ],
    sourceRefs: src("tneaBrochure", "rpwAct", "dmeGovQ", "tngasaGuidelines"),
  },
  {
    code: "EX_SERVICEMEN",
    name: "Sons/Daughters of Ex-Servicemen",
    nameTa: "வீரர்கள்/வீரங்கிகள் குடும்பத்தினர்",
    scope: "all_institutions",
    quota: "Engineering: 150 seats. MBBS: 10 seats, BDS: 1 seat (Government colleges). Arts & Science: 6 UG seats per block.",
    conditions: [
      "Certificate from an officer not below the rank of Assistant Director, Department of Ex-Servicemen's Welfare.",
      "Also requires the discharge certificate and the parent's Ex-Servicemen ID.",
      "Tamil Nadu origin only.",
      "Special-category candidates also compete in general counselling — the reservation is additive, not a separate stream.",
    ],
    sourceRefs: src("tneaBrochure", "dmeGovQ", "goExServicemen"),
  },
  {
    code: "SPORTS",
    name: "Eminent Sports Persons",
    nameTa: "புகழ்பெற்ற விளையாட்டு வீரர்கள்",
    scope: "all_institutions",
    quota: "Engineering: 500 seats. MBBS: 13 seats, BDS: 2 seats in Government colleges. Arts & Science: 3% of UG seats (district/divisional level and above).",
    conditions: [
      "G.O.(Ms) No. 121, Higher Education (J1), 03.07.2012 governs the engineering quota.",
      "Tamil Nadu origin only.",
    ],
    sourceRefs: src("goSports", "tneaBrochure", "dmeGovQ", "tngasaGuidelines"),
  },
  {
    code: "FIRST_GRADUATE",
    name: "First Graduate Tuition Fee Concession",
    nameTa: "குடும்பத்தின் முதல் பட்டதாரர் சலுகை",
    scope: "all_institutions",
    quota: "Fee concession, not a fixed seat count",
    conditions: [
      "The candidate must be the first graduate in the family.",
      "Certificate issued by the Headquarters Deputy Tahsildar in the format prescribed by G.O.(st) No. 85, Higher Education (J2), 16.04.2010.",
      "Accepted only as a digitally signed e-Certificate.",
      "Requires a family tree naming father, mother, paternal and maternal grandparents, brothers and sisters, plus a joint declaration by the candidate and parent/guardian.",
      "Disqualified if a brother or sister has already availed the first-graduate concession for a professional course.",
    ],
    sourceRefs: src("goFirstGraduate", "tngasaGuidelines"),
  },
  {
    code: "MGMT_QUOTA",
    name: "Management Quota",
    nameTa: "மேலாண்மை இடக்கூறு",
    scope: "medical",
    quota: "Medical/dental: 35% or less of seats in self-financing and State private university colleges. Split 65:35 (Government : Management) for non-minority unaided colleges; 50:50 for minority institutions.",
    conditions: [
      "Higher fee than Government Quota seats.",
      "Admission is still NEET-based.",
      "NRI quota is 15% of self-financing seats; NRI vacancies convert to Management seats in Round 3.",
      "Minority quota (Linguistic: Telugu/Malayalam; Religious: Christian) additionally requires the candidate to be a native of Tamil Nadu and to hold a Nativity Certificate.",
      "Requires: NEET score card, Class X/XI/XII marksheets, Transfer Certificate, Community Certificate where applicable, parent's Tamil Nadu Community Certificate, an Income Certificate valid on the date of application, and for management quota a Nativity Certificate where applicable.",
      "For engineering, TNEA does not itself allocate management-quota seats; those are surrendered by self-financing colleges. Always check the individual college's 65:35 split in its prospectus.",
    ],
    sourceRefs: src("dmeMgmtQ", "dmeGovQ", "tneaBrochure"),
  },
  {
    code: "NRI_QUOTA",
    name: "NRI Quota",
    nameTa: "புலம்பெயர் இடக்கூறு",
    scope: "medical",
    quota: "15% of self-financing seats",
    conditions: [
      "Unfilled NRI seats convert to Management seats in Round 3.",
    ],
    sourceRefs: src("dmeMgmtQ"),
  },
  {
    code: "NCC",
    name: "NCC Quota",
    nameTa: "என்சிசி இடக்கூறு",
    scope: "arts_science",
    quota: "1 NCC ('A' certificate) UG seat and 1 NCC PG ('C' certificate) seat per Government Arts & Science college",
    conditions: ["Certificate level 'A' for UG admission, 'C' for PG admission."],
    sourceRefs: src("tngasaGuidelines"),
  },
  {
    code: "SRI_LANKAN_TAMIL",
    name: "Srilankan Tamil Refugee Quota",
    nameTa: "இலங்கை தமிழர் அகழ்வினர் இடக்கூறு",
    scope: "all_institutions",
    quota: "5 seats",
    conditions: [
      "G.O.(St) No. 172, Higher Education (J2), 29.06.2010.",
      "Certificate issued by the Headquarters Tahsildar.",
      "Admitted under Open Competition.",
    ],
    sourceRefs: src("dmeGovQ", "tneaBrochure"),
  },
  {
    code: "SECURITY_FORCES",
    name: "Security Forces children and widows",
    nameTa: "பாதுகாப்புப் படைகள் குடும்பத்தினர் மற்றும் விதவைகள்",
    scope: "arts_science",
    quota: "3 UG and 2 PG seats per college",
    conditions: [
      "Parent must be serving in, or retired from, the Indian Armed Forces, Central Armed Police Forces, State Police, Fire Services or a Central/State Government employee deployed on border duty.",
      "Widows and children of such personnel are eligible; ex-servicemen are covered by the separate Ex-Servicemen quota.",
      "Proof: service/discharge certificate from the unit, plus a relationship or death certificate where applicable.",
    ],
    sourceRefs: src("tngasaGuidelines"),
  },
  {
    code: "IRT_WARD",
    name: "IRT / State Transport Corporation ward quota",
    nameTa: "போக்குவரத்து அமைப்பு குடும்பத்தினர் இடக்கூறு",
    scope: "medical",
    quota: "30 of 100 seats at Government Erode Medical College",
    conditions: ["Ward of a State Transport Corporation / IRT corpus-fund member."],
    sourceRefs: src("dmeGovQ"),
  },
  {
    code: "ANDAMAN_TAMIL",
    name: "Andaman & Nicobar Tamil-origin quota",
    nameTa: "அன்டமன் நிக்கோபார் தமிழர்களுக்கான இடக்கூறு",
    scope: "arts_science",
    quota: "2 UG seats per college",
    conditions: ["Tamil origin in the Andaman & Nicobar Islands."],
    sourceRefs: src("tngasaGuidelines"),
  },
];

/**
 * Central reservation, included for contrast. Tamil Nadu students can only use
 * it at central institutions (IITs, NITs, IIITs, AIIMS, IIMs, central
 * universities) — never in state quota counselling.
 */
export const CENTRAL_RESERVATION = [
  { code: "GEN", name: "General (Unreserved)", percentage: 40.5 },
  { code: "EWS", name: "Economically Weaker Sections", percentage: 10 },
  { code: "OBC_NCL", name: "OBC Non-Creamy Layer", percentage: 27 },
  { code: "SC", name: "Scheduled Caste", percentage: 15 },
  { code: "ST", name: "Scheduled Tribe", percentage: 7.5 },
] as const;

export const CENTRAL_EWS_RULE = {
  annualIncomeCeiling: 800000,
  docRef: "O.M. No. 36039/1/2019-Estt(Res) dated 31.01.2019",
  assetExclusions: [
    "Agricultural land of 5 acres or more",
    "A residential flat of 1000 sq ft or more in a notified municipality",
    "A residential plot of 100 sq yd or more in a notified municipality",
    "A residential plot of 200 sq yd or more anywhere else",
  ],
  note:
    "The ₹8 lakh EWS criterion is a CENTRAL rule. Tamil Nadu has not implemented a 10% EWS quota in state admissions, so an EWS certificate does not create a Tamil Nadu state quota seat. It does matter for central institution admissions, Top Class Education, AICTE and INSPIRE schemes.",
  sourceRef: src1("ewsOm"),
};
