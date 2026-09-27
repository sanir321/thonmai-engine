"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentType, HeldDocument, StudentProfile } from "@/engine/types";
import { DocumentScanner, type ScannableField } from "@/components/document-scanner";

const LEVELS = [
  ["school", "School (Classes 1-12)"],
  ["iti", "ITI / Industrial Training"],
  ["diploma", "Diploma"],
  ["ug", "Undergraduate"],
  ["pg", "Postgraduate"],
  ["phd", "PhD / Research"],
] as const;

/** School and ITI go up to class 12; diploma and degrees cap at year 6. */
function classYearMax(level: string): number {
  return level === "school" || level === "iti" ? 12 : 6;
}

const COMMUNITIES = [
  ["OC", "OC — Open Category"],
  ["BC", "BC — Backward Class"],
  ["BCM", "BCM — Backward Class (Muslim)"],
  ["MBC", "MBC — Most Backward Class"],
  ["MBCV", "MBC — Vanniyar"],
  ["DNC", "MBC & DNC (Denotified)"],
  ["SC", "SC — Scheduled Caste"],
  ["SCA", "SCA — Scheduled Caste (Adivasi)"],
  ["ST", "ST — Scheduled Tribe"],
] as const;

const DOCS: [DocumentType, string, string][] = [
  ["community_certificate", "Community certificate", "வளர்ச்சிக் குடித்தொகை சான்றிதழ்"],
  ["income_certificate", "Family income certificate", "குடும வருமான சான்றிதழ்"],
  ["nativity_certificate", "Nativity certificate (REV-102, e-Certificate only)", "தரிசம் சான்றிதழ்"],
  ["first_graduate_certificate", "First-graduate certificate (Deputy Tahsildar)", "முதலாம் பட்டதாரி சான்றிதழ்"],
  ["bonafide_certificate", "Bonafide certificate with school EMIS number", "பள்ளி விட்டுச் சான்றிதழ்"],
  ["pwd_certificate", "Disability certificate + UDID", "மாற்றுத்திறனாளி சான்றிதழ்"],
  ["aadhaar", "Aadhaar", "ஆதார்"],
  ["bank_passbook", "Bank passbook (Aadhaar-seeded)", "வங்கி கணக்கு பதிவேடு"],
  ["marksheet_10", "Class 10 marksheet", "10ஆம் வகுப்பு சான்றிதழ்"],
  ["marksheet_12", "Class 12 marksheet", "12ஆம் வகுப்பு சான்றிதழ்"],
  ["ex_servicemen_certificate", "Ex-servicemen / armed forces certificate", "வீரர்கள் சான்றிதழ்"],
  ["emis_id", "School EMIS number", "பள்ளி EMIS எண்"],
];

/**
 * A three-state answer: yes / no / not sure.
 *
 * "Not sure" is a first-class option, not a hidden default. Sending it means the
 * key is left out of the profile entirely, so the engine returns `unknown` and
 * asks the student a question instead of silently deciding for them.
 */
const TriState = ({
  name,
  value,
  onChange,
  title,
  ta,
  hint,
}: {
  name: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  title: string;
  ta?: string;
  hint?: string;
}) => (
  <fieldset
    className="rounded-lg border border-clay-100 bg-paper-raised p-3"
    aria-label={title}
  >
    <legend className="sr-only">{title}</legend>
    <p className="text-sm font-medium">{title}</p>
    {ta ? <p className="ta text-xs text-clay-600">{ta}</p> : null}
    {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    <div className="mt-2 flex flex-wrap gap-1.5">
      {(
        [
          [true, "Yes", "ஆம்"],
          [false, "No", "இல்லை"],
          [null, "Not sure", "தெரியாது"],
        ] as const
      ).map(([v, label, labelTa]) => (
        <label
          key={String(v)}
          className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            value === v
              ? "border-clay-500 bg-clay-500 text-white"
              : "border-clay-200 bg-paper text-ink-soft hover:bg-clay-50"
          }`}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === v}
            onChange={() => onChange(v)}
          />
          {label} <span className={value === v ? "ta opacity-80" : "ta opacity-60"}>{labelTa}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

/** A plain tick box, for "do you already hold this document?" — absence is harmless. */
const Check = ({
  name,
  checked,
  onChange,
  title,
  ta,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  ta?: string;
  hint?: string;
}) => (
  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-clay-100 bg-paper-raised p-3 hover:bg-clay-50">
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 accent-clay-500"
    />
    <span className="text-sm">
      <span className="font-medium">{title}</span>
      {ta ? <span className="ta block text-xs text-clay-600">{ta}</span> : null}
      {hint ? <span className="block text-xs text-ink-soft">{hint}</span> : null}
    </span>
  </label>
);

const Section = ({ title, ta, children }: { title: string; ta: string; children: React.ReactNode }) => (
  <fieldset className="card p-5">
    <legend className="px-1 text-base font-semibold">{title}</legend>
    <p className="ta mb-4 text-sm text-clay-600">{ta}</p>
    <div className="space-y-4">{children}</div>
  </fieldset>
);

/** Questions the student may genuinely not know the answer to. */
type TriStateField =
  | "isMinority"
  | "isFirstGraduate"
  | "studiedClass6to12InGovtSchool"
  | "isDifferentlyAbled"
  | "isExServicemenWard"
  | "isEminentSportsPerson"
  | "isOrphan"
  | "isCovidAffectedWard"
  | "isArmedForcesMartyrWard"
  | "isSriLankanTamil"
  | "isNccCadet"
  | "hasNativityCertificate"
  | "bankAccountAadhaarSeeded"
  | "hasValidAadhaar";

type FormState = {
  level: string;
  classOrYear: string;
  gender: string;
  community: string;
  religion: string;
  domicileState: string;
  course: string;
  annualFamilyIncome: string;
  previousYearPercentage: string;
  disabilityPercentage: string;
  admissionRoute: string;
  institutionType: string;
} & Record<TriStateField, boolean | null>;

export function OnboardingForm({ readingAvailable = true }: { readingAvailable?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    level: "ug",
    classOrYear: "1",
    gender: "female",
    community: "BC",
    religion: "hindu",
    domicileState: "Tamil Nadu",
    course: "",
    annualFamilyIncome: "",
    previousYearPercentage: "",
    disabilityPercentage: "",
    admissionRoute: "government_quota",
    institutionType: "government",
    isMinority: null,
    isFirstGraduate: null,
    studiedClass6to12InGovtSchool: null,
    isDifferentlyAbled: null,
    isExServicemenWard: null,
    isEminentSportsPerson: null,
    isOrphan: null,
    isCovidAffectedWard: null,
    isArmedForcesMartyrWard: null,
    isSriLankanTamil: null,
    isNccCadet: null,
    hasNativityCertificate: null,
    bankAccountAadhaarSeeded: null,
    hasValidAadhaar: null,
  });
  const [docs, setDocs] = useState<DocumentType[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const applyScanned = (values: Partial<Record<ScannableField, string | number | boolean>>) => {
    // Only ever fills a field the student explicitly ticked on the scanner. A
    // blank or unrecognised value leaves the answer unanswered, which keeps the
    // engine saying "unknown" rather than guessing.
    setForm((f) => {
      const next = { ...f };
      if (values.annualFamilyIncome !== undefined) {
        next.annualFamilyIncome = String(values.annualFamilyIncome);
      }
      if (values.previousYearPercentage !== undefined) {
        next.previousYearPercentage = String(values.previousYearPercentage);
      }
      if (values.classOrYear !== undefined) {
        next.classOrYear = String(values.classOrYear);
      }
      if (values.community !== undefined) {
        next.community = String(values.community);
      }
      if (values.disabilityPercentage !== undefined) {
        next.disabilityPercentage = String(values.disabilityPercentage);
        // A percentage on the certificate is itself the proof of the claim, so
        // ticking it answers the yes/no question too.
        if (values.isDifferentlyAbled === undefined) next.isDifferentlyAbled = true;
      }
      if (values.isFirstGraduate !== undefined) {
        // Narrowed rather than cast: a malformed response must not be able to
        // push a string into a field the profile schema declares boolean.
        next.isFirstGraduate = typeof values.isFirstGraduate === "boolean" ? values.isFirstGraduate : null;
      }
      if (values.isDifferentlyAbled !== undefined) {
        next.isDifferentlyAbled =
          typeof values.isDifferentlyAbled === "boolean" ? values.isDifferentlyAbled : null;
      }
      return next;
    });
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleDoc = (t: DocumentType) =>
    setDocs((d) => (d.includes(t) ? d.filter((x) => x !== t) : [...d, t]));

  /**
   * One place that turns form state into a profile, so the "check" and "save"
   * buttons can never disagree about what the student answered.
   *
   * Dropping every unanswered question is the point: an absent key is what makes
   * the engine say "unknown" — sending `false` here would silently rule a
   * student out of most of the catalogue.
   */
  function buildProfile(): StudentProfile {
    const answered = (value: boolean | null): boolean | undefined => value ?? undefined;

    return {
      level: form.level as StudentProfile["level"],
      classOrYear: Number(form.classOrYear) || 1,
      gender: form.gender as StudentProfile["gender"],
      community: form.community as StudentProfile["community"],
      religion: form.religion as StudentProfile["religion"],
      domicileState: form.domicileState,
      course: form.course.trim() || undefined,
      annualFamilyIncome: form.annualFamilyIncome
        ? Number(form.annualFamilyIncome)
        : undefined,
      previousYearPercentage: form.previousYearPercentage
        ? Number(form.previousYearPercentage)
        : undefined,
      disabilityPercentage: form.disabilityPercentage
        ? Number(form.disabilityPercentage)
        : undefined,
      admissionRoute: form.admissionRoute as StudentProfile["admissionRoute"],
      institutionType: form.institutionType as StudentProfile["institutionType"],
      isMinority: answered(form.isMinority),
      isFirstGraduate: answered(form.isFirstGraduate),
      studiedClass6to12InGovtSchool: answered(form.studiedClass6to12InGovtSchool),
      isDifferentlyAbled: answered(form.isDifferentlyAbled),
      isExServicemenWard: answered(form.isExServicemenWard),
      isEminentSportsPerson: answered(form.isEminentSportsPerson),
      isOrphan: answered(form.isOrphan),
      isCovidAffectedWard: answered(form.isCovidAffectedWard),
      isArmedForcesMartyrWard: answered(form.isArmedForcesMartyrWard),
      isSriLankanTamil: answered(form.isSriLankanTamil),
      isNccCadet: answered(form.isNccCadet),
      hasNativityCertificate: answered(form.hasNativityCertificate),
      bankAccountAadhaarSeeded: answered(form.bankAccountAadhaarSeeded),
      hasValidAadhaar: answered(form.hasValidAadhaar),
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const profile = buildProfile();
    const heldDocuments: HeldDocument[] = docs.map((type) => ({ type, confirmed: true }));

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, documents: heldDocuments }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const report = await res.json();
      sessionStorage.setItem("thonmai:report", JSON.stringify(report));
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Restores a saved profile when arriving from "Use these" on the account page.
   * Reading the query string in an effect keeps this page statically renderable,
   * unlike `useSearchParams`, which would force a Suspense boundary.
   */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("saved");
    if (!id) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profiles");
        if (!res.ok) return;
        const json = await res.json();
        const found = (json.profiles ?? []).find((p: { id: string }) => p.id === id);
        if (!found || cancelled) return;

        setForm((f) => ({ ...f, ...found.profile }));
        setDocs((found.documents ?? []).map((d: { type: DocumentType }) => d.type));
        setSaveMessage(`Loaded your saved answers. Remember to press “Show what I qualify for”.`);
        window.history.replaceState({}, "", "/check");
      } catch {
        // A failed restore is not worth interrupting the form over.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Persists the current answers to the student's account. Requires a session:
   * a 401 sends them to the login page with a note about coming back.
   */
  async function saveAnswers() {
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `${form.level.toUpperCase()} · ${form.course.trim() || "no course"}`,
          profile: buildProfile(),
          documents: docs.map((type) => ({ type, confirmed: true })),
        }),
      });

      if (res.status === 401) {
        setSaveMessage("Log in to save your answers, then press Save again.");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not save your answers.");
      setSaveMessage(`Saved. You can find it under My account.`);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Could not save your answers.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <DocumentScanner onApply={applyScanned} readingAvailable={readingAvailable} />
      <form onSubmit={onSubmit} className="space-y-5">
      <Section title="What are you studying?" ta="நீங்கள் என்ன படிக்கிறீர்கள்?">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="level">Level</label>
            <select
              id="level"
              className="field"
              value={form.level}
              onChange={(e) => set("level", e.target.value)}
            >
              {LEVELS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="classOrYear">
              {form.level === "school" || form.level === "iti" || form.level === "diploma"
                ? "Class of study"
                : "Year of study"}
            </label>
            <input
              id="classOrYear"
              type="number"
              min={1}
              // School and ITI run to class 12; a degree runs to year 6. Keeping
              // the limit tied to the level stops a scan of a class 12 marksheet
              // landing in a form that would silently reject it.
              max={classYearMax(form.level)}
              className="field"
              value={form.classOrYear}
              onChange={(e) => set("classOrYear", e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-soft">
              {classYearMax(form.level) === 12
                ? "1 to 12 for school and ITI."
                : "1 to 6 for a degree."}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="course">Course (optional)</label>
            <input
              id="course"
              className="field"
              placeholder="e.g. B.Sc Mathematics"
              value={form.course}
              onChange={(e) => set("course", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="institutionType">Institution type</label>
            <select
              id="institutionType"
              className="field"
              value={form.institutionType}
              onChange={(e) => set("institutionType", e.target.value)}
            >
              <option value="government">Government</option>
              <option value="government_aided">Government-aided</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Category and background" ta="சமூதி மற்றும் பின்னணி">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="community">Community</label>
            <select
              id="community"
              className="field"
              value={form.community}
              onChange={(e) => set("community", e.target.value)}
            >
              {COMMUNITIES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="admissionRoute">Admission route</label>
            <select
              id="admissionRoute"
              className="field"
              value={form.admissionRoute}
              onChange={(e) => set("admissionRoute", e.target.value)}
            >
              <option value="government_quota">Government quota</option>
              <option value="management_quota">Management quota</option>
              <option value="nri_quota">NRI quota</option>
              <option value="minority_quota">Minority quota</option>
              <option value="not_applicable">Not applicable</option>
            </select>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <TriState
            name="firstGraduate"
            title="First graduate in my family"
            ta="குடுமத்தில் முதலாம் பட்டதாரி நான்"
            hint="Issued by the Deputy Tahsildar — a strong signal for several schemes."
            value={form.isFirstGraduate}
            onChange={(v) => set("isFirstGraduate", v)}
          />
          <TriState
            name="govtSchool"
            title="Studied Classes 6-12 in a government school"
            ta="6-12 ஆம் வகுப்புகளை அரசுப் பள்ளியில் படித்தேன்"
            hint="Unlocks the 7.5% horizontal quota."
            value={form.studiedClass6to12InGovtSchool}
            onChange={(v) => set("studiedClass6to12InGovtSchool", v)}
          />
          <TriState
            name="pwd"
            title="Certified as differently abled"
            ta="மாற்றுத்திறனாளி அறிவிப்புச் சான்றிதழ் உள்ளது"
            hint="Needs a medical board certificate plus UDID."
            value={form.isDifferentlyAbled}
            onChange={(v) => set("isDifferentlyAbled", v)}
          />
          <div>
            <label className="label" htmlFor="disabilityPercentage">
              Disability percentage
              <span className="ta block text-sm font-normal text-ink-soft">மாற்றுத்திறன் சதவீதம்</span>
            </label>
            <input
              id="disabilityPercentage"
              type="number"
              min={0}
              max={100}
              step="any"
              className="field"
              placeholder="Leave blank if you do not know"
              value={form.disabilityPercentage}
              onChange={(e) => set("disabilityPercentage", e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-soft">
              Most schemes need 40% or more. A certificate alone is not enough — the
              UDID number is also required.
              <span className="ta block">பெரும்பாலான திட்டங்களுக்கு 40% அல்லது அதற்கு மேல் தேவை.</span>
            </p>
          </div>
          <TriState
            name="exService"
            title="Ward of ex-servicemen or serving personnel"
            ta="ஓய்வுபெற்ற அல்லது பணியில் உள்ள பாதுகாப்புப் படை அரசியல் குடிம்பத்தினர்"
            value={form.isExServicemenWard}
            onChange={(v) => set("isExServicemenWard", v)}
          />
          <TriState
            name="sports"
            title="Eminent sports person"
            ta="சிறப்பு விளையாட்டு வீரர்"
            value={form.isEminentSportsPerson}
            onChange={(v) => set("isEminentSportsPerson", v)}
          />
          <TriState
            name="orphan"
            title="Orphan or ward"
            ta="அனாதை அல்லது பாதுகாவல்"
            value={form.isOrphan}
            onChange={(v) => set("isOrphan", v)}
          />
          <TriState
            name="minority"
            title="Belongs to a notified minority community"
            ta="அறிவிக்கப்பட்ட சிறுப்பெயின் சமூதியைச் சேர்ந்தவன்"
            value={form.isMinority}
            onChange={(v) => set("isMinority", v)}
          />
          <TriState
            name="sriLankan"
            title="Sri Lankan Tamil"
            ta="இலங்கைத் தமிழரன்"
            value={form.isSriLankanTamil}
            onChange={(v) => set("isSriLankanTamil", v)}
          />
          <TriState
            name="ncc"
            title="NCC cadet"
            ta="NCC இளம் உறுப்பினர்"
            value={form.isNccCadet}
            onChange={(v) => set("isNccCadet", v)}
          />
          <TriState
            name="nativity"
            title="Hold a nativity certificate"
            ta="தரிசம் சான்றிதழ் உள்ளது"
            value={form.hasNativityCertificate}
            onChange={(v) => set("hasNativityCertificate", v)}
          />
        </div>
      </Section>

      <Section title="Money and marks" ta="பணம் மற்றும் மதிப்பெண்கள்">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="income">Annual family income (₹)</label>
            <input
              id="income"
              type="number"
              min={0}
              className="field"
              placeholder="180000"
              value={form.annualFamilyIncome}
              onChange={(e) => set("annualFamilyIncome", e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-soft">
              Leave blank if you do not know — we will ask, not guess.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="pct">Last exam percentage (%)</label>
            <input
              id="pct"
              type="number"
              min={0}
              max={100}
              className="field"
              placeholder="87"
              value={form.previousYearPercentage}
              onChange={(e) => set("previousYearPercentage", e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <TriState
            name="bank"
            title="My bank account is seeded with Aadhaar"
            ta="வங்கிக் கணக்கு ஆதாருடன் இணைக்கப்பட்டுள்ளது"
            value={form.bankAccountAadhaarSeeded}
            onChange={(v) => set("bankAccountAadhaarSeeded", v)}
          />
          <TriState
            name="aadhaarOk"
            title="I have a valid Aadhaar"
            ta="சரியான ஆதார் உள்ளது"
            hint="Most payments go by Direct Benefit Transfer."
            value={form.hasValidAadhaar}
            onChange={(v) => set("hasValidAadhaar", v)}
          />
        </div>
      </Section>

      <Section
        title="What do you already hold?"
        ta="உங்களிடம் ஏற்கனவே உள்ள சான்றிதழ்கள்"
      >
        <p className="text-sm text-ink-soft">
          Tick everything you already have. We will not ask you to upload anything to
          get a result, and nothing you tick leaves your browser.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOCS.map(([type, label, ta]) => (
            <Check
              key={type}
              name={type}
              title={label}
              ta={ta}
              checked={docs.includes(type)}
              onChange={() => toggleDoc(type)}
            />
          ))}
        </div>
      </Section>

      {error ? (
        <p role="alert" className="rounded bg-clay-100 px-3 py-2 text-sm text-clay-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Checking…" : "Show what I qualify for"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void saveAnswers()}
          disabled={saving || busy}
        >
          {saving ? "Saving…" : "Save these answers"}
          <span className="ta block text-xs">பதில்களைச் சேமி</span>
        </button>
      </div>

      {saveMessage ? (
        <p role="status" className="rounded bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {saveMessage}
        </p>
      ) : null}
      </form>
    </div>
  );
}
