import { requireUser } from "@/lib/auth/request";
import { ResultsView } from "@/components/results-view";

export const metadata = { title: "Your results — Thonmai" };

/**
 * Account-only, and therefore dynamic: a signed-out visitor is redirected to the
 * login page rather than being shown an empty shell with no session behind it.
 */
export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  await requireUser("/results");
  return <ResultsView />;
}
