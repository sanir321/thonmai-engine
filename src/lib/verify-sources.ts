import { SOURCES, OFFICIAL_SOURCE_COUNT, TOTAL_SOURCE_COUNT } from "@data/sources";
import { ALL_SCHEMES } from "@data/index";
import {
  TN_QUOTA_ROSTER,
  TN_HORIZONTAL_QUOTAS,
  TN_SPECIAL_QUOTAS,
} from "@data/quota";
import { probeUrls, type ProbeResult, type FetchOutcome } from "./http";

/**
 * Does the source this scheme rests on still exist?
 *
 * The product makes a promise: every benefit figure is traceable to a source we
 * actually read. That promise decays quietly — a G.O. gets superseded, a PDF moves,
 * a portal is rebuilt. This module is how we find out, so the promise stays honest.
 */

export type SourceKey = keyof typeof SOURCES;

/** How long a probe result is considered fresh. Government portals move slowly. */
export const PROBE_TTL_MS = 6 * 60 * 60 * 1000;

export interface SourceHealth {
  key: SourceKey;
  /** Other registry keys that cite this same document. */
  alsoCitedAs: SourceKey[];
  url: string;
  publisher: string;
  official: boolean;
  outcome: FetchOutcome;
  status: number | null;
  ms: number;
  error?: string;
  /** Schemes and quota rules that would lose a citation if this source died. */
  usedBy: string[];
  /** The date a human last read the document, from the registry. */
  lastHumanRead: string;
}

/**
 * Everything in the product that rests on a citation: the scheme catalogue *and*
 * the quota model. Quota records carry their own `sourceRefs` — the reservation
 * roster is sourced separately from any scheme — and a document that only backs a
 * quota rule is just as load-bearing as one that backs a benefit figure.
 */
function allCitedRecords(): { id: string; sourceRefs: { url: string }[] }[] {
  const quota = [
    ...TN_QUOTA_ROSTER,
    ...TN_HORIZONTAL_QUOTAS,
    ...TN_SPECIAL_QUOTAS,
  ];
  return [
    ...ALL_SCHEMES.map((s) => ({ id: `scheme:${s.id}`, sourceRefs: s.sourceRefs })),
    ...quota.map((q) => ({ id: `quota:${q.code}`, sourceRefs: q.sourceRefs })),
  ];
}

/**
 * Which schemes and quota rules cite each source.
 *
 * Keyed by URL rather than by registry key on purpose: the registry legitimately
 * cites one document for several different facts (the TNEA brochure backs the
 * reservation roster, the ex-servicemen quota and the sports quota). Probing and
 * attributing by key would report one of those three as "uncited" and probe the
 * same PDF twice, so we fold them together and keep every key that points at it.
 */
function buildUsageIndex(): Map<string, { keys: SourceKey[]; schemes: string[] }> {
  const byUrl = new Map<string, { keys: SourceKey[]; schemes: string[] }>();

  for (const [key, source] of Object.entries(SOURCES) as [SourceKey, (typeof SOURCES)[SourceKey]][]) {
    const entry = byUrl.get(source.url) ?? { keys: [], schemes: [] };
    entry.keys.push(key);
    byUrl.set(source.url, entry);
  }

  for (const record of allCitedRecords()) {
    for (const ref of record.sourceRefs) {
      const entry = byUrl.get(ref.url);
      if (entry && !entry.schemes.includes(record.id)) entry.schemes.push(record.id);
    }
  }

  return byUrl;
}

const USAGE = buildUsageIndex();

/** Distinct documents. Several keys may cite the same file. */
export const UNIQUE_SOURCE_URLS = [...USAGE.keys()];

/** Pure: fold raw probe results into a health report. No network, no I/O. */
export function summarise(results: ProbeResult[]): {
  health: SourceHealth[];
  dead: SourceHealth[];
  summary: {
    /** Distinct documents probed. */
    total: number;
    /** How many of those are official government documents. */
    official: number;
    /** Registry keys, which can exceed `total` when one document is cited twice. */
    registeredKeys: number;
    checked: number;
    ok: number;
    notFound: number;
    forbidden: number;
    serverError: number;
    unreachable: number;
    /** Official sources that failed. Anything above zero is a data-quality alarm. */
    officialFailures: number;
    /** Schemes that cite at least one official source. */
    schemesCoveredByOfficial: number;
  };
} {
  const health: SourceHealth[] = results.map((r) => {
    const keysForUrl = USAGE.get(r.url)?.keys ?? [];
    // Prefer an official key for the label when one exists.
    const key =
      (keysForUrl.find((k) => SOURCES[k].official) as SourceKey | undefined) ??
      keysForUrl[0] ??
      (r.url as SourceKey);
    const source = SOURCES[key];
    return {
      key,
      alsoCitedAs: keysForUrl.filter((k) => k !== key),
      url: r.url,
      publisher: source?.publisher ?? "unknown",
      official: source?.official ?? false,
      outcome: r.outcome,
      status: r.status,
      ms: r.ms,
      error: r.error,
      usedBy: USAGE.get(r.url)?.schemes ?? [],
      lastHumanRead: source?.retrievedAt ?? "unknown",
    };
  });

  const by = (o: FetchOutcome) => health.filter((h) => h.outcome === o);
  const schemesWithOfficial = new Set(
    health
      .filter((h) => h.official)
      .flatMap((h) => h.usedBy),
  );

  return {
    health,
    dead: health.filter((h) => h.outcome !== "ok"),
    summary: {
      // `total` counts documents, not registry keys: several keys can cite one PDF.
      total: health.length,
      official: health.filter((h) => h.official).length,
      registeredKeys: TOTAL_SOURCE_COUNT,
      checked: health.length,
      ok: by("ok").length,
      notFound: by("not_found").length,
      forbidden: by("forbidden").length,
      serverError: by("server_error").length,
      unreachable: by("unreachable").length,
      officialFailures: health.filter((h) => h.official && h.outcome !== "ok").length,
      schemesCoveredByOfficial: schemesWithOfficial.size,
    },
  };
}

export const ALL_SOURCE_URLS = UNIQUE_SOURCE_URLS;

export { OFFICIAL_SOURCE_COUNT, TOTAL_SOURCE_COUNT };

// ---------------------------------------------------------------------------
// Cache: a module-level memo so that hitting the endpoint in a loop does not
// turn us into a load generator against nic.in.
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number;
  value: ReturnType<typeof summarise>;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<CacheEntry> | null = null;

async function runProbe(): Promise<CacheEntry> {
  const results = await probeUrls(ALL_SOURCE_URLS, {
    timeoutMs: 10_000,
    concurrency: 6,
  });
  return { at: Date.now(), value: summarise(results) };
}

/** Returns a cached report if it is younger than the TTL, otherwise re-probes. */
export async function checkSources(
  { force = false, now = Date.now() }: { force?: boolean; now?: number } = {},
): Promise<ReturnType<typeof summarise> & { checkedAt: string; cached: boolean }> {
  if (!force && cache && now - cache.at < PROBE_TTL_MS) {
    return { ...cache.value, checkedAt: new Date(cache.at).toISOString(), cached: true };
  }

  // Collapse concurrent callers onto a single outbound sweep.
  inFlight ??= runProbe().finally(() => {
    inFlight = null;
  });
  cache = await inFlight;

  return { ...cache.value, checkedAt: new Date(cache.at).toISOString(), cached: false };
}
