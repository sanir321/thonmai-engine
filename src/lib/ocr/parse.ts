/**
 * Turns certificate text into *suggested* answers.
 *
 * Nothing here is ever applied automatically. Each candidate carries the exact
 * snippet it came from so a student can confirm it against their own document,
 * because a wrong confident guess is worse than no suggestion at all.
 */

export type Confidence = "high" | "medium" | "low";

export interface OcrCandidate {
  /** The profile field this would fill. */
  field: string;
  label: string;
  value: string | number | boolean;
  confidence: Confidence;
  /** The text the value was read from, shown to the user for verification. */
  evidence: string;
}

export interface ParsedDocument {
  candidates: OcrCandidate[];
  /** Aadhaar-like numbers are masked before the text ever leaves the server. */
  text: string;
}

/**
 * Aadhaar is a 12-digit number and must never be copied out of a document. This
 * masks anything of that shape in the text we echo back, and also catches the
 * XXXX XXXX XXXX spaced form. We keep the last digit visible so two numbers
 * remain distinguishable to a human, but it is never used as data.
 */
export function redactSensitive(text: string): string {
  return text
    .replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, (_m, a, b, c) => `${a} XXXX XXXX ${c.slice(-1)}`)
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "XXXX XXXX XXXX XXXX");
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function snippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 45);
  const end = Math.min(text.length, index + length + 45);
  return clean(`…${text.slice(start, end)}…`);
}

/**
 * Indian numbering: 1,80,000 / 180000 / 2.5 lakh / Rs. 2,50,000/-.
 *
 * `context` is the text immediately after the figure, because the unit is often
 * written as a separate word ("2.5 lakhs") and the number alone is ambiguous.
 */
function parseRupees(raw: string, context = ""): number | null {
  const digits = raw.replace(/[^\d.]/g, "");
  if (!digits) return null;

  const lakhMatch = /([\d.]+)\s*lakh/i.exec(`${raw} ${context}`);
  if (lakhMatch?.[1]) return Math.round(parseFloat(lakhMatch[1]) * 100_000);

  const value = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  // A family income below this is implausible and almost always a misread of
  // some other number on the page.
  if (value < 1000) return null;
  return Math.round(value);
}

const INCOME_CONTEXT = /(annual|total|family|monthly)?\s*(family\s+)?(annual\s+)?income|வருமாந்/gi;

function extractIncome(text: string): OcrCandidate | null {
  // Prefer an amount that sits next to an income keyword.
  const contextual = new RegExp(INCOME_CONTEXT.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = contextual.exec(text)) !== null) {
    const window = text.slice(match.index, match.index + 120);
    // Matches "1,80,000", "180000" and decimals like "2.5" (lakh notation).
    const amount =
      /(?:rs\.?|₹|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:\/\-)?/i.exec(window);
    if (!amount?.[1] || amount.index === undefined) continue;
    // The unit often trails the figure ("2.5 lakhs"), so hand the parser the
    // text that follows the match as well.
    const after = window.slice(amount.index + amount[0].length, amount.index + amount[0].length + 40);
    const value = parseRupees(amount[1], after);
    if (value === null) continue;
    return {
      field: "annualFamilyIncome",
      label: "Annual family income",
      value,
      confidence: /family|annual/i.test(match[0]) ? "high" : "medium",
      evidence: snippet(text, match.index, window.length),
    };
  }

  // No keyword: a lone rupee figure is usually a fee or an award, not income.
  return null;
}

function extractPercentage(text: string): OcrCandidate | null {
  const patterns: { re: RegExp; confidence: Confidence }[] = [
    { re: /(?:percentage|percent|marks?)[^\d%]{0,40}?(\d{1,3}(?:\.\d+)?)\s*%/i, confidence: "high" },
    { re: /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:marks?|percentage|percent)/i, confidence: "high" },
    { re: /(\d{1,3}(?:\.\d+)?)\s*%/, confidence: "low" },
  ];

  for (const { re, confidence } of patterns) {
    const match = re.exec(text);
    const raw = match?.[1];
    if (!raw || match === null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 30 || value > 100) continue;
    return {
      field: "previousYearPercentage",
      label: "Last exam percentage",
      value,
      confidence,
      evidence: snippet(text, match.index, match[0].length),
    };
  }
  return null;
}

const COMMUNITY_PATTERNS: { re: RegExp; value: string }[] = [
  { re: /\b(?:scheduled caste|s\.?c\.?|SC)\b(?!\s*ova)/i, value: "SC" },
  { re: /\b(?:scheduled caste\s*\(?adivasi\)?|SCA)\b/i, value: "SCA" },
  { re: /\b(?:scheduled tribe|tribal|S\.?T\.?)\b/i, value: "ST" },
  { re: /\b(?:most backward class(?:\s*\(?vanniyar\)?)?|MBC|Vanniyar)\b/i, value: "MBC" },
  { re: /\b(?:backward class\s*\(?muslim\)?|BCM|B\.?C\.?M)\b/i, value: "BCM" },
  { re: /\b(?:denotified|DNC|MBC\s*&\s*DNC)\b/i, value: "DNC" },
  { re: /\b(?:backward class|BCB|B\.?C\.?)\b/i, value: "BC" },
  { re: /\b(?:open category|general category|OC)\b/i, value: "OC" },
];

function extractCommunity(text: string): OcrCandidate | null {
  for (const { re, value } of COMMUNITY_PATTERNS) {
    const match = re.exec(text);
    if (!match) continue;
    return {
      field: "community",
      label: "Community / category",
      value,
      // A bare "BC" can appear in other contexts, so only spelled-out or
      // parenthesised forms earn high confidence.
      confidence: /backward|caste|tribe|adivasi|vanniyar|denotified|general|open/i.test(match[0])
        ? "high"
        : "medium",
      evidence: snippet(text, match.index, match[0].length),
    };
  }
  return null;
}

const CLASS_PATTERNS: { re: RegExp; value: number }[] = [
  { re: /\bclass\s*(1[0-2]|[1-9])\b/i, value: 0 },
  { re: /\b(\d)(?:st|nd|rd|th)\s*year\b/i, value: 0 },
  { re: /\byear\s*(1[0-2]|[1-9])\b/i, value: 0 },
  { re: /\b(?:I{1,3}|IV|V|VI)\s*year\b/i, value: 0 },
];

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

function extractClassOrYear(text: string): OcrCandidate | null {
  for (const { re } of CLASS_PATTERNS) {
    const match = re.exec(text);
    if (!match) continue;
    const captured = match[1];
    const value = captured ? Number(captured) : ROMAN[match[0].trim().split(/\s+/)[0] ?? ""];
    if (!value || !Number.isInteger(value) || value < 1 || value > 12) continue;
    return {
      field: "classOrYear",
      label: "Class or year of study",
      value,
      confidence: /class|year/i.test(match[0]) ? "medium" : "low",
      evidence: snippet(text, match.index, match[0].length),
    };
  }
  return null;
}

const PHRASE_RULES: { re: RegExp; field: string; label: string; value: boolean }[] = [
  {
    re: /first\s*graduate|no\.?\s*first\s*graduate|முதலாம்\s*பட்டதாரி/i,
    field: "isFirstGraduate",
    label: "First graduate in the family",
    value: true,
  },
  {
    re: /government\s*school|govt\.?\s*school|அரசுப்?\s*பள்ளி/i,
    field: "studiedClass6to12InGovtSchool",
    label: "Studied Classes 6-12 in a government school",
    value: true,
  },
  {
    re: /nativity\s*(certificate|order)|தரிசம்/i,
    field: "hasNativityCertificate",
    label: "Holds a nativity certificate",
    value: true,
  },
  {
    re: /disab(?:ility|led)|ஏவிப்புச்?/i,
    field: "isDifferentlyAbled",
    label: "Certified as differently abled",
    value: true,
  },
  {
    re: /ex[- ]?servicemen|armed\s*forces|வீரர்கள்/i,
    field: "isExServicemenWard",
    label: "Ward of ex-servicemen or serving personnel",
    value: true,
  },
  {
    re: /national\s*cadet\s*corps|\bNCC\b/i,
    field: "isNccCadet",
    label: "NCC cadet",
    value: true,
  },
  {
    re: /sri\s*lankan\s*tamil|இலங்கை\s*தமிழ/i,
    field: "isSriLankanTamil",
    label: "Sri Lankan Tamil",
    value: true,
  },
];

function extractPhrases(text: string): OcrCandidate[] {
  const found: OcrCandidate[] = [];
  for (const rule of PHRASE_RULES) {
    const match = rule.re.exec(text);
    if (!match) continue;
    found.push({
      field: rule.field,
      label: rule.label,
      value: rule.value,
      confidence: "medium",
      evidence: snippet(text, match.index, match[0].length),
    });
  }
  return found;
}

/**
 * The disability word must sit right next to its percentage. Allowing a long
 * gap lets a marks percentage several lines earlier be mistaken for a
 * disability figure, which would be a confident and badly wrong suggestion.
 */
const DISABILITY_WORD = "(?:disab\\w*|locomotor|intellectual|visual|hearing|orthopedi\\w*)";

function extractDisabilityPercentage(text: string): OcrCandidate | null {
  const adjacent = new RegExp(
    `(\\d{1,2}(?:\\.\\d+)?)\\s*%?\\s*(?:of)?\\s*${DISABILITY_WORD}|${DISABILITY_WORD}\\w*\\s*(?:is|:|-)?\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*%`,
    "i",
  );
  const match = adjacent.exec(text);
  const raw = match?.[1] ?? match?.[2];
  if (!raw || match === null) return null;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 20 || value > 100) return null;

  return {
    field: "disabilityPercentage",
    label: "Disability percentage",
    value,
    confidence: "medium",
    evidence: snippet(text, match.index, match[0].length),
  };
}

export function parseDocumentText(raw: string): ParsedDocument {
  const text = redactSensitive(clean(raw));
  if (!text) return { candidates: [], text: "" };

  const candidates: OcrCandidate[] = [];

  const income = extractIncome(text);
  if (income) candidates.push(income);

  const percentage = extractPercentage(text);
  if (percentage) candidates.push(percentage);

  const community = extractCommunity(text);
  if (community) candidates.push(community);

  const classOrYear = extractClassOrYear(text);
  if (classOrYear) candidates.push(classOrYear);

  const disability = extractDisabilityPercentage(text);
  if (disability) candidates.push(disability);

  candidates.push(...extractPhrases(text));

  // One suggestion per field: the first (most specific) match wins.
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.field)) return false;
    seen.add(c.field);
    return true;
  });

  return { candidates: unique, text };
}
