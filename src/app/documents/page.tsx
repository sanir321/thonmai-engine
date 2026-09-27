import Link from "next/link";
import {
  CERTIFICATE_GUIDES,
  MANUAL_ONLY_FIELDS,
  NEVER_COLLECT,
  documentSpecFor,
} from "@/lib/documents/certificate-plan";
import { readingAvailable } from "@/lib/ocr/extract";

/**
 * Rendered per request rather than baked at build time.
 *
 * This page states whether documents are read locally or by Google, and that is
 * decided by the environment. Prerendering it would freeze the answer taken at
 * build time, so a server whose key is later removed would go on telling
 * students that their documents are sent to Google. A wrong privacy claim is
 * worse than a page render.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "What to upload — Thonmai",
  description:
    "Which certificate to upload for each answer, who issues it, what we read from it, and what you have to type yourself.",};

/**
 * The document plan, written out in full.
 *
 * Students do not arrive with a question of "which certificate do I need" — they
 * have a certificate in their hand and no idea what it proves. So this page is
 * organised by the three certificates that unlock the most schemes first, and
 * every entry separates what we can read off the paper from what only the
 * student or their college can tell us.
 */
export default function DocumentsPage() {
  // Read on the server, not the client: the browser cannot see this, and a
  // default of "false" would misinform every visitor on a configured server.
  const canRead = readingAvailable();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        What to upload, and what to type yourself
      </h1>
      <p className="ta mt-2 text-xl text-clay-600">என்ன பதிவேற்றுவது, நீங்கள் என்ன தட்டச்சு செய்வது</p>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Three certificates unlock most of the catalogue: your <strong>Community
        Certificate</strong>, your <strong>Family Income Certificate</strong>, and —
        if it applies to you — the <strong>First Graduate Certificate</strong> from the
        Headquarters Deputy Tahsildar. Upload any one of them and we will read the
        details for you to confirm.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/check" className="btn btn-primary">
          Start the check
        </Link>
        <Link href="/quota" className="btn btn-secondary">
          How quota decides your seat
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">The three that matter most</h2>
        <p className="mt-2 text-ink-soft">
          If you only have time to get three papers, get these.
        </p>
        <ul className="mt-5 space-y-4">
          {CERTIFICATE_GUIDES.slice(0, 3).map((guide) => {
            const spec = documentSpecFor(guide.documentType);
            return (
              <li key={guide.id} className="card p-5">
                <h3 className="text-lg font-semibold">
                  {guide.label}
                  <span className="ta ml-2 text-base font-normal text-clay-600">
                    {guide.labelTa}
                  </span>
                </h3>
                <p className="mt-1 text-ink-soft">{guide.proves}</p>
                <p className="ta mt-0.5 text-sm text-ink-soft">{guide.provesTa}</p>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium">We read from it</dt>
                    <dd className="text-sm text-ink-soft">
                      {guide.readableFields.length > 0
                        ? guide.readableFields
                            .map((f) => FIELD_LABELS[f] ?? f)
                            .join(", ")
                        : "Nothing — it is a supporting paper."}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium">You still confirm</dt>
                    <dd className="text-sm text-ink-soft">
                      {guide.manualFields.length > 0
                        ? guide.manualFields
                            .map((f) => f.label)
                            .join(", ")
                        : "Nothing — every answer is readable."}
                    </dd>
                  </div>
                </dl>

                {guide.manualFields.map((f) => (
                  <p key={f.field} className="mt-3 text-sm text-clay-800">
                    <strong className="font-medium">{f.label}:</strong> {f.why}
                  </p>
                ))}

                {spec ? (
                  <div className="mt-4 border-t border-clay-100 pt-4 text-sm text-ink-soft">
                    <p>
                      <strong className="font-medium text-ink">Issued by:</strong>{" "}
                      {spec.issuingAuthority}
                      <span className="ta block">{spec.issuingAuthorityTa}</span>
                    </p>
                    {spec.howToObtain ? (
                      <p className="mt-2">
                        <strong className="font-medium text-ink">How to get it:</strong>{" "}
                        {spec.howToObtain}
                      </p>
                    ) : null}
                    {spec.eCertificateOnly ? (
                      <p className="mt-2 font-medium text-clay-700">
                        A digitally signed e-Certificate is required. A paper printout
                        may be rejected.
                      </p>
                    ) : null}
                    {spec.validityNote ? (
                      <p className="mt-2">
                        <strong className="font-medium text-ink">Watch out:</strong>{" "}
                        {spec.validityNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">The rest, and what each one unlocks</h2>
        <p className="mt-2 text-ink-soft">
          Optional, but each one opens a scheme the others cannot.
        </p>
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-clay-200 text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th scope="col" className="p-3">Certificate</th>
                <th scope="col" className="p-3">What it proves</th>
                <th scope="col" className="p-3">We read</th>
                <th scope="col" className="p-3">You confirm</th>
              </tr>
            </thead>
            <tbody>
              {CERTIFICATE_GUIDES.slice(3).map((guide) => (
                <tr key={guide.id} className="border-b border-clay-100 align-top last:border-0">
                  <th scope="row" className="p-3 font-medium">
                    {guide.label}
                    <span className="ta block text-xs font-normal text-ink-soft">
                      {guide.labelTa}
                    </span>
                  </th>
                  <td className="p-3 text-ink-soft">{guide.proves}</td>
                  <td className="p-3 text-ink-soft">
                    {guide.readableFields.length > 0
                      ? guide.readableFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")
                      : "—"}
                  </td>
                  <td className="p-3 text-ink-soft">
                    {guide.manualFields.length > 0
                      ? guide.manualFields.map((f) => f.label).join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">
          What you have to tell us yourself
        </h2>
        <p className="ta mt-1 text-lg text-clay-600">நீங்கள் நமக்கே சொல்ல வேண்டியவை</p>
        <p className="mt-2 max-w-2xl text-ink-soft">
          No certificate can tell us these, and guessing them would misstate your
          eligibility. So we ask you directly.
        </p>
        <ul className="mt-5 space-y-3">
          {MANUAL_ONLY_FIELDS.map((f) => (
            <li key={f.field} className="card p-4">
              <h3 className="font-medium">
                {f.label}
                <span className="ta ml-2 text-sm font-normal text-clay-600">
                  {f.labelTa}
                </span>
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{f.why}</p>
              <p className="mt-1 text-sm">
                <strong className="font-medium">Check:</strong> {f.source}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">
          What we will never ask you for
        </h2>
        <p className="ta mt-1 text-lg text-clay-600">நாங்கள் ஒருபோதும் கேட்க மாட்டோம்</p>
        <div className="card mt-5 border-clay-300 bg-clay-50 p-5">
          <ul className="space-y-3">
            {NEVER_COLLECT.map((n) => (
              <li key={n.label} className="text-sm">
                <strong className="font-medium text-ink">{n.label}</strong>
                <span className="ta ml-2 text-clay-700">{n.labelTa}</span>
                <p className="mt-0.5 text-ink-soft">{n.why}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">How uploading works</h2>
        <ol className="mt-4 space-y-3 text-ink-soft">
          <li>
            <strong className="text-ink">1. Tell us which certificate it is.</strong>{" "}
            So we know which details to look for, and can tell you when a value does
            not belong to that document.
          </li>
          <li>
            <strong className="text-ink">2. Upload a clear photo or PDF.</strong> Flat,
            well lit, and all four corners visible. Up to 8 MB.
          </li>
          <li>
            <strong className="text-ink">
              3. We read it and show you every value with the text it came from.
            </strong>{" "}
            Nothing is filled in until you tick it.
          </li>
          <li>
            <strong className="text-ink">
              4. {canRead ? "Photos are read by Google's AI" : "Reading documents is switched off"}.
            </strong>{" "}
            {canRead
              ? "A photo is uploaded to Google so it can be read accurately, including handwriting and Tamil. A PDF that already contains text is read on the server instead and is not sent to anyone. Either way the file is deleted straight afterwards, never stored, and any 12-digit number on it is masked before you see it."
              : "This server has no document reader, so you will need to fill in the answers on the eligibility page by hand. Everything else on this page still applies."}
          </li>
        </ol>
        <p className="mt-4 text-sm text-ink-soft">
          A PDF with selectable text is read directly and is faster and more accurate
          than a photo. A scanned PDF or a photo is read with OCR, which is why you
          should check each value against the paper in front of you.
        </p>
      </section>
    </div>
  );
}

/** Human labels for the fields a certificate can fill. */
const FIELD_LABELS: Record<string, string> = {
  community: "Community / category",
  annualFamilyIncome: "Annual family income",
  previousYearPercentage: "Last exam percentage",
  classOrYear: "Class or year of study",
  isFirstGraduate: "First graduate in family",
  isDifferentlyAbled: "Certified as differently abled",
  disabilityPercentage: "Disability percentage",
  hasNativityCertificate: "Holds a nativity certificate",
  isExServicemenWard: "Ward of ex-servicemen",
  isOrphan: "Orphan or ward",
  domicileState: "Domicile state",
  course: "Course",
  admissionRoute: "Admission route",
  institutionType: "Institution type",
  level: "Level of study",
  gender: "Gender",
};
