import type { Scheme } from "@/engine/types";
import { all, any, between, eq, gte, inCommunity, inList, isTrue, lte, not } from "@/engine/rules";
import { normaliseBenefit } from "@/engine/benefit";
import { src } from "./sources";

const V = "2026-09-27";

/** Repeating rule fragments, named so scheme definitions read like prose. */
const govtSchool6to12 = isTrue(
  "studiedClass6to12InGovtSchool",
  "Studied Classes 6-12 in a Tamil Nadu Government school",
);
const aadhaarBank = isTrue("bankAccountAadhaarSeeded", "Bank account is Aadhaar-seeded");
const tnDomicile = eq("domicileState", "Tamil Nadu", "Domicile state");

/**
 * TAMIL NADU STATE SCHEMES
 *
 * Income ceilings below follow the current BCW / BCMBCMW / ADW department
 * pages. Where tndce.tn.gov.in disagrees (it quotes a stale ₹50,000 figure and
 * was last updated 03-08-2024) we follow the welfare department and record the
 * conflict on the scheme rather than silently picking one.
 */
export const TN_SCHEMES: Scheme[] = [
  // =====================================================================
  // ADI DRAVIDAR AND TRIBAL WELFARE — SC / ST
  // =====================================================================
  {
    id: "tn_adtw_postmatric",
    name: "Post-Matric Scholarship for SC and ST Students",
    nameTa: "ஆதிதிராவிடர் மற்றும் புலங்கர் மேற்படிப்பு உதவித்தொகை",
    authority: "state",
    department: "Directorate of Adi Dravidar and Tribal Welfare",
    level: ["school", "iti", "diploma", "ug", "pg", "phd"],
    categories: ["SC", "SCA", "ST"],
    summary:
      "Covers 100% of tuition and non-refundable compulsory fees plus a monthly maintenance allowance for SC and ST students from Class 11 through PhD, paid by Direct Benefit Transfer to an Aadhaar-seeded account.",
    summaryTa:
      "11ஆம் வகுப்பு முதல் PhD வரை SC, ST மாணவர்களுக்கு முழுக் கட்டணம் மற்றும் மாதாந்திர உதவித்தொகை.",
    rules: all(
      inCommunity(["SC", "SCA", "ST"]),
      gte("classOrYear", 0),
      lte("annualFamilyIncome", 250000, "Annual family income"),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Tuition and non-refundable compulsory fees", amount: 100000, period: "year", note: "Actual fees reimbursed in full, not a fixed grant." },
        { label: "Maintenance allowance — day scholar", amount: 7500, period: "year", note: "Ranges ₹230-₹750 per month by course group." },
        { label: "Maintenance allowance — hosteller", amount: 14400, period: "year", note: "Ranges ₹380-₹1,200 per month by course group." },
        { label: "Study tour / thesis printing (PG and above)", amount: 5000, period: "year", note: "As notified." },
      ],
      "estimated",
      "Tuition reimbursement is the actual fee paid, so the annual total varies by course. The allowances above are the top of each published band.",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "previous_year_marksheet", mandatory: false, note: "Mandatory for renewal." },
    ],
    apply: {
      portal: "Tamil Nadu Unified Scholarship Portal (USSP) / UMIS",
      url: "https://umis.tn.gov.in",
      channel: "institution",
      helpline: "1800-599-7638",
      deadlineNote: "Institutional upload window, typically opening after admission. NSP mirror closes 31-10-2026 for AY 2026-27.",
    },
    status: "live",
    sourceRefs: src("bcwScholarship", "tnGovSchemes", "tnadtw"),
    conflicts: [
      {
        field: "annualFamilyIncome",
        note: "Some aggregator pages state up to ₹8 lakh. The official ADW/BCW post-matric guidance for TN students sets ₹2.5 lakh.",
        sourceRefs: src("bcwScholarship"),
      },
    ],
    tags: ["sc", "st", "postmatric", "fees", "dbt", "school", "ug", "pg"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_adtw_free_education",
    name: "Free Education to Scheduled Tribe Students",
    nameTa: "புலங்கர் இனத்தவர்களுக்கான இலவசக் கல்வி",
    authority: "state",
    department: "Directorate of Adi Dravidar and Tribal Welfare",
    level: ["school", "iti", "diploma", "ug"],
    categories: ["ST"],
    summary:
      "Full tuition, special fee and public examination fee reimbursement for ST students up to degree level, with no income ceiling. Intended for ST students not already receiving the Government of India scholarship.",
    rules: all(inCommunity(["ST"]), aadhaarBank),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Full tuition, special fee and public examination fees up to degree level", amount: 60000, period: "year", note: "Reimbursement of actual fees, no income limit." },
      ],
      "variable",
      "The scheme has no income ceiling. The figure shown is a placeholder order of magnitude for comparison; the actual benefit equals the fees paid.",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: {
      portal: "Tamil Nadu Unified Scholarship Portal (USSP) / UMIS",
      url: "https://umis.tn.gov.in",
      channel: "institution",
    },
    status: "live",
    sourceRefs: src("tnGovSchemes", "tnGovDetail", "tnadtw"),
    tags: ["st", "free-education", "fees", "school", "ug"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_adtw_higher_education_special",
    name: "Higher Education Special Scholarship for SC and ST",
    nameTa: "உயர்கல்வி சிறப்பு உதவித்தொகை",
    authority: "state",
    department: "Directorate of Adi Dravidar and Tribal Welfare",
    level: ["ug", "pg"],
    categories: ["SC", "SCA", "ST"],
    summary:
      "Additional degree and postgraduate scholarship for SC/ST students in higher education where family income does not exceed ₹1,00,000.",
    rules: all(
      inCommunity(["SC", "SCA", "ST"]),
      inList("level", ["ug", "pg"]),
      lte("annualFamilyIncome", 100000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Degree-level scholarship", amount: 7500, period: "year" },
        { label: "Postgraduate / professional course scholarship", amount: 8000, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { portal: "Tamil Nadu Unified Scholarship Portal (USSP) / UMIS", url: "https://umis.tn.gov.in", channel: "institution" },
    status: "live",
    sourceRefs: src("tnGovSchemes", "tnGovDetail"),
    tags: ["sc", "st", "ug", "pg", "income-capped"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_adtw_cm_merit_award",
    name: "Chief Minister's Merit Award for SC/ST Students",
    nameTa: "முதல்வர் விதைவு விருதி",
    authority: "state",
    department: "Directorate of Adi Dravidar and Tribal Welfare",
    level: ["ug", "pg", "diploma", "iti"],
    categories: ["SC", "SCA", "ST"],
    summary:
      "₹3,000 per annum for five years for 1,000 boys and 1,000 girls who score the top marks in Class 12 from SC, ST and Adi Dravidar Christian communities and continue to study.",
    rules: all(
      inCommunity(["SC", "SCA", "ST"]),
      gte("previousYearPercentage", 0),
      isTrue("bankAccountAadhaarSeeded"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Merit award, payable for 5 years", amount: 3000, period: "year" }],
      "estimated",
      "The award runs for 5 years, so total value is roughly ₹15,000.",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "marksheet_12", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { portal: "Adi Dravidar and Tribal Welfare Department, through your institution", url: "https://tnadtwscholarship.tn.gov.in", channel: "institution" },
    status: "live",
    sourceRefs: src("tnGovSchemes", "tndceScholarship"),
    conflicts: [
      {
        field: "benefit.amount",
        note: "Two records on tn.gov.in disagree: one states ₹3,000 per annum for 5 years, another states ₹1,500 per annum for 5 years. The Directorate of Collegiate Education states ₹3,000. We use ₹3,000 and flag it.",
        sourceRefs: src("tnGovSchemes", "tndceScholarship"),
      },
    ],
    tags: ["sc", "st", "merit", "school-to-college", "girls"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_adtw_overseas",
    name: "State Overseas Scholarship for SC/ST Students",
    nameTa: "வெளிநாட்டு உதவித்தொகை",
    authority: "state",
    department: "Directorate of Adi Dravidar and Tribal Welfare",
    level: ["pg", "phd"],
    categories: ["SC", "SCA", "ST"],
    summary: "Monthly support for SC/ST students admitted to a master's or doctoral programme abroad. Age limit 35.",
    rules: all(
      inCommunity(["SC", "SCA", "ST"]),
      inList("level", ["pg", "phd"]),
      eq("domicileState", "Tamil Nadu"),
    ),
    combinableWithWelfare: false,
    benefit: normaliseBenefit(
      [{ label: "Overseas study grant", amount: 12000, period: "month" }],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "nativity_certificate", mandatory: true },
      { type: "marksheet_12", mandatory: false },
    ],
    apply: { portal: "Directorate of Adi Dravidar and Tribal Welfare", url: "https://tnadtwscholarship.tn.gov.in", channel: "district_office" },
    status: "live",
    sourceRefs: src("tnGovSchemes", "tnGovDetail"),
    tags: ["sc", "st", "pg", "abroad"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // BACKWARD CLASSES / MBC / DNC WELFARE
  // =====================================================================
  {
    id: "tn_bc_postmatric",
    name: "Post-Matric Scholarship for BC, MBC and DNC Students",
    nameTa: "பிற்படைவினர், மிகப் பிற்படைவினர் மற்றும் குடியாளர் மேற்படிப்பு உதவித்தொகை",
    authority: "state",
    department: "Directorate of BC, MBC & DNC and Minorities Welfare",
    level: ["school", "iti", "diploma", "ug", "pg", "phd"],
    categories: ["BC", "BCM", "MBC", "DNC"],
    summary:
      "Tuition and special fee at the government rate, examination fee in full, book money as notified, and ₹4,000 per year towards boarding and lodging for hostellers, for BC/MBC/DNC students from Class 11 upwards. MBC and DNC students receive exam fee reimbursement without any income condition.",
    summaryTa:
      "BC/MBC/DNC மாணவர்களுக்கு 11ஆம் வகுப்பு முதல் மேற்படிப்பு உதவித்தொகை, விடுநிலையாளர்களுக்கு ஆண்டுக்கு ₹4,000.",
    rules: all(
      inCommunity(["BC", "BCM", "MBC", "DNC"]),
      any(
        // BC has an income ceiling; MBC and DNC exam-fee reimbursement has none.
        lte("annualFamilyIncome", 250000, "Annual family income (BC ceiling)"),
        inCommunity(["MBC", "DNC"], "MBC / DNC (no income condition on exam fee)"),
      ),
      aadhaarBank,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Tuition and special fee at government rates", amount: 30000, period: "year", note: "Sanctioned as fixed for government institutions." },
        { label: "Examination fee — full", amount: 3000, period: "year" },
        { label: "Book money", amount: 2000, period: "year", note: "As notified in the scholarship notification." },
        { label: "Boarding and lodging — hostellers", amount: 4000, period: "year", note: "₹400 per month for 10 months, from 2021-22." },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "previous_year_marksheet", mandatory: false, note: "Mandatory for renewal." },
    ],
    apply: {
      portal: "Unified State Scholarship Portal (USSP) — umis.tn.gov.in",
      url: "https://umis.tn.gov.in",
      channel: "institution",
      deadlineNote: "BC, MBC and DNC college students MUST apply through USSP with their UMIS ID and Aadhaar-seeded bank account.",
    },
    status: "live",
    sourceRefs: src("bcwScholarship", "bcmbcmwWelfare"),
    tags: ["bc", "muc", "dnc", "postmatric", "fees", "hostel"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_bc_free_education",
    name: "Free Education to First-Generation BC Students (UG Degree)",
    nameTa: "முதல் தலைமுறை பிற்படைவினர் இலவசக் கல்வி",
    authority: "state",
    department: "Directorate of BC, MBC & DNC and Minorities Welfare",
    level: ["ug"],
    categories: ["BC", "BCM"],
    summary:
      "Tuition fee fully waived with special and non-refundable compulsory fees reimbursed, for BC students pursuing a 3-year degree where no family member has graduated. No income ceiling for the government and government-aided column.",
    rules: all(
      inCommunity(["BC", "BCM"]),
      eq("level", "ug"),
      isTrue("isFirstGraduate", "First graduate in the family"),
      any(
        inList("institutionType", ["government", "government_aided"], "Government or government-aided institution (no income ceiling)"),
        all(
          inList("institutionType", ["government", "government_aided", "private_self_finance"], "Recognised institution"),
          lte("annualFamilyIncome", 250000, "Annual family income (self-finance ceiling)"),
        ),
      ),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Tuition fee waived in full", amount: 45000, period: "year", note: "Actual tuition at the government rate." },
        { label: "Special and non-refundable compulsory fees", amount: 10000, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "first_graduate_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { portal: "Unified State Scholarship Portal (USSP) — umis.tn.gov.in", url: "https://umis.tn.gov.in", channel: "institution" },
    status: "live",
    sourceRefs: src("bcwScholarship", "bcmbcmwWelfare"),
    conflicts: [
      {
        field: "annualFamilyIncome",
        note: "tndce.tn.gov.in states a family income not exceeding ₹50,000 for this scheme; the current BCW page states ₹2.5 lakh. The TNDCE page was last updated 03-08-2024. We follow BCW.",
        sourceRefs: src("bcwScholarship", "tndceScholarship"),
      },
    ],
    tags: ["bc", "first-graduate", "ug", "free-education"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_bc_pg_institutions",
    name: "BC/MBC/DNC Scholarship for UG and PG at Central Government Institutions",
    nameTa: "மத்திய அரசு கல்விநிலையங்களில் பிற்படைவினர் உதவித்தொகை",
    authority: "state",
    department: "Directorate of BC, MBC & DNC and Minorities Welfare",
    level: ["ug", "pg"],
    categories: ["BC", "BCM", "MBC", "DNC"],
    summary:
      "Fee reimbursement for Tamil Nadu BC students admitted to undergraduate and postgraduate programmes at Government of India institutions — IIT, IIM, IIIT, NIT and Central Universities.",
    rules: all(
      inCommunity(["BC", "BCM", "MBC", "DNC"]),
      inList("level", ["ug", "pg"]),
      eq("institutionType", "central_institute", "Studying at a central institution"),
      tnDomicile,
    ),
    combinableWithWelfare: false,
    benefit: normaliseBenefit(
      [{ label: "Tuition and examination fee reimbursement at a central institution", amount: 200000, period: "year", note: "Reimbursement of actual fees, capped by institute fee." }],
      "variable",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "nativity_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { portal: "Unified State Scholarship Portal (USSP) — umis.tn.gov.in", url: "https://umis.tn.gov.in", channel: "institution" },
    status: "live",
    sourceRefs: src("bcwScholarship", "bcmbcmwWelfare"),
    tags: ["bc", "ug", "pg", "central-institute", "iit", "nit", "iim"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_bc_prematric",
    name: "Pre-Matric Scholarship for BC Students (Class 10)",
    nameTa: "முன்பருவ உதவித்தொகை (10ஆம் வகுப்பு)",
    authority: "state",
    department: "Directorate of BC, MBC & DNC and Minorities Welfare",
    level: ["school"],
    categories: ["BC", "BCM"],
    summary:
      "Full reimbursement of the Class 10 public examination fee for BC students studying in English medium in government and government-aided schools where parental income does not exceed ₹2.50 lakh. MBC and DNC students receive the same reimbursement with no income condition.",
    rules: all(
      inCommunity(["BC", "BCM", "MBC", "DNC"]),
      inList("level", ["school"]),
      between("classOrYear", 9, 10, "Class 9 or 10"),
      any(
        lte("annualFamilyIncome", 250000, "Annual family income (BC ceiling)"),
        inCommunity(["MBC", "DNC"], "MBC / DNC (no income condition)"),
      ),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Class 10 public examination fee reimbursed in full", amount: 500, period: "year" }],
      "exact",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "marksheet_10", mandatory: false },
    ],
    apply: { portal: "Unified State Scholarship Portal (USSP) — umis.tn.gov.in", url: "https://umis.tn.gov.in", channel: "institution" },
    status: "live",
    sourceRefs: src("bcwScholarship"),
    tags: ["bc", "school", "prematric", "class-10", "exam-fee"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_bc_free_hostel",
    name: "Free Boarding and Lodging in Government Hostels (BC/MBC/DNC)",
    nameTa: "அரசு விடுநிலையில் இலவச தங்குவிடம்",
    authority: "state",
    department: "Directorate of BC, MBC & DNC and Minorities Welfare",
    level: ["school", "iti", "diploma", "ug"],
    categories: ["BC", "BCM", "MBC", "DNC"],
    summary:
      "Free boarding and lodging in the 1,354 government hostels run by the department, from Class 4 through polytechnic level.",
    rules: all(
      inCommunity(["BC", "BCM", "MBC", "DNC"]),
      gte("classOrYear", 4, "Class / year"),
      lte("annualFamilyIncome", 200000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Free boarding and lodging", amount: 36000, period: "year", note: "Value of accommodation and meals, not a cash transfer." }],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "marksheet_10", mandatory: false },
    ],
    apply: {
      portal: "District BC / MBC & Minorities Welfare Officer",
      url: "https://bcmbcmw.tn.gov.in",
      channel: "district_office",
      helpline: "1800-599-4999",
      deadlineNote: "Offline. Application forms are available from the hostel warden or matron, or the District Welfare Officer.",
    },
    status: "live",
    sourceRefs: src("bcmbcmwWelfare"),
    tags: ["bc", "muc", "hostel", "school", "ug"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_free_bicycle",
    name: "Free Bicycle for Class 11 Students",
    nameTa: "இலவச சிவக்குமாறி",
    authority: "state",
    department: "Directorate of Backward Classes Welfare",
    level: ["school"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "A free bicycle is distributed every year to all Class 11 students in Tamil Nadu, of every community, irrespective of parental income. Students who already hold a free bus pass are still eligible; students in hostels within school premises or in residential schools are not.",
    rules: all(
      eq("level", "school"),
      eq("classOrYear", 11, "Class 11"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Bicycle", amount: 3500, period: "one_time" }],
      "estimated",
      "Distributed by the school. Not a cash benefit.",
    ),
    documents: [{ type: "marksheet_10", mandatory: false }],
    apply: { portal: "Your school / Directorate of Backward Classes Welfare", url: "https://bcw.tn.gov.in/sub_page/9", channel: "institution" },
    status: "live",
    sourceRefs: src("bcwBicycles"),
    tags: ["all", "school", "class-11", "in-kind"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_rural_mbc_girls",
    name: "Rural MBC/DNC Girl Students Incentive",
    nameTa: "ஊரக மிகப் பிற்படைவினர் பெண் ஊக்குவீட்டுத் தொகை",
    authority: "state",
    department: "Directorate of BC, MBC & DNC and Minorities Welfare",
    level: ["school"],
    categories: ["MBC", "DNC"],
    summary:
      "An incentive for MBC and DNC girl students in Classes 3 to 6, to keep them in school. ₹500 per year for Classes 3 to 5 and ₹1,000 for Class 6.",
    rules: all(
      inCommunity(["MBC", "DNC"]),
      eq("level", "school"),
      gte("classOrYear", 3),
      lte("classOrYear", 6),
      eq("gender", "female"),
      lte("annualFamilyIncome", 100000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Annual incentive (Class 6)", amount: 1000, period: "year", note: "₹500 per year for Classes 3 to 5." }],
      "exact",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
    ],
    apply: { portal: "Directorate of BC, MBC & DNC and Minorities Welfare", url: "https://bcmbcmw.tn.gov.in", channel: "institution" },
    status: "live",
    sourceRefs: src("bcwScholarship", "tndceScholarship"),
    conflicts: [
      {
        field: "annualFamilyIncome",
        note: "BCW states ₹1,00,000 with effect from 2021-22; tndce.tn.gov.in still shows a stale ₹25,000 figure. We follow BCW.",
        sourceRefs: src("bcwScholarship"),
      },
    ],
    tags: ["muc", "dnc", "school", "girls", "rural", "retention"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // SOCIAL WELFARE — the flagship girls' schemes
  // =====================================================================
  {
    id: "tn_pudhumai_penn",
    name: "Moovalur Ramamirtham Ammaiyar Higher Education Assurance Scheme (Pudhumai Penn)",
    nameTa: "மூவலூர் ராமமிர்தம் அம்மையார் உயர்கல்வி உறுதித்திட்டம் (புதுமைப்பெண்)",
    authority: "state",
    department: "Department of Social Welfare and Women Empowerment",
    level: ["ug", "diploma", "iti"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "₹1,000 per month by Direct Benefit Transfer to the girl student's own bank account, for girls who studied Classes 6 to 12 in Tamil Nadu government schools, paid until the uninterrupted completion of their first undergraduate degree, diploma or ITI course. It is paid in addition to other scholarships, and no income ceiling is stated.",
    summaryTa:
      "அரசுப் பள்ளியில் 6 முதல் 12 வரை படித்த பெண் மாணவிக்கு மாதம் ₹1,000, இளைய ஆரம்ப பட்டதாரர் வரை.",
    rules: all(
      eq("gender", "female", "Girl student"),
      govtSchool6to12,
      inList("level", ["ug", "diploma", "iti"], "First higher education course (degree, diploma or ITI)"),
      isTrue("bankAccountAadhaarSeeded", "Aadhaar-seeded account in the girl's own name"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Monthly transfer, until the first degree / diploma / ITI course completes", amount: 12000, period: "year" }],
      "estimated",
      "₹1,000 per month, paid for the duration of the course. Paid in addition to other scholarships.",
    ),
    documents: [
      { type: "bonafide_certificate", mandatory: true, note: "School issues the data to the portal, including the EMIS number." },
      { type: "emis_id", mandatory: true },
      { type: "bank_passbook", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: {
      portal: "Penkalvi (Social Welfare Department)",
      url: "https://penkalvi.tn.gov.in",
      channel: "online",
      helpline: "044-24354885",
      deadlineNote: "Bonafide certificate must be submitted to the school every 6 months. A rejected application can be appealed before the Member of Appellate Authority.",
    },
    status: "live",
    sourceRefs: src("tnSocialWelfare", "penkalvi"),
    tags: ["girls", "govt-school", "ug", "dbt", "flagship", "no-income-ceiling"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_tamil_pudhalvan",
    name: "Tamil Pudhalvan Scheme (male counterpart of Pudhumai Penn)",
    nameTa: "தமிழ் புதல்வன் திட்டம்",
    authority: "state",
    department: "Department of Social Welfare and Women Empowerment",
    level: ["ug", "diploma", "iti"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Launched on 8 August 2024, this is the male counterpart of Pudhumai Penn: ₹1,000 per month for boys who studied Classes 6 to 12 in Tamil Nadu government schools, continuing into their first higher education course. Allocated ₹360 crore covering about 3.28 lakh boys.",
    rules: all(
      eq("gender", "male", "Boy student"),
      govtSchool6to12,
      inList("level", ["ug", "diploma", "iti"]),
      isTrue("bankAccountAadhaarSeeded"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Monthly transfer", amount: 12000, period: "year" }], "estimated", "₹1,000 per month."),
    documents: [
      { type: "bonafide_certificate", mandatory: true },
      { type: "emis_id", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { portal: "Department of Social Welfare and Women Empowerment", url: "https://tnsocialwelfare.tn.gov.in", channel: "institution" },
    status: "live",
    sourceRefs: src("tnSocialWelfare"),
    tags: ["boys", "govt-school", "ug", "dbt", "flagship"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // DIGITAL EMPOWERMENT AND SKILLING
  // =====================================================================
  {
    id: "tn_vetri_laptop",
    name: "Vetri Laptop Scheme (Ulagam Ungal Kaiyil)",
    nameTa: "வேத்ரி மடி வைப்பு திட்டம் (உலகம் உங்கையில்)",
    authority: "state",
    department: "ELCOT / Department of Higher Education",
    level: ["ug"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "A free laptop for college students in Tamil Nadu, with ₹2,000 crore allocated in the 2026-27 budget and a revised scope of all college students rather than only first-year undergraduates. There is NO application to fill: your university or college uploads your data through UMIS, and distribution happens district-wise. Private unaided institutions are not covered. Announced as 'Ulagam Ungal Kaiyil' on 5 January 2026 and rebranded 'Vetri Laptop Scheme' in the August 2026 budget.",
    rules: all(
      inList("level", ["ug"]),
      inList("institutionType", ["government", "government_aided"], "Government or government-aided college"),
      tnDomicile,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Free laptop", amount: 45000, period: "one_time", note: "Acer, HP or Dell as selected by procurement." }],
      "variable",
      "Not a cash benefit. Value shown is an indicative laptop price; the earlier phase was restricted to first-year undergraduates, the 2026-27 budget extends it to all college students.",
    ),
    documents: [
      { type: "aadhaar", mandatory: true, note: "Uploaded by your institution, not by you." },
      { type: "emis_id", mandatory: false },
    ],
    apply: {
      portal: "No application — your institution uploads to UMIS. Reference portal: elcotlaptop.tn.gov.in",
      url: "https://elcotlaptop.tn.gov.in/faq",
      channel: "automatic",
      deadlineNote: "Applications are not accepted. Colleges upload eligible students to the DigiShakti portal.",
    },
    status: "live",
    supersedes: "tn_ulagam_ungal_kaiyil",
    sourceRefs: src("elcotLaptop", "pressLaptopRebrand"),
    tags: ["laptop", "in-kind", "ug", "automatic", "no-application", "budget-2026"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_naan_mudhalvan",
    name: "Naan Mudhalvan Skill Development Programme",
    nameTa: "நான் முதல்வன் திட்டம்",
    authority: "state",
    department: "TNSDC / Special Programme Implementation Department",
    level: ["school", "iti", "diploma", "ug", "pg"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Free industry-aligned skill certification, soft skills, apprenticeships and internships for students of Classes 6 to 12 and higher education across Tamil Nadu. Open to every economic background. Internships carry a stipend of roughly ₹1,000 to ₹3,000 per month, and over 50 lakh students have enrolled.",
    rules: all(
      inList("level", ["school", "iti", "diploma", "ug", "pg"]),
      gte("classOrYear", 6, "Class 6 or above"),
      tnDomicile,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Free skill certification courses", amount: 6000, period: "year", note: "Non-cash: courses, industry certification, soft skills." },
        { label: "Internship stipend", amount: 12000, period: "year", note: "₹1,000-₹3,000 per month while on an internship." },
      ],
      "estimated",
    ),
    documents: [
      { type: "aadhaar", mandatory: true },
      { type: "bonafide_certificate", mandatory: true, note: "College registration." },
      { type: "bank_passbook", mandatory: false, note: "Needed only for the internship stipend." },
    ],
    apply: { portal: "Naan Mudhalvan, Tamil Nadu Skill Development Corporation", url: "https://www.naanmudhalvan.tn.gov.in", channel: "online", helpline: "+91 90437 10211" },
    status: "live",
    sourceRefs: src("naanMudhalvan"),
    tags: ["skills", "all-levels", "all-categories", "stipend", "no-income-ceiling"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // 7.5% GOVERNMENT SCHOOL QUOTA — fee consequences
  // =====================================================================
  {
    id: "tn_govt_school_quota_fees",
    name: "7.5% Government School Students — Full Fee Reimbursement",
    nameTa: "அரசுப் பள்ளி மாணவர்கள் 7.5% — முழுக் கட்டணச் சலுகை",
    authority: "state",
    department: "Directorate of Backward Classes Welfare / Higher Education",
    level: ["ug", "pg"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Admitted under the 7.5% horizontal Government School Students quota, your entire course fee and hostel or mess fee is reimbursed to the Directorate of Medical Education by the Directorate of Backward Classes Welfare. The Government separately bears the full tuition, hostel and development fee under G.O. 221 of 15 November 2021. Proof is a bonafide certificate showing Classes 6 to 12 in a State Government school, carrying the EMIS number.",
    rules: all(
      govtSchool6to12,
      inList("level", ["ug", "pg"]),
      tnDomicile,
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Full course fee reimbursed", amount: 250000, period: "year", note: "Actual course fee, paid to the institute." },
        { label: "Hostel / mess fee reimbursed", amount: 60000, period: "year", note: "For medical admissions, reimbursed to the DME by BC Welfare." },
      ],
      "variable",
      "Reimbursement equals the actual fee. The Government bears full tuition, hostel and development fee under G.O. 221, Higher Education (J2), 15.11.2021.",
    ),
    documents: [
      { type: "bonafide_certificate", mandatory: true, note: "Must state Classes 6-12 in a State Government school and carry the EMIS number." },
      { type: "emis_id", mandatory: true },
    ],
    apply: { portal: "No separate application. Handled at admission and by your institution.", url: "https://bcw.tn.gov.in/sub_page/8", channel: "automatic" },
    status: "live",
    sourceRefs: src("go167", "bcwScholarship"),
    tags: ["7.5-percent", "govt-school", "horizontal", "fees", "no-application"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // DIFFERENTLY ABLED
  // =====================================================================
  {
    id: "tn_pwd_scholarship",
    name: "Scholarship for Differently Abled Students",
    nameTa: "மாற்றுத்திறனாளி மாணவர் உதவித்தொகை",
    authority: "state",
    department: "Commissionerate for Welfare of Differently Abled, Tamil Nadu",
    level: ["school", "iti", "diploma", "ug", "pg"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Financial assistance to differently abled students from Class 9 onwards, and to the sons and daughters of differently abled persons, across school, vocational, professional, medical and engineering courses. Awards run up to ₹7,000 per year for the student, up to ₹6,000 for a ward of a person with disability, ₹100 to ₹300 per month for books in Classes 1 to 8, and ₹1,000 per month as a severe disability allowance.",
    rules: all(
      any(
        isTrue("isDifferentlyAbled", "Certified as differently abled with a UDID"),
      ),
      inList("level", ["school", "iti", "diploma", "ug", "pg"]),
      any(
        gte("classOrYear", 9, "Class 9 or above"),
        not(eq("level", "school")),
      ),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Scholarship for the student", amount: 7000, period: "year", note: "Up to ₹7,000 per year from Class 9 onwards." },
        { label: "Book allowance, Classes 1 to 8", amount: 3000, period: "year", note: "₹100-₹300 per month." },
        { label: "Severe disability allowance", amount: 12000, period: "year", note: "₹1,000 per month." },
      ],
      "estimated",
    ),
    documents: [
      { type: "pwd_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "udid", mandatory: false },
    ],
    apply: {
      portal: "District Differently Abled Welfare Officer",
      url: "https://www.tn.gov.in",
      channel: "district_office",
      deadlineNote: "Offline application. Minimum 40% in the previous year, and a minimum 40% disability, are required.",
    },
    status: "live",
    sourceRefs: src("tnGovSchemes", "rpwAct"),
    tags: ["pwd", "disability", "school", "ug", "offline"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // MINORITIES
  // =====================================================================
  {
    id: "tn_minority_scholarship",
    name: "Scholarship for Students from Minority Communities",
    nameTa: "சிறுப்பான்மைச் சமுதாய மாணவர் உதவித்தொகை",
    authority: "state",
    department: "Directorate of BC, MBC & DNC and Minorities Welfare",
    level: ["school", "iti", "diploma", "ug", "pg", "phd"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Implemented by the Tamil Nadu government but fully funded by the Government of India. Pre-matric for Classes 1 to 10 gives a maintenance allowance of ₹6,000 per year for hostellers and ₹1,000 for day scholars. Post-matric from Class 11 gives ₹7,000 for Classes 11 to 12, ₹10,000 for technical courses, and ₹3,000 for UG and PG, plus maintenance.",
    rules: all(
      isTrue("isMinority", "Belongs to a notified minority community"),
      inList("level", ["school", "iti", "diploma", "ug", "pg", "phd"]),
      lte("annualFamilyIncome", 200000, "Annual family income"),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [
        { label: "Pre-matric maintenance, hosteller", amount: 6000, period: "year" },
        { label: "Pre-matric maintenance, day scholar", amount: 1000, period: "year" },
        { label: "Post-matric, Classes 11-12", amount: 7000, period: "year" },
        { label: "Post-matric, technical course", amount: 10000, period: "year" },
        { label: "Post-matric, UG / PG", amount: 3000, period: "year" },
      ],
      "estimated",
    ),
    documents: [
      { type: "community_certificate", mandatory: true },
      { type: "income_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "bank_passbook", mandatory: true },
    ],
    apply: { portal: "Ministry of Minority Affairs (funded scheme, state implementation)", url: "https://minorityaffairs.gov.in", channel: "online" },
    status: "live",
    sourceRefs: src("bcmbcmwWelfare", "momaGuidelines"),
    tags: ["minority", "muslim", "christian", "school", "ug", "pg"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // FEES, CONCESSIONS AND AWARDS
  // =====================================================================
  {
    id: "tn_first_graduate_concession",
    name: "First Graduate Tuition Fee Concession",
    nameTa: "முதல் பட்டதாரர் விழி மேல்வரி சலுகை",
    authority: "state",
    department: "Directorate of Technical Education / Higher Education",
    level: ["ug", "diploma", "iti"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "A tuition fee concession for the first graduate in the family, under G.O.(st) No. 85 of 16 April 2010. The certificate is issued by the Headquarters Deputy Tahsildar as a digitally signed e-Certificate in a prescribed format, with a family tree and a joint declaration. If a brother or sister has already claimed the concession for a professional course, you are disqualified.",
    rules: all(
      isTrue("isFirstGraduate", "First graduate in the family"),
      inList("level", ["ug", "diploma", "iti"]),
    ),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Tuition fee concession", amount: 45000, period: "year", note: "Concession on the first year of the professional course; a percentage of tuition at the government rate." }],
      "estimated",
    ),
    documents: [
      { type: "first_graduate_certificate", mandatory: true, note: "Digitally signed e-Certificate from the HQ Deputy Tahsildar, plus the family tree and joint declaration." },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { portal: "TN e-Sevai, then produced at admission counselling", url: "https://tnesevai.tn.gov.in", channel: "district_office" },
    status: "live",
    sourceRefs: src("goFirstGraduate", "tngasaGuidelines"),
    tags: ["first-graduate", "fees", "ug", "all-categories"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_cm_research_fellowship",
    name: "Chief Minister's Research Fellowship",
    nameTa: "முதல்வர் ஆராய்ச்சி உதவித்தொகை",
    authority: "state",
    department: "Directorate of Collegiate Education, Tamil Nadu",
    level: ["phd"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Research fellowship for 180 PhD scholars per year pursuing regular (not external) doctoral programmes in Government, Government-aided colleges and University departments. G.O. No. 53, Higher Education (G1) Department, 27 February 2023.",
    rules: all(eq("level", "phd"), inList("institutionType", ["government", "government_aided"], "Government or government-aided college, or a university department")),
    combinableWithWelfare: false,
    benefit: normaliseBenefit([{ label: "Research fellowship", amount: 36000, period: "year", note: "180 scholars per year." }], "variable"),
    documents: [
      { type: "marksheet_12", mandatory: false },
      { type: "previous_year_marksheet", mandatory: true },
      { type: "aadhaar", mandatory: true },
    ],
    apply: { portal: "Tamil Nadu Teachers Recruitment Board portal", url: "https://www.tn.gov.in", channel: "online" },
    status: "live",
    sourceRefs: src("tndceScholarship"),
    tags: ["phd", "research", "fellowship"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_evr_nagammai",
    name: "EVR Nagammai Scholarship for PG Girl Students",
    nameTa: "ஈ.வி.ஆர் நாகம்மை உதவித்தொகை",
    authority: "state",
    department: "Directorate of Collegiate Education, Tamil Nadu",
    level: ["pg"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Financial assistance for girl students pursuing postgraduate degree courses in Arts and Science at a recognised college in Tamil Nadu, commemorating the former Vice Chancellor EVR Nagammai. The Directorate of Collegiate Education describes the award as variable financial assistance; it is applied for offline through the Directorate.",
    rules: all(eq("level", "pg"), eq("gender", "female")),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Postgraduate scholarship for Arts and Science girl students", amount: 6000, period: "year", note: "The official TNDCE page states only 'variable financial assistance'; this figure is an order-of-magnitude estimate." }], "estimated"),
    documents: [
      { type: "bonafide_certificate", mandatory: true },
      { type: "marksheet_12", mandatory: true },
    ],
    apply: { portal: "Directorate of Collegiate Education (offline)", url: "https://tndce.tn.gov.in/Home/scholarship", channel: "district_office" },
    status: "live",
    sourceRefs: src("tndceScholarship"),
    tags: ["pg", "girls", "arts", "science", "low-confidence"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_tnscst_student_project",
    name: "Tamil Nadu State Council for Science and Technology — Student Project Scheme",
    nameTa: "தமிழ்நாடு அறிவியல் மற்றும் தொழில்நுட்ப ஆராய்ச்சி கவுன்சில் மாணவர் திட்டம்",
    authority: "state",
    department: "Tamil Nadu State Council for Science and Technology (TNSCST)",
    level: ["ug", "pg"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Funding for final-year and postgraduate student research projects in agricultural sciences, biotechnology, engineering, medicine, physics, chemistry and related disciplines. Typical awards are on the order of ₹7,500 to ₹25,000 per project, and the approved lists are published annually by TNSCST.",
    rules: all(inList("level", ["ug", "pg"]), tnDomicile),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Student project grant", amount: 25000, period: "one_time", note: "₹7,500 to ₹25,000 per project depending on discipline." }], "estimated"),
    documents: [
      { type: "bonafide_certificate", mandatory: true },
      { type: "aadhaar", mandatory: true },
      { type: "previous_year_marksheet", mandatory: true },
    ],
    apply: { portal: "TNSCST, DOTE campus, Chennai", url: "https://www.tanscst.tn.gov.in", channel: "online", deadlineNote: "Annual call for proposals; check the approved-list PDFs published each year." },
    status: "live",
    sourceRefs: src("tnGovSchemes"),
    tags: ["research", "science", "ug", "pg", "project"],
    lastVerifiedAt: V,
  },

  // =====================================================================
  // IN-KIND / AUTOMATIC SCHOOL BENEFITS
  // =====================================================================
  {
    id: "tn_free_bus_pass",
    name: "Free Bus Pass for Students",
    nameTa: "மாணவர் இலவசப் பேருந்துச் சீட்டு",
    authority: "state",
    department: "Tamil Nadu State Transport Corporations / MTC",
    level: ["school", "iti", "diploma"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Free concession passes up to HSC for students in Classes I to XII in government-recognised schools and students of government ITIs, Government Arts and Science Colleges and Government Polytechnics. College students get a 50% student concession ticket instead. Passes are issued 15 June to 30 November and are valid 15 June to 30 April, and can be used on all ordinary, express and deluxe services except night services and AC.",
    rules: all(inList("level", ["school", "iti", "diploma"])),
    combinableWithWelfare: true,
    benefit: normaliseBenefit(
      [{ label: "Free monthly bus pass (school / ITI / polytechnic)", amount: 6000, period: "year", note: "Approximate fare avoided, all categories of bus, 10 months." }],
      "estimated",
    ),
    documents: [
      { type: "bonafide_certificate", mandatory: true, note: "School authorities collect the forms and the pass agency visits the school for photos and online issue." },
    ],
    apply: {
      portal: "Through your school / college, via the Tamil Nadu State Transport Corporations",
      url: "https://mtcbus.tn.gov.in/Home/students/14",
      channel: "institution",
      helpline: "149",
      deadlineNote: "Pass issue window is 15 June to 30 November each year. For 2026-27 the government has confirmed continuation; students in uniform may travel pending pass issue.",
    },
    status: "live",
    sourceRefs: src("tnBusPass"),
    tags: ["school", "transport", "in-kind", "iti", "diploma"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_textbooks",
    name: "Free Textbooks for Government and Government-Aided Schools",
    nameTa: "அரசுப் பள்ளி உரைநூல்கள் இலவசம்",
    authority: "state",
    department: "Tamil Nadu Textbook and Educational Services Corporation",
    level: ["school"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "All textbooks are supplied free of cost to students in Tamil Nadu Government and Government-aided schools, in Tamil, English and minority languages. No application is needed. Minority-language books run Classes 4 to 12; Tamil books Classes 1 to 10 and annual books for 9, 10 and 12.",
    rules: all(eq("level", "school")),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Textbooks, all subjects", amount: 1500, period: "year", note: "Non-cash, supplied by the school." }], "estimated"),
    documents: [{ type: "bonafide_certificate", mandatory: false }],
    apply: { portal: "Your school", url: "https://www.textbookcorp.in/schools", channel: "automatic" },
    status: "live",
    sourceRefs: src("tnTextbook"),
    tags: ["school", "in-kind", "no-application", "all-categories"],
    lastVerifiedAt: V,
  },
  {
    id: "tn_breakfast",
    name: "Perunthalaivar Kamarajar Breakfast Scheme",
    nameTa: "பெருந்தாலைவார் காமராஜர் உணவுத்திட்டம்",
    authority: "state",
    department: "Department of School Education, Tamil Nadu",
    level: ["school"],
    categories: ["OC", "BC", "BCM", "MBC", "DNC", "SC", "SCA", "ST"],
    summary:
      "Free breakfast for school students, expanded with effect from 17 September 2026 to Classes 6 to 8 in addition to the existing classes, benefiting about 15.14 lakh students across 15,414 schools at a cost of ₹710 crore.",
    rules: all(eq("level", "school"), lte("classOrYear", 8, "Class 8 or below (current coverage)")),
    combinableWithWelfare: true,
    benefit: normaliseBenefit([{ label: "Free breakfast on school days", amount: 3000, period: "year", note: "Non-cash, ~₹30 per school day." }], "estimated"),
    documents: [{ type: "bonafide_certificate", mandatory: false }],
    apply: { portal: "Your school (automatic)", url: "https://www.tn.gov.in", channel: "automatic" },
    status: "live",
    sourceRefs: src("tnGovSchemes"),
    tags: ["school", "nutrition", "in-kind", "no-application", "budget-2026"],
    lastVerifiedAt: V,
  },
];
