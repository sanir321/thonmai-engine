import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Nothing we hand to a helper process may hang the request. */
const TOOL_TIMEOUT_MS = 15_000;
const MAX_PDF_PAGES = 6;
/** Below this, a "text layer" is form feeds and whitespace, not words. */
const MIN_USEFUL_CHARS = 40;

/**
 * Reads a PDF's own text layer with `pdftotext`, or returns null if there isn't a
 * usable one.
 *
 * This is not OCR. It is Poppler handing back text the PDF already contains, with
 * no recognition and no model — which is why it is worth keeping even though the
 * app no longer does any local text recognition at all.
 *
 * A government portal PDF almost always has such a layer, and reading it is free,
 * exact, instant and private. Sending one to a cloud model would cost money,
 * spend a student's privacy and add a network round trip to buy a slightly worse
 * version of the same text. So this runs first and the cloud reader only sees
 * what this cannot handle: photographs and scanned pages.
 *
 * Poppler is an **optional** dependency. Every failure — binary missing, not
 * installed, timeout, malformed file — returns null, and the caller falls through
 * to the cloud reader. A host without Poppler therefore still works; it just pays
 * for every PDF instead of most of them.
 */
export async function readPdfTextLayer(pdfPath: string): Promise<string | null> {
  try {
    const { stdout } = await run(
      "pdftotext",
      ["-layout", "-f", "1", "-l", String(MAX_PDF_PAGES), pdfPath, "-"],
      { timeout: TOOL_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    );
    const meaningful = stdout.replace(/\s+/g, " ").trim();
    return meaningful.length >= MIN_USEFUL_CHARS ? meaningful : null;
  } catch {
    // Missing binary, non-zero exit, timeout: all mean "no usable text layer".
    return null;
  }
}
