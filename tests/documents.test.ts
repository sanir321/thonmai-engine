import { describe, expect, it } from "vitest";
import { DOC_BY_TYPE, DOCUMENT_SPECS, docLabel } from "@data/documents";
import { documentWarnings } from "@/engine/match";
import { ALL_SCHEMES, SCHEME_BY_ID } from "@data/index";
import type { DocumentType, HeldDocument, Scheme } from "@/engine/types";

const held = (over: Partial<HeldDocument> = {}): HeldDocument => ({
  type: "community_certificate",
  confirmed: true,
  ...over,
});

describe("document registry", () => {
  it("covers every document type used by the dataset", () => {
    const used = new Set(ALL_SCHEMES.flatMap((s) => s.documents.map((d) => d.type)));
    for (const type of used) {
      expect(DOC_BY_TYPE[type], `missing spec for ${type}`).toBeDefined();
    }
  });

  it("gives every document a Tamil label and an issuing authority", () => {
    for (const d of DOCUMENT_SPECS) {
      expect(d.labelTa, d.type).toBeTruthy();
      expect(d.issuingAuthority, d.type).toBeTruthy();
      expect(d.issuingAuthorityTa, d.type).toBeTruthy();
    }
  });

  it("marks REV-102 nativity as e-certificate only, issued by a Tahsildar", () => {
    const nativity = DOC_BY_TYPE["nativity_certificate"];
    expect(nativity.eCertificateOnly).toBe(true);
    expect(nativity.issuingAuthority).toMatch(/tahsildar/i);
  });

  it("requires a Deputy Tahsildar for the first-graduate certificate", () => {
    expect(DOC_BY_TYPE["first_graduate_certificate"].issuingAuthority).toMatch(/deputy tahsildar/i);
  });

  it("issues the disability certificate from a medical board, with UDID as a separate step", () => {
    // TN issues the certificate physically via a Medical Board; UDID
    // registration is a distinct, additional document.
    expect(DOC_BY_TYPE["pwd_certificate"].issuingAuthority).toMatch(/medical board/i);
    expect(DOC_BY_TYPE["pwd_certificate"].validityNote).toMatch(/udid/i);
    expect(DOC_BY_TYPE["udid"]).toBeDefined();
  });

  it("names UIDAI for Aadhaar", () => {
    expect(DOC_BY_TYPE["aadhaar"].issuingAuthority).toMatch(/uidai/i);
  });

  it("records a validity note for time-limited revenue certificates", () => {
    expect(DOC_BY_TYPE["income_certificate"].validityNote).toBeTruthy();
  });

  it("tells the student how to obtain documents that must be applied for", () => {
    for (const d of DOCUMENT_SPECS.filter((x) => x.acquisition === "apply")) {
      expect(d.howToObtain, d.type).toBeTruthy();
    }
  });

  it("labels every type for the UI", () => {
    for (const type of Object.keys(DOC_BY_TYPE) as DocumentType[]) {
      expect(docLabel(type)).toBeTruthy();
    }
  });
});

describe("document warnings", () => {
  const scheme = SCHEME_BY_ID["tn_bc_postmatric"] as Scheme;

  it("warns when a required certificate has expired", () => {
    const docs = [held({ type: "income_certificate", expiresOn: "2019-06-01" })];
    expect(documentWarnings(scheme, docs, "2026-10-01").join(" ")).toMatch(/expired|valid/i);
  });

  it("stays silent on a certificate with no expiry date", () => {
    const docs = [held({ type: "income_certificate" })];
    expect(documentWarnings(scheme, docs, "2026-10-01")).toHaveLength(0);
  });

  it("accepts a certificate still inside its validity window", () => {
    const docs = [held({ type: "income_certificate", expiresOn: "2099-01-01" })];
    expect(documentWarnings(scheme, docs, "2026-10-01")).toHaveLength(0);
  });

  it("treats the expiry date itself as the last valid day", () => {
    const docs = [held({ type: "income_certificate", expiresOn: "2026-10-01" })];
    expect(documentWarnings(scheme, docs, "2026-10-01")).toHaveLength(0);
  });

  it("stays silent about a nativity certificate the scheme never requests", () => {
    const docs = [held({ type: "nativity_certificate", issuingAuthority: "Village office" })];
    expect(scheme.documents.map((d) => d.type)).not.toContain("nativity_certificate");
    expect(documentWarnings(scheme, docs, "2026-10-01")).toHaveLength(0);
  });

  it("warns about a hand-issued nativity certificate where one is required", () => {
    const nativityScheme = SCHEME_BY_ID["tn_bc_pg_institutions"] as Scheme;
    expect(nativityScheme.documents.map((d) => d.type)).toContain("nativity_certificate");
    const docs = [held({ type: "nativity_certificate", issuingAuthority: "Village office" })];
    expect(documentWarnings(nativityScheme, docs, "2026-10-01").join(" ")).toMatch(
      /nativ|tahsildar|e-Certificate/i,
    );
  });

  it("accepts a nativity certificate issued through the portal", () => {
    const nativityScheme = SCHEME_BY_ID["tn_bc_pg_institutions"] as Scheme;
    const docs = [
      held({ type: "nativity_certificate", issuingAuthority: "Tahsildar via tnesevai.tn.gov.in" }),
    ];
    expect(documentWarnings(nativityScheme, docs, "2026-10-01")).toHaveLength(0);
  });

  it("ignores documents the scheme does not ask for", () => {
    const docs = [held({ type: "marksheet_10", expiresOn: "2000-01-01" })];
    expect(documentWarnings(scheme, docs, "2026-10-01")).toHaveLength(0);
  });
});
