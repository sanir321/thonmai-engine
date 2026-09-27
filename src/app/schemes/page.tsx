import Link from "next/link";
import { ALL_SCHEMES, DATASET_STATS } from "@data/index";
import { DOC_BY_TYPE } from "@data/documents";
import { inr } from "@/components/ui";

export const metadata = { title: "All schemes — Thonmai" };

export default function SchemesPage() {
  const live = ALL_SCHEMES.filter((s) => s.status === "live");
  const state = live.filter((s) => s.authority === "state");
  const central = live.filter((s) => s.authority === "central");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">All schemes</h1>
      <p className="ta mt-1 text-lg text-clay-600">அனைத்துத் திட்டங்கள்</p>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {DATASET_STATS.totalSchemes} schemes, of which {live.length} are live right now.
        Each one shows its benefit, the documents it needs and where it comes from.
        Use the{" "}
        <Link href="/check" className="font-medium text-clay-700 underline">
          eligibility check
        </Link>{" "}
        to see which apply to you.
      </p>

      <Group title="Tamil Nadu state schemes" count={state.length} schemes={state} />
      <Group title="Central government schemes" count={central.length} schemes={central} />
    </div>
  );
}

function Group({
  title,
  count,
  schemes,
}: {
  title: string;
  count: number;
  schemes: typeof ALL_SCHEMES;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">
        {title} <span className="text-sm font-normal text-ink-soft">({count})</span>
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {schemes.map((s) => {
          const lowConfidence = s.sourceRefs.every((r) => !r.official);
          return (
            <article key={s.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug">{s.name}</h3>
                <span className="shrink-0 tabular-nums text-sm font-bold text-clay-600">
                  {s.benefit.annualEstimate > 0 ? (
                    <>
                      {inr(s.benefit.annualEstimate)}
                      <span className="block text-right text-[11px] font-normal text-ink-soft">
                        per year
                      </span>
                    </>
                  ) : s.benefit.loanValue > 0 ? (
                    <span className="block text-right text-[11px] font-normal text-ink-soft">
                      loan, not a grant
                    </span>
                  ) : (
                    <span className="block text-right text-[11px] font-normal text-ink-soft">
                      no yearly amount
                    </span>
                  )}
                </span>
              </div>
              {s.nameTa ? <p className="ta text-sm text-clay-600">{s.nameTa}</p> : null}
              <p className="mt-2 flex-1 text-sm text-ink-soft">{s.summary}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.level.map((l) => (
                  <span key={l} className="tag bg-paper text-ink-soft">{l}</span>
                ))}
                {s.documents.filter((d) => d.mandatory).slice(0, 3).map((d) => (
                  <span key={d.type} className="tag bg-clay-50 text-clay-700">
                    {DOC_BY_TYPE[d.type]?.label ?? d.type}
                  </span>
                ))}
              </div>

              {lowConfidence ? (
                <p className="mt-2 text-xs text-clay-700">
                  Source is not official — verify before applying.
                </p>
              ) : null}

              <Link
                href={`/schemes/${s.id}`}
                className="mt-3 text-sm font-medium text-clay-700 underline"
              >
                Full details and sources
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
