import { OnboardingForm } from "@/components/onboarding-form";
import { requireUser } from "@/lib/auth/request";
import { readingAvailable } from "@/lib/ocr/extract";

export const metadata = { title: "Check eligibility — Thonmai" };

/**
 * Account-only, and therefore dynamic: the session cookie has to be read before
 * the form is served, so this page cannot be prerendered.
 */
export const dynamic = "force-dynamic";

export default async function CheckPage() {
  const user = await requireUser("/check");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Check your eligibility</h1>
      <p className="ta mt-1 text-lg text-clay-600">உங்கள் உரிமையைச் சரிபார்க்கவும்</p>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Signed in as <span className="font-medium text-ink">{user.email}</span>. Blank
        answers are never treated as a &quot;no&quot; — we will ask you instead. When you
        are ready, save your answers so the next check takes seconds.
      </p>

      <div className="mt-8">
        <OnboardingForm readingAvailable={readingAvailable()} />
      </div>
    </div>
  );
}
