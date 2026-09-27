import type { Evaluation, RuleTrace, TraceOutcome } from "@/engine/types";
import { StatusPill } from "./ui";

const ICON = {
  pass: "✓",
  fail: "✕",
  unknown: "?",
  skipped: "–",
} satisfies Record<TraceOutcome, string>;
const COLOUR = {
  pass: "text-palm-600",
  fail: "text-clay-600",
  unknown: "text-ink-soft",
  skipped: "text-ink-soft/60",
} satisfies Record<TraceOutcome, string>;

/**
 * Renders the whole rule tree so a student can audit the decision, not just
 * accept it. Indentation encodes nesting depth.
 */
export function TraceTree({ node, depth = 0 }: { node: RuleTrace; depth?: number }) {
  const leaf = !node.children?.length;
  return (
    <li>
      <div
        className="flex items-start gap-2 py-1"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            leaf
              ? node.outcome === "pass"
                ? "bg-palm-100"
                : node.outcome === "fail"
                  ? "bg-clay-100"
                  : "bg-clay-50"
              : "bg-paper"
          } ${COLOUR[node.outcome]}`}
          aria-hidden="true"
        >
          {leaf ? ICON[node.outcome] : "•"}
        </span>
        <span className="text-sm">
          <span className={leaf ? COLOUR[node.outcome] : "font-medium text-ink"}>
            {node.detail}
          </span>
          {node.actual && leaf ? (
            <span className="block text-xs text-ink-soft">
              You told us: {node.actual}
            </span>
          ) : null}
        </span>
      </div>
      {node.children?.length ? (
        <ul>{node.children.map((c, i) => <TraceTree key={i} node={c} depth={depth + 1} />)}</ul>
      ) : null}
    </li>
  );
}

export function SchemeResultCard({ evaluation }: { evaluation: Evaluation }) {
  const { scheme, status, trace, blockingReasons, openQuestions, confidence } = evaluation;

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{scheme.name}</h3>
          {scheme.nameTa ? <p className="ta text-sm text-clay-600">{scheme.nameTa}</p> : null}
        </div>
        <StatusPill status={status} />
      </div>

      <p className="mt-2 text-sm text-ink-soft">{scheme.summary}</p>

      {blockingReasons.length > 0 ? (
        <div className="mt-3 rounded bg-clay-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-clay-700">
            Why not
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink-soft">
            {blockingReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {openQuestions.length > 0 ? (
        <div className="mt-3 rounded bg-marigold-100/50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-marigold-700">
            Answer to check
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink-soft">
            {openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-clay-700">
          Show every condition ({confidence === "low" ? "source is unofficial" : "auditable"})
        </summary>
        <ul className="mt-2 border-t border-clay-100 pt-2">
          <TraceTree node={trace} />
        </ul>
      </details>
    </article>
  );
}
