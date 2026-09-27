import type { Scheme } from "@/engine/types";
import { TN_SCHEMES } from "./schemes-tn";
import { CENTRAL_SCHEMES } from "./schemes-central";
import { DOCUMENT_SPECS } from "./documents";
import {
  TN_QUOTA_ROSTER,
  TN_QUOTA_BLOCKS,
  blockShare,
  TN_SPECIAL_QUOTAS,
  TN_HORIZONTAL_QUOTAS,
  CENTRAL_RESERVATION,
  CENTRAL_EWS_RULE,
} from "./quota";
import { SOURCES, OFFICIAL_SOURCE_COUNT, TOTAL_SOURCE_COUNT } from "./sources";

export const ALL_SCHEMES: Scheme[] = [...TN_SCHEMES, ...CENTRAL_SCHEMES];

export const SCHEME_BY_ID: Record<string, Scheme> = Object.fromEntries(
  ALL_SCHEMES.map((s) => [s.id, s]),
);

export function schemesForLevel(level: string): Scheme[] {
  return ALL_SCHEMES.filter((s) => s.status === "live" && s.level.includes(level as never));
}

export {
  TN_SCHEMES,
  CENTRAL_SCHEMES,
  DOCUMENT_SPECS,
  TN_QUOTA_ROSTER,
  TN_QUOTA_BLOCKS,
  blockShare,
  TN_SPECIAL_QUOTAS,
  TN_HORIZONTAL_QUOTAS,
  CENTRAL_RESERVATION,
  CENTRAL_EWS_RULE,
  SOURCES,
  OFFICIAL_SOURCE_COUNT,
  TOTAL_SOURCE_COUNT,
};

/**
 * Dataset integrity checks. These run in the test suite AND are exported so a
 * failed ingest can be caught at seed time rather than in production.
 */
export function validateDataset(schemes: Scheme[] = ALL_SCHEMES): string[] {
  const errors: string[] = [];

  const ids = new Set<string>();
  for (const s of schemes) {
    if (ids.has(s.id)) errors.push(`Duplicate scheme id: ${s.id}`);
    ids.add(s.id);
    if (s.sourceRefs.length === 0) errors.push(`${s.id}: has no sourceRefs`);
    // In-kind benefits (a bicycle, a laptop) are worth real money but produce
    // no recurring income, so the total must be positive while the annual
    // figure may legitimately be zero. A loan-only scheme is also legitimately
    // zero: the money is repayable debt, tracked in `loanValue`.
    const worthSomething = s.benefit.totalValue > 0 || s.benefit.loanValue > 0;
    if (!worthSomething) errors.push(`${s.id}: benefit totalValue must be positive`);
    if (s.benefit.annualEstimate > s.benefit.totalValue) {
      errors.push(`${s.id}: annualEstimate exceeds the total one can actually receive`);
    }
    if (s.summary.trim().length < 20) errors.push(`${s.id}: summary is too thin to be useful`);
    for (const d of s.documents) {
      if (!DOCUMENT_SPECS.some((spec) => spec.type === d.type)) {
        errors.push(`${s.id}: unknown document type "${d.type}"`);
      }
    }
  }

  for (const q of TN_QUOTA_BLOCKS) {
    if (q.percentage === null) errors.push(`Quota block ${q.code} has no percentage`);
  }
  const blockSum = TN_QUOTA_BLOCKS.reduce((s, q) => s + blockShare(q), 0);
  if (Math.abs(blockSum - 100) > 0.001) {
    errors.push(`TN quota blocks sum to ${blockSum}, expected 100`);
  }

  const ocBlock = TN_QUOTA_BLOCKS.find((q) => q.code === "OC");
  const reservedSum = blockSum - (ocBlock ? blockShare(ocBlock) : 0);
  if (Math.abs(reservedSum - 69) > 0.001) {
    errors.push(`TN reserved share is ${reservedSum}%, expected 69%`);
  }

  // Each block's members (its own share plus its sub-quotas) must add up to
  // the block total. A grouping node such as MBC holds no seats of its own,
  // so its sub-quotas must fill the whole block.
  for (const block of TN_QUOTA_BLOCKS) {
    const subs = TN_QUOTA_ROSTER.filter((r) => r.parentCode === block.code);
    if (subs.length === 0) continue;
    const head = block.isGroupingNode ? 0 : (block.percentage ?? 0);
    const subSum = subs.reduce((s, r) => s + (r.percentage ?? 0), 0);
    if (Math.abs(head + subSum - blockShare(block)) > 0.001) {
      errors.push(
        `Members of block ${block.code} sum to ${head + subSum}%, but the block is ${blockShare(block)}%`,
      );
    }
  }

  for (const q of TN_QUOTA_ROSTER.filter((r) => r.isSubQuota)) {
    const parent = TN_QUOTA_ROSTER.find((r) => r.code === q.parentCode);
    if (!parent) errors.push(`Sub-quota ${q.code} has no parent block`);
    else if ((q.percentage ?? 0) > (parent.percentage ?? 0)) {
      errors.push(`Sub-quota ${q.code} (${q.percentage}%) exceeds parent ${parent.code} (${parent.percentage}%)`);
    }
  }

  const centralSum = CENTRAL_RESERVATION.reduce((s, c) => s + c.percentage, 0);
  if (Math.abs(centralSum - 100) > 0.001) {
    errors.push(`Central reservation sums to ${centralSum}, expected 100`);
  }

  for (const s of schemes) {
    if (s.sourceRefs.every((r) => !r.official)) {
      // Allowed, but the UI must label it. We only warn if it is the sole source.
      if (s.sourceRefs.length === 1) {
        errors.push(`${s.id}: sole source is non-official and must be labelled low confidence`);
      }
    }
  }

  return errors;
}

export const DATASET_STATS = {
  totalSchemes: ALL_SCHEMES.length,
  stateSchemes: TN_SCHEMES.length,
  centralSchemes: CENTRAL_SCHEMES.length,
  liveSchemes: ALL_SCHEMES.filter((s) => s.status === "live").length,
  documentTypes: DOCUMENT_SPECS.length,
  sources: TOTAL_SOURCE_COUNT,
  officialSources: OFFICIAL_SOURCE_COUNT,
  quotaCategories: TN_QUOTA_ROSTER.length,
  specialQuotas: TN_SPECIAL_QUOTAS.length + TN_HORIZONTAL_QUOTAS.length,
  conflicts: ALL_SCHEMES.reduce((n, s) => n + (s.conflicts?.length ?? 0), 0),
} as const;
