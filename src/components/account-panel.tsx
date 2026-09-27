"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SavedProfile {
  id: string;
  label: string;
  level: string;
  createdAt: string;
  updatedAt: string;
  profile: Record<string, unknown>;
  documents: unknown[];
}

const LEVEL_LABELS: Record<string, string> = {
  school: "School",
  iti: "ITI",
  diploma: "Diploma",
  ug: "Undergraduate",
  pg: "Postgraduate",
  phd: "PhD",
};

function summarise(profile: Record<string, unknown>): string {
  const bits: string[] = [];
  if (typeof profile.course === "string" && profile.course) bits.push(profile.course);
  if (typeof profile.annualFamilyIncome === "number") {
    bits.push(`income ${profile.annualFamilyIncome.toLocaleString("en-IN")}`);
  }
  if (typeof profile.previousYearPercentage === "number") {
    bits.push(`${profile.previousYearPercentage}% marks`);
  }
  if (typeof profile.community === "string") bits.push(profile.community);
  return bits.length > 0 ? bits.join(" · ") : "no extra details";
}

export function AccountPanel({ email }: { email: string }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      setProfiles(json.profiles ?? []);
    } catch {
      setError("Could not load your saved answers.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/profiles?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setProfiles((p) => p.filter((x) => x.id !== id));
    else setError("That answer could not be deleted.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold">Signed in as</h2>
        <p className="mt-1 text-ink-soft">{email}</p>
        <p className="mt-3 text-sm text-ink-soft">
          Only your answers are stored. We never save a certificate, an Aadhaar number, or
          any text read out of an uploaded document.
          <span className="ta block">உங்கள் பதில்கள் மட்டுமே சேமிக்கப்படுகின்றன.</span>
        </p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => void logout()}>
          Log out
          <span className="ta block text-xs">வெளியேறு</span>
        </button>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Saved answers</h2>
        <p className="ta mt-0.5 text-sm text-ink-soft">சேமிக்கப்பட்ட பதில்கள்</p>
        <p className="mt-2 text-sm text-ink-soft">
          Fill in the check form, then use “Save these answers” at the bottom of the page
          to keep them here.
        </p>

        {error ? (
          <p role="alert" className="mt-3 rounded bg-clay-100 px-3 py-2 text-sm text-clay-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-ink-soft">Loading…</p>
        ) : profiles.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Nothing saved yet.{" "}
            <a className="underline" href="/check">Start the check</a>
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-clay-200 p-3"
              >
                <div>
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-ink-soft">
                    {LEVEL_LABELS[p.level] ?? p.level} · {summarise(p.profile)} · saved{" "}
                    {new Date(p.updatedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    className="btn btn-secondary"
                    href={`/check?saved=${encodeURIComponent(p.id)}`}
                  >
                    Use these
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void remove(p.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
