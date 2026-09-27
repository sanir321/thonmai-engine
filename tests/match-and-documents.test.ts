import { describe, expect, it, vi } from "vitest";
import { POST as match } from "@/app/api/match/route";
import { currentUser, isTrustedOrigin } from "@/lib/auth/request";
import {
  CERTIFICATE_GUIDES,
  MANUAL_ONLY_FIELDS,
  NEVER_COLLECT,
  READABLE_FIELDS,
  expectedFieldsFor,
  getCertificateGuide,
} from "@/lib/documents/certificate-plan";

/**
 * The match route is the engine, and the account gate is the only thing keeping
 * it behind a login. A page-level redirect is not enough on its own: anyone can
 * open devtools and call the endpoint directly.
 */
vi.mock("@/lib/auth/request", () => ({
  currentUser: vi.fn(),
  isTrustedOrigin: vi.fn(),
}));

const validBody = {
  profile: {
    level: "school",
    gender: "female",
    community: "SC",
    classOrYear: 12,
    domicileState: "tamil_nadu",
    admissionRoute: "government_quota",
    institutionType: "government",
    annualFamilyIncome: 180000,
    district: "coimbatore",
    isFirstGraduate: false,
    isDifferentlyAbled: false,
    isExServicemenWard: false,
    isOrphan: false,
    hasNativityCertificate: false,
  },
  documents: [],
};

function request(body: unknown = validBody) {
  return new Request("http://localhost/api/match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/match is account-only", () => {
  it("refuses a signed-out caller without leaking scheme data", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);

    const res = await match(request());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/log in/i);
    // The point of the test: no eligibility data is served before login.
    expect(JSON.stringify(body)).not.toContain("schemes");
  });

  it("evaluates the catalogue once signed in", async () => {
    vi.mocked(currentUser).mockResolvedValue({
      id: "user_1",
      email: "student@example.com",
    } as never);

    const res = await match(request());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evaluations.length).toBeGreaterThan(0);
    expect(body.evaluations[0]).toHaveProperty("trace");
    expect(Array.isArray(body.eligible)).toBe(true);
    expect(Array.isArray(body.ineligible)).toBe(true);
    expect(Array.isArray(body.needsDocument)).toBe(true);
  });
});

describe("POST /api/ocr/extract is closed to other sites", () => {
  it("refuses a cross-origin POST before touching the upload", async () => {
    // The point of the origin check: a page on another site should not be able
    // to spend this server's Gemini quota using the visitor's browser.
    vi.mocked(isTrustedOrigin).mockResolvedValue(false);
    const { POST: ocr } = await import("@/app/api/ocr/extract/route");

    const res = await ocr(
      new Request("http://localhost/api/ocr/extract", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("refuses a signed-out caller", async () => {
    vi.mocked(isTrustedOrigin).mockResolvedValue(true);
    vi.mocked(currentUser).mockResolvedValue(null);
    const { POST: ocr } = await import("@/app/api/ocr/extract/route");

    const res = await ocr(
      new Request("http://localhost/api/ocr/extract", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(res.status).toBe(401);
  });
});

describe("document plan integrity", () => {
  it("gives every certificate an id and both languages", () => {
    expect(CERTIFICATE_GUIDES.length).toBeGreaterThan(0);

    for (const cert of CERTIFICATE_GUIDES) {
      expect(cert.id, "every certificate needs an id").toBeTruthy();
      expect(cert.label.length, `${cert.id} needs an English label`).toBeGreaterThan(2);
      expect(cert.labelTa.length, `${cert.id} needs a Tamil label`).toBeGreaterThan(1);
      expect(
        cert.manualFields.every((f) => f.why.length > 10),
        `${cert.id} has a manual field with no reason given`,
      ).toBe(true);
    }
  });

  it("keeps certificate ids unique and resolvable", () => {
    const ids = CERTIFICATE_GUIDES.map((c) => c.id);
    expect(new Set(ids).size, "duplicate certificate id").toBe(ids.length);
    for (const id of ids) expect(getCertificateGuide(id)).toBeDefined();
  });

  it("expects the disability fields on the disability certificate", () => {
    // This is the case the narrow ReadableField type used to hide: the reader
    // does return these, and the UI has to say so.
    expect(expectedFieldsFor("pwd_certificate")).toContain("isDifferentlyAbled");
    expect(expectedFieldsFor("pwd_certificate")).toContain("disabilityPercentage");
    expect(expectedFieldsFor("first_graduate_certificate")).toContain("isFirstGraduate");
  });

  it("does not claim a community certificate carries an income", () => {
    expect(expectedFieldsFor("community_certificate")).toEqual(["community"]);
  });

  it("never asks the student to type an Aadhaar number", () => {
    // A yes/no question like "is your bank account seeded with Aadhaar?" is fine
    // and some schemes genuinely require it. Asking for the 12-digit number is
    // not, so the rule is about collecting a number, not about the word.
    const asksForNumber = (label: string) =>
      /aadhaar|ஆதார்/i.test(label) && /number|எண்|number\b|digits/i.test(label);

    for (const cert of CERTIFICATE_GUIDES) {
      for (const field of cert.manualFields) {
        expect(asksForNumber(field.label), `${cert.id}: ${field.label}`).toBe(false);
      }
    }
    for (const field of MANUAL_ONLY_FIELDS) {
      expect(asksForNumber(field.label), field.field).toBe(false);
    }
  });

  it("states the never-collect rule for the Aadhaar number", () => {
    const entry = NEVER_COLLECT.find((n) => /aadhaar|ஆதார்/i.test(n.label));
    expect(entry, "Aadhaar must be listed as never collected").toBeDefined();
  });

  it("lists every readable field the type knows about", () => {
    expect(READABLE_FIELDS.length).toBeGreaterThan(0);
    for (const field of READABLE_FIELDS) expect(field).toBeTruthy();
    // The manual-only list is disjoint from what a document can prove, which is
    // the entire reason it exists.
    const manual = new Set(MANUAL_ONLY_FIELDS.map((f) => f.field));
    for (const field of READABLE_FIELDS) expect(manual.has(field)).toBe(false);
  });

  it("explains every never-collect entry", () => {
    for (const item of NEVER_COLLECT) {
      expect(item.why.length, item.label).toBeGreaterThan(10);
      expect(item.labelTa.length).toBeGreaterThan(1);
    }
  });
});
