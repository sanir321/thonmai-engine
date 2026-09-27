/**
 * A small, dependency-free HTTP client for the things this app does on the
 * outside world: checking that a government URL still resolves.
 *
 * Design rules, in order of importance:
 *  1. Never hang. Every request has a hard timeout, even if the socket does not.
 *  2. Never hammer. Concurrency is capped and there is a cool-down between runs.
 *  3. Say who you are. Government portals deserve a real User-Agent.
 *  4. Degrade quietly. A source check failing is a data-quality signal, not a
 *     reason to take the site down, so nothing here throws.
 */

const USER_AGENT =
  "ThonmaiSchemeBot/1.0 (scholarship eligibility checker; +https://github.com/thonmai)";

export type FetchOutcome = "ok" | "not_found" | "forbidden" | "server_error" | "unreachable";

export interface ProbeResult {
  url: string;
  outcome: FetchOutcome;
  status: number | null;
  /** Milliseconds spent, useful for spotting a portal that has become slow. */
  ms: number;
  error?: string;
}

export function classify(status: number): FetchOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404 || status === 410) return "not_found";
  if (status === 401 || status === 403 || status === 451) return "forbidden";
  if (status >= 500) return "server_error";
  // 3xx we did not follow, 4xx we cannot satisfy: treat as a soft problem.
  return "unreachable";
}

/** We only care whether the document is there, not what is inside it. */
async function probeOne(url: string, timeoutMs: number): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // HEAD first: cheap, and most servers support it.
    //
    // But a HEAD 404 is not to be trusted. Measured on scholarships.gov.in: it
    // answers 404 to HEAD and 206 to GET for the very same PDF, and answers 404
    // to HEAD on its own homepage. Treating a HEAD 404 as "deleted" produced a
    // full page of false alarms, so we re-ask with GET whenever HEAD looks
    // negative. Only a GET result is allowed to conclude anything.
    for (const method of ["HEAD", "GET"] as const) {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "*/*",
          ...(method === "GET" ? { Range: "bytes=0-1023" } : {}),
        },
      });

      // Release the socket; we never read the body.
      if (res.body) await res.body.cancel();

      if (method === "HEAD" && (res.status === 405 || res.status === 404)) continue;
      if (method === "HEAD" && res.status >= 500) continue;

      return { url, outcome: classify(res.status), status: res.status, ms: Date.now() - started };
    }

    return {
      url,
      outcome: "unreachable",
      status: null,
      ms: Date.now() - started,
      error: "no reliable answer from HEAD or GET",
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      url,
      outcome: "unreachable",
      status: null,
      ms: Date.now() - started,
      error: aborted ? `timed out after ${timeoutMs}ms` : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Run `tasks` with at most `limit` in flight, preserving input order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await fn(item);
    }
  });

  await Promise.all(workers);
  return results;
}

export interface ProbeOptions {
  timeoutMs?: number;
  concurrency?: number;
}

export async function probeUrls(
  urls: string[],
  { timeoutMs = 10_000, concurrency = 6 }: ProbeOptions = {},
): Promise<ProbeResult[]> {
  return pool(urls, concurrency, (url) => probeOne(url, timeoutMs));
}
