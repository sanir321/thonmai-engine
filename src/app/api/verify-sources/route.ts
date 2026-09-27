import { checkSources } from "@/lib/verify-sources";
import { clientKey, rateLimit, toHeaders } from "@/lib/rate-limit";

/**
 * GET /api/verify-sources — are the documents behind our benefit numbers still online?
 *
 * Results are cached for six hours per process. `?refresh=1` forces a re-probe but
 * is rate limited hard, because a re-probe fans out to one request per unique
 * government servers and we should not let anyone trigger that on a loop.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";
  const scope = force ? "verify-force" : "verify";

  // A forced sweep is one request per unique document across .gov.in hosts, so
  // it stays tightly limited: 2 per 10 minutes.
  const limit = rateLimit(clientKey(req, scope), {
    limit: force ? 2 : 30,
    windowMs: force ? 600_000 : 60_000,
  });
  if (!limit.ok) {
    return Response.json(
      { error: "rate_limited", retryInSeconds: limit.resetIn },
      { status: 429, headers: { ...toHeaders(limit), "Retry-After": String(limit.resetIn) } },
    );
  }

  try {
    const report = await checkSources({ force });

    // 200 even when sources are dead: the report describing a broken citation is
    // still a successful verification, and clients need the body either way.
    return Response.json(
      {
        checkedAt: report.checkedAt,
        cached: report.cached,
        summary: report.summary,
        problems: report.dead.map((h) => ({
          key: h.key,
          publisher: h.publisher,
          official: h.official,
          outcome: h.outcome,
          status: h.status,
          error: h.error,
          affected: h.usedBy,
        })),
      },
      {
        headers: {
          ...toHeaders(limit),
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
        },
      },
    );
  } catch {
    // A verification outage must not look like a data problem to a student.
    return Response.json(
      { error: "verification_unavailable" },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }
}
