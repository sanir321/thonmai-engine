"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MatchReport } from "@/engine/types";
import { SchemeResultCard } from "@/components/results";
import { inr } from "@/components/ui";

type Tab = "claim" | "documents" | "ineligible" | "all";

const TABS: [Tab, string, string][] = [
  ["claim", "You can claim", "உரிமை பெறலாம்"],
  ["documents", "Need documents", "ஆவணங்கள் தேவை"],
  ["ineligible", "Not eligible", "உரிமை இல்லை"],
  ["all", "Everything", "அனைத்தும்"],
];

export function ResultsView() {
  const [report, setReport] = useState<MatchReport | null>(null);
  const [tab, setTab] = useState<Tab>("claim");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("thonmai:report");
    if (raw) {
      try {
        setReport(JSON.parse(raw));
      } catch {
        /* corrupt payload — fall through to the empty state */
      }
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">No results yet</h1>
        <p className="ta mt-1 text-clay-600">இதுவரை முடிவுகள் இல்லை</p>
        <p className="mt-3 text-ink-soft">
          Answer the questions and we will show your matches.
        </p>
        <Link href="/check" className="btn btn-primary mt-6">
          Start the check
        </Link>
      </div>
    );
  }

  const claimable = [...report.eligible, ...report.needsDocument];
  const sorted = [...claimable].sort(
    (a, b) => b.scheme.benefit.annualEstimate - a.scheme.benefit.annualEstimate,
  );

  const shown =
    tab === "claim"
      ? sorted
      : tab === "documents"
        ? report.needsDocument
        : tab === "ineligible"
          ? report.ineligible
          : report.evaluations;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Your results</h1>
      <p className="ta mt-1 text-lg text-clay-600">உங்கள் முடிவுகள்</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-2xl font-bold text-palm-600">
            {inr(report.totalAnnualEstimate)}
          </p>
          <p className="text-sm text-ink-soft">recurring benefit per year</p>
          <p className="mt-1 text-xs text-ink-soft">
            one-time items are not counted here
          </p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold">{claimable.length}</p>
          <p className="text-sm text-ink-soft">schemes you could claim</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold">{report.unknown.length}</p>
          <p className="text-sm text-ink-soft">waiting on an answer from you</p>
        </div>
      </div>

      {report.hasNonOfficialSource ? (
        <p className="mt-4 rounded bg-marigold-100/60 px-3 py-2 text-sm text-marigold-700">
          Part of this total comes from a source that is not an official government
          page. Confirm on the portal before you rely on it.
        </p>
      ) : null}

      {report.totalAnnualEstimate > 0 ? (
        <p className="mt-2 text-xs text-ink-soft">
          Certainty: {report.benefitCertainty} · oldest source checked{" "}
          {report.oldestSourceRetrievedAt}
        </p>
      ) : null}

      {report.topQuestions.length > 0 ? (
        <section className="card mt-4 border-marigold-200 bg-marigold-100/40 p-5">
          <h2 className="text-lg font-bold text-marigold-700">
            Answer these to unlock {report.unknown.length} more scheme
            {report.unknown.length === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            We could not decide these either way, so we did not guess. Each answer below
            is currently holding up the schemes next to it.
          </p>
          <ul className="mt-3 space-y-2">
            {report.topQuestions.map((q) => (
              <li key={q} className="flex items-start gap-2 text-sm">
                <span className="tag shrink-0 bg-marigold-200 text-marigold-700">
                  {report.blockedBy[q]} blocked
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
          <Link href="/check" className="btn btn-primary mt-4">
            Go back and answer
          </Link>
        </section>
      ) : null}

      <div role="tablist" aria-label="Result filters" className="mt-8 flex flex-wrap gap-1">
        {TABS.map(([key, label, ta]) => {
          const count =
            key === "claim"
              ? claimable.length
              : key === "documents"
                ? report.needsDocument.length
                : key === "ineligible"
                  ? report.ineligible.length
                  : report.evaluations.length;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                tab === key
                  ? "bg-clay-500 text-white"
                  : "bg-paper-raised text-ink-soft hover:bg-clay-50"
              }`}
            >
              {label} <span className="ta font-normal opacity-70">{ta}</span>
              <span className="ml-1.5 tabular-nums opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {shown.length === 0 ? (
          <p className="card p-5 text-sm text-ink-soft">Nothing in this category.</p>
        ) : (
          shown.map((e) => <SchemeResultCard key={e.scheme.id} evaluation={e} />)
        )}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/check" className="btn btn-secondary">
          Change my answers
        </Link>
        <Link href="/quota" className="btn btn-secondary">
          Why am I in this category?
        </Link>
      </div>
    </div>
  );
}
