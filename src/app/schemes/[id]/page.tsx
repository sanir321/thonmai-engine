import { notFound } from "next/navigation";
import Link from "next/link";
import { ALL_SCHEMES, SCHEME_BY_ID } from "@data/index";
import { DOC_BY_TYPE } from "@data/documents";
import { collectLeaves, evaluateRuleTree } from "@/engine/evaluate";
import { inr } from "@/components/ui";
import type { StudentProfile } from "@/engine/types";

export function generateStaticParams() {
  return ALL_SCHEMES.map((s) => ({ id: s.id }));
}

/** A clearly hypothetical profile, used only to render the rule list. */
const SAMPLE: StudentProfile = {
  level: "ug",
  classOrYear: 1,
  gender: "female",
  community: "BC",
  isMinority: false,
  domicileState: "Tamil Nadu",
  isFirstGraduate: false,
  studiedClass6to12InGovtSchool: false,
  isDifferentlyAbled: false,
  isExServicemenWard: false,
  isEminentSportsPerson: false,
  isOrphan: false,
  isCovidAffectedWard: false,
  isArmedForcesMartyrWard: false,
  isSriLankanTamil: false,
  isNccCadet: false,
  admissionRoute: "government_quota",
  institutionType: "government",
  hasNativityCertificate: false,
  bankAccountAadhaarSeeded: true,
  hasValidAadhaar: true,
};

export default async function SchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheme = SCHEME_BY_ID[id];
  if (!scheme) notFound();

  const leaves = collectLeaves(evaluateRuleTree(SAMPLE, scheme.rules));
  const official = scheme.sourceRefs.filter((r) => r.official).length;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/schemes" className="text-sm text-clay-700 underline">
        ← All schemes
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight">{scheme.name}</h1>
      {scheme.nameTa ? <p className="ta mt-1 text-xl text-clay-600">{scheme.nameTa}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="tag bg-clay-100 text-clay-700">{scheme.department}</span>
        <span className="tag bg-paper text-ink-soft">{scheme.authority} scheme</span>
        {scheme.level.map((l) => (
          <span key={l} className="tag bg-paper text-ink-soft">{l}</span>
        ))}
      </div>

      <p className="mt-4 text-ink-soft">{scheme.summary}</p>
      {scheme.summaryTa ? (
        <p className="ta mt-2 text-ink-soft">{scheme.summaryTa}</p>
      ) : null}

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-bold">What you get</h2>
        {scheme.benefit.annualEstimate > 0 ? (
          <p className="mt-1 text-2xl font-bold text-clay-600">
            {inr(scheme.benefit.annualEstimate)}
            <span className="text-sm font-normal text-ink-soft"> per year</span>
          </p>
        ) : (
          <p className="mt-1 text-ink-soft">
            No yearly amount — this scheme does not pay you a recurring benefit.
          </p>
        )}
        {scheme.benefit.oneTimeValue > 0 ? (
          <p className="text-sm text-ink-soft">
            plus {inr(scheme.benefit.oneTimeValue)} one-time, which is not counted as
            yearly income
          </p>
        ) : null}
        {scheme.benefit.loanValue > 0 ? (
          <p className="mt-2 rounded-md border border-clay-200 bg-clay-50 p-3 text-sm text-clay-800">
            <span className="font-semibold">This is a loan, not a grant.</span> Around{" "}
            {inr(scheme.benefit.loanValue)} of education loan may be sanctioned. You repay
            it with interest, so it is deliberately left out of the benefit figure above.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {scheme.benefit.components.map((c) => (
            <li key={c.label} className="text-sm">
              <span className="font-medium">{c.label}</span>
              <span className="text-ink-soft">
                {" "}
                — {inr(c.amount ?? 0)} / {c.period.replace("_", " ")}
                {c.exclusiveGroup ? " (one stage only)" : ""}
              </span>
              {c.note ? <span className="block text-xs text-ink-soft">{c.note}</span> : null}
            </li>
          ))}
        </ul>
        {scheme.benefit.note ? (
          <p className="mt-3 rounded bg-clay-50 px-3 py-2 text-xs text-ink-soft">
            {scheme.benefit.note}
          </p>
        ) : null}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-lg font-bold">Who qualifies</h2>
        <ul className="mt-3 space-y-2">
          {leaves.map((leaf, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-0.5 text-clay-500" aria-hidden="true">•</span>
              <span>{leaf.label}</span>
            </li>
          ))}
        </ul>
        {typeof scheme.categories !== "string" ? (
          <p className="mt-3 text-sm text-ink-soft">
            Open to: {scheme.categories.join(", ")}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">Open to every community.</p>
        )}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-lg font-bold">Documents you need</h2>
        <ul className="mt-3 space-y-3">
          {scheme.documents.map((d) => {
            const spec = DOC_BY_TYPE[d.type];
            return (
              <li key={d.type}>
                <p className="text-sm font-medium">
                  {spec?.label ?? d.type}
                  {d.mandatory ? (
                    <span className="ml-2 text-xs text-clay-700">required</span>
                  ) : (
                    <span className="ml-2 text-xs text-ink-soft">if applicable</span>
                  )}
                </p>
                {spec?.issuingAuthority ? (
                  <p className="text-xs text-ink-soft">
                    Issued by: {spec.issuingAuthority}
                  </p>
                ) : null}
                {spec?.eCertificateOnly ? (
                  <p className="mt-1 text-xs text-marigold-700">
                    Accepted only as a digitally signed e-Certificate.
                  </p>
                ) : null}
                {spec?.validityNote ? (
                  <p className="text-xs text-ink-soft">{spec.validityNote}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-lg font-bold">How to apply</h2>
        <p className="mt-2 text-sm">{scheme.apply.portal}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Channel: {scheme.apply.channel.replace(/_/g, " ")}
          {scheme.apply.helpline ? ` · Helpline: ${scheme.apply.helpline}` : ""}
        </p>
        {scheme.apply.url ? (
          <a
            href={scheme.apply.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-clay-700 underline"
          >
            Official portal
          </a>
        ) : null}
        {scheme.apply.deadlineNote ? (
          <p className="mt-2 text-sm text-marigold-700">{scheme.apply.deadlineNote}</p>
        ) : null}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-lg font-bold">Sources</h2>
        <p className="mt-1 text-xs text-ink-soft">
          {official} of {scheme.sourceRefs.length} sources are official government pages.
          Last verified {scheme.lastVerifiedAt}.
        </p>
        <ul className="mt-3 space-y-2">
          {scheme.sourceRefs.map((r, i) => (
            <li key={i} className="text-sm">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {r.publisher}
              </a>
              <span
                className={`tag ml-2 ${
                  r.official ? "bg-palm-50 text-palm-700" : "bg-clay-100 text-clay-700"
                }`}
              >
                {r.official ? "official" : "unofficial"}
              </span>
              {r.docRef ? (
                <span className="block text-xs text-ink-soft">{r.docRef}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {scheme.conflicts?.length ? (
        <section className="card mt-4 border-clay-200 bg-clay-50 p-5">
          <h2 className="text-lg font-bold text-clay-700">Conflicting sources</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {scheme.conflicts.map((c, i) => (
              <li key={i}>
                <strong>{c.field}:</strong> {c.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href="/check" className="btn btn-primary mt-8">
        Check if I qualify
      </Link>
    </article>
  );
}
