import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { clientKey, rateLimit, toHeaders } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-response";
import { ExtractionError, extractText } from "@/lib/ocr/extract";
import { hasTruncatedTail, looksLikeExecutableOrScript, sniffUpload, UploadRejected } from "@/lib/ocr/validate";
import { expectedFieldsFor, getCertificateGuide } from "@/lib/documents/certificate-plan";
import { currentUser, isTrustedOrigin } from "@/lib/auth/request";

export const runtime = "nodejs";
/** A cloud read takes seconds, so it must not be squeezed by the default timeout. */
export const maxDuration = 60;

/**
 * Deliberately low: recognition costs seconds of CPU, so this endpoint is the
 * easiest thing in the app to abuse for a denial of service.
 */
const LIMIT = { limit: 6, windowMs: 10 * 60_000 };

/**
 * POST /api/ocr/extract — read a certificate and suggest answers.
 *
 * The uploaded file is written to a private temp directory, read once, and
 * deleted in a `finally` block that runs on every path including a crash. The
 * text is returned to the caller for confirmation but is never stored, and any
 * Aadhaar-shaped number is masked before it leaves this function.
 *
 * Whether the file stays on this machine depends on the configured reader: the
 * default local reader never opens a socket, and the opt-in Gemini reader sends
 * it to Google. The response says which one ran via `sentToThirdParty`, so the
 * interface never claims more privacy than it has.
 *
 * Account-only and same-origin, like the auth routes. Without the origin check a
 * page on any other site could POST a student's file here and spend the app's
 * Gemini quota; the auth requirement is what turns that from "wasting our money"
 * into "needs the victim's session".
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isTrustedOrigin())) {
    return jsonError("Request rejected.", 403);
  }

  const user = await currentUser();
  if (!user) {
    return jsonError("Please log in to read a certificate.", 401);
  }

  const rl = rateLimit(clientKey(request, "ocr"), LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many documents. Please wait a few minutes and try again." },
      { status: 429, headers: { ...toHeaders(rl), "Retry-After": String(rl.resetIn) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Please send the document as multipart form data.", 400);
  }

  const entry = form.get("document");
  if (!(entry instanceof File)) {
    return jsonError("No document was uploaded.", 400);
  }
  if (entry.size === 0) {
    return jsonError("That file is empty.", 400);
  }

  /**
   * Which certificate the student says this is.
   *
   * This never decides *whether* a value is trusted — the student still ticks
   * every value by hand. It only tells the reader which fields to expect, so a
   * Community Certificate that appears to report an income can be flagged as
   * not-belonging rather than shown as an equal result.
   */
  const kindRaw = form.get("kind");
  const kind = typeof kindRaw === "string" ? kindRaw : "other";
  if (!getCertificateGuide(kind)) {
    return jsonError("Please choose which certificate this is.", 400);
  }
  const expectedFields = expectedFieldsFor(kind);

  const bytes = Buffer.from(await entry.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) {
    return jsonError("That file is larger than 8 MB. Please upload a smaller scan or photo.", 413);
  }

  let sniffed;
  try {
    sniffed = sniffUpload(bytes, entry.type);
    if (looksLikeExecutableOrScript(bytes)) {
      return jsonError("That file does not look like a document.", 400);
    }
    if (hasTruncatedTail(bytes, sniffed.kind)) {
      return jsonError("That PDF looks incomplete or damaged. Please re-export and try again.", 400);
    }
  } catch (error) {
    if (error instanceof UploadRejected) return jsonError(error.message, error.status);
    throw error;
  }

  // A private directory: mkdtemp creates it 0700, so no other user on the box
  // can read the document while it is being processed.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "thonmai-up-"));
  const file = path.join(dir, `document.${sniffed.kind}`);

  try {
    await fs.writeFile(file, bytes, { mode: 0o600 });

    const extracted = await extractText(file, sniffed.kind, kind);

    return NextResponse.json(
      {
        kind,
        certificate: getCertificateGuide(kind)?.label ?? kind,
        expectedFields,
        reader: extracted.reader,
        // True when the document was sent to a third party. The UI must not
        // claim the file never left this machine if it did.
        sentToThirdParty: extracted.sentToThirdParty,
        candidates: extracted.candidates,
        text: extracted.text,
        method: extracted.method,
        pages: extracted.pages,
        // The student must opt in per value; nothing is trusted automatically.
        requiresConfirmation: true,
        stored: false,
      },
      { headers: toHeaders(rl) },
    );
  } catch (error) {
    if (error instanceof ExtractionError) return jsonError(error.message, error.status);
    // Never surface a stack trace or a file path to the client.
    console.error("[ocr] extraction failed:", error instanceof Error ? error.message : error);
    return jsonError("That document could not be read. Try a clearer scan or photo.", 422);
  } finally {
    // Runs on success, on error, and on a thrown exception. This is the whole
    // privacy guarantee of the endpoint: the file does not outlive the request.
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
