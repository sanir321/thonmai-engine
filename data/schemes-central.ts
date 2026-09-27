import type { Scheme } from "@/engine/types";
import { all, any, containsAny, eq, gte, inList, isTrue, lte } from "@/engine/rules";
import { normaliseBenefit } from "@/engine/benefit";
import { src } from "./sources";

const V = "2026-09-27";

const ALL_CATEGORIES = ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"] as const;
const aadhaarBank = isTrue("bankAccountAadhaarSeeded", "Bank account is Aadhaar-seeded");
const nspApply = {
  portal: "National Scholarship Portal",
  url: "https://scholarships.gov.in",
  channel: "online" as const,
  helpline: "0120-6619540 / 1800-118-111",
};

/**
 * AY 2026-27 NSP window: portal open 01-06-2026, student applications close
 * 31-10-2026, institute verification 15-11-2026, DNO/SNO verification
 * 30-11-2026. NMMS closes earlier (30-09-2026) and the free coaching scheme
 * opens later (03-08-2026) — those are recorded per scheme.
 *
 * IMPORTANT: NSP lists no Tamil Nadu state schemes. A Tamil Nadu student on
 * NSP only ever sees Central Sector and Centrally Sponsored schemes. All TN
 * state welfare goes through umis.tn.gov.in. This app therefore has to combine
 * two independent sources, which is exactly the gap a student falls into.
 */
export const CENTRAL_SCHEMES: Scheme[] = [
  // =====================================================================
  // PM-USP CENTRAL SECTOR SCHEME OF SCHOLARSHIP (CSSS)
  // =====================================================================
  {
    id: "in_csss",
    name: "PM-USP Central Sector Scheme of Scholarship for College and University Students",
    nameTa: "மத்திய சுற்றுத் திட்ட உதவித்தொகை (CSSS)",
    authority: "central",
    department: "Department of Higher Education, Ministry of Education",
    level: ["ug", "pg"],
    categories: [...ALL_CATEGORIES],
    summary:
      "Merit-based scholarship for students entering the first year of a degree or postgraduate programme. ₹12,000 per year for the first three years of graduation and ₹20,000 per year for postgraduate study or years 4 and 5 of a professional course. A B.Tech receives ₹12,000 for years 1 to 3 and ₹20,000 in year 4. 50% of awards are reserved for girls and 5% for benchmark disabilities. Family income must not exceed ₹4.5 lakh per annum.",
    rules: all(
      inList("level", ["ug", "pg"]),
      lte("annualFamilyIncome", 450000, "Annual family income"),
      // Proxy for the "above the 80th percentile in the Class 12 examination"
      // criterion. Tamil Nadu does not publish a percentile to students, so we
      // use the raw aggregate and flag it in the UI.
      gte("previousYearPercentage", 80, "Class 12 aggregate of 80% or above (proxy for the 80th percentile)"),
      aadhaarBank,
    ),
    combinableWithWelfare: false,
    exclusiveWith: ["in_pm_yashasvi_postmatric", "in_top_class_sc", "in_aicte_pragati", "in_aicte_saksham"],
    benefit: normaliseBenefit(
      [
        { label: "Graduation years 1 to 3", amount: 12000, period: "year" },
        { label: "Postgraduate, or years 4 and 5 of a professional course", amount: 20000, period: "year" },
      ],
      "exact",
      "B.Tech / B.Engg: ₹12,000 for years 1-3 and ₹20,000 in year 4 only. The graduation cap means a 4-year B.Tech does not continue into year 5.",
    ),
    documents: [
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "marksheet_12", mandatory: true, note: "Determines the merit percentile." },
      { type: "income_certificate", mandatory: true },
      { type: "community_certificate", mandatory: false, note: "Required for reservation-linked components." },
      { type: "bonafide_certificate", mandatory: true },
      { type: "previous_year_marksheet", mandatory: false, note: "Mandatory for renewal." },
    ],
    apply: {
      ...nspApply,
      deadlineNote:
        "Renewal window for CSSS and PM-USP J&K/Ladakh: student close 31-10-2026, institute 15-11-2026, L2 30-11-2026. Some scheme cards still display an earlier set of dates (student close 30-09-2026) — the portal announcement of the later dates takes precedence.",
    },
    status: "live",
    sourceRefs: src("nspSchemes", "csssGuidelines"),
    tags: ["central", "merit", "ug", "pg", "nsp", "nointake-with-others"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // PM-YASASVI
  // =====================================================================
  {
    id: "in_yashasvi_prematric",
    name: "PM-YASASVI Pre-Matric Scholarship for OBC, EBC and DNT Students",
    nameTa: "பிற்படைவினர் முன்பருவ உதவித்தொகை",
    authority: "central",
    department: "Department of Social Justice & Empowerment (Backward Classes)",
    level: ["school"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC"],
    summary:
      "For OBC, Economically Backward Class and De-notified Tribe students in Classes 9 and 10, funded 60% by the Union Government and 40% by the state. In Tamil Nadu the state component pays BC/MBC/DNC girl students in Classes 9 and 10 in government schools ₹4,000 per year directly into their bank accounts. Family income must not exceed ₹2.50 lakh.",
    rules: all(
      eq("level", "school"),
      inList("classOrYear", [9, 10], "Class 9 or 10"),
      lte("annualFamilyIncome", 250000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Academic allowance (Tamil Nadu state component, girls in govt schools)", amount: 4000, period: "year" },
        { label: "Academic allowance (central component)", amount: 4000, period: "year" },
      ],
      "estimated",
      "The ₹4,000 figure is the Tamil Nadu state component. The central component carries a separate academic allowance plus a book allowance as notified.",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { ...nspApply, deadlineNote: "State-implemented. Tamil Nadu applies through USSP at umis.tn.gov.in; the NSP mirror follows the standard 31-10-2026 close." },
    status: "live",
    sourceRefs: src("yashasvi", "bcwScholarship", "nspSchemes"),
    tags: ["central", "state-implemented", "obc", "school", "class-9-10", "girls"],
    lastVerifiedAt: V,
  },
  {
    id: "in_yashasvi_postmatric",
    name: "PM-YASASVI Post-Matric Scholarship for OBC, EBC and DNT Students",
    nameTa: "பிற்படைவினர் மேற்படிப்பு உதவித்தொகை (YASASVI)",
    authority: "central",
    department: "Department of Social Justice & Empowerment (Backward Classes)",
    level: ["iti", "diploma", "ug", "pg"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC"],
    summary:
      "Post-matric scholarship for BC, MBC and DNC students in Tamil Nadu pursuing UG degree, polytechnic, professional courses and other post-matric programmes, funded 60:40 between the Union and State Governments and paid by Direct Benefit Transfer. Awards are banded by course group: Group 1 ₹10,000 + ₹10,000, Group 2 ₹8,000 + ₹5,000, Group 3 ₹6,000 + ₹2,000, Group 4 ₹5,000. Family income must not exceed ₹2.50 lakh.",
    rules: all(
      inList("level", ["iti", "diploma", "ug", "pg"]),
      lte("annualFamilyIncome", 250000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Group 1 — degree / PG professional course", amount: 20000, period: "year" },
        { label: "Group 2", amount: 13000, period: "year" },
        { label: "Group 3", amount: 8000, period: "year" },
        { label: "Group 4", amount: 5000, period: "year" },
      ],
      "estimated",
      "Amounts are published in four course groups. The correct group depends on your programme, which we do not yet capture.",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "bonafide_certificate", mandatory: true },
      { type: "previous_year_marksheet", mandatory: false, note: "Mandatory for renewal." },
    ],
    apply: { ...nspApply, deadlineNote: "In Tamil Nadu this must be applied through the Unified State Scholarship Portal at umis.tn.gov.in using the UMIS ID and an Aadhaar-seeded bank account." },
    status: "live",
    sourceRefs: src("yashasvi", "bcwScholarship", "nspSchemes"),
    tags: ["central", "state-implemented", "obc", "ug", "pg", "60-40"],
    lastVerifiedAt: V,
  },
  {
    id: "in_yashasvi_top_class_school",
    name: "PM-YASASVI Top Class Education in Schools for OBC, EBC and DNT Students",
    nameTa: "மேல்நிலை கல்வி உதவித்தொகை (பள்ளி)",
    authority: "central",
    department: "Department of Social Justice & Empowerment (Backward Classes)",
    level: ["school"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC"],
    summary:
      "For OBC/EBC/DNT students in Classes 9 to 12 seeking admission to notified top schools. Up to ₹75,000 per year for Classes 9 and 10, rising to ₹1,25,000 per year for Classes 11 and 12. Family income must not exceed ₹2.50 lakh.",
    rules: all(
      eq("level", "school"),
      inList("classOrYear", [9, 10, 11, 12], "Classes 9 to 12"),
      lte("annualFamilyIncome", 250000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Classes 9 and 10", amount: 75000, period: "year" },
        { label: "Classes 11 and 12", amount: 125000, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "marksheet_10", mandatory: false },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("yashasvi", "nspSchemes"),
    tags: ["central", "obc", "school", "boarding", "high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_yashasvi_top_class_college",
    name: "PM-YASASVI Top Class Education in College for OBC, EBC and DNT Students",
    nameTa: "மேல்நிலை கல்வி உதவித்தொகை (கல்லூரி)",
    authority: "central",
    department: "Department of Social Justice & Empowerment (Backward Classes)",
    level: ["ug", "pg"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC"],
    summary:
      "Full-cost scholarship for OBC/EBC/DNT students in full-time undergraduate and postgraduate programmes. Fees are capped at ₹2.00 lakh in private institutions and ₹3.72 lakh in government notified institutions, with a living allowance of ₹3,000 per month, a books allowance of ₹5,000 per year and a one-time ₹45,000. 30% of awards are reserved for girls. Family income must not exceed ₹2.50 lakh.",
    rules: all(
      inList("level", ["ug", "pg"]),
      lte("annualFamilyIncome", 250000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Fees, private institution (capped)", amount: 200000, period: "year" },
        { label: "Living allowance", amount: 36000, period: "year" },
        { label: "Books allowance", amount: 5000, period: "year" },
        { label: "One-time grant", amount: 45000, period: "one_time" },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "bonafide_certificate", mandatory: true },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("yashasvi", "nspSchemes"),
    tags: ["central", "obc", "ug", "pg", "high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_top_class_sc",
    name: "Top Class Education for Scheduled Caste Students",
    nameTa: "அரசு ஒழுங்கு வகை மேல்நிலைக் கல்வி உதவித்தொகை",
    authority: "central",
    department: "Department of Social Justice & Empowerment",
    level: ["ug", "pg"],
    categories: ["SC", "SCA"],
    summary:
      "For SC students in undergraduate and postgraduate programmes. Fees of ₹2.00 lakh per year in private institutions, with allowances of ₹86,000 in the first year and ₹41,000 per year thereafter. Family income must not exceed ₹8.00 lakh. 30% of awards are reserved for girls.",
    rules: all(
      inList("community", ["SC", "SCA"]),
      inList("level", ["ug", "pg"]),
      lte("annualFamilyIncome", 800000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Fees, first year", amount: 86000, period: "year" },
        { label: "Fees, subsequent years", amount: 41000, period: "year" },
        { label: "Additional fee component in private institutions (capped)", amount: 200000, period: "year", note: "Up to ₹2.00 lakh per year in private institutions." },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "marksheet_12", mandatory: true },
    ],
    apply: { ...nspApply, deadlineNote: "On the NSP catalogue, institute and DNO/SNO verification for this scheme closes 30-11-2026." },
    status: "live",
    sourceRefs: src("nspSchemes", "nsp"),
    tags: ["central", "sc", "ug", "pg", "high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_tribal_higher_ed",
    name: "National Fellowship and Scholarship for Higher Education of Scheduled Tribe Students",
    nameTa: "புலங்கர் மாணவர் உயர்கல்வி உதவித்தொகை",
    authority: "central",
    department: "Ministry of Tribal Affairs",
    level: ["ug", "pg", "phd"],
    categories: ["ST"],
    summary:
      "Formerly Top Class Education for Schedule Tribe students, now administered as the National Fellowship and Scholarship for Higher Education of ST Students. Family income must not exceed ₹6.00 lakh.",
    rules: all(
      eq("community", "ST"),
      inList("level", ["ug", "pg", "phd"]),
      lte("annualFamilyIncome", 600000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Full-cost scholarship for ST students", amount: 150000, period: "year", note: "Fees, maintenance and books as notified." }], "variable"),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { ...nspApply, deadlineNote: "DNO/SNO verification for this scheme closes 30-11-2026 on the NSP catalogue." },
    status: "live",
    sourceRefs: src("nspSchemes", "nsp"),
    tags: ["central", "st", "ug", "pg", "phd"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // AICTE — technical education
  // =====================================================================
  {
    id: "in_aicte_pragati",
    name: "AICTE Pragati Scholarship for Girl Students",
    nameTa: "அக்ஷயா பிரகதி உதவித்தொகை",
    authority: "central",
    department: "All India Council for Technical Education",
    level: ["ug", "diploma"],
    categories: [...ALL_CATEGORIES],
    summary:
      "₹50,000 per year for girl students in technical education, for the first year of a degree or lateral entry diploma, for a maximum of 4 years. A maximum of 2 girls per family are eligible. Family income must not exceed ₹8 lakh per annum.",
    rules: all(
      eq("gender", "female", "Girl student"),
      inList("level", ["ug", "diploma"]),
      lte("annualFamilyIncome", 800000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Scholarship, lump sum for up to 4 years", amount: 50000, period: "year" }], "exact"),
    documents: [
      { type: "aadhaar", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "bonafide_certificate", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "marksheet_12", mandatory: false },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("aicteGuidelines", "aictePragatiGuidelines", "nspSchemes"),
    tags: ["central", "girls", "technical", "ug", "diploma", "high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_aicte_saksham",
    name: "AICTE Saksham Scholarship for Specially Abled Students",
    nameTa: "அக்ஷயா சக்ஷம் உதவித்தொகை",
    authority: "central",
    department: "All India Council for Technical Education",
    level: ["ug", "diploma"],
    categories: [...ALL_CATEGORIES],
    summary:
      "₹50,000 per year for students with at least 40% disability pursuing technical education, for the first year of a degree or lateral entry diploma, for a maximum of 4 years. Family income must not exceed ₹8 lakh per annum.",
    rules: all(
      isTrue("isDifferentlyAbled", "Specially abled student"),
      gte("disabilityPercentage", 40, "Disability percentage"),
      inList("level", ["ug", "diploma"]),
      lte("annualFamilyIncome", 800000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Scholarship, lump sum for up to 4 years", amount: 50000, period: "year" }], "exact"),
    documents: [
      { type: "pwd_certificate", mandatory: true },
      { type: "udid", mandatory: true, note: "You must log in to the UDID portal and consent to sharing your UDID details, or the NSP application cannot be submitted." },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("aicteGuidelines", "aicteSakshamGuidelines", "nspSchemes"),
    tags: ["central", "pwd", "technical", "ug", "high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_aicte_swanath",
    name: "AICTE Swanath Scholarship Scheme",
    nameTa: "அக்ஷயா ஸ்வனத் உதவித்தொகை",
    authority: "central",
    department: "All India Council for Technical Education",
    level: ["ug", "diploma"],
    categories: [...ALL_CATEGORIES],
    summary:
      "₹50,000 per year for students who are orphans, wards of COVID-19-affected families, or wards of Armed Forces martyrs, pursuing degree or diploma courses in technical education. Family income must not exceed ₹8 lakh per annum.",
    rules: all(
      any(
        isTrue("isOrphan", "Orphan"),
        isTrue("isCovidAffectedWard", "Ward of a COVID-19 affected family"),
        isTrue("isArmedForcesMartyrWard", "Ward of an Armed Forces martyr"),
      ),
      inList("level", ["ug", "diploma"]),
      lte("annualFamilyIncome", 800000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Scholarship", amount: 50000, period: "year" }], "exact"),
    documents: [
      { type: "orphan_certificate", mandatory: true, note: "Or orphan/COVID/martyr documentation as applicable." },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("aicteGuidelines", "aicteSwanathGuidelines", "nspSchemes"),
    tags: ["central", "orphan", "technical", "ug", "high-value"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // DEPwD
  // =====================================================================
  {
    id: "in_depwd_prematric",
    name: "Pre-Matric Scholarship for Students with Disabilities",
    nameTa: "முன்பருவ மாற்றுத்திறனாளி உதவித்தொகை",
    authority: "central",
    department: "Department of Empowerment of Persons with Disabilities",
    level: ["school"],
    categories: [...ALL_CATEGORIES],
    summary:
      "For students with at least 40% disability in Classes 9 and 10. Maintenance of ₹800 per month for hostellers and ₹500 per month for day scholars, plus a disability allowance of ₹4,000 per year for those with up to 80% disability and ₹2,000 for severe disability, and a books allowance of ₹1,000 per year. Family income must not exceed ₹2.50 lakh.",
    rules: all(
      isTrue("isDifferentlyAbled", "Student with a disability"),
      gte("disabilityPercentage", 40, "Disability percentage"),
      inList("level", ["school"]),
      inList("classOrYear", [9, 10], "Classes 9 or 10"),
      lte("annualFamilyIncome", 250000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Maintenance, hosteller", amount: 9600, period: "year" },
        { label: "Maintenance, day scholar", amount: 6000, period: "year" },
        { label: "Disability allowance (up to 80%)", amount: 4000, period: "year" },
        { label: "Books allowance", amount: 1000, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "pwd_certificate", mandatory: true },
      { type: "udid", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { ...nspApply, deadlineNote: "This scheme opens 25-07-2026 and closes 30-09-2026, with L2 verification closing 31-10-2026." },
    status: "live",
    sourceRefs: src("depwdGuidelines", "nspSchemes"),
    tags: ["central", "pwd", "school", "class-9-10"],
    lastVerifiedAt: V,
  },
  {
    id: "in_depwd_postmatric",
    name: "Post-Matric Scholarship for Students with Disabilities",
    nameTa: "மேற்படிப்பு மாற்றுத்திறனாளி உதவித்தொகை",
    authority: "central",
    department: "Department of Empowerment of Persons with Disabilities",
    level: ["school", "iti", "diploma", "ug", "pg"],
    categories: [...ALL_CATEGORIES],
    summary:
      "For students with at least 40% disability from Class 11 to postgraduate level. Fees up to ₹1.40 lakh per year, maintenance of ₹1,200 per month for hostellers and ₹650 for day scholars, a disability allowance, and a books allowance of ₹1,500 per year. Family income must not exceed ₹2.50 lakh.",
    rules: all(
      isTrue("isDifferentlyAbled"),
      gte("disabilityPercentage", 40, "Disability percentage"),
      inList("level", ["school", "iti", "diploma", "ug", "pg"]),
      lte("annualFamilyIncome", 250000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Fees, capped", amount: 140000, period: "year" },
        { label: "Maintenance, hosteller", amount: 14400, period: "year" },
        { label: "Maintenance, day scholar", amount: 7800, period: "year" },
        { label: "Books allowance", amount: 1500, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "pwd_certificate", mandatory: true },
      { type: "udid", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { ...nspApply, deadlineNote: "Opens 25-07-2026, closes 31-10-2026." },
    status: "live",
    sourceRefs: src("depwdGuidelines", "nspSchemes"),
    tags: ["central", "pwd", "ug", "pg"],
    lastVerifiedAt: V,
  },
  {
    id: "in_depwd_top_class",
    name: "Top Class Education for Students with Disabilities",
    nameTa: "மாற்றுத்திறனாளி மேல்நிலைக் கல்வி",
    authority: "central",
    department: "Department of Empowerment of Persons with Disabilities",
    level: ["ug", "pg"],
    categories: [...ALL_CATEGORIES],
    summary:
      "For students with at least 40% disability in undergraduate and postgraduate programmes. Fees up to ₹1.90 lakh per year, maintenance of ₹3,000 per month for hostellers and ₹1,500 for day scholars, a special allowance of ₹2,000 per month, and a books allowance of ₹5,000 per year. Family income must not exceed ₹8.00 lakh.",
    rules: all(
      isTrue("isDifferentlyAbled"),
      gte("disabilityPercentage", 40, "Disability percentage"),
      inList("level", ["ug", "pg"]),
      lte("annualFamilyIncome", 800000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Fees, capped", amount: 190000, period: "year" },
        { label: "Maintenance, hosteller", amount: 36000, period: "year" },
        { label: "Maintenance, day scholar", amount: 18000, period: "year" },
        { label: "Special allowance", amount: 24000, period: "year" },
        { label: "Books allowance", amount: 5000, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "pwd_certificate", mandatory: true },
      { type: "udid", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("depwdGuidelines", "nspSchemes"),
    tags: ["central", "pwd", "ug", "pg", "high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_depwd_national_fellowship",
    name: "National Fellowship for Students with Disabilities",
    nameTa: "மாற்றுத்திறனாளி மாதவிருது",
    authority: "central",
    department: "Department of Empowerment of Persons with Disabilities",
    level: ["pg", "phd"],
    categories: [...ALL_CATEGORIES],
    summary:
      "Junior Research Fellowship of ₹37,000 per month for the first two years rising to Senior Research Fellowship of ₹42,000 per month, plus a contingency allowance of ₹10,000 to ₹20,500 per year, and an escort allowance of ₹2,000 per month. For M.Phil and PhD students with at least 40% disability. Family income must not exceed ₹8.00 lakh.",
    rules: all(
      isTrue("isDifferentlyAbled"),
      gte("disabilityPercentage", 40, "Disability percentage"),
      inList("level", ["pg", "phd"]),
      lte("annualFamilyIncome", 800000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "JRF, first 2 years", amount: 444000, period: "year" },
        { label: "SRF, subsequent years", amount: 504000, period: "year" },
        { label: "Contingency allowance", amount: 20500, period: "year" },
        { label: "Escort allowance", amount: 24000, period: "year", note: "₹2,000 per month." },
      ],
      "estimated",
    ),
    documents: [
      { type: "pwd_certificate", mandatory: true },
      { type: "udid", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("depwdGuidelines", "nspSchemes"),
    tags: ["central", "pwd", "phd", "fellowship", "high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_depwd_free_coaching",
    name: "Free Coaching for Students with Disabilities",
    nameTa: "மாற்றுத்திறனாளிகளுக்கான இலவசப் பயிற்சி",
    authority: "central",
    department: "Department of Empowerment of Persons with Disabilities",
    level: ["school", "iti", "diploma", "ug", "pg"],
    categories: [...ALL_CATEGORIES],
    summary:
      "Free coaching for competitive and professional examinations, with roughly 1,000 slots per year, for students with at least 40% disability. Family income must not exceed ₹8.00 lakh.",
    rules: all(
      isTrue("isDifferentlyAbled"),
      gte("disabilityPercentage", 40, "Disability percentage"),
      lte("annualFamilyIncome", 800000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Free coaching", amount: 20000, period: "year", note: "Non-cash. Indicative market value of coaching support." }], "variable"),
    documents: [
      { type: "pwd_certificate", mandatory: true },
      { type: "udid", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("depwdGuidelines", "nspSchemes"),
    tags: ["central", "pwd", "coaching", "non-cash"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // NMMS
  // =====================================================================
  {
    id: "in_nmms",
    name: "National Means-cum-Merit Scholarship",
    nameTa: "தேசிய மேல்நிலை வருவாய் விருத்தி உதவித்தொகை",
    authority: "central",
    department: "Department of School Education & Literacy, Ministry of Education",
    level: ["school"],
    categories: [...ALL_CATEGORIES],
    summary:
      "₹12,000 per year (₹1,000 per month) for meritorious students from economically weaker families in Classes 9 to 12. Family income must not exceed ₹3.50 lakh. To continue in Class 12, the student must pass the Class 10 examination securing 60% or more of the aggregate marks, with a 5% relaxation for SC and ST students.",
    rules: all(
      eq("level", "school"),
      inList("classOrYear", [9, 10, 11, 12], "Classes 9 to 12"),
      lte("annualFamilyIncome", 350000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Scholarship", amount: 12000, period: "year", note: "₹1,000 per month, paid as two instalments." }], "exact"),
    documents: [
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "marksheet_10", mandatory: false, note: "Required for entry to Class 9 and for the Class 12 renewal test." },
    ],
    apply: { ...nspApply, deadlineNote: "NMMS closes earlier than the rest: student close 30-09-2026, institute verification 15-10-2026, DNO/SNO 31-10-2026." },
    status: "live",
    sourceRefs: src("nmmsGuidelines", "nspSchemes"),
    tags: ["central", "merit", "school", "class-9-12", "income-capped"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // MINORITY AFFAIRS
  // =====================================================================
  {
    id: "in_moma_postmatric",
    name: "Ministry of Minority Affairs — Post-Matric Scholarship",
    nameTa: "சிறுப்பான்மை அமைச்சகம் மேற்படிப்பு உதவித்தொகை",
    authority: "central",
    department: "Ministry of Minority Affairs, Government of India",
    level: ["school", "iti", "diploma", "ug", "pg", "phd"],
    categories: [...ALL_CATEGORIES],
    summary:
      "For students from the six notified minorities. Fees of ₹7,000 per year for Classes 11 and 12, ₹10,000 for professional courses, and ₹3,000 for UG and PG, plus maintenance of ₹380 per month for hostellers and ₹230 for day scholars (₹570 and ₹300 for non-technical UG/PG, ₹1,200 and ₹550 for M.Phil/PhD). 30% of awards are reserved for girls. Family income must not exceed ₹2.00 lakh.",
    rules: all(
      isTrue("isMinority", "Belongs to a notified minority community"),
      lte("annualFamilyIncome", 200000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Classes 11 and 12", amount: 7000, period: "year" },
        { label: "Technical / professional course", amount: 10000, period: "year" },
        { label: "UG / PG", amount: 3000, period: "year" },
        { label: "Maintenance, hosteller", amount: 4560, period: "year" },
        { label: "Maintenance, day scholar", amount: 2760, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true, note: "Proof of membership in a notified minority community." },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { portal: "Ministry of Minority Affairs", url: "https://minorityaffairs.gov.in", channel: "online" },
    status: "live",
    sourceRefs: src("momaGuidelines"),
    tags: ["central", "minority", "school", "ug", "pg", "not-on-nsp"],
    lastVerifiedAt: V,
  },
  {
    id: "in_moma_mcm",
    name: "Ministry of Minority Affairs — Merit-cum-Means Scholarship",
    nameTa: "சிறுப்பான்மை அமைச்சகம் மேற்கல்வி விருதி உதவித்தொகை",
    authority: "central",
    department: "Ministry of Minority Affairs, Government of India",
    level: ["ug", "pg"],
    categories: [...ALL_CATEGORIES],
    summary:
      "₹20,000 per year, subject to actual expenditure, for minority students pursuing professional and technical courses at undergraduate and postgraduate level. Family income must not exceed ₹2.50 lakh.",
    rules: all(
      isTrue("isMinority"),
      inList("level", ["ug", "pg"]),
      lte("annualFamilyIncome", 250000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Scholarship, subject to actual expenditure", amount: 20000, period: "year" }], "exact"),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "marksheet_12", mandatory: true },
    ],
    apply: { portal: "Ministry of Minority Affairs", url: "https://minorityaffairs.gov.in", channel: "online" },
    status: "live",
    sourceRefs: src("momaGuidelines"),
    tags: ["central", "minority", "ug", "pg", "technical"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // SCIENCE
  // =====================================================================
  {
    id: "in_inspire_she",
    name: "INSPIRE Scholarship for Higher Education (SHE)",
    nameTa: "INSPIRE உயர்கல்வி உதவித்தொகை",
    authority: "central",
    department: "Department of Science and Technology, Government of India",
    level: ["ug"],
    categories: [...ALL_CATEGORIES],
    summary:
      "₹80,000 per year (₹60,000 stipend plus ₹20,000 mentorship grant) for B.Sc, B.S and integrated M.Sc students in the basic and natural sciences, awarded on academic merit. Roughly 10,000 selections per year, for up to 5 years.",
    rules: all(
      eq("level", "ug"),
      containsAny(
        "course",
        ["bsc", "b.sc", "b.s", "bs", "integrated msc", "int msc", "science"],
        "Studying B.Sc, B.S or integrated M.Sc in basic or natural sciences",
      ),
      gte("previousYearPercentage", 80, "Top 1% in the Class 12 examination, or a qualifying JEE / NEET / NTSE / KVPY rank"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Stipend", amount: 60000, period: "year" }, { label: "Mentorship grant", amount: 20000, period: "year" }], "exact", "Paid for up to 5 years."),
    documents: [
      { type: "marksheet_12", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { portal: "INSPIRE Online Portal, Department of Science and Technology", url: "https://www.online-inspire.gov.in", channel: "online" },
    status: "live",
    sourceRefs: src("inspire"),
    tags: ["central", "science", "ug", "merit", "high-value"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // DEFENCE, OVERSEAS, FREE COACHING, SCHOOL
  // =====================================================================
  {
    id: "in_pms_armed_forces",
    name: "Prime Minister's Scholarship Scheme for Wards of Armed Forces / CAPF / Police",
    nameTa: "பாதுகாப்புப் படைகள் குடும்பத்தினர் உதவித்தொகை",
    authority: "central",
    department: "Ministry of Home Affairs, Government of India",
    level: ["school", "ug", "pg"],
    categories: [...ALL_CATEGORIES],
    summary: "Merit-cum-means scholarship for the wards of serving or retired Armed Forces, Central Armed Police Forces and police personnel.",
    rules: all(
      isTrue("isExServicemenWard", "Ward of serving or retired Armed Forces, CAPF or police personnel"),
      inList("level", ["school", "ug", "pg"]),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Scholarship for armed forces / police wards", amount: 30000, period: "year" }], "variable"),
    documents: [
      { type: "ex_servicemen_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "marksheet_12", mandatory: false },
    ],
    apply: { ...nspApply },
    status: "live",
    sourceRefs: src("nspSchemes", "nsp"),
    tags: ["central", "defence", "school", "ug", "low-confidence"],
    lastVerifiedAt: V,
  },
  {
    id: "in_national_overseas",
    name: "National Overseas Scholarship Scheme",
    nameTa: "தேசிய வெளிநாட்டு உதவித்தொகை",
    authority: "central",
    department: "Department of Social Justice & Empowerment, Government of India",
    level: ["pg", "phd"],
    categories: ["SC", "SCA", "ST", "DNC", "OC"],
    summary:
      "Full funding including tuition and maintenance, paid through Indian Missions, for SC, ST, De-notified Tribes and other specified groups to study at a degree-granting institution abroad. 30% of awards are reserved for women. The DEPwD variant for students with disabilities carries a ₹50,000 deposit and funding of about US$15,400 per year.",
    rules: all(inList("level", ["pg", "phd"])),
    combinableWithWelfare: false,
    benefit: normaliseBenefit([{ label: "Tuition and maintenance, paid through the Indian Mission", amount: 1500000, period: "year", note: "Approximate. Varies by country; the DEPwD variant is roughly US$15,400 per year." }], "variable"),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "nativity_certificate", mandatory: true },
      { type: "marksheet_12", mandatory: true },
    ],
    apply: { portal: "Department of Social Justice & Empowerment", url: "https://socialjustice.gov.in/schemes/28", channel: "online" },
    status: "live",
    sourceRefs: src("nationalOverseas"),
    tags: ["central", "sc", "st", "abroad", "pg", "phd", "very-high-value"],
    lastVerifiedAt: V,
  },
  {
    id: "in_free_coaching_sc_obc",
    name: "Free Coaching for SC, OBC and PM CARES Children",
    nameTa: "SC, OBC மற்றும் PM கேர்ஸ் குழந்தைகளுக்கான இலவசப் பயிற்சி",
    authority: "central",
    department: "Department of Social Justice & Empowerment, Government of India",
    level: ["school", "iti", "diploma", "ug", "pg"],
    categories: ["SC", "SCA", "OC", "BC", "BCM", "MBC", "DNC"],
    summary:
      "Free coaching for competitive examinations. SC and OBC students are eligible up to ₹8 lakh family income; PM CARES children have no income or caste restriction.",
    rules: all(
      any(
        inList("community", ["SC", "SCA", "BC", "BCM", "MBC", "DNC"], "SC / OBC category"),
        lte("annualFamilyIncome", 800000, "Annual family income (PM CARES route)"),
      ),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Free coaching", amount: 25000, period: "year", note: "Non-cash. Indicative market value of coaching support." }], "variable"),
    documents: [
      { type: "community_certificate", mandatory: false },
      { type: "income_certificate", mandatory: false },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { ...nspApply, deadlineNote: "This scheme opens later than the rest: 03-08-2026, closing 31-10-2026." },
    status: "live",
    sourceRefs: src("nspSchemes", "nsp"),
    tags: ["central", "coaching", "sc", "obc", "non-cash"],
    lastVerifiedAt: V,
  },
  {
    id: "in_samagra_shiksha",
    name: "Samagra Shiksha — Free Textbooks, Uniform and Midday Meal",
    nameTa: "சமக்ரித திட்டம் — இலவசப் பாடநூல், சீருடை, மதிய உணவு",
    authority: "central",
    department: "Department of School Education & Literacy, Government of India",
    level: ["school"],
    categories: [...ALL_CATEGORIES],
    summary:
      "For students in Government and Government-aided schools from pre-school to Class 12: free textbooks, a ₹600 per year uniform grant, midday meals, ICT labs, sports equipment and support for children with special needs at ₹3,500 per year. No application is needed — benefits follow enrolment. Also funds KGBV hostels and teacher training.",
    rules: all(
      eq("level", "school"),
      inList("institutionType", ["government", "government_aided", "not_applicable"], "Government or government-aided school"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Uniform grant", amount: 600, period: "year" },
        { label: "Textbooks, all subjects", amount: 1500, period: "year" },
        { label: "Midday meal / breakfast, all school days", amount: 3000, period: "year" },
        { label: "Special-needs support (CWSN)", amount: 3500, period: "year" },
      ],
      "estimated",
      "All non-cash and automatic on enrolment. Only one of the cash-free items is recorded per category; benefits stack with the Tamil Nadu textbook and breakfast schemes.",
    ),
    documents: [{ type: "bonafide_certificate", mandatory: false }],
    apply: { portal: "Automatic on enrolment — no application. Reference: Samagra Shiksha", url: "https://samagra.education.gov.in", channel: "automatic" },
    status: "live",
    sourceRefs: src("sspaSamagra"),
    tags: ["central", "school", "in-kind", "no-application", "all-categories"],
    lastVerifiedAt: V,
  },
  {
    id: "in_pm_vidyalaxmi",
    name: "PM Vidya Lakshmi Education Loan",
    nameTa: "பி.எம். வித்யா லட்சுமி கல்வி கடனம்",
    authority: "central",
    department: "Ministry of Education, Government of India",
    level: ["ug", "pg", "phd"],
    categories: [...ALL_CATEGORIES],
    summary:
      "Collateral-free, guarantor-free education loans for admission to top higher education institutions, with a 3% interest subvention for families with income up to ₹8 lakh studying at NIRF-ranked institutions. Apply once on the Vidya Lakshmi portal and compare offers from 38 or more banks.",
    rules: all(inList("level", ["ug", "pg", "phd"])),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Education loan with 3% interest subvention", amount: 500000, period: "year", kind: "loan", note: "Loan, not a grant. Indicative sanctioned amount; repayable with interest." }], "variable"),
    documents: [
      { type: "aadhaar", mandatory: true },
      { type: "marksheet_12", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: {
      portal: "Vidya Lakshmi Portal (Ministry of Education with NSDL)",
      url: "https://www.vidyalakshmi.co.in",
      channel: "online",
      deadlineNote: "Loans are not time-bound but the academic year matters for bank disbursement.",
    },
    status: "live",
    sourceRefs: src("vidyaLakshmi", "ewsOm"),
    tags: ["central", "loan", "ug", "pg", "not-a-grant"],
    lastVerifiedAt: V,
  },
];
