"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Email and password only.
 *
 * There is deliberately no Aadhaar, OTP, or government login here: those would
 * mean handling identity documents this app has no business holding. A student
 * can use the checker entirely without an account, which is why nothing in the
 * eligibility flow depends on being signed in.
 */
export function AuthForm({
  mode,
  onModeChange,
  next,
}: {
  mode: "login" | "register";
  onModeChange?: (mode: "login" | "register") => void;
  next?: string;
}) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Only ever send a same-site path, so `?next=` cannot become an open redirect. */
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Something went wrong. Please try again.");
      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5" noValidate={false}>
      <div>
        <label className="label" htmlFor="email">
          Email
          <span className="ta block text-sm font-normal text-ink-soft">மின்னஞ்சல்</span>
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
          <span className="ta block text-sm font-normal text-ink-soft">கடவுச்சொல்</span>
        </label>
        <div className="flex gap-2">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 10 : undefined}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary shrink-0"
            onClick={() => setShowPassword((s) => !s)}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {isRegister ? (
          <p className="mt-2 text-sm text-ink-soft">
            <strong className="font-medium text-ink">
              {password.length >= 10 ? "✓" : "○"} At least 10 characters
            </strong>
            <span className="ta block">குறைந்தது 10 எழுத்துகள்</span>
            <span className="mt-1 block text-xs">
              A short sentence you will remember is stronger than one short word with
              symbols. We cannot recover it for you, so there is no reset link yet.
            </span>
          </p>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-md bg-clay-50 p-3 text-sm text-clay-800">
          <p className="font-medium">{error}</p>
          {error.includes("incorrect") && !isRegister ? (
            <p className="mt-1">
              Check the spelling of your email and try again. If you have never made an
              account, use the “Create account” tab.
            </p>
          ) : null}
        </div>
      ) : null}

      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : isRegister ? "Create my account" : "Log in"}
        <span className="ta block text-xs">
          {isRegister ? "கணக்கு உருவாக்கு" : "உள்ளே செல்"}
        </span>
      </button>

      {onModeChange ? (
        <p className="text-sm text-ink-soft">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button type="button" className="underline" onClick={() => onModeChange("login")}>
                Log in instead
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button type="button" className="underline" onClick={() => onModeChange("register")}>
                Create an account
              </button>
            </>
          )}
        </p>
      ) : null}
    </form>
  );
}
