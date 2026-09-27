import {
  CENTRAL_EWS_RULE,
  CENTRAL_RESERVATION,
  TN_HORIZONTAL_QUOTAS,
  TN_QUOTA_BLOCKS,
  TN_QUOTA_ROSTER,
  TN_SPECIAL_QUOTAS,
  blockShare,
} from "@data/quota";

export const metadata = { title: "Quota guide — Thonmai" };

const pct = (n: number) => `${n}%`;

const SWATCHES = [
  "bg-clay-500",
  "bg-clay-400",
  "bg-palm-500",
  "bg-marigold-500",
  "bg-clay-600",
  "bg-palm-600",
  "bg-marigold-700",
];

export default function QuotaPage() {
  const reserved = TN_QUOTA_BLOCKS.filter((b) => b.code !== "OC").reduce(
    (s, b) => s + blockShare(b),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Tamil Nadu quota, explained</h1>
      <p className="ta mt-1 text-lg text-clay-600">தமிழ்நாடு இடக்கமட்டம்</p>
      <p className="mt-3 max-w-2xl text-ink-soft">
        This is the part most students get wrong, and it changes which schemes you
        qualify for. {pct(reserved)} of seats are reserved; the remaining 31% are open
        to everyone.
      </p>

      <div className="mt-8">
        <div
          className="flex h-9 w-full overflow-hidden rounded-lg"
          role="img"
          aria-label="Share of Tamil Nadu seats by reserved category"
        >
          {TN_QUOTA_BLOCKS.map((b, i) => (
            <div
              key={b.code}
              className={`flex items-center justify-center text-[11px] font-semibold text-white ${SWATCHES[i % 7]}`}
              style={{ width: `${blockShare(b)}%` }}
              title={`${b.name}: ${blockShare(b)}%`}
            >
              {blockShare(b) >= 8 ? b.code : ""}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {TN_QUOTA_BLOCKS.map((b, i) => (
            <span key={b.code} className="inline-flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-sm ${SWATCHES[i % 7]}`}
                aria-hidden="true"
              />
              {b.name} {pct(blockShare(b))}
            </span>
          ))}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">The vertical roster</h2>
        <p className="mt-1 text-sm text-ink-soft">
          A sub-quota never adds to 100% on its own — it sits inside its parent block.
        </p>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Tamil Nadu reservation by community</caption>
            <thead className="bg-clay-50 text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Category</th>
                <th scope="col" className="px-4 py-2 font-semibold">Tamil</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Share</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Block</th>
              </tr>
            </thead>
            <tbody>
              {TN_QUOTA_ROSTER.map((c) => (
                <tr key={c.code} className="border-t border-clay-100">
                  <td className="px-4 py-2">
                    {c.name}
                    {c.isGroupingNode ? (
                      <span className="ml-1.5 text-xs text-ink-soft">(split below)</span>
                    ) : null}
                  </td>
                  <td className="ta px-4 py-2 text-clay-600">{c.nameTa}</td>
                  <td className="tabular-nums px-4 py-2 text-right">
                    {c.isGroupingNode ? "—" : pct(c.percentage ?? 0)}
                  </td>
                  <td className="tabular-nums px-4 py-2 text-right text-ink-soft">
                    {c.blockTotal ? pct(c.blockTotal) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Horizontal quotas</h2>
        <p className="mt-1 text-sm text-ink-soft">
          These cut across every vertical category, and they do not reduce the{" "}
          {pct(reserved)} reserved share.
        </p>
        <div className="mt-4 space-y-3">
          {TN_HORIZONTAL_QUOTAS.map((q) => (
            <div key={q.code} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{q.name}</h3>
                <span className="tag bg-clay-100 text-clay-700">{q.quota}</span>
              </div>
              <p className="ta text-sm text-clay-600">{q.nameTa}</p>
              <ul className="mt-2 list-inside list-disc text-sm text-ink-soft">
                {q.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Special quotas</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Smaller reservations on top of the horizontal list.
        </p>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Special and management quotas</caption>
            <thead className="bg-clay-50 text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Quota</th>
                <th scope="col" className="px-4 py-2 font-semibold">Tamil</th>
                <th scope="col" className="px-4 py-2 font-semibold">What you get</th>
              </tr>
            </thead>
            <tbody>
              {TN_SPECIAL_QUOTAS.map((q) => (
                <tr key={q.code} className="border-t border-clay-100 align-top">
                  <td className="px-4 py-2 font-medium">{q.name}</td>
                  <td className="ta px-4 py-2 text-clay-600">{q.nameTa}</td>
                  <td className="px-4 py-2 text-ink-soft">
                    {q.quota}
                    {q.conditions.length > 0 ? (
                      <ul className="mt-1 list-inside list-disc text-xs">
                        {q.conditions.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Central institutions: the one difference</h2>
        <div className="card mt-4 p-4">
          <p className="text-sm text-ink-soft">
            Tamil Nadu has <strong>no EWS quota</strong>. Central institutions — IITs,
            NITs, IIITs, AIIMS, IIMs, central universities — do: 10% for families below{" "}
            {inrCeiling(CENTRAL_EWS_RULE.annualIncomeCeiling)} a year. You can use it
            there, never in Tamil Nadu state quota counselling.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CENTRAL_RESERVATION.map((c) => (
              <span key={c.code} className="tag bg-palm-50 text-palm-700">
                {c.name} {c.percentage}%
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function inrCeiling(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
