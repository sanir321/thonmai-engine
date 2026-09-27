import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ExtractionError } from "./reader";

const exec = promisify(execFile);

/**
 * What a hosted recogniser hands back. Deliberately narrower than
 * `ReadResult` in `extract.ts`: OCR.Space proposes no values of its own, so the
 * candidates are added by the shared parser afterwards. Importing that type here
 * would be circular, since extract.ts is what calls this reader.
 */
interface OcrSpaceResult {
  text: string;
  method: "ocrspace";
  pages: number;
  sentToThirdParty: true;
}

/**
 * OCR.Space (https://ocr.space/parse/image) is a hosted OCR service. It is a
 * thin wrapper around Tesseract, so this is still "OCR" — just somebody else's,
 * running somewhere else. The reason for using it over the Tesseract we removed
 * is that we do not have to ship or tune an engine, and it handles a phone
 * photograph better than the wasm build did.
 *
 * It returns plain text, not the structured fields the rest of the app wants, so
 * the same regex parser we use everywhere else runs over the result. That keeps
 * the value allowlist and the redaction in front of the user, exactly as they
 * were with the local reader: OCR.Space proposes, the student confirms.
 */

const ENDPOINT = "https://api.ocr.space/parse/image";

/**
 * OCR.Space caps uploads at 1 MB on the free plan. We check it here rather than
 * paying for a round trip to be told the file is too big, and so the student
 * gets a message naming the actual limit instead of a generic failure.
 */
const MAX_BYTES = 1024 * 1024;

const MAX_PAGES = 6;

export class OcrSpaceError extends ExtractionError {
  constructor(message: string, status = 502, readonly code?: string) {
    super(message, status);
    this.name = "OcrSpaceError";
  }
}

function requireKey(): string {
  const key = process.env.OCRSPACE_API_KEY?.trim();
  if (!key) {
    throw new OcrSpaceError(
      "Document reading is not configured on this server. Please fill in the form by hand.",
      503,
    );
  }
  return key;
}

interface OcrSpaceWord {
  WordText: string;
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
}

interface OcrSpaceLine {
  LineText: string;
  Words?: OcrSpaceWord[];
}

interface OcrSpaceResponse {
  ParsedResults?: Array<{
    ParsedText: string;
    FileParseExitCode?: number;
    ErrorMessage?: string;
    TextOverlay?: { Lines?: OcrSpaceLine[]; HasOverlay?: boolean };
  }>;
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[] | string;
  ProcessingTimeInMilliseconds?: string;
}

/**
 * OCR.Space uses HTTP status codes to mean specific things, and returns 200 even
 * when it failed, so the message is the only reliable signal. Left unhandled the
 * student sees a blank page; mapped, they see "try again tonight".
 */
function friendlyError(messages: string[], exitCode?: number): string {
  const text = messages.join(" ").toUpperCase();
  if (text.includes("E101") || exitCode === 99) {
    return "The document reading service did not understand the file. Try a clearer photo, or fill in the form by hand.";
  }
  if (text.includes("E102") || text.includes("TOO MANY")) {
    return "The document reading service is busy right now. Please try again in a few minutes.";
  }
  if (text.includes("E105") || text.includes("DAILY") || text.includes("MONTHLY")) {
    return "Today's free document-reading limit has been reached. Please try again tomorrow, or fill in the form by hand.";
  }
  if (text.includes("SIZE") || text.includes("TOO BIG") || text.includes("DIMENSION")) {
    return `That file is too large or has the wrong dimensions. Please use a photo or a PDF under ${Math.round(MAX_BYTES / 1024)} KB, or fill in the form by hand.`;
  }
  if (text.includes("E106") || text.includes("BAD KEY") || text.includes("FREE API")) {
    return "Document reading is misconfigured on this server. Please fill in the form by hand.";
  }
  return "The document could not be read. Try a clearer photo, or fill in the form by hand.";
}

/**
 * Number of pages the file seems to contain, best effort. We only use it to
 * warn in the interface, so an inaccurate guess is not worth failing over.
 */
function countPages(text: string): number {
  const breaks = text.split(/\f|\n\s*-\s*\d+\s*-\s*\n/).filter((p) => p.trim()).length;
  return Math.max(1, Math.min(MAX_PAGES, breaks || 1));
}

export async function readWithOcrSpace(
  filePath: string,
  mimeType: string,
): Promise<OcrSpaceResult> {
  const apiKey = requireKey();

  const { size } = await statOrThrow(filePath);
  if (size > MAX_BYTES) {
    throw new OcrSpaceError(
      `That file is ${Math.round(size / 1024)} KB. Please use one under ${Math.round(MAX_BYTES / 1024)} KB, or fill in the form by hand.`,
      413,
    );
  }

  // Engine 2 is the more accurate one and handles photographs better than
  // engine 1. Scale enlarges small phone photos before recognition, which is
  // most of the difference between a readable and an unreadable upload.
  const fields = {
    apikey: apiKey,
    language: process.env.OCRSPACE_LANGUAGE?.trim() || "eng",
    isOverlayRequired: "false",
    detectOrientation: "true",
    scale: "true",
    OCREngine: process.env.OCRSPACE_ENGINE?.trim() || "2",
    isTable: mimeType === "application/pdf" ? "true" : "false",
  };

  let body: string;
  try {
    // OCR.Space can take several seconds on a slow photograph, so this is
    // deliberately far above the previous timeout.
    const { stdout } = await exec(
      "curl",
      [
        "-sS", "--fail-with-body",
        "--max-time", "100",
        "-X", "POST",
        ENDPOINT,
        "-H", `apikey: ${apiKey}`,
        ...Object.entries(fields).flatMap(([k, v]) => ["-F", `${k}=${v}`]),
        "-F", `file=@${filePath};type=${mimeType}`,
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    body = stdout;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    // --fail-with-body puts OCR.Space's own error payload in stderr, so it is
    // still worth reading before giving up.
    if (stderr.trim()) {
      try {
        return interpret(JSON.parse(stderr) as OcrSpaceResponse, mimeType);
      } catch {
        /* fall through to the generic message */
      }
    }
    throw new OcrSpaceError(
      "The document reading service could not be reached. Please try again in a few minutes.",
      503,
    );
  }

  let parsed: OcrSpaceResponse;
  try {
    parsed = JSON.parse(body) as OcrSpaceResponse;
  } catch {
    throw new OcrSpaceError(
      "The document reading service sent something unexpected. Please try again.",
      502,
    );
  }
  return interpret(parsed, mimeType);
}

function interpret(payload: OcrSpaceResponse, mimeType: string): OcrSpaceResult {
  if (payload.IsErroredOnProcessing) {
    const messages = Array.isArray(payload.ErrorMessage)
      ? payload.ErrorMessage
      : [payload.ErrorMessage ?? "Unknown error"];
    throw new OcrSpaceError(friendlyError(messages, payload.OCRExitCode), 502);
  }

  const result = payload.ParsedResults?.[0];
  if (!result) {
    throw new OcrSpaceError(
      "The document reading service returned no text. Try a clearer photo, or fill in the form by hand.",
      502,
    );
  }
  if (result.FileParseExitCode !== 0 && result.FileParseExitCode !== 1) {
    throw new OcrSpaceError(friendlyError([result.ErrorMessage ?? ""], result.FileParseExitCode), 502);
  }

  const text = result.ParsedText?.trim() ?? "";
  if (text.replace(/\W/g, "").length < 10) {
    throw new OcrSpaceError(
      "Almost no text could be read from that file. Try a clearer, straighter photo, or fill in the form by hand.",
      422,
    );
  }

  return {
    text,
    method: "ocrspace",
    pages: countPages(text),
    // Always true: the file left the server for a third party. The interface
    // promises this before the upload, so it must not be conditional.
    sentToThirdParty: true,
  };
}

async function statOrThrow(path: string): Promise<{ size: number }> {
  const { stat } = await import("node:fs/promises");
  try {
    return await stat(path);
  } catch {
    throw new OcrSpaceError("That file could not be opened. Please choose it again.", 400);
  }
}
