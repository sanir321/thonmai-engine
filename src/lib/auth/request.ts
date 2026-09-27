import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/crypto";
import { resolveSession, type User } from "@/lib/auth/session-store";

/**
 * Only the session cookie is ever set, and it is HttpOnly + SameSite=Lax. A
 * cookie name prefix would add `__Host-` hardening, but it requires a secure
 * origin, which would break plain-HTTP local development.
 */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return resolveSession(token);
}

/**
 * The gate for the pages that do real work.
 *
 * Reading a cookie makes the page dynamic, which is the point: the checker is
 * now account-only, so it cannot be prerendered or crawled. `next` carries the
 * page the student was trying to reach so they land back there after signing in,
 * and is validated to be a same-site path so it cannot become an open redirect.
 */
export async function requireUser(next: string): Promise<User> {
  const user = await currentUser();
  if (user) return user;

  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/check";
  redirect(`/login?next=${encodeURIComponent(target)}`);
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions({ secure: await isHttps() }));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", sessionCookieOptions({ secure: await isHttps() }));
}

export async function isHttps(): Promise<boolean> {
  const list = await headers();
  const proto = list.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  return process.env.NODE_ENV === "production";
}

/**
 * Defence in depth for state-changing requests. SameSite=Lax already blocks
 * cross-site cookie-bearing POSTs, but a same-site subdomain or a misconfigured
 * proxy could still get through, so we also require the Origin header to match.
 *
 * A missing Origin is allowed: non-browser clients (curl, tests) legitimately
 * omit it, and they are not subject to CSRF in the first place.
 */
export async function isTrustedOrigin(): Promise<boolean> {
  const list = await headers();
  const origin = list.get("origin");
  if (!origin) return true;
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return false;

  const forwardedProto = list.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const expectedProto = forwardedProto ?? ((await isHttps()) ? "https" : "http");

  try {
    return new URL(origin).host === host && new URL(origin).protocol === `${expectedProto}:`;
  } catch {
    return false;
  }
}
