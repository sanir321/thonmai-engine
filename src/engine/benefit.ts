import type { BenefitComponent, BenefitSummary, BenefitCertainty } from "./types";

/** How many times a component is paid in a year. One-time items pay zero per year. */
const PERIODS_PER_YEAR: Record<BenefitComponent["period"], number> = {
  year: 1,
  per_semester: 2,
  month: 12,
  one_time: 0,
};

/** A one-time benefit is not recurring income unless explicitly marked so. */
export function isRecurring(c: BenefitComponent): boolean {
  return c.recurring ?? c.period !== "one_time";
}

/** Loan principal is debt. It never counts as benefit a student receives. */
export function isLoan(c: BenefitComponent): boolean {
  return c.kind === "loan";
}

function pointValue(c: BenefitComponent): number {
  if (c.min !== undefined && c.max !== undefined) return (c.min + c.max) / 2;
  if (c.min !== undefined) return c.min;
  if (c.max !== undefined) return c.max;
  return c.amount ?? 0;
}

export function annualise(c: BenefitComponent): number {
  if (!isRecurring(c)) return 0;
  return pointValue(c) * (PERIODS_PER_YEAR[c.period] ?? 1);
}

function validate(components: BenefitComponent[]): void {
  if (components.length === 0) {
    throw new Error("normaliseBenefit: at least one component is required");
  }
  for (const c of components) {
    const hasAny = c.amount !== undefined || c.min !== undefined || c.max !== undefined;
    if (!hasAny) {
      throw new Error(`normaliseBenefit: "${c.label}" has no amount, min or max`);
    }
    for (const [key, v] of [["amount", c.amount], ["min", c.min], ["max", c.max]] as const) {
      if (v !== undefined && !Number.isFinite(v)) {
        throw new Error(`normaliseBenefit: "${c.label}" has a non-numeric ${key}`);
      }
    }
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
      throw new Error(`normaliseBenefit: "${c.label}" has min ${c.min} above max ${c.max}`);
    }
    if (c.min !== undefined && c.min < 0) {
      throw new Error(`normaliseBenefit: "${c.label}" has a negative min`);
    }
  }
}

/**
 * A student can only receive one component from each `exclusiveGroup`, so we
 * keep the most valuable one and discard the rest. Without this, a staged
 * scheme (Classes 9-10 OR 11-12) would double-count in every later year.
 */
function pickWinners(components: BenefitComponent[]): BenefitComponent[] {
  const byGroup = new Map<string, BenefitComponent>();
  const loose: BenefitComponent[] = [];
  for (const c of components) {
    if (!c.exclusiveGroup) {
      loose.push(c);
      continue;
    }
    const held = byGroup.get(c.exclusiveGroup);
    if (!held || pointValue(c) > pointValue(held)) byGroup.set(c.exclusiveGroup, c);
  }
  return [...loose, ...byGroup.values()];
}

export function normaliseBenefit(
  components: BenefitComponent[],
  certainty: BenefitCertainty,
  note?: string,
): BenefitSummary {
  validate(components);

  const winners = pickWinners(components);
  const fundable = winners.filter((c) => !isLoan(c));
  const annualEstimate = fundable
    .filter(isRecurring)
    .reduce((sum, c) => sum + annualise(c), 0);
  const oneTimeValue = fundable
    .filter((c) => !isRecurring(c))
    .reduce((sum, c) => sum + pointValue(c), 0);
  const loanValue = winners
    .filter(isLoan)
    .reduce((sum, c) => sum + annualise(c), 0);

  const hasRange = components.some((c) => c.min !== undefined || c.max !== undefined);
  const hasGroups = components.some((c) => c.exclusiveGroup);
  const hasLoan = components.some(isLoan);
  const notes = [
    note,
    hasGroups ? "Only the highest applicable stage is counted." : undefined,
    hasRange ? "Ranges are shown at their midpoint." : undefined,
    hasLoan ? "Loan amounts are repayable debt and are not counted as benefit." : undefined,
  ]
    .filter((n): n is string => Boolean(n))
    .join(" ");

  return {
    components,
    annualEstimate,
    totalValue: annualEstimate + oneTimeValue,
    oneTimeValue,
    loanValue,
    certainty: hasRange && certainty === "exact" ? "estimated" : certainty,
    note: notes || undefined,
  };
}

export function combineCertainty(parts: BenefitCertainty[]): BenefitCertainty {
  if (parts.length === 0) return "exact";
  if (parts.includes("variable")) return "variable";
  if (parts.includes("estimated")) return "estimated";
  return "exact";
}

export function formatINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} crore`;
  if (abs >= 100000) return `₹${(n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
