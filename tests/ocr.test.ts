import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  hasTruncatedTail,
  looksLikeExecutableOrScript,
  sniffUpload,
  UploadRejected,
} from "@/lib/ocr/validate";
import { parseDocumentText, redactSensitive } from "@/lib/ocr/parse";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n");

describe("upload type detection", () => {
  it("trusts magic bytes, not the file name", () => {
    expect(sniffUpload(PNG, "image/png").kind).toBe("png");
    expect(sniffUpload(JPEG).kind).toBe("jpeg");
    expect(sniffUpload(PDF).kind).toBe("pdf");
  });

  it("is not fooled by renaming a shell script to .png", () => {
    const fake = Buffer.from("#!/bin/sh\nrm -rf /\n", "utf8");
    expect(() => sniffUpload(fake, "image/png")).toThrow(UploadRejected);
  });

  it("rejects a file whose declared type contradicts its content", () => {
    // A real PNG sent as a PDF: a client doing this is either broken or probing.
    expect(() => sniffUpload(PNG, "application/pdf")).toThrow(/looks like/);
  });

  it("tolerates the generic octet-stream browsers send for PDFs", () => {
    expect(sniffUpload(PDF, "application/octet-stream").kind).toBe("pdf");
  });

  it("tolerates a missing or empty declared type", () => {
    expect(sniffUpload(PNG, null).kind).toBe("png");
    expect(sniffUpload(PNG, "").kind).toBe("png");
  });

  it("ignores charset parameters on the declared type", () => {
    expect(sniffUpload(PNG, "image/png; charset=binary").kind).toBe("png");
  });

  it("rejects an empty file", () => {
    expect(() => sniffUpload(Buffer.alloc(0))).toThrow(/empty/i);
  });

  it("rejects a file over the size cap instead of reading it into memory", () => {
    const huge = Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    expect(() => sniffUpload(huge)).toThrow(/8 MB/);
  });

  it("rejects content that is neither a PDF nor an image", () => {
    expect(() => sniffUpload(Buffer.from("just some text"))).toThrow(UploadRejected);
  });
});

describe("polyglot and truncation defence", () => {
  it("rejects a binary with an HTML script payload", () => {
    const evil = Buffer.concat([PNG, Buffer.from("<script>alert(1)</script>")]);
    expect(looksLikeExecutableOrScript(evil)).toBe(true);
  });

  it("rejects an ELF binary", () => {
    expect(looksLikeExecutableOrScript(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]))).toBe(true);
  });

  it("rejects a PHP tag", () => {
    expect(looksLikeExecutableOrScript(Buffer.from("<?php system($_GET[0]); ?>"))).toBe(true);
  });

  it("passes an ordinary image", () => {
    expect(looksLikeExecutableOrScript(PNG)).toBe(false);
  });

  it("detects a PDF whose trailer is missing", () => {
    const truncated = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
    expect(hasTruncatedTail(truncated, "pdf")).toBe(true);
    expect(hasTruncatedTail(PDF, "pdf")).toBe(false);
  });
});

describe("Aadhaar redaction", () => {
  it("masks a 12-digit Aadhaar number in its spaced form", () => {
    const out = redactSensitive("Aadhaar 2345 6789 0123 on file");
    expect(out).not.toContain("6789 0123");
    expect(out).toMatch(/2345 XXXX XXXX 3/);
  });

  it("masks an unspaced 12-digit Aadhaar number", () => {
    expect(redactSensitive("aadhaar no 234567890123")).not.toContain("234567890123");
  });

  it("leaves a 13-digit number alone: it is not an Aadhaar shape", () => {
    expect(redactSensitive("ref 1234567890123")).toBe("ref 1234567890123");
  });

  it("masks a 16-digit card number", () => {
    expect(redactSensitive("card 4111111111111111")).toBe("card XXXX XXXX XXXX XXXX");
  });

  it("leaves ordinary numbers alone", () => {
    expect(redactSensitive("Income Rs 1,80,000 for 2026")).toBe("Income Rs 1,80,000 for 2026");
  });
});

describe("suggested answers from certificate text", () => {
  const income = parseDocumentText(
    "TAMIL NADU BACKWARD CLASS WELFARE DEPARTMENT. Annual Family Income: Rs. 1,80,000/-",
  );
  it("reads income stated next to an income keyword", () => {
    const c = income.candidates.find((x) => x.field === "annualFamilyIncome");
    expect(c?.value).toBe(180000);
    expect(c?.confidence).toBe("high");
  });

  it("always shows the evidence it read the value from", () => {
    for (const c of income.candidates) {
      expect(c.evidence.length).toBeGreaterThan(10);
    }
  });

  it("does not guess income from a bare rupee figure", () => {
    // A lone amount is usually a fee or an award, not a family income.
    const out = parseDocumentText("Scholarship awarded Rs. 50,000");
    expect(out.candidates.find((c) => c.field === "annualFamilyIncome")).toBeUndefined();
  });

  it("understands lakh notation", () => {
    const out = parseDocumentText("Annual income Rs 2.5 lakhs");
    expect(out.candidates.find((c) => c.field === "annualFamilyIncome")?.value).toBe(250000);
  });

  it("reads a marked percentage", () => {
    const out = parseDocumentText("Percentage of Marks: 82.5%");
    expect(out.candidates.find((c) => c.field === "previousYearPercentage")?.value).toBe(82.5);
  });

  it("ignores an implausible percentage", () => {
    const out = parseDocumentText("Scanned at 8% quality");
    expect(out.candidates.find((c) => c.field === "previousYearPercentage")).toBeUndefined();
  });

  it("reads a spelled-out community", () => {
    const out = parseDocumentText("This certifies the holder is of Most Backward Class");
    expect(out.candidates.find((c) => c.field === "community")?.value).toBe("MBC");
  });

  it("reads Scheduled Caste", () => {
    const out = parseDocumentText("Community: Scheduled Caste (SC)");
    expect(out.candidates.find((c) => c.field === "community")?.value).toBe("SC");
  });

  it("recognises a first-graduate certificate", () => {
    const out = parseDocumentText("FIRST GRADUATE CERTIFICATE issued by the Tahsildar");
    expect(out.candidates.find((c) => c.field === "isFirstGraduate")?.value).toBe(true);
  });

  it("reads a disability percentage", () => {
    const out = parseDocumentText("Disability: 40% locomotor disability");
    expect(out.candidates.find((c) => c.field === "disabilityPercentage")?.value).toBe(40);
  });

  it("suggests at most one value per field", () => {
    const out = parseDocumentText(
      "Annual income Rs 1,80,000. Annual income Rs 2,40,000. Percentage 70%. Class 12.",
    );
    const fields = out.candidates.map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("never returns an Aadhaar number as a candidate", () => {
    const out = parseDocumentText("Annual income Rs 1,80,000. Aadhaar 2345 6789 0123.");
    expect(JSON.stringify(out.candidates)).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
    expect(out.text).not.toContain("2345 6789 0123");
  });

  it("returns nothing for unreadable input instead of inventing values", () => {
    expect(parseDocumentText("").candidates).toEqual([]);
    expect(parseDocumentText("###").candidates).toEqual([]);
  });
});

describe("disability percentage is not confused with a marks percentage", () => {
  it("does not read a marks percentage several lines earlier", () => {
    const out = parseDocumentText(
      "Percentage of Marks: 84.5% Class 12 - Tamil Nadu Disability: 40% locomotor",
    );
    expect(out.candidates.find((c) => c.field === "disabilityPercentage")?.value).toBe(40);
  });

  it("accepts the word before the number", () => {
    const out = parseDocumentText("Locomotor disability 35%");
    expect(out.candidates.find((c) => c.field === "disabilityPercentage")?.value).toBe(35);
  });

  it("suggests nothing when no figure sits next to the word", () => {
    const out = parseDocumentText("Marks 88%. Disability is mentioned in this letter.");
    expect(out.candidates.find((c) => c.field === "disabilityPercentage")).toBeUndefined();
  });
});
