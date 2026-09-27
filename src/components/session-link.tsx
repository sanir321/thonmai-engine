"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Shows "Log in" or "My account" depending on the session.
 *
 * This probes the session from the browser rather than reading cookies in the
 * layout, because reading a cookie in the layout would force every page —
 * including all 50 scheme pages — out of static generation and into a dynamic
 * render on each request. A signed-out visitor still sees one brief "Log in",
 * which costs nothing, and the scheme pages stay cacheable.
 */
export function SessionLink() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/login", { cache: "no-store" });
        // Check the body, not just the status: a 200 carrying `user: null` once
        // made this link claim everyone was signed in.
        const json = res.ok ? await res.json() : null;
        if (cancelled) return;
        setSignedIn(Boolean(json?.user?.id));
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      className="rounded px-2.5 py-1.5 font-medium text-ink-soft hover:bg-clay-50 hover:text-clay-700"
    >
      {signedIn ? "My account" : "Log in"}
      <span className="ta ml-1.5 text-xs text-clay-500">
        {signedIn ? "எனது கணக்கு" : "உள்ளே செல்"}
      </span>
    </Link>
  );
}
