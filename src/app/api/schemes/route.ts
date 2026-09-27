import { ALL_SCHEMES, DATASET_STATS, validateDataset } from "@data/index";
import { clientKey, rateLimit, toHeaders } from "@/lib/rate-limit";

/** GET /api/schemes — the public catalogue. Supports ?level= and ?authority=. */
export async function GET(req: Request) {
  const limit = rateLimit(clientKey(req, "schemes"), { limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return Response.json(
      { error: "rate_limited", retryInSeconds: limit.resetIn },
      { status: 429, headers: { ...toHeaders(limit), "Retry-After": String(limit.resetIn) } },
    );
  }

  const url = new URL(req.url);
  const level = url.searchParams.get("level");
  const authority = url.searchParams.get("authority");
  const status = url.searchParams.get("status") ?? "live";

  const problems = validateDataset();
  if (problems.length > 0) {
    return Response.json({ error: "dataset_failed_validation", problems }, { status: 500 });
  }

  const filtered = ALL_SCHEMES.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (level && !s.level.includes(level as never)) return false;
    if (authority && s.authority !== authority) return false;
    return true;
  });

  return Response.json(
    {
      stats: DATASET_STATS,
      count: filtered.length,
      schemes: filtered,
    },
    { headers: { ...toHeaders(limit), "Cache-Control": "public, max-age=300" } },
  );
}
