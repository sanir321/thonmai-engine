import { describe, expect, it, afterEach, vi } from "vitest";
import { extractText, readingAvailable, ExtractionError } from "@/lib/ocr/extract";
import { readPdfTextLayer } from "@/lib/ocr/pdf-text";

/**
 * The app no longer does any local text recognition. These tests pin the two
 * consequences of that, because both fail silently otherwise:
 *
 *  1. With no API key the feature must refuse clearly, not pretend to work.
 *  2. Poppler is optional — a host without it must still read documents, through
 *     the cloud reader, rather than reporting a broken upload.
 */
vi.mock("@/lib/ocr/pdf-text", () => ({ readPdfTextLayer: vi.fn() }));
vi.mock("@/lib/ocr/reader-gemini", () => ({ readWithGemini: vi.fn() }));

const { readWithGemini } = await import("@/lib/ocr/reader-gemini");
const originalKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  vi.clearAllMocks();
});

describe("readingAvailable", () => {
  it("is true only when a key is present", () => {
    delete process.env.GEMINI_API_KEY;
    expect(readingAvailable()).toBe(false);

    process.env.GEMINI_API_KEY = "test-key";
    expect(readingAvailable()).toBe(true);
  });
});

describe("a server with no reader configured", () => {
  it("refuses a photograph with an explanation instead of a silent failure", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.mocked(readWithGemini).mockResolvedValue({
      text: "should never be used",
      method: "gemini",
      pages: 1,
      sentToThirdParty: true,
    });

    await expect(extractText("/tmp/x.png", "png", "community_certificate")).rejects.toThrow(
      /fill in the form by hand/i,
    );
    // The point: no request is attempted with a missing key.
    expect(readWithGemini).not.toHaveBeenCalled();
  });

  it("still answers readingAvailable, so the interface can hide the upload", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(readingAvailable()).toBe(false);
  });
});

describe("PDFs with a text layer", () => {
  it("are read locally and never uploaded", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(readPdfTextLayer).mockResolvedValue(
      "This is to certify that RAMESH KUMAR belongs to SC Annual Family Income Rs 90,000",
    );

    const result = await extractText("/tmp/x.pdf", "pdf", "community_certificate");

    expect(result.reader).toBe("pdf-text-layer");
    expect(result.sentToThirdParty).toBe(false);
    expect(readWithGemini).not.toHaveBeenCalled();
  });

  it("mask anything Aadhaar-shaped before it is returned", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(readPdfTextLayer).mockResolvedValue(
      "Community certificate for 1234 5678 9012 community SC family income 90000",
    );

    const result = await extractText("/tmp/x.pdf", "pdf", "community_certificate");

    expect(result.text).not.toMatch(/\d{12}/);
    expect(result.text).toContain("XXXX");
  });

  it("falls through to the cloud reader when there is no text layer", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(readPdfTextLayer).mockResolvedValue(null);
    vi.mocked(readWithGemini).mockResolvedValue({
      text: "Community certificate SC",
      method: "gemini",
      pages: 1,
      sentToThirdParty: true,
      candidates: [
        { field: "community", label: "Category", value: "SC", confidence: "high", evidence: "SC" },
      ],
    });

    const result = await extractText("/tmp/x.pdf", "pdf", "community_certificate");

    expect(result.reader).toBe("gemini");
    expect(result.sentToThirdParty).toBe(true);
    expect(readWithGemini).toHaveBeenCalledOnce();
  });
});

describe("photographs", () => {
  it("always go to the cloud reader, since there is no local recognition left", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(readWithGemini).mockResolvedValue({
      text: "Community certificate MBC",
      method: "gemini",
      pages: 1,
      sentToThirdParty: true,
      candidates: [
        {
          field: "community",
          label: "Category",
          value: "MBC",
          confidence: "high",
          evidence: "MOST BACKWARD",
        },
      ],
    });

    const result = await extractText("/tmp/x.png", "png", "community_certificate");

    expect(result.reader).toBe("gemini");
    expect(result.sentToThirdParty).toBe(true);
    expect(result.candidates[0]?.value).toBe("MBC");
    // The PDF shortcut must not be consulted for an image.
    expect(readPdfTextLayer).not.toHaveBeenCalled();
  });
});

describe("the reader path has no local recognition", () => {
  it("readPdfTextLayer returns null rather than throwing when Poppler is absent", async () => {
    // The real function, unmocked: a missing binary must degrade, not crash.
    const real = await vi.importActual<typeof import("@/lib/ocr/pdf-text")>(
      "@/lib/ocr/pdf-text",
    );
    const result = await real.readPdfTextLayer("/nonexistent/path.pdf");
    expect(result).toBeNull();
  });

  it("ExtractionError is still the type the route catches", () => {
    expect(new ExtractionError("x", 503).status).toBe(503);
  });
});
