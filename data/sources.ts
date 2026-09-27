import type { SourceRef } from "@/engine/types";

/**
 * Central source registry.
 *
 * Rules for this file:
 *  - A source is only `official: true` if the host is a .gov.in / .nic.in /
 *    .ac.in domain operated by a government body.
 *  - Aggregator/blog sources are permitted but MUST be marked official:false.
 *    They exist because some scheme facts (e.g. a budget announcement) are
 *    reported before the notification lands. We label them, we do not hide them.
 *  - `retrievedAt` is the date a human verified the content, not the date the
 *    file was written. The verify:sources script re-checks liveness.
 */

const R = "2026-09-27";

export const SOURCES = {
  // ---- Tamil Nadu: primary / statutory -------------------------------------
  go167: {
    url: "https://cms.tn.gov.in/cms_migrated/document/GO/hedu_e_167_2021.pdf",
    publisher: "Directorate of Collegiate Education / Higher Education Dept, TN",
    retrievedAt: R,
    docRef: "G.O.(Ms) No. 167, Higher Education (J2), 31.08.2021",
    official: true,
    confidence: "high",
    note: "Authoritative 69% reservation roster and the 7.5% Government School Students horizontal quota.",
  },
  tneaBrochure: {
    url: "https://static.tneaonline.org/docs/2_Information_Brochure_2026.pdf",
    publisher: "Directorate of Technical Education, Tamil Nadu",
    retrievedAt: R,
    docRef: "TNEA 2026 Information Brochure, §4 Reservation, §5.1 Special Reservation",
    official: true,
    confidence: "high",
  },
  dmeGovQ: {
    url: "https://tnmedicalselection.net/news/30062026003157.pdf",
    publisher: "Directorate of Medical Education, Tamil Nadu (Selection Committee)",
    retrievedAt: R,
    docRef: "MBBS/BDS Government Quota Prospectus 2026-27, pp. 52-53",
    official: true,
    confidence: "high",
  },
  dmeMgmtQ: {
    url: "https://tnmedicalselection.net/news/28062026235144.pdf",
    publisher: "Directorate of Medical Education, Tamil Nadu (Selection Committee)",
    retrievedAt: R,
    docRef: "MBBS/BDS Management Quota Prospectus 2026-27",
    official: true,
    confidence: "high",
  },
  tngasaGuidelines: {
    url: "https://static.tneaonline.org/docs/arts/Admission_guidelines_2026.pdf",
    publisher: "TNGASA, Directorate of Collegiate Education, Tamil Nadu",
    retrievedAt: R,
    docRef: "Arts & Science UG/PG Admission Guidelines 2026",
    official: true,
    confidence: "high",
  },
  goFirstGraduate: {
    url: "https://dte.tn.gov.in/uploads/gos/13/85_16_4_2010_First_Graduation_First_year.pdf",
    publisher: "Directorate of Technical Education, Tamil Nadu",
    retrievedAt: R,
    docRef: "G.O.(st) No. 85, Higher Education (J2), 16.04.2010 — First Graduate Tuition Fee Concession",
    official: true,
    confidence: "medium",
    note: "The PDF is a scan; content cross-checked against the TNEA 2026 Brochure §7.2.",
  },
  goExServicemen: {
    url: "https://static.tneaonline.org/docs/2_Information_Brochure_2026.pdf",
    publisher: "Directorate of Technical Education, Tamil Nadu",
    retrievedAt: R,
    docRef: "TNEA 2026 Brochure §5.1; G.O.Ms.No.281 dated 26.06.1998 (Arts & Science)",
    official: true,
    confidence: "high",
  },
  goSports: {
    url: "https://static.tneaonline.org/docs/2_Information_Brochure_2026.pdf",
    publisher: "Directorate of Technical Education, Tamil Nadu",
    retrievedAt: R,
    docRef: "G.O.(Ms) No. 121, Higher Education (J1), 03.07.2012",
    official: true,
    confidence: "high",
  },
  esevaiNativity: {
    url: "https://tnesevai.tn.gov.in/",
    publisher: "Tamil Nadu e-Sevai / Revenue Department",
    retrievedAt: R,
    docRef: "e-Sevai service REV-102 — Nativity Certificate",
    official: true,
    confidence: "high",
    note: "Issued by Tahsildar / Zonal Deputy Tahsildar. E-certificate only for TNEA counselling.",
  },
  bcwScholarship: {
    url: "https://bcw.tn.gov.in/sub_page/8",
    publisher: "Directorate of Backward Classes Welfare, Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "high",
    note: "Pre-matric, post-matric, free-education and PM-YASASVI rules for BC/MBC/DNC.",
  },
  bcmbcmwWelfare: {
    url: "https://bcmbcmw.tn.gov.in/welfschemes.htm",
    publisher: "Directorate of BC, MBC & DNC and Minorities Welfare, Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "high",
  },
  bcwBicycles: {
    url: "https://bcw.tn.gov.in/sub_page/9",
    publisher: "Directorate of Backward Classes Welfare, Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "high",
  },
  tndceScholarship: {
    url: "https://tndce.tn.gov.in/Home/scholarship",
    publisher: "Directorate of Collegiate Education, Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "medium",
    note: "KNOWN STALE: page last updated 03-08-2024 and quotes income ceilings (₹50,000) that contradict current BCW guidance (₹2.5 lakh). Cited only where it is the sole official source, and flagged.",
  },
  tnGovSchemes: {
    url: "https://www.tn.gov.in/scheme_list.php",
    publisher: "Government of Tamil Nadu — scheme directory",
    retrievedAt: R,
    official: true,
    confidence: "medium",
  },
  tnGovDetail: {
    url: "https://www.tn.gov.in/scheme_details.php",
    publisher: "Government of Tamil Nadu — scheme directory",
    retrievedAt: R,
    official: true,
    confidence: "medium",
  },
  umis: {
    url: "https://umis.tn.gov.in",
    publisher: "Tamil Nadu Unified Scholarship Management Information System (TNeGA)",
    retrievedAt: R,
    official: true,
    confidence: "high",
    note: "Unified State Scholarship Portal (USSP). Aadhaar e-KYC + mobile OTP login. Not scrapable without authentication.",
  },
  tnssportal: {
    url: "https://ssp24-25.tnega.org/institute/all_schemes.html",
    publisher: "Tamil Nadu State Scholarship Portal (TNeGA)",
    retrievedAt: R,
    official: true,
    confidence: "medium",
  },
  tnadtw: {
    url: "https://tnadtwscholarship.tn.gov.in",
    publisher: "Directorate of Adi Dravidar and Tribal Welfare, Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "high",
  },
  tnSocialWelfare: {
    url: "https://tnsocialwelfare.tn.gov.in",
    publisher: "Department of Social Welfare and Women Empowerment, Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "high",
  },
  penkalvi: {
    url: "https://penkalvi.tn.gov.in",
    publisher: "Department of Social Welfare and Women Empowerment, Tamil Nadu",
    retrievedAt: R,
    docRef: "Pudhumai Penn online portal",
    official: true,
    confidence: "medium",
    note: "Replaced the earlier pudhumaipenn.tn.gov.in portal.",
  },
  elcotLaptop: {
    url: "https://elcotlaptop.tn.gov.in/faq",
    publisher: "ELCOT / Electronics Corporation of Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "high",
  },
  naanMudhalvan: {
    url: "https://www.naanmudhalvan.tn.gov.in/",
    publisher: "TNSDC / Special Programme Implementation Department, Tamil Nadu",
    retrievedAt: R,
    official: true,
    confidence: "high",
  },
  tnBusPass: {
    url: "https://mtcbus.tn.gov.in/Home/students/14",
    publisher: "Metropolitan Transport Corporation (Chennai) Ltd",
    retrievedAt: R,
    official: true,
    confidence: "medium",
  },
  tnTextbook: {
    url: "https://www.textbookcorp.in/schools",
    publisher: "Tamil Nadu Textbook and Educational Services Corporation",
    retrievedAt: R,
    official: true,
    confidence: "medium",
  },
  rpwAct: {
    url: "https://www.indiacode.nic.in",
    publisher: "Department of Empowerment of Persons with Disabilities, Govt of India",
    retrievedAt: R,
    docRef: "Rights of Persons with Disabilities Act, 2016 — s.32 (5% reservation in higher education)",
    official: true,
    confidence: "high",
  },
  ewsOm: {
    url: "https://dopt.gov.in",
    publisher: "Department of Personnel and Training, Govt of India",
    retrievedAt: R,
    docRef: "O.M. No. 36039/1/2019-Estt(Res) dated 31.01.2019",
    official: true,
    confidence: "high",
    note: "Central EWS: family income below ₹8.00 lakh, plus asset exclusions. NOT implemented in Tamil Nadu state admissions.",
  },

  // ---- Central: National Scholarship Portal ---------------------------------
  nsp: {
    url: "https://scholarships.gov.in",
    publisher: "Ministry of Electronics and IT, Government of India",
    retrievedAt: R,
    official: true,
    confidence: "high",
  },
  nspSchemes: {
    url: "https://scholarships.gov.in/All-Scholarships",
    publisher: "National Scholarship Portal — AY 2026-27 catalogue",
    retrievedAt: R,
    docRef: "Portal open 01-06-2026; student close 31-10-2026; institute verification 15-11-2026; DNO/SNO 30-11-2026",
    official: true,
    confidence: "high",
  },
  csssGuidelines: {
    url: "https://scholarships.gov.in/public/schemeGuidelines/CSSS_GUIDLINES_07022024_updated.pdf",
    publisher: "Department of Higher Education, Ministry of Education, Govt of India",
    retrievedAt: R,
    docRef:
      "PM-USP guidelines for the Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS), applicable from 2022-23",
    official: true,
    confidence: "high",
    note: "Supersedes the earlier CSSS guideline file, which is no longer published.",
  },
  yashasvi: {
    url: "https://scholarships.gov.in/public/schemeGuidelines/3069_G.pdf",
    publisher: "Dept of Social Justice & Empowerment, Govt of India",
    retrievedAt: R,
    docRef:
      "PM-YASASVI scheme guidelines, 2021-22 to 2025-26 — Pre-Matric, Post-Matric and Top Class Education components",
    official: true,
    confidence: "high",
    note: "Umbrella scheme: subsumes the earlier PMS/PMS-EBC and Dr. Ambedkar DNT schemes from 2021-22.",
  },
  aicteGuidelines: {
    url: "https://www.aicte.gov.in/schemes/students-development-schemes",
    publisher: "All India Council for Technical Education, Govt of India",
    retrievedAt: R,
    docRef: "AICTE Student Development Schemes — Pragati, Saksham and Swanath",
    official: true,
    confidence: "high",
    note: "Index page. The per-scheme guidelines are cited separately below.",
  },
  aictePragatiGuidelines: {
    url: "https://www.aicte.gov.in/sites/default/files/AICTE%20Pragati%20Scheme%20Guidelines.pdf",
    publisher: "All India Council for Technical Education, Govt of India",
    retrievedAt: R,
    docRef: "Guidelines for AICTE Pragati Scholarship Scheme for Girl Students (Degree & Diploma)",
    official: true,
    confidence: "high",
  },
  aicteSakshamGuidelines: {
    url: "https://www.aicte.gov.in/sites/default/files/Final_Annexure%202_AICTE%20Saksham%20Scheme%20guidelines.pdf",
    publisher: "All India Council for Technical Education, Govt of India",
    retrievedAt: R,
    docRef:
      "Guidelines for AICTE Saksham Scholarship Scheme for Specially Abled Students (Degree & Diploma)",
    official: true,
    confidence: "high",
  },
  aicteSwanathGuidelines: {
    url: "https://scholarships.gov.in/public/schemeGuidelines/AICTE/AICTE_3038_F.pdf",
    publisher: "All India Council for Technical Education, Govt of India",
    retrievedAt: R,
    docRef: "AICTE Swanath Scholarship Scheme — guidelines and FAQs",
    official: true,
    confidence: "high",
  },
  depwdGuidelines: {
    url: "https://scholarships.gov.in/public/schemeGuidelines/DEPDGuidelines_1.pdf",
    publisher: "Department of Empowerment of Persons with Disabilities, Govt of India",
    retrievedAt: R,
    docRef:
      "F. No. 3-06/2017-Sch (Comp. No. 14196), 25.09.2024 — revised DEPwD umbrella scheme guidelines (Pre-Matric, Post-Matric, Top Class, Fellowship)",
    official: true,
    confidence: "high",
  },
  nmmsGuidelines: {
    url: "https://scholarships.gov.in/public/schemeGuidelines/NMMSSGuidelines.pdf",
    publisher: "Department of School Education & Literacy, Ministry of Education",
    retrievedAt: R,
    docRef: "F. No. 1-6/2020-5S, 15.03.2022 — National Means-cum-Merit Scholarship guidelines",
    official: true,
    confidence: "high",
  },
  momaGuidelines: {
    url: "https://minorityaffairs.gov.in",
    publisher: "Ministry of Minority Affairs, Government of India",
    retrievedAt: R,
    docRef: "Pre-Matric, Post-Matric and Merit-cum-Means scholarship guidelines for minorities",
    official: true,
    confidence: "high",
    note: "These are NOT currently listed on the NSP catalogue; students apply on the MoMA portal directly.",
  },
  inspire: {
    url: "https://www.online-inspire.gov.in",
    publisher: "Department of Science and Technology, Government of India",
    retrievedAt: R,
    docRef: "INSPIRE Scholarship for Higher Education (SHE)",
    official: true,
    confidence: "medium",
  },
  nationalOverseas: {
    url: "https://socialjustice.gov.in/schemes/28",
    publisher: "Department of Social Justice & Empowerment, Government of India",
    retrievedAt: R,
    docRef: "National Overseas Scholarship Scheme",
    official: true,
    confidence: "medium",
  },
  vidyaLakshmi: {
    url: "https://www.vidyalakshmi.co.in",
    publisher: "Ministry of Education, Govt of India, with NSDL",
    retrievedAt: R,
    official: true,
    confidence: "medium",
  },
  sspaSamagra: {
    url: "https://samagra.education.gov.in",
    publisher: "Department of School Education & Literacy, Government of India",
    retrievedAt: R,
    docRef: "Samagra Shiksha Abhiyan",
    official: true,
    confidence: "high",
  },

  // ---- Non-official, deliberately labelled ---------------------------------
  pressLaptopRebrand: {
    url: "https://www.newindianexpress.com/states/tamil-nadu/2026/Aug/05/tvk-govt-rebrands-free-laptop-scheme-rs-8393-crore-allotted-for-higher-education-department-in-tn-budget",
    publisher: "The New Indian Express",
    retrievedAt: R,
    docRef: "Tamil Nadu Budget 2026-27 — 'Vetri Laptop Scheme' rebrands 'Ulagam Ungal Kaiyil'",
    official: false,
    confidence: "medium",
    note: "Budget announcements precede the scheme notification. The rebrand is reported here and corroborated by elcotlaptop.tn.gov.in.",
  },
  pressTnEws: {
    url: "https://www.thehindu.com",
    publisher: "The Hindu",
    retrievedAt: R,
    docRef: "Tamil Nadu's position on EWS in state admissions (counter-affidavit, Madras High Court)",
    official: false,
    confidence: "medium",
    note: "Reports the State's court filing. No Tamil Nadu EWS government order could be located on any .gov.in source.",
  },
} as const satisfies Record<string, SourceRef>;

export type SourceKey = keyof typeof SOURCES;

export function src(...keys: SourceKey[]): SourceRef[] {
  return keys.map((k) => SOURCES[k]);
}

export function src1(key: SourceKey): SourceRef {
  const s = SOURCES[key] as SourceRef;
  return { ...s };
}

export const OFFICIAL_SOURCE_COUNT = Object.values(SOURCES).filter((s) => s.official).length;
export const TOTAL_SOURCE_COUNT = Object.keys(SOURCES).length;
