import type { DocumentSpec, DocumentType } from "@/engine/types";

/**
 * Document registry.
 *
 * `issuingAuthority` is the field students get wrong most often. A community
 * certificate printed at a taluk office counter can be rejected if the scheme
 * requires a digitally-signed e-Certificate, and a Permanent Residence
 * Certificate is explicitly NOT accepted in place of a Nativity Certificate
 * for TNEA counselling. The UI surfaces this before the student goes anywhere.
 */
export const DOCUMENT_SPECS: DocumentSpec[] = [
  {
    type: "community_certificate",
    label: "Community Certificate",
    labelTa: "சமுதாய சான்றிதழ்",
    issuingAuthority: "Tahsildar / HQ or Zonal Deputy Tahsildar (Revenue Department). SC, SCA and ST are issued by the Tahsildar of the native taluk; ST via the Revenue Divisional Officer.",
    issuingAuthorityTa: "தாசில்தார் / மாவட்ட துணைத் தாசில்தார்",
    eCertificateOnly: true,
    howToObtain: "TN e-Sevai (tnesevai.tn.gov.in) or the taluk office. Link the certificate number to your Aadhaar.",
    validityNote:
      "Effectively permanent, but must have been issued before the application deadline. A certificate issued by another state is not accepted for Tamil Nadu quota.",
    acquisition: "apply",
  },
  {
    type: "income_certificate",
    label: "Family Income Certificate",
    labelTa: "குடும்ப வருமானச் சான்றிதழ்",
    issuingAuthority: "Tahsildar or Revenue Officer via TN e-Sevai",
    issuingAuthorityTa: "தாசில்தார்",
    eCertificateOnly: false,
    howToObtain: "TN e-Sevai (tnesevai.tn.gov.in). Get it issued after 1 April for the current financial year.",
    validityNote:
      "Must be valid on the date of application. This is the single most common cause of rejected applications — check the issue date on the certificate before you apply.",
    acquisition: "apply",
  },
  {
    type: "nativity_certificate",
    label: "Nativity Certificate",
    labelTa: "நாட்டினுரிமைச் சான்றிதழ்",
    issuingAuthority: "Tahsildar / Zonal Deputy Tahsildar via TN e-Sevai service REV-102",
    issuingAuthorityTa: "தாசில்தார் (e-Sevai REV-102)",
    eCertificateOnly: true,
    howToObtain: "Apply on tnesevai.tn.gov.in under revenue service REV-102.",
    validityNote:
      "TNEA accepts only a digitally signed e-Certificate. A Permanent Residence Certificate is NOT accepted in its place. Required if you studied Classes VIII to XII outside Tamil Nadu, and for management / NRI / minority quota.",
    acquisition: "apply",
  },
  {
    type: "first_graduate_certificate",
    label: "First Graduate Certificate",
    labelTa: "முதல் பட்டதாரர் சான்றிதழ்",
    issuingAuthority: "Headquarters Deputy Tahsildar",
    issuingAuthorityTa: "மாவட்ட துணைத் தாசில்தார்",
    eCertificateOnly: true,
    howToObtain:
      "Apply through TN e-Sevai. You will need the family tree prescribed by G.O.(st) No. 85 of 2010 naming father, mother, paternal and maternal grandparents, brothers and sisters, plus a joint declaration signed by you and your parent/guardian.",
    validityNote:
      "You are disqualified if a brother or sister has already availed the first-graduate concession for a professional course.",
    acquisition: "apply",
  },
  {
    type: "pwd_certificate",
    label: "Differently Abled Certificate",
    labelTa: "மாற்றுத்திறனாளி சான்றிதழ்",
    issuingAuthority:
      "Medical Board of at least 3 doctors (TNEA). For MBBS/BDS, the Regional Medical Board at RGGGH Chennai or the designated centres at Madurai, Coimbatore and Thanjavur.",
    issuingAuthorityTa: "மருத்துவக் குழு",
    eCertificateOnly: false,
    howToObtain: "Apply through the District Differently Abled Welfare Office or the Medical Board.",
    validityNote: "Minimum 40% benchmark disability. Register on the UDID portal before applying on the National Scholarship Portal.",
    acquisition: "apply",
  },
  {
    type: "ex_servicemen_certificate",
    label: "Ex-Servicemen Certificate",
    labelTa: "வீரர் சான்றிதழ்",
    issuingAuthority:
      "Officer not below the rank of Assistant Director, Department of Ex-Servicemen's Welfare, Tamil Nadu",
    issuingAuthorityTa: "மாவீடர் நலத்துறை இணை இயக்குநர்",
    eCertificateOnly: false,
    howToObtain: "Apply to the District Ex-Servicemen's Welfare Office.",
    validityNote:
      "Also carry the parent's discharge certificate and Ex-Servicemen ID. Tamil Nadu origin only.",
    acquisition: "apply",
  },
  {
    type: "aadhaar",
    label: "Aadhaar Card",
    labelTa: "ஆதார் அட்டை",
    issuingAuthority: "UIDAI",
    issuingAuthorityTa: "UIDAI",
    eCertificateOnly: false,
    howToObtain: "Enrol or update at an Aadhaar enrolment centre or on uidai.gov.in.",
    validityNote:
      "The Aadhaar must be seeded with your bank account for Direct Benefit Transfer. This is a hard prerequisite for almost every central scheme.",
    acquisition: "instant_derivable",
  },
  {
    type: "bank_passbook",
    label: "Bank Passbook (first page)",
    labelTa: "வங்கிக் கடிதகம்",
    issuingAuthority: "Your bank branch",
    issuingAuthorityTa: "வங்கி கிளை",
    eCertificateOnly: false,
    howToObtain: "Request a cancelled cheque or a passbook scan from your branch.",
    validityNote:
      "The account must be in the student's own name (or, for Pudhumai Penn, the girl's own account) and Aadhaar-seeded.",
    acquisition: "instant_derivable",
  },
  {
    type: "marksheet_10",
    label: "Class 10 Mark Sheet",
    labelTa: "10ஆம் வகுப்பு சான்றிதழ்",
    issuingAuthority: "Board of Examinations (HSC, CBSE, ICSE or equivalent)",
    issuingAuthorityTa: "பாடத்தலவு ஆணையம்",
    eCertificateOnly: false,
    howToObtain: "Collect from your school or the board portal.",
    validityNote: "Attested photocopy is usually required at document verification.",
    acquisition: "instant_derivable",
  },
  {
    type: "marksheet_12",
    label: "Class 12 Mark Sheet",
    labelTa: "12ஆம் வகுப்பு சான்றிதழ்",
    issuingAuthority: "Board of Examinations (HSC, CBSE, ICSE or equivalent)",
    issuingAuthorityTa: "பாடத்தலவு ஆணையம்",
    eCertificateOnly: false,
    howToObtain: "Collect from your school or the board portal.",
    validityNote: "The CSSS merit threshold is assessed on this document.",
    acquisition: "instant_derivable",
  },
  {
    type: "previous_year_marksheet",
    label: "Previous Year Mark Sheet",
    labelTa: "முந்தைய ஆண்டு சான்றிதழ்",
    issuingAuthority: "Your institution / Board of Examinations",
    issuingAuthorityTa: "உங்கள் கல்லூரி / பாடத்தலவு ஆணையம்",
    eCertificateOnly: false,
    howToObtain: "Download from your institution's portal.",
    validityNote:
      "Mandatory for scholarship renewal. CSSS renewal requires at least 50% in the annual examination and 75% attendance.",
    acquisition: "instant_derivable",
  },
  {
    type: "transfer_certificate",
    label: "Transfer Certificate",
    labelTa: "இடமாற்றுச் சான்றிதழ்",
    issuingAuthority: "Head of the last institution attended",
    issuingAuthorityTa: "கடைசியாகப் படித்த பள்ளியின் தலைவர்",
    eCertificateOnly: false,
    howToObtain: "Apply to your school after completing Class 12.",
    validityNote: "",
    acquisition: "apply",
  },
  {
    type: "migration_certificate",
    label: "Migration / Eligibility Certificate",
    labelTa: "இடமாற்று / தகுதி சான்றிதழ்",
    issuingAuthority:
      "For medical admissions: TN Dr. MGR Medical University issues an Eligibility Certificate for non-State / CBSE / ICSE / foreign board students.",
    issuingAuthorityTa: "தமிழ்நாடு முடிராஜர் மருத்துவக் கல்லூரி",
    eCertificateOnly: false,
    howToObtain: "Apply to TN Dr. MGR Medical University.",
    validityNote: "Needed if you studied outside Tamil Nadu or on a non-State board.",
    acquisition: "apply",
  },
  {
    type: "bonafide_certificate",
    label: "Bonafide Certificate (with EMIS number)",
    labelTa: "உண்மைச் சான்றிதழ் (EMIS எண் உடன்)",
    issuingAuthority: "Head of your school",
    issuingAuthorityTa: "பள்ளி தலைவர்",
    eCertificateOnly: false,
    howToObtain: "Request it from your school office. Ask specifically for the EMIS number to be printed on it.",
    validityNote:
      "This is the proof used for the 7.5% Government School Students quota. It must state that you studied Classes VI to XII in a State Government school and carry the EMIS number.",
    acquisition: "apply",
  },
  {
    type: "emis_id",
    label: "EMIS Number (school)",
    labelTa: "EMIS எண்",
    issuingAuthority: "Your school, via the EMIS record",
    issuingAuthorityTa: "EMIS பதிவு",
    eCertificateOnly: false,
    howToObtain: "Ask your school office for your EMIS number; it also appears on the Pudhumai Penn portal lookup.",
    validityNote:
      "Needed to prove government-school study from Class 6 onwards. Pudhumai Penn and the 7.5% quota both key off it.",
    acquisition: "auto_from_enrolment",
  },
  {
    type: "udid",
    label: "UDID (Unique Disability ID)",
    labelTa: "UDID எண்",
    issuingAuthority: "Department of Empowerment of Persons with Disabilities, Government of India",
    issuingAuthorityTa: "மாற்றுத்திறனாளி ஆற்றல் வளர்ச்சி அமைச்சகம்",
    eCertificateOnly: false,
    howToObtain: "Register at swavlambancard.gov.in.",
    validityNote:
      "Mandatory before applying on the National Scholarship Portal — PwD students must log in to UDID and consent to share the UDID details, or the NSP application cannot be submitted.",
    acquisition: "auto_from_enrolment",
  },
  {
    type: "orphan_certificate",
    label: "Orphan Certificate",
    labelTa: "ஆதரவற்ற சான்றிதழ்",
    issuingAuthority: "District Social Welfare Office / Women & Child Development",
    issuingAuthorityTa: "மாவட்ட சமூக நல அலுவலகம்",
    eCertificateOnly: false,
    howToObtain: "Apply to the District Social Welfare Office.",
    validityNote: "Required for the AICTE Swanath scholarship.",
    acquisition: "apply",
  },
];

export const DOC_BY_TYPE: Record<DocumentType, DocumentSpec> = Object.fromEntries(
  DOCUMENT_SPECS.map((d) => [d.type, d]),
) as Record<DocumentType, DocumentSpec>;

export function docLabel(t: DocumentType): string {
  return DOC_BY_TYPE[t]?.label ?? t;
}
