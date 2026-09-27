import { NextResponse } from "next/server";
import { registerSchema, INVALID_CREDENTIALS } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/crypto";
import { createSession, createUser, findUserByEmail } from "@/lib/auth/session-store";
import { setSessionCookie, isTrustedOrigin, currentUser } from "@/lib/auth/request";
import { rateLimit, clientKey, toHeaders } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-response";

export const runtime = "nodejs";

/**
 * Registration is expensive (bcrypt cost 12) and a spam target, so it is tight.
 */
const LIMIT = { limit: 5, windowMs: 15 * 60_000 };

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isTrustedOrigin())) {
    return jsonError("Request blocked: untrusted origin.", 403);
  }

  const rl = rateLimit(clientKey(request, "auth-register"), LIMIT);
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

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid details.", 400);
  }

  const { email, password } = parsed.data;

  if (findUserByEmail(email)) {
    // The wording is deliberately identical to a failed login, so a casual
    // reader learns nothing.
    //
    // The 409 does still leak the fact that an address is registered to anyone
    // reading status codes, and this comment used to claim it could not. It can,
    // so the honest options are: close it with an email-verification step, which
    // needs an email provider this project does not have, or accept the signal
    // and pay for it with the rate limit above. We accept it, because the
    // alternative is telling a student who has already registered that their
    // password is wrong, which loses them. See README, "Known limits".
    return jsonError(INVALID_CREDENTIALS, 409);
  }

  const passwordHash = await hashPassword(password);
  const user = createUser(email, passwordHash);
  const { token } = createSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json(
    { user: { id: user.id, email: user.email } },
    { status: 201, headers: toHeaders(rl) },
  );
}

/** Lets the client decide whether to show "log in" or "register" on mount. */
export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  return NextResponse.json({ user: user ? { id: user.id, email: user.email } : null });
}
