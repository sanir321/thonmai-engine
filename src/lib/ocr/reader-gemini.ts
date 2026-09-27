import fs from "node:fs/promises";
import { ExtractionError, type DocumentReader, type ExtractedDocument, type ParsedCandidate } from "./reader";
import { redactSensitive } from "./parse";
import { getCertificateGuide } from "@/lib/documents/certificate-plan";

/**
 * Reads a certificate with Gemini instead of local OCR.
 *
 * The trade-off, stated plainly: this is markedly better at real photographs,
 * handwriting, Tamil text and messy scans, and it needs no Poppler. The cost is
 * that the student's certificate leaves this machine. It is therefore opt-in via
 * `THONMAI_OCR_PROVIDER=gemini` and a `GEMINI_API_KEY`, never the default.
 *
 * Everything else is held to the same bar as the local reader: the response is
 * validated, masked for Aadhaar-shaped numbers, and still requires the student
 * to tick every value before it reaches the form.
 */

/**
 * `gemini-3.8-flash` is the default because it is what Google's own error
 * message recommends for a newly created key — the older `gemini-2.5-flash` now
 * returns 404 for new users. Overridable with `GEMINI_MODEL`.
 */
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 45_000;

/**
 * Free-tier Gemini answers 503 fairly often under load, and a student holding a
 * perfectly good photograph should not be told their scan is unreadable because
 * a server elsewhere was busy. Transient failures are retried, and if they
 * persist the message names the real cause.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
};

/** The fields Gemini is allowed to propose, with the label and shape for each. */
const FIELD_SPEC = [
  { field: "community", label: "Community / category", type: "string" },
  { field: "annualFamilyIncome", label: "Annual family income", type: "number" },
  { field: "previousYearPercentage", label: "Last exam percentage", type: "number" },
  { field: "classOrYear", label: "Class or year of study", type: "number" },
  { field: "isFirstGraduate", label: "First graduate in the family", type: "boolean" },
  { field: "isDifferentlyAbled", label: "Certified as differently abled", type: "boolean" },
  { field: "disabilityPercentage", label: "Disability percentage", type: "number" },
] as const;

/**
 * Guardrail, not a security control.
 *
 * The model is told not to reproduce identity numbers, and the response is
 * masked again afterwards. A model can still be talked into echoing one, so the
 * redaction is the thing that actually protects the student.
 *
 * Note what is deliberately *not* asked for: a full transcription. The local
 * reader needs raw text because a regex parser does the extracting, but Gemini
 * returns the values itself, and asking it to echo the whole document blew the
 * token limit and truncated the JSON on real certificates. A short identifying
 * summary is what the interface actually shows.
 */
const INSTRUCTION = `You are reading an Indian student certificate to pre-fill an eligibility form.

Return ONLY a JSON object, no prose, no markdown fence, in exactly this shape:
{"text": "<one short sentence naming the document and its holder>", "values": [{"field": "<one of the listed fields>", "value": <value>, "evidence": "<the exact words it was read from>", "confidence": "high|medium|low"}]}

Rules:
- "text" must be ONE short sentence. Do not transcribe the document.
- Only use these fields: ${FIELD_SPEC.map((f) => f.field).join(", ")}.
- Only report a value you can actually see. Never infer, calculate or guess. If a number is not legible, leave it out.
- "value" must be a number for numeric fields, a boolean for yes/no fields, otherwise a string.
- "evidence" must be a short verbatim quote from the document containing the value.
- For community use the code form: OC, BC, BCM, MBC, MBCV, DNC, SC, SCA, ST.
- Do NOT reproduce Aadhaar numbers, bank account numbers, or any 12-digit identity number. Write "[redacted]" in their place.
- An empty "values" array is a correct and acceptable answer.`;

function buildPrompt(kind: string): string {
  const guide = getCertificateGuide(kind);
  const expected = guide?.readableFields ?? [];
  const expectedLine =
    expected.length > 0
      ? `The student says this is a ${guide?.label}. The fields most likely to be present are: ${expected.join(", ")}. Report any other listed field only if it is clearly written.`
      : "The student is not sure what this document is. Report any listed field that is clearly written.";
  return `${INSTRUCTION}\n\n${expectedLine}`;
}

function parseJson(text: string): { text: string; values: unknown[] } {
  // Strip a markdown fence if the model adds one despite the instruction.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new ExtractionError("That document could not be read. Try a clearer scan or photo.");
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      text?: unknown;
      values?: unknown;
    };
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      values: Array.isArray(parsed.values) ? parsed.values : [],
    };
  } catch {
    throw new ExtractionError("That document could not be read. Try a clearer scan or photo.");
  }
}

const CONFIDENCE = new Set(["high", "medium", "low"]);

/**
 * Validates each proposed value against the allowlist.
 *
 * A model is not a parser: it can return a field that was never allowed, a
 * string where a number belongs, or a confidence it invented. Nothing reaches
 * the client without passing here.
 */
function toCandidates(raw: unknown[]): ParsedCandidate[] {
  const byField = new Map<string, (typeof FIELD_SPEC)[number]>(FIELD_SPEC.map((f) => [f.field, f]));
  const out: ParsedCandidate[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { field, value, evidence, confidence } = item as Record<string, unknown>;
    if (typeof field !== "string") continue;

    const spec = byField.get(field);
    if (!spec) continue;
    if (typeof value !== spec.type && !(spec.type === "number" && typeof value === "string" && /^\d+$/.test(value))) {
      continue;
    }

    const numeric = spec.type === "number" ? Number(value) : value;
    if (spec.type === "number" && (!Number.isFinite(numeric as number) || (numeric as number) < 0)) {
      continue;
    }
    // A percentage above 100 is a misread, not a real mark or disability score.
    if (
      (field === "previousYearPercentage" || field === "disabilityPercentage") &&
      (numeric as number) > 100
    ) {
      continue;
    }
    if (field === "classOrYear" && ((numeric as number) < 1 || (numeric as number) > 12)) {
      continue;
    }
    if (field === "community") {
      const allowed = new Set(["OC", "BC", "BCM", "MBC", "MBCV", "DNC", "SC", "SCA", "ST"]);
      if (typeof numeric !== "string" || !allowed.has(numeric)) continue;
    }

    out.push({
      field,
      label: spec.label,
      value: numeric as string | number | boolean,
      confidence: CONFIDENCE.has(String(confidence)) ? (confidence as ParsedCandidate["confidence"]) : "low",
      evidence: typeof evidence === "string" ? evidence.slice(0, 200) : "",
    });
  }

  return out;
}

export async function readWithGemini(
  filePath: string,
  kind: "pdf" | "png" | "jpeg",
  certificateKind: string,
): Promise<ExtractedDocument> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ExtractionError("Cloud reading is not configured on this server.", 503);
  }

  const bytes = await fs.readFile(filePath);
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(certificateKind) },
          { inlineData: { mimeType: MIME[kind] ?? "application/octet-stream", data: bytes.toString("base64") } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
    // No custom `safetySettings` on purpose. Measured on gemini-3.8-flash with
    // this key, sending them returns 503 "high demand" on every request, while
    // the identical call without them succeeds. The model applies its own
    // default safety settings regardless, so the block was pure downside. If you
    // add it back, re-measure first.
  };

  let payload: GeminiResponse | null = null;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${API_ROOT}/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      lastStatus = res.status;

      if (res.ok) {
        payload = (await res.json()) as GeminiResponse;
        break;
      }

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        // A bad or mis-scoped key must not surface as a problem with the file.
        console.error("[ocr] gemini rejected the request:", res.status);
        throw new ExtractionError("Cloud reading is not available on this server right now.", 503);
      }

      if (RETRYABLE.has(res.status) && attempt < ATTEMPTS) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }

      if (res.status === 429) {
        throw new ExtractionError(
          "Too many documents just now. Please try again in a few minutes.",
          429,
        );
      }
      if (RETRYABLE.has(res.status)) {
        throw new ExtractionError(
          "Our reading service is busy. Please try again in a minute.",
          503,
        );
      }
      throw new ExtractionError("That document could not be read. Try a clearer scan or photo.");
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt < ATTEMPTS) {
          await sleep(400 * 2 ** (attempt - 1));
          continue;
        }
        throw new ExtractionError("Reading that document took too long. Try a smaller file.");
      }
      if (attempt < ATTEMPTS) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      console.error("[ocr] gemini request failed:", lastStatus, error instanceof Error ? error.message : error);
      throw new ExtractionError("That document could not be read. Try a clearer scan or photo.");
    } finally {
      clearTimeout(timer);
    }
  }

  if (!payload) {
    throw new ExtractionError("Our reading service is busy. Please try again in a minute.", 503);
  }

  const blockReason = payload.promptFeedback?.blockReason;
  if (blockReason) {
    throw new ExtractionError("That document could not be processed.");
  }

  if (payload.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    console.error("[ocr] gemini response hit the token limit");
    throw new ExtractionError(
      "That document is too long to read. Try uploading only the page with the details.",
    );
  }

  const reply = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!reply.trim()) {
    throw new ExtractionError("No text could be read from that document. Try a clearer photo.");
  }

  const { text, values } = parseJson(reply);

  return {
    // Masked here as well as in the prompt: the model may echo a number back
    // despite being told not to, and the student must never see it.
    text: redactSensitive(text),
    method: "gemini",
    pages: 1,
    sentToThirdParty: true,
    candidates: toCandidates(values),
  };
}

export const geminiReader: DocumentReader = {
  name: "gemini",
  read: (filePath, kind) => readWithGemini(filePath, kind, "other"),
};
