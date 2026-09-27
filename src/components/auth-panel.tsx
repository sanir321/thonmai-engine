"use client";

import { useState } from "react";
import { AuthForm } from "@/components/auth-form";

const PERKS = [
  {
    en: "Unlocks the eligibility checker — that is what the account is for",
    ta: "உரிமைச் சரிபார்ப்பு இதற்குத் தான் கணக்கு",
  },
  {
    en: "Saves your answers, so the next check takes seconds",
    ta: "உங்கள் பதில்களைச் சேமித்து விரைவில் முடியும்",
  },
  {
    en: "Stores only your email, a password hash, and the answers you choose to save",
    ta: "மின்னஞ்சல், கடவுச்சொல் மற்றும் நீங்கள் சேமிக்கும் பதில்கள் மட்டுமே",
  },
];

/**
 * One page for both signing in and creating an account.
 *
 * The account is what unlocks the checker, so the tabs sit below a plain
 * statement of exactly what it buys — and, just as plainly, what is stored. A
 * student should be able to see the price of this before paying it.
 */
export function AuthPanel({
  initialMode,
  next,
}: {
  initialMode: "login" | "register";
  next?: string;
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const isRegister = mode === "register";

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold">What an account is for</h2>
        <p className="ta mt-0.5 text-sm text-ink-soft">கணக்கு எதற்கு?</p>
        <p className="mt-2 text-sm text-ink-soft">
          An account takes a minute, needs only an email and a password, and is the
          only way to run the eligibility check.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {PERKS.map((p) => (
            <li key={p.en} className="flex gap-2">
              <span aria-hidden="true" className="text-clay-600">✓</span>
              <span>
                {p.en}
                <span className="ta block text-ink-soft">{p.ta}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-soft">
          <strong className="font-medium text-ink">
            We never ask for an Aadhaar number.
          </strong>{" "}
          Nor a bank account, a phone number, or an OTP. Your password is stored only
          as a one-way hash, and a session cookie is what keeps you signed in — it
          expires after 30 days.
          <span className="ta block">ஆதார் எண் ஒருபோதும் கேட்கப்படாது.</span>
        </p>
      </section>

      <div
        role="tablist"
        aria-label="Log in or create an account"
        className="flex gap-2"
      >
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            className={mode === m ? "btn btn-primary flex-1" : "btn btn-secondary flex-1"}
            onClick={() => setMode(m)}
          >
            {m === "login" ? "Log in" : "Create account"}
            <span className="ta block text-xs">
              {m === "login" ? "உள்ளே செல்" : "கணக்கு உருவாக்கு"}
            </span>
          </button>
        ))}
      </div>

      <AuthForm mode={mode} onModeChange={setMode} next={next} />

      <p className="text-sm text-ink-soft">
        Want to know which papers you will need first?{" "}
        <a className="underline" href="/documents">
          See what each certificate proves
        </a>{" "}
        before you sign up.
      </p>
    </div>
  );
}
