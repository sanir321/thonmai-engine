import Link from "next/link";
import { HeroActions } from "@/components/hero-actions";
import { ALL_SCHEMES, DATASET_STATS, TN_QUOTA_BLOCKS, blockShare } from "@data/index";

const STEPS = [
  {
    n: "1",
    title: "Tell us about yourself",
    ta: "உங்களைப் பற்றி சொல்லுங்கள்",
    body: "Class, community, family income and a few background facts. No Aadhaar number, ever. No payment either.",
  },
  {
    n: "2",
    title: "See what you qualify for",
    ta: "உங்களுக்குரியவை",
    body: "Every scheme comes with a plain explanation of why you do or do not qualify.",
  },
  {
    n: "3",
    title: "Take the right papers",
    ta: "சரியான ஆவணங்கள்",
    body: "We list the exact certificate, who issues it, and whether an e-Certificate is required.",
  },
];

export default function Home() {
  const reserved = TN_QUOTA_BLOCKS.filter((b) => b.code !== "OC").reduce(
    (s, b) => s + blockShare(b),
    0,
  );

  return (
    <>
      <section className="border-b border-clay-100 bg-gradient-to-b from-clay-50 to-paper">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="ta text-sm font-semibold uppercase tracking-widest text-clay-600">
            தொண்மை
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Know what you qualify for, before you apply.
          </h1>
          <p className="ta mt-3 text-xl text-clay-600">
            விண்ணப்பிக்கும் முன்பே உங்களுக்குரிய சிறப்பு உதவித்தொகைகளை அறியுங்கள்.
          </p>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft">
            {DATASET_STATS.totalSchemes} Tamil Nadu and central schemes, checked against
            the reservation rules that actually apply to you — with the reason for
            every answer, and the exact office to visit.
          </p>

          <HeroActions />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clay-500 text-sm font-bold text-white">
                {s.n}
              </span>
              <h2 className="mt-3 font-semibold">{s.title}</h2>
              <p className="ta text-sm text-clay-600">{s.ta}</p>
              <p className="mt-2 text-sm text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-clay-100 bg-paper-raised">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3">
          <div>
            <p className="text-3xl font-bold text-clay-600">{DATASET_STATS.totalSchemes}</p>
            <p className="text-sm text-ink-soft">
              schemes · {DATASET_STATS.stateSchemes} state, {DATASET_STATS.centralSchemes}{" "}
              central
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-clay-600">{reserved}%</p>
            <p className="text-sm text-ink-soft">
              of Tamil Nadu seats are reserved — most families miss the category that
              applies to them
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-clay-600">
              {DATASET_STATS.officialSources}/{DATASET_STATS.sources}
            </p>
            <p className="text-sm text-ink-soft">sources are official government pages</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-2xl font-bold tracking-tight">What we deliberately do not do</h2>
        <ul className="mt-4 space-y-3 text-ink-soft">
          {[
            "We never ask for your Aadhaar number, and we store nothing that could identify you.",
            "We never log into a government portal on your behalf.",
            "We never submit an application. You apply yourself, and we tell you where.",
            "We tell you when a source is unofficial or a rule is an approximation.",
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-palm-500" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
