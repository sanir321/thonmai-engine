import { NextResponse } from "next/server";
import { matchSchemes } from "@/engine/match";
import { ALL_SCHEMES, validateDataset } from "@data/index";
import { clientKey, rateLimit, toHeaders } from "@/lib/rate-limit";
import { matchBodySchema } from "@/lib/validation";
import type { HeldDocument, StudentProfile } from "@/engine/types";
import { currentUser } from "@/lib/auth/request";
import { jsonError } from "@/lib/api-response";

/**
 * POST /api/match — evaluate a profile against the whole catalogue.
 *
 * Account-only, and enforced here as well as in the page: gating the page alone
 * would leave the actual engine reachable by anyone who opened devtools. The
 * response itself is not stored anywhere; only what the student explicitly saves
 * via /api/profiles is.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return jsonError("Please log in to check your eligibility.", 401);
  }

  // Matching is cheap but not free, and this endpoint is the app's whole surface.
  // 30 a minute per client is far above what a real student needs.
  const limit = rateLimit(clientKey(req, "match"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryInSeconds: limit.resetIn },
      { status: 429, headers: { ...toHeaders(limit), "Retry-After": String(limit.resetIn) } },
    );
  }

  const problems = validateDataset();
  if (problems.length > 0) {
    return NextResponse.json(
      { error: "dataset_failed_validation", problems },
      { status: 500 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = matchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues.slice(0, 10) },
      { status: 400 },
    );
  }

  const report = matchSchemes(
    ALL_SCHEMES,
    parsed.data.profile as unknown as StudentProfile,
    parsed.data.documents as unknown as HeldDocument[],
    parsed.data.now ?? new Date().toISOString().slice(0, 10),
  );

  return NextResponse.json(report, { headers: toHeaders(limit) });
}
