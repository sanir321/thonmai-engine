"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The hero call to action, which changes with the session.
 *
 * The account is now required to run the checker, so a signed-out visitor has to
 * be offered the sign-in path *before* they click a button that would only bounce
 * them to a login page. Sending them straight to /check looks like it works and
 * then throws them out, which is the worst of both.
 *
 * Session is probed from the browser rather than read in the server layout: a
 * cookie read in the layout would drag all 50 statically generated scheme pages
 * into a dynamic render on every request. Until the probe resolves we show the
 * signed-out wording, which is the honest default for an anonymous visitor.
 */
export function HeroActions() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/login", { cache: "no-store" });
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setSignedIn(Boolean(json?.user?.id));
      } catch {
        // Offline or blocked: fall back to the signed-out wording, which still
        // works for anyone who then signs in or registers.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (signedIn) {
    return (
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/check" className="btn btn-primary">
          Check my eligibility
        </Link>
        <Link href="/account" className="btn btn-secondary">
          My account
        </Link>
        <Link href="/quota" className="btn btn-secondary">
          Understand the quota system
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <Link href="/register" className="btn btn-primary">
          Create a free account
        </Link>
        <Link href="/login" className="btn btn-secondary">
          I already have one
        </Link>
      </div>

      <p className="mt-4 max-w-md text-sm text-ink-soft">
        The eligibility check needs an account, and that is all it is for: an email,
        a password, and your own saved answers. No Aadhaar number, no phone number,
        no OTP.
        <span className="ta block">
          உரிமைச் சரிபார்ப்புக்கு ஒரு கணக்கு தேவை. ஆதார் எண் தேவையில்லை.
        </span>
      </p>

      <p className="mt-3 text-sm text-ink-soft">
        <Link href="/documents" className="underline">
          See which certificates you will need
        </Link>{" "}
        or{" "}
        <Link href="/quota" className="underline">
          read how the quota system works
        </Link>{" "}
        first — no account needed for either.
      </p>
    </div>
  );
}
