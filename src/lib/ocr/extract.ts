import { readPdfTextLayer } from "./pdf-text";
import { readWithOcrSpace } from "./reader-ocrspace";
import { readWithGemini } from "./reader-gemini";
import { ExtractionError, type ExtractedDocument } from "./reader";
import { redactSensitive, parseDocumentText } from "./parse";

/**
 * Who reads an uploaded document.
 *
 * Photographs and scanned pages are recognised by a hosted service, never
 * locally — the local Tesseract build and its `tessdata` model are gone. Three
 * readers remain, in the order they are tried:
 *
 *  1. `pdf-text-layer` — `pdftotext` on a PDF that already holds text. Free,
 *     exact, no network. Not recognition, so it runs first.
 *  2. `ocrspace` — the default, because it is free at this volume, needs no
 *     model of ours, and handles a phone photograph well. It returns text only,
 *     so the shared regex parser runs over it.
 *  3. `gemini` — opt-in via `DOCUMENT_READER=gemini`, or the automatic fallback
 *     when OCR.Space is unreachable. It is the only one of the three that reads
 *     Tamil, which is why it was not deleted.
 *
 * All three end in the same place: masked text, values filtered through one
 * allowlist, and nothing applied to the form until the student ticks it.
 */
export type ReaderName = "ocrspace" | "gemini" | "pdf-text-layer";

export interface ReadResult extends ExtractedDocument {
  /** Values to propose, whether the reader or the shared parser produced them. */
  candidates: NonNullable<ExtractedDocument["candidates"]>;
  reader: ReaderName;
}

type CloudReader = "ocrspace" | "gemini";

/**
 * Which hosted recogniser to use. OCR.Space unless the deployment asks for
 * Gemini, which is the only reader with a Tamil model.
 */
function preferredCloudReader(): CloudReader {
  return process.env.DOCUMENT_READER?.trim().toLowerCase() === "gemini"
    ? "gemini"
    : "ocrspace";
}

function hasKeyFor(reader: CloudReader): boolean {
  return Boolean(
    reader === "gemini" ? process.env.GEMINI_API_KEY : process.env.OCRSPACE_API_KEY,
  );
}

/**
 * Whether document reading is available at all.
 *
 * The UI has to be able to say this *before* a student picks a file, not only
 * after an attempt. A server component reads the environment and passes the
 * answer down, because the browser cannot see these variables and a `false`
 * default rendered from the client would quietly offer a feature that cannot
 * work.
 *
 * `pdftotext` is deliberately not consulted: a host without Poppler can still
 * read a document through a hosted reader, so its absence must not disable the
 * feature.
 */
export function readingAvailable(): boolean {
  return hasKeyFor(preferredCloudReader()) || hasKeyFor(otherCloudReader());
}

function otherCloudReader(): CloudReader {
  return preferredCloudReader() === "gemini" ? "ocrspace" : "gemini";
}

/**
 * Reads a document and produces proposed values.
 *
 * A PDF's own text is used when it exists, because it needs no model and no
 * network. Everything else is sent to a hosted recogniser, which returns either
 * structured values (Gemini) or plain text that the shared parser reads.
 */
export async function extractText(
  filePath: string,
  kind: "pdf" | "png" | "jpeg",
  certificateKind: string,
): Promise<ReadResult> {
  if (kind === "pdf") {
    const layer = await readPdfTextLayer(filePath);
    if (layer !== null) {
      const parsed = parseDocumentText(layer);
      return {
        text: redactSensitive(layer),
        method: "pdf-text-layer",
        pages: 1,
        sentToThirdParty: false,
        candidates: parsed.candidates,
        reader: "pdf-text-layer",
      };
    }
  }

  if (!readingAvailable()) {
    // Failing here is better than attempting a request with an empty key, and far
    // better than silently pretending a document was read.
    throw new ExtractionError(
      "Reading documents is not switched on for this server. You can still fill in the form by hand.",
      503,
    );
  }

  const preferred = preferredCloudReader();
  const order: CloudReader[] = [preferred, otherCloudReader()].filter(hasKeyFor);

  let lastError: ExtractionError | null = null;
  for (const reader of order) {
    try {
      if (reader === "gemini") {
        const result = await readWithGemini(filePath, kind, certificateKind);
        return { ...result, candidates: result.candidates ?? [], reader: "gemini" };
      }
      const result = await readWithOcrSpace(filePath, kind === "pdf" ? "application/pdf" : "image/png");
      // OCR.Space gives text only, so the same allowlisted parser used for the
      // PDF text layer reads it. Confidence is not reported per value, so
      // everything is "medium": the student is asked to confirm, and the
      // interface shows the surrounding text either way.
      const parsed = parseDocumentText(redactSensitive(result.text));
      return {
        ...result,
        text: redactSensitive(result.text),
        candidates: parsed.candidates.map((c) => ({ ...c, confidence: "medium" as const })),
        reader: "ocrspace",
      };
    } catch (error) {
      // Only a transport or service failure is worth trying the other reader
      // for. A rejected file — too large, unreadable, wrong type — will be
      // rejected identically next time, and retrying spends a second quota unit
      // to tell the student the same thing twice.
      if (error instanceof ExtractionError && error.status < 500 && error.status !== 429) {
        throw error;
      }
      lastError = error instanceof ExtractionError ? error : null;
    }
  }

  throw (
    lastError ??
    new ExtractionError(
      "The document could not be read. Try a clearer photo, or fill in the form by hand.",
      503,
    )
  );
}

export { ExtractionError };
export type { ExtractedDocument, ParsedCandidate } from "./reader";
