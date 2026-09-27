import type { Confidence, EvaluationStatus, HeldDocument } from "@/engine/types";

export const TA: Record<string, string> = {
  eligible: "உரிமை உள்ளது",
  ineligible: "உரிமை இல்லை",
  needs_document: "ஆவணங்கள் தேவை",
  unknown: "மேலும் விவரம் தேவை",
};

export const STATUS_STYLE: Record<
  EvaluationStatus,
  { label: string; cls: string; dot: string }
> = {
  eligible: {
    label: "Eligible now",
    cls: "bg-palm-50 text-palm-700",
    dot: "bg-palm-500",
  },
  needs_document: {
    label: "Eligible — documents pending",
    cls: "bg-marigold-100 text-marigold-700",
    dot: "bg-marigold-500",
  },
  ineligible: {
    label: "Not eligible",
    cls: "bg-clay-50 text-ink-soft",
    dot: "bg-clay-200",
  },
  unknown: {
    label: "Needs more information",
    cls: "bg-paper text-ink-soft",
    dot: "bg-ink-soft/30",
  },
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Well sourced",
  medium: "Moderately sourced",
  low: "Verify before applying",
};

export function StatusPill({ status }: { status: EvaluationStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`tag ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
      <span className="ta font-normal opacity-70">{TA[status]}</span>
    </span>
  );
}

export function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const cls =
    confidence === "high"
      ? "bg-palm-50 text-palm-700"
      : confidence === "medium"
        ? "bg-marigold-100 text-marigold-700"
        : "bg-clay-100 text-clay-700";
  return <span className={`tag ${cls}`}>{CONFIDENCE_LABEL[confidence]}</span>;
}

export function Money({ rupees }: { rupees: number }) {
  if (rupees <= 0) return <span className="text-ink-soft">—</span>;
  return <span className="tabular-nums">{rupees.toLocaleString("en-IN")}</span>;
}

/** "₹1.2 lakh / year" style helper, kept local so pages stay declarative. */
export function inr(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} crore`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} lakh`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function DocumentChecklist({
  missing,
  held,
}: {
  missing: { type: string; note?: string }[];
  held: HeldDocument[];
}) {
  if (missing.length === 0) {
    return (
      <p className="rounded bg-palm-50 px-3 py-2 text-sm text-palm-700">
        You have every mandatory document for this scheme.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {missing.map((d) => (
        <li key={d.type} className="rounded bg-marigold-100/60 px-3 py-2 text-sm">
          <span className="font-semibold text-marigold-700">Still needed: {d.type}</span>
          {d.note ? <span className="block text-ink-soft">{d.note}</span> : null}
        </li>
      ))}
      {held.length > 0 ? (
        <li className="px-1 text-xs text-ink-soft">
          Already held: {held.map((h) => h.type).join(", ")}
        </li>
      ) : null}
    </ul>
  );
}
