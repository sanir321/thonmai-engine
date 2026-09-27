import { NextResponse } from "next/server";
import { clearSessionCookie, isTrustedOrigin } from "@/lib/auth/request";
import { destroySession } from "@/lib/auth/session-store";
import { SESSION_COOKIE } from "@/lib/auth/crypto";
import { cookies } from "next/headers";
import { jsonError } from "@/lib/api-response";

export const runtime = "nodejs";

/**
 * Idempotent by design: logging out twice, or without a session, still succeeds.
 * A logout that errors on a missing session would leak whether one existed.
 */
export async function POST(): Promise<NextResponse> {
  if (!(await isTrustedOrigin())) {
    return jsonError("Request blocked: untrusted origin.", 403);
  }

  const jar = await cookies();
  destroySession(jar.get(SESSION_COOKIE)?.value);
  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
