# Thonmai (தொண்மை)

**Know what you qualify for, before you apply.**

Thonmai is a Tamil Nadu–first scholarship and benefit eligibility engine. A
student fills in a short profile, optionally uploads certificates, and gets a
ranked list of the schemes they can claim — each with a plain English/Tamil
explanation of *why*, the exact documents needed, and the office to visit.

It never asks for an Aadhaar number, never logs into a government portal, and
never submits an application on the student's behalf.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional: enables the Gemini reader
npm run dev                   # http://localhost:3000
```

The app works with no configuration at all. Documents are then read on the
machine you are running on, and nothing is sent anywhere.

To use it properly instead of just running the tests:

```bash
npm run typecheck        # tsc --noEmit
npm test                 # 228 tests
npm run build            # production build
npm run verify:sources   # live re-probe of every official document cited
npm run check            # typecheck + tests + live source verification
```

`npm run check` is the one to run before shipping anything. It exits non-zero if
a type breaks, a test fails, or a cited government document has disappeared.

---

## Status

**Live App:** [https://thonmai-engine.onrender.com](https://thonmai-engine.onrender.com) (Deployed via Render)

| Area | State |
| --- | --- |
| Eligibility engine | Complete, 228 tests passing |
| Curated dataset | 50 schemes (26 TN, 24 central), 41 sources (39 official) |
| Quota model | TN 69% roster, horizontal and special quotas, central contrast |
| Document registry | 17 document types with issuing authority and validity rules |
| Web UI | `/`, `/login`, `/register`, `/check`, `/results`, `/account`, `/documents`, `/quota`, `/schemes`, 50 scheme pages |
| Offline PWA | Fully configured with `@serwist/next`. Installable on mobile devices for offline use |
| API | `/api/match`, `/api/schemes`, `/api/verify-sources`, `/api/auth/*`, `/api/profiles`, `/api/ocr/extract` |
| Source verification | 41 unique documents probed live, 0 missing, 12 needing a manual look |
| Accounts / database | `node:sqlite`, email + password, saved profiles |
| Document reading | Gemini and OCR.Space for photos and scanned PDFs; `pdftotext` for PDFs |

---

## Who can use what

The account is **required** to check eligibility. It exists to hold nothing more
than an email, a password hash, and the answers a student chooses to save.

| Route | Signed out |
| --- | --- |
| `/`, `/schemes`, `/schemes/[id]`, `/quota`, `/documents` | Public |
| `/login`, `/register` | Public |
| `/check`, `/results`, `/account` | Redirects to `/login?next=…` |
| `POST /api/match` | `401` |
| `POST /api/ocr/extract` | `401` |
| `/api/profiles` | `401` |
| `GET /api/schemes`, `GET /api/verify-sources` | Public |

The API gates are not a restatement of the page gates. A redirect in the page
hides a button; it does not stop anyone from calling the endpoint directly, and
the engine is the expensive part of this app. Both layers check.

`/documents` is public on purpose: a student should be able to find out which
certificates they need *before* deciding to register.

---

## How eligibility is decided

Every scheme is a rule tree, not a boolean. The evaluator returns
**pass / fail / unknown** per condition, and the three-way outcome is the point:

- `eligible` — every condition is satisfied.
- `needs_document` — you qualify, but a mandatory file is missing.
- `unknown` — we cannot decide until you answer something. The UI lists the exact
  questions, ordered by how many schemes each one unlocks.
- `ineligible` — a condition *definitely* fails, and the reason is shown.

The rule that matters most: **a blank answer is never a "no."** Disadvantage
markers (first graduate, ex-servicemen ward, disability, government school,
minority) gate most of this catalogue, so treating an unanswered boolean as false
would quietly rule a student out of nearly every scheme. An unanswered input
produces `unknown`, and a definite failure always dominates an unknown inside an
`all(...)` — you are only shown `ineligible` when something is genuinely,
provably false.

```ts
import { matchSchemes } from "@/engine/match";
import { ALL_SCHEMES } from "@data/index";

const report = matchSchemes(ALL_SCHEMES, profile, heldDocuments);
report.eligible;        // schemes you can claim now
report.needsDocument;   // qualify, missing paperwork
report.unknown;         // waiting on an answer
report.totalAnnualEstimate;
```

### Why benefit totals are split

`annualEstimate` counts only recurring money. A ₹45,000 laptop is real value but
not annual income, so it is excluded from the headline figure and tracked
separately as `oneTimeValue` (with `totalValue` for the full picture).
Components sharing an `exclusiveGroup` are treated as alternatives, so a staged
scheme (Classes 9–10 **or** 11–12) is not counted twice.

A component marked `kind: "loan"` is also excluded and reported as `loanValue`.
Repayable debt is not money received: without this, PM Vidya Lakshmi's ₹5,00,000
sanctioned amount would have inflated a bare-profile report from a true ₹25,000
of benefit to a fictional "₹5.25 lakh per year". Loan-only schemes still surface
in results, clearly labelled as loans you repay.

---

## Tamil Nadu reservation model

The most misunderstood part of TN admissions, so the data models it explicitly:

- Seven top-level blocks total exactly 100%: BC 30, MBC/DNC 20, SC 18, ST 1,
  OC 31 — **69% reserved**.
- BC = 26.5 + BCM 3.5 (inside the 30% block); SC = 15 + SCA 3 (inside 18%);
  MBC = 10.5 + 7 + 2.5 = 20.
- The 7.5% government-school quota (Classes 6–12, bonafide with EMIS number) is
  **horizontal** — it cuts across every vertical category and does not reduce the
  69%.
- **Tamil Nadu has no EWS quota.** The app never offers one. Central institutions
  do: 10% EWS at an ₹8 lakh ceiling, shown only for contrast.

`data/quota.ts` is validated in tests: blocks must sum to 100%, reserved share to
69%, and no sub-quota may exceed its parent.

---

## Documents

`/documents` explains, per certificate, what it proves, who issues it, what is
read from it, and what has to be typed by hand. The same data drives the upload
picker and the expected-field hints in the scanner, so the guidance cannot drift
from the form.

The split that matters: a certificate proves a fact *about* the student, but
almost nothing proves which course they are in, how they got admitted, or how they
were taught. Only the student or their college knows that, so those fields are
asked directly and labelled as manual rather than left to look like a gap in the
document reader.

### Who reads the file

One reader: **Gemini**. The app does no local text recognition — Tesseract and
its `tessdata` model are gone, along with the rasterising step that fed them.
Photographs and scanned PDFs are sent to Google, which reads handwriting and
Tamil far better than the local engine ever managed.

The one exception is not recognition. A PDF that already contains selectable
text is read with `pdftotext` (Poppler), which returns text the PDF already
holds — no model, no network. It is worth keeping because it is free, exact and
instant, and because Gemini 503s and rate-limits under load. Sending a
government portal PDF to a cloud model would cost money, spend a student's
privacy, and add a round trip to buy a slightly worse copy of the same text.

**Poppler is therefore an optional dependency.** `pdf-text.ts` treats every
failure — binary missing, not installed, timeout — as "no text layer" and falls
through to Gemini. A host without Poppler still reads every document; it just
pays for the PDFs too. That is what keeps the deploy simple.

There is no local fallback for photographs. Without `GEMINI_API_KEY`,
`readingAvailable()` returns false, the server refuses the upload with an
explanation rather than a bare error, and the interface hides the button and
tells the student to fill the form in by hand. Both halves of that are pinned by
tests, because losing the feature silently is the main risk of having one reader.

`gemini-3.8-flash` is the default model. Google's own error message recommends it
for newly created keys, and `gemini-2.5-flash` now returns 404 for them. Two
measured quirks are documented in `src/lib/ocr/reader-gemini.ts`: custom
`safetySettings` cause a 503 on this model, and asking for a full transcription
overflows the token limit and truncates the JSON.

### What is never collected

No Aadhaar number, OTP, bank account number, government credential, or payment
detail is ever requested or stored. Aadhaar-*shaped* and card-shaped digit strings
are masked out of any extracted text before it is returned. Two yes/no questions
are asked — whether the student has a valid Aadhaar, and whether their bank
account is seeded with it — because Direct Benefit Transfer genuinely turns on
the second. Both are booleans; neither asks for the number.

---

## Data provenance

Every scheme cites its sources, and the UI shows them. A scheme with only
non-official sources is flagged low-confidence. `hasNonOfficialSource` on a report
warns when a headline total leans on weaker evidence.

Live TN portals (`umis.tn.gov.in` and friends) are Aadhaar/OTP-gated or
unavailable, so the catalogue is **curated and versioned** rather than scraped at
runtime.

The National Scholarship Portal was investigated as a bulk data source and
**rejected**: `scholarships.gov.in/All-Scholarships` returns a ~205 KB Struts
shell with the scheme list bound to session-scoped JavaScript, and its candidate
JSON endpoints all return that same HTML. The 51 guideline PDFs it links *are*
stable, so NSP is used for document verification rather than catalogue ingest.

Instead of scraping, `npm run verify:sources` proves the citations are real. It
probes every unique document URL (HEAD, then GET when HEAD is refused, which NSP
requires) and distinguishes three outcomes:

- **missing** — GET-confirmed 404/410. The document is gone; this fails CI.
- **blocked / slow** — 403, timeout, or 5xx. Reported as needing a manual look,
  never as a missing document, because `.tn.gov.in` portals routinely block
  datacentre IPs.
- **reachable** — served a 200/206.

Results are cached for 6 hours and exposed at `/api/verify-sources`. Latest run:
**41 unique documents, 0 missing, 12 needing a manual check.**

---

## Layout

```
src/engine/       rule DSL, evaluator, benefit maths, matcher  (no framework deps)
data/             schemes, sources, quota, document registry
src/lib/db/       node:sqlite connection, migrations, repositories
src/lib/auth/     bcrypt, sessions, cookie and origin handling
src/lib/ocr/      upload validation, Gemini reader, PDF text, redaction, parsing
src/lib/documents/ certificate plan shared by the guide, picker and scanner
src/app/          Next.js routes and bilingual UI
src/components/   onboarding form, results, cards, scanner, auth
scripts/          source verification CLI
tests/            228 tests: engine, quota, benefits, dataset, auth, profiles, reading, sources
```

The engine is deliberately framework-free so the rules stay testable and
portable. `data/` depends on `src/engine/`, never the reverse.

---

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Required for any document reading. Without it the upload UI is hidden. Never commit it. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Any model the key can reach. |
| `THONMAI_DB_PATH` | `.thonmai/app.db` | Parent directory is created `0700`, file `0600`. |

---

## Security notes

- No Aadhaar number, OTP, bank account number or government login is ever
  requested or stored.
- Passwords are bcrypt at cost 12. Session tokens are 256 random bits, of which
  only the SHA-256 digest is stored, so a copy of the database does not hand over
  live sessions.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, 30-day lifetime.
- Uploads are written to a private temp directory, read once, and deleted in a
  `finally` block that runs on every path including a crash. Magic bytes are
  sniffed, so a renamed script is rejected, and no extracted text is persisted.
- Reading only ever *suggests* values. Nothing reaches the form until the student
  ticks it, because a wrong income or category guess would quietly misstate their
  eligibility.
- Saved profiles are scoped by user id in SQL and every read is filtered, so one
  account can never read or delete another's answers.
- State-changing routes check `Origin` and are rate limited per client. The
  document-reading route is included in both: without the origin check, a page on
  another site could POST a visitor's file here and spend the app's Gemini quota.
- `last_seen_at` is written at most once an hour per session, so browsing the
  checker does not turn every page load into a database write.

---

## Known limits

Worth stating plainly rather than discovering later.

- **Registration reveals that an address is taken.** The wording is identical to
  a failed login, but the `409` status still differs from the login route's
  `401`, so a determined script can enumerate addresses. The alternative is
  telling a student who has already registered that their password is wrong,
  which loses them at exactly the wrong moment. We accept the signal and pay for
  it with the rate limit. Closing it properly needs an email-verification step,
  and this project has no email provider.
- **Rate limits are per process, held in memory.** They reset on deploy and do not
  coordinate across instances. A single-instance deployment is fine; a scaled one
  needs a shared store.
- **Document reading has no local fallback.** If the key is missing, invalid, or
  the quota is exhausted, photographs cannot be read at all. The interface hides
  the upload and the form still works, but this is a single point of failure that
  a second reader would remove.
- **12 official sources could not be reached from here**, mostly bot-blocked TN
  portals. They are flagged for manual review, not treated as missing.
- **No password reset.** There is no email provider, so a forgotten password
  means a lost account. The registration form says so rather than offering a
  button that cannot work.
- **The dataset is curated, not live.** Rules change; the source verifier tells
  you when a cited document disappears, but it cannot tell you that a portal
  quietly revised a rule while keeping the same URL.

---

## Deployment requirements

- **Node 22.5+** for `node:sqlite`. Developed and tested on 24.18.1.
- **Poppler** (`pdftotext`) is optional. Install it to keep text-layer PDFs off
  the API; skip it and every PDF is read by Gemini instead. Nothing else is
  required: there is no OCR model, no worker and no native module left to ship.
- `output: "standalone"` is set, so a container image can copy `.next/standalone`
  and skip `node_modules` entirely.
- `.thonmai/` holds the SQLite file. Back it up, and keep it out of version
  control and out of any image that gets published.
- If you enable the Gemini reader, set `GEMINI_API_KEY` in the host's secret
  store. A key committed to the repository is a key to revoke.

---

## Licence and data

Scheme facts come from public government notifications. The code is a prototype;
always confirm eligibility on the official portal before applying.
