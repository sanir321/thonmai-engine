"use client";

import { useRef, useState } from "react";
import { CERTIFICATE_GUIDES, type ReadableField } from "@/lib/documents/certificate-plan";

interface Candidate {
  field: string;
  label: string;
  value: string | number | boolean;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

/** Keys the scanner can suggest, mapped to how the form stores them. */
export type ScannableField =
  | "annualFamilyIncome"
  | "previousYearPercentage"
  | "classOrYear"
  | "community"
  | "disabilityPercentage"
  | "isFirstGraduate"
  | "isDifferentlyAbled";

/**
 * Every field the API can return. The parser may one day add a field; until it
 * is listed here it is shown but cannot be ticked, so the UI can never offer a
 * choice it would then quietly throw away.
 */
const OFFERED_FIELDS: readonly ScannableField[] = [
  "annualFamilyIncome",
  "previousYearPercentage",
  "classOrYear",
  "community",
  "disabilityPercentage",
  "isFirstGraduate",
  "isDifferentlyAbled",
];

type ScannableValue = string | number | boolean;

const FIELD_LABELS: Record<string, string> = {
  community: "Community / category",
  annualFamilyIncome: "Annual family income",
  previousYearPercentage: "Last exam percentage",
  classOrYear: "Class or year of study",
  disabilityPercentage: "Disability percentage",
  isFirstGraduate: "First graduate in the family",
  isDifferentlyAbled: "Certified as differently abled",
};

const CONFIDENCE_TONE: Record<Candidate["confidence"], string> = {
  high: "text-clay-600",
  medium: "text-ink-soft",
  low: "text-ink-soft",
};

/**
 * Reads a certificate and offers what it found.
 *
 * Nothing is applied until the student ticks a value and presses Apply: OCR is
 * wrong often enough that a silent guess would quietly misstate their income or
 * category, which is the one thing this app must never get wrong. Each row
 * shows the exact text the value was read from so it can be checked against the
 * document in hand.
 */
export function DocumentScanner({
  onApply,
  readingAvailable = true,
}: {
  onApply: (values: Partial<Record<ScannableField, ScannableValue>>) => void;
  /**
   * False when the server has no way to read a document. Passed in from a server
   * component, because the browser cannot read the environment and a client-side
   * default would offer an upload button that can only fail.
   */
  readingAvailable?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(CERTIFICATE_GUIDES[0]!.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<string | null>(null);
  const [expected, setExpected] = useState<ReadableField[]>([]);
  const [sentToCloud, setSentToCloud] = useState(false);

  const guide = CERTIFICATE_GUIDES.find((g) => g.id === kind);

  async function scan(file: File) {
    setBusy(true);
    setError(null);
    setCandidates([]);
    setPicked({});

    const body = new FormData();
    body.append("document", file);
    body.append("kind", kind);

    try {
      const res = await fetch("/api/ocr/extract", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "That document could not be read.");
      setCandidates(json.candidates ?? []);
      setExpected(json.expectedFields ?? []);
      setMethod(json.method);
      setSentToCloud(Boolean(json.sentToThirdParty));
      if ((json.candidates ?? []).length === 0) {
        setError(
          `We could not find a ${guide?.label.toLowerCase() ?? "detail"} in that document. You can still fill the form yourself.`,
        );
      }
    } catch (err) {
      // The server has already deleted the file by this point.
      setError(err instanceof Error ? err.message : "That document could not be read.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const toggle = (field: string) =>
    setPicked((p) => ({ ...p, [field]: !p[field] }));

  const applySelected = () => {
    const chosen = candidates.filter((c) => picked[c.field]);
    if (chosen.length === 0) return;
    const values: Partial<Record<ScannableField, ScannableValue>> = {};
    for (const c of chosen) {
      if (OFFERED_FIELDS.includes(c.field as ScannableField)) {
        values[c.field as ScannableField] = c.value as ScannableValue;
      }
    }
    onApply(values);
    setPicked({});
  };

  const chosenCount = candidates.filter((c) => picked[c.field]).length;

  return (
    <section className="card p-4" aria-labelledby="scan-heading">
      <h2 id="scan-heading" className="font-semibold">
        Fill from a certificate
        <span className="ta block text-sm text-ink-soft">சான்றிதழ்லிருந்து நிரப்பு</span>
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Tell us which certificate this is, upload it, and we will read the details for
        you to check. The file is deleted the moment it has been read — it is never
        stored, and we never ask for an Aadhaar number.
        <span className="ta block">
          சான்றிதழைப் பதிவேற்றவும். படம் வாசிக்கப்பட்டவுடன் நீக்கப்படும்.
        </span>
      </p>

      <div className="mt-3">
        <label className="label" htmlFor="certificate-kind">
          Which certificate is this?
        </label>
        <select
          id="certificate-kind"
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {CERTIFICATE_GUIDES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label} — {g.pickerHint}
            </option>
          ))}
        </select>
        {guide ? (
          <p className="mt-1 text-xs text-ink-soft">
            <strong className="font-medium text-ink">{guide.proves}</strong>
            {guide.readableFields.length > 0 ? (
              <>
                {" "}
                We look for:{" "}
                {guide.readableFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.
              </>
            ) : null}
          </p>
        ) : null}
        <p className="mt-1 text-xs">
          <a className="underline" href="/documents" target="_blank" rel="noreferrer">
            Not sure which certificate to upload?
          </a>{" "}
          <span className="text-ink-soft">See what each one proves.</span>
        </p>
      </div>

      {readingAvailable ? (
        <label className="btn btn-secondary mt-3 inline-block">
          {busy ? "Reading…" : "Choose a PDF or photo"}
          <span className="ta block text-xs">கோப்பைத் தேர்வு செய்</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void scan(file);
            }}
          />
        </label>
      ) : (
        // No reader on the server. Offering the button would only produce an
        // error after the student has chosen a file, so the whole panel says so
        // plainly and the form below carries on working.
        <p className="mt-3 rounded-md bg-clay-50 p-3 text-sm text-clay-800">
          <strong className="font-medium">Reading documents is switched off</strong> on
          this server, so there is nothing to upload here. You can fill in every answer
          below by hand — it takes about two minutes and nothing changes about your
          result.
          <span className="ta block text-xs">
            சான்றிதழ் வாசிப்பு இங்கு இயங்கவில்லை. கீழே நிரப்பவும்.
          </span>
        </p>
      )}

      {readingAvailable ? (
      <p className="mt-2 text-xs text-ink-soft">
        {sentToCloud ? (
          <>
            <strong className="font-medium text-clay-700">
              This copy was read by Google&apos;s AI, so it was uploaded off this
              server.
            </strong>{" "}
            It is deleted immediately and never kept. A PDF that already contains
            text is read here instead and is not sent anywhere.
          </>
        ) : (
          "Read from the PDF's own text on this server, so it was not sent to anyone. Photographs are read by Google's AI."
        )}
      </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-clay-50 p-3 text-sm text-clay-800">
          {error}
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-ink-soft">
            {method === "pdf-text-layer"
              ? "Read from the document's own text. Check each one before using it."
              : sentToCloud
                ? "Read by Google's AI. Check each one against the paper before using it."
                : "Read from a scan of the document. Check each one before using it."}
            <span className="ta block">ஒவ்வொன்றையும் உறுதி செய்யவும்.</span>
          </p>

          <ul className="space-y-2">
            {candidates.map((c) => {
              const isExpected = expected.includes(c.field as ReadableField);
              return (
                <li key={c.field}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-clay-200 p-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(picked[c.field])}
                      onChange={() => toggle(c.field)}
                    />
                    <span>
                      <span className="font-medium">
                        {c.label ?? FIELD_LABELS[c.field] ?? c.field}
                      </span>
                      <span className="block">
                        <strong>{String(c.value)}</strong>{" "}
                        <span className={`text-xs ${CONFIDENCE_TONE[c.confidence]}`}>
                          ({c.confidence} confidence)
                        </span>
                        {isExpected ? (
                          <span className="ml-1 text-xs text-clay-700">
                            · expected on this certificate
                          </span>
                        ) : (
                          <span className="ml-1 text-xs text-ink-soft">
                            · not usually on this certificate
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        read from: “{c.evidence}”
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={chosenCount === 0}
              onClick={applySelected}
            >
              Use {chosenCount} selected
              <span className="ta block text-xs">தேர்ந்தெடுத்தவைப் பயன்படுத்து</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setCandidates([]);
                setPicked({});
              }}
            >
              Discard
              <span className="ta block text-xs">கைவிடு</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
