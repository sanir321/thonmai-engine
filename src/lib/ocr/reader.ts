/**
 * The contract every document reader satisfies.
 *
 * There are two implementations, and the choice is deliberate rather than a
 * default: `local` reads the file on this machine and never sends it anywhere,
 * while `gemini` sends it to Google and reads far more accurately, including
 * Tamil. A student's community and income certificate is sensitive, so the
 * private reader is the default and the cloud one is opt-in.
 */
export interface ExtractedDocument {
  /** The document's text, already through sensitive-number redaction. */
  text: string;
  /** How it was read, shown to the student so they know how much to trust it. */
  method: "pdf-text-layer" | "ocr" | "ocrspace" | "gemini";
  pages: number;
  /** Set when the text came from a third party, so the UI can say so. */
  sentToThirdParty: boolean;
  /**
   * Values the reader is confident enough to propose, already shaped like the
   * parser's output. A provider that can return structured data returns it
   * here; one that can only return text leaves it empty and lets the shared
   * parser do the work.
   */
  candidates?: ParsedCandidate[];
}

export interface ParsedCandidate {
  field: string;
  label: string;
  value: string | number | boolean;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

export interface DocumentReader {
  readonly name: "local" | "gemini";
  read(filePath: string, kind: "pdf" | "png" | "jpeg"): Promise<ExtractedDocument>;
}

export class ExtractionError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "ExtractionError";
    this.status = status;
  }
}
