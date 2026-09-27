import { describe, expect, it } from "vitest";
import { formatINR, normaliseBenefit } from "@/engine/benefit";
import { ALL_SCHEMES } from "@data/index";

describe("normaliseBenefit", () => {
  it("marks a single recurring amount as exact", () => {
    const b = normaliseBenefit([{ label: "Scholarship", amount: 20000, period: "year" }], "exact");
    expect(b.annualEstimate).toBe(20000);
    expect(b.certainty).toBe("exact");
  });

  it("converts a monthly amount to an annual estimate", () => {
    const b = normaliseBenefit([{ label: "Stipend", amount: 1000, period: "month" }], "exact");
    expect(b.annualEstimate).toBe(12000);
  });

  it("counts a per-semester amount twice a year", () => {
    const b = normaliseBenefit([{ label: "Term grant", amount: 5000, period: "per_semester" }], "exact");
    expect(b.annualEstimate).toBe(10000);
  });

  it("uses the midpoint of a range and downgrades certainty", () => {
    const b = normaliseBenefit(
      [{ label: "Tuition", min: 20000, max: 40000, period: "year" }],
      "exact",
    );
    expect(b.annualEstimate).toBe(30000);
    expect(b.certainty).toBe("estimated");
    expect(b.note).toMatch(/midpoint/i);
  });

  it("excludes a one-time benefit from the annual income figure", () => {
    const b = normaliseBenefit([{ label: "Laptop", amount: 45000, period: "one_time" }], "estimated");
    // A laptop is not recurring income.
    expect(b.annualEstimate).toBe(0);
    expect(b.oneTimeValue).toBe(45000);
    expect(b.totalValue).toBe(45000);
  });

  it("keeps one-time value separate from recurring value", () => {
    const b = normaliseBenefit(
      [
        { label: "Scholarship", amount: 20000, period: "year" },
        { label: "Laptop", amount: 45000, period: "one_time" },
      ],
      "estimated",
    );
    expect(b.annualEstimate).toBe(20000);
    expect(b.totalValue).toBe(65000);
  });

  it("sums several independent components", () => {
    const b = normaliseBenefit(
      [
        { label: "Tuition", amount: 20000, period: "year" },
        { label: "Maintenance", amount: 6000, period: "year" },
      ],
      "exact",
    );
    expect(b.annualEstimate).toBe(26000);
  });

  it("takes the largest, not the sum, of mutually exclusive stages", () => {
    // Classes 9-10 OR 11-12: a student claims one stage, never both.
    const b = normaliseBenefit(
      [
        { label: "Classes 9-10", amount: 12000, period: "year", exclusiveGroup: "stage" },
        { label: "Classes 11-12", amount: 20000, period: "year", exclusiveGroup: "stage" },
      ],
      "estimated",
    );
    expect(b.annualEstimate).toBe(20000);
  });

  it("sums across different exclusive groups independently", () => {
    const b = normaliseBenefit(
      [
        { label: "Stage A", amount: 12000, period: "year", exclusiveGroup: "stage" },
        { label: "Stage B", amount: 20000, period: "year", exclusiveGroup: "stage" },
        { label: "Book grant", amount: 5000, period: "year", exclusiveGroup: "books" },
        { label: "Books alt", amount: 3000, period: "year", exclusiveGroup: "books" },
      ],
      "estimated",
    );
    expect(b.annualEstimate).toBe(25000);
  });

  it("rejects an empty component list", () => {
    expect(() => normaliseBenefit([], "exact")).toThrow();
  });

  it("rejects a range whose minimum exceeds its maximum", () => {
    expect(() =>
      normaliseBenefit([{ label: "Bad", min: 90000, max: 1000, period: "year" }], "exact"),
    ).toThrow();
  });

  it("rejects a non-numeric amount", () => {
    expect(() =>
      normaliseBenefit([{ label: "Bad", amount: Number.NaN, period: "year" }], "exact"),
    ).toThrow();
  });
});

describe("loans are not benefit income", () => {
  const loan = {
    label: "Education loan",
    amount: 500000,
    period: "year",
    kind: "loan",
  } as const;
  const stipend = { label: "Stipend", amount: 12000, period: "year" } as const;

  it("excludes loan principal from the annual estimate", () => {
    const b = normaliseBenefit([loan], "variable");
    expect(b.annualEstimate).toBe(0);
    expect(b.totalValue).toBe(0);
  });

  it("still reports the loan separately so it is not hidden", () => {
    const b = normaliseBenefit([loan], "variable");
    expect(b.loanValue).toBe(500000);
  });

  it("adds grants and loans without letting the loan inflate the total", () => {
    const b = normaliseBenefit([stipend, loan], "variable");
    expect(b.annualEstimate).toBe(12000);
    expect(b.oneTimeValue).toBe(0);
    expect(b.loanValue).toBe(500000);
  });

  it("tells the reader the loan is not a benefit", () => {
    const b = normaliseBenefit([loan], "variable");
    expect(b.note).toMatch(/repayable debt/i);
  });

  it("a loan-only scheme contributes nothing to a claimable stack", () => {
    const loanOnly = normaliseBenefit([loan], "variable");
    const grantsOnly = normaliseBenefit([stipend], "variable");
    expect(loanOnly.annualEstimate + grantsOnly.annualEstimate).toBe(12000);
  });
});

describe("formatINR", () => {
  it("uses lakh and crore for large sums", () => {
    expect(formatINR(45000)).toMatch(/45,000/);
    expect(formatINR(250000)).toMatch(/lakh/);
    expect(formatINR(10000000)).toMatch(/crore/);
  });

  it("renders zero without NaN", () => {
    expect(formatINR(0)).toMatch(/0/);
    expect(formatINR(0)).not.toMatch(/NaN/);
  });
});

describe("dataset benefit sanity", () => {
  it("keeps every live scheme's estimate finite and non-negative", () => {
    for (const s of ALL_SCHEMES) {
      expect(Number.isFinite(s.benefit.annualEstimate), s.id).toBe(true);
      expect(s.benefit.annualEstimate, s.id).toBeGreaterThanOrEqual(0);
      expect(s.benefit.totalValue, s.id).toBeGreaterThanOrEqual(s.benefit.annualEstimate);
    }
  });

  it("excludes every one-time component from the annual income total", () => {
    for (const s of ALL_SCHEMES) {
      const oneTime = s.benefit.components.filter((c) => c.period === "one_time");
      for (const c of oneTime) {
        expect(c.recurring ?? false, `${s.id}/${c.label}`).toBe(false);
      }
    }
  });

  it("never reports zero value for a live scheme with a cash component", () => {
    // A loan-only scheme is the one legitimate zero: the money is debt.
    const offenders = ALL_SCHEMES.filter(
      (s) =>
        s.status === "live" &&
        s.benefit.totalValue === 0 &&
        s.benefit.loanValue === 0 &&
        s.benefit.components.length > 0,
    );
    expect(offenders.map((o) => o.id)).toEqual([]);
  });

  it("keeps every loan out of the reported benefit totals", () => {
    for (const s of ALL_SCHEMES) {
      const loanPrincipal = s.benefit.components
        .filter((c) => c.kind === "loan")
        .reduce((sum, c) => sum + (c.amount ?? 0), 0);
      if (loanPrincipal > 0) {
        expect(s.benefit.totalValue, `${s.id} must not count a loan as benefit`).toBeLessThan(
          loanPrincipal + 1,
        );
      }
    }
  });
});
