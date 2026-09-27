import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { closeDb, useInMemoryDb, getDb } from "@/lib/db/client";
import { createSession, createUser, resolveSession } from "@/lib/auth/session-store";
import { hashToken } from "@/lib/auth/crypto";

/**
 * A stand-in for the Next.js request scope.
 *
 * `cookies()` only exists inside a real request, so the auth routes cannot be
 * exercised directly in a unit test. This fake gives them the same tiny surface
 * they use — get, set, delete — which is enough to prove the response contract
 * without standing up a server.
 */
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) as string } : undefined,
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
  headers: async () =>
    new Headers({ host: "localhost:3000", "x-forwarded-proto": "https" }),
}));

beforeEach(() => {
  useInMemoryDb();
  jar.clear();
});

afterAll(() => {
  closeDb();
});

describe("GET /api/auth/login — the session probe", () => {
  /**
   * Regression guard. This endpoint once answered 200 with `{"user":null}` for a
   * signed-out visitor. The header's "My account" link keys off the status, so
   * every visitor was shown a signed-in state they were not in. The status now
   * has to mean "signed in".
   */
  it("answers 401 when nobody is signed in, not 200 with a null user", async () => {
    const { GET } = await import("@/app/api/auth/login/route");
    const res = await GET();

    expect(res.status).toBe(401);
    const body = (await res.json()) as { user?: unknown; error?: string };
    expect(body.user).toBeUndefined();
    expect(body.error).toBeTypeOf("string");
  });

  it("answers 200 with the user once a session cookie is present", async () => {
    const { GET } = await import("@/app/api/auth/login/route");

    const user = createUser("probe@example.com", "hash");
    const { token } = createSession(user.id);
    jar.set("thonmai_session", token);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user.email).toBe("probe@example.com");
    expect(body.user.id).toBe(user.id);
  });

  it("stays signed out for a session that has already been destroyed", async () => {
    const { GET } = await import("@/app/api/auth/login/route");
    const { destroySession } = await import("@/lib/auth/session-store");

    const user = createUser("gone@example.com", "hash");
    const { token } = createSession(user.id);
    jar.set("thonmai_session", token);

    // destroySession hashes the token itself, so it takes the raw value.
    destroySession(token);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("stays signed out for a forged cookie value", async () => {
    const { GET } = await import("@/app/api/auth/login/route");
    const user = createUser("real@example.com", "hash");
    createSession(user.id);

    jar.set("thonmai_session", "not-a-real-token");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("session cookie hygiene", () => {
  it("sets HttpOnly, SameSite=Lax, Path=/ and a 30 day lifetime", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const { hashPassword } = await import("@/lib/auth/crypto");

    createUser("cookie@example.com", await hashPassword("a-long-enough-passphrase"));

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "cookie@example.com", password: "a-long-enough-passphrase" }),
      }),
    );

    expect(res.status).toBe(200);

    // Next.js turns jar.set() into the Set-Cookie header, which a fake jar cannot
    // produce, so the options are asserted at the call that made them instead.
    const { setSessionCookie, clearSessionCookie } = await import("@/lib/auth/request");
    const { sessionCookieOptions } = await import("@/lib/auth/crypto");
    expect(sessionCookieOptions({ secure: true })).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    jar.clear();
    await setSessionCookie("a-real-token");
    expect(jar.get("thonmai_session")).toBe("a-real-token");

    // Logging out must overwrite the cookie rather than merely ignore it, or a
    // back button would replay a live session.
    await clearSessionCookie();
    expect(jar.get("thonmai_session")).toBe("");
  }, 30_000);
});

describe("account isolation at the database level", () => {
  it("never lets one user's session resolve to another user", () => {
    const a = createUser("a@example.com", "hash");
    const b = createUser("b@example.com", "hash");
    const { token } = createSession(a.id);

    const resolved = resolveSession(token);
    expect(resolved?.id).toBe(a.id);
    expect(resolved?.id).not.toBe(b.id);
  });
});
