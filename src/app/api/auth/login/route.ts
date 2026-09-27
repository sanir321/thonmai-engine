import { NextResponse } from "next/server";
import { loginSchema, INVALID_CREDENTIALS } from "@/lib/auth/validation";
import { verifyPassword } from "@/lib/auth/crypto";
import { createSession, findUserByEmail } from "@/lib/auth/session-store";
import { setSessionCookie, isTrustedOrigin, currentUser } from "@/lib/auth/request";
import { rateLimit, clientKey, toHeaders } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-response";

export const runtime = "nodejs";

/**
 * Tight on purpose: this is the endpoint a password-spraying attack would hit,
 * and each attempt costs a deliberate bcrypt comparison.
 */
const LIMIT = { limit: 10, windowMs: 15 * 60_000 };

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isTrustedOrigin())) {
    return jsonError("Request blocked: untrusted origin.", 403);
  }

  const rl = rateLimit(clientKey(request, "auth-login"), LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: toHeaders(rl) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be JSON.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(INVALID_CREDENTIALS, 401);
  }

  const record = findUserByEmail(parsed.data.email);
  // `verifyPassword` runs a comparison even when the account is unknown, so the
  // two failure modes take indistinguishable time.
  const ok = await verifyPassword(parsed.data.password, record?.passwordHash ?? null);

  if (!record || !ok) {
    return jsonError(INVALID_CREDENTIALS, 401);
  }

  const { token } = createSession(record.id);
  await setSessionCookie(token);

  return NextResponse.json(
    { user: { id: record.id, email: record.email } },
    { headers: toHeaders(rl) },
  );
}

/**
 * Reports who is signed in.
 *
 * Returns 401 rather than 200-with-a-null-user so that `response.ok` means
 * "signed in" everywhere. A 200 here would make every caller that checks
 * `res.ok` — including the navigation link — believe there is a session.
 */
export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return jsonError("No active session.", 401);
  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
