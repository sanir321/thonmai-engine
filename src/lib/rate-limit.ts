/**
 * A fixed-window rate limiter, in memory, per process.
 *
 * This is deliberately small: it protects a public, free, single-node service
 * from a runaway client and from being used as a scraping oracle. It is not a
 * substitute for a shared store if this is ever run on more than one instance —
 * at that point swap the `Map` for Redis and keep the same interface.
 */

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  resetIn: number;
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Opportunistically drop expired buckets. Without this the map grows forever
 * and a scan-the-endpoints attacker becomes a memory leak.
 */
function sweep(now: number): void {
  if (buckets.size < 1024) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  { limit, windowMs, now = Date.now() }: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit, remaining: limit - 1, resetIn: windowMs / 1000 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return {
    ok: existing.count <= limit,
    limit,
    remaining,
    resetIn: Math.max(0, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Best-effort client identity.
 *
 * We trust `x-forwarded-for` only because this app is expected to sit behind a
 * proxy in production; when it is not, the header is simply absent and every
 * caller shares the "unknown" bucket, which fails closed rather than open.
 */
export function clientKey(req: Request, scope: string): string {
  const headers = req.headers;
  const fwd = headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

export function toHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.resetIn),
  };
}
