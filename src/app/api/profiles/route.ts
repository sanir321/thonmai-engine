import { NextResponse } from "next/server";
import { currentUser, isTrustedOrigin } from "@/lib/auth/request";
import { clientKey, rateLimit, toHeaders } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-response";
import { saveProfileBodySchema } from "@/lib/validation";
import { deleteProfile, listProfiles, saveProfile } from "@/lib/profiles/store";
import type { HeldDocument, StudentProfile } from "@/engine/types";

export const runtime = "nodejs";

const LIMIT = { limit: 60, windowMs: 60_000 };

/**
 * GET /api/profiles — the signed-in student's saved answers.
 * Anonymous callers get 401, never an empty list, so a client bug cannot look
 * like "you have no saved profiles" when the real problem is a missing cookie.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return jsonError("Please log in to see your saved profiles.", 401);

  const rl = rateLimit(clientKey(request, "profiles"), LIMIT);
  return NextResponse.json({ profiles: listProfiles(user.id) }, { headers: toHeaders(rl) });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isTrustedOrigin())) {
    return jsonError("Request blocked: untrusted origin.", 403);
  }

  const user = await currentUser();
  if (!user) return jsonError("Please log in to save your answers.", 401);

  const rl = rateLimit(clientKey(request, "profiles"), LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { ...toHeaders(rl), "Retry-After": String(rl.resetIn) } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("Request body must be JSON.", 400);
  }

  const parsed = saveProfileBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues.slice(0, 10) },
      { status: 400, headers: toHeaders(rl) },
    );
  }

  const { id, label, profile, documents } = parsed.data;

  // Passing the id of a profile owned by someone else updates nothing: the
  // UPDATE is scoped by user_id and falls through to an INSERT here.
  const saved = saveProfile({
    userId: user.id,
    id,
    label,
    profile: profile as unknown as StudentProfile,
    documents: documents as unknown as HeldDocument[],
  });

  return NextResponse.json({ profile: saved }, { status: id ? 200 : 201, headers: toHeaders(rl) });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  if (!(await isTrustedOrigin())) {
    return jsonError("Request blocked: untrusted origin.", 403);
  }

  const user = await currentUser();
  if (!user) return jsonError("Please log in to delete a profile.", 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Which profile should be deleted?", 400);

  const removed = deleteProfile(user.id, id);
  // 404 whether it was missing or simply not yours, so ids cannot be probed.
  if (!removed) return jsonError("That profile was not found.", 404);

  return NextResponse.json({ ok: true });
}
