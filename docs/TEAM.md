# Team

## Recommended: 5 people

Small enough to ship, wide enough that no one person owns a risk. If you have
fewer, cut in this order: design → OCR → accounts. Do **not** cut research or
the engine — they are the product.

| # | Role | Owns | Why it exists |
| --- | --- | --- | --- |
| 1 | **Full-stack lead** | Next.js app, routing, API routes, deploy | Owns the demo and the architecture |
| 2 | **Policy researcher** (TN domain) | Scheme dataset, quota orders, source provenance | The hardest part to get right, and the whole credibility of the product |
| 3 | **Engineer, data + rules** | Rule DSL, evaluator, benefit maths, dataset validation | Turns policy into deterministic, testable logic |
| 4 | **Full-stack / UX** | Onboarding flow, results UI, Tamil-first copy, accessibility | A student must finish the form in minutes on a phone |
| 5 | **Design + content** | Visual design, Tamil translations, microcopy | "தொண்மை" is a brand, not just a form |

## Responsibilities that are easy to drop

- **Source verification is a recurring job, not a launch task.** Someone must
  own re-checking deadlines and amounts before every academic year. A stale
  benefit figure is worse than a missing scheme.
- **Tamil copy needs a native speaker.** Machine-translated government
  terminology ("horizontal quota", "nativity certificate") confuses students.
  This cannot be outsourced to whoever is free that sprint.
- **Someone must own the "we could be wrong" surface.** Deadlines, 80th-percentile
  proxies and non-official sources all need honest labelling in the UI.

## If you must ship smaller

| Team | Cut | Keep |
| --- | --- | --- |
| **3** | Design (fold into UX), OCR, accounts | Lead, researcher, engineer |
| **2** | Everything except the engine and the data | Not recommended: research alone is a full-time job during admission season |
| **1** | Prototype only | Ship the engine + a static results page. No accounts, no OCR. Still a credible portfolio piece. |

## Suggested first two weeks

1. Researcher: verify the 24 highest-value schemes and record `sourceRefs`.
2. Engineer: finish the UI against the existing engine and test fixtures.
3. Everyone: test the onboarding on a real Class 11 student and a real UG
   student; log every question they had to ask twice.
