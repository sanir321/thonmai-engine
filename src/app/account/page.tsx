import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/request";
import { AccountPanel } from "@/components/account-panel";

export const metadata = { title: "My account — Thonmai" };
// The session lives in a cookie, so this page cannot be prerendered.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">My account</h1>
      <p className="ta mt-1 text-lg text-clay-600">எனது கணக்கு</p>
      <div className="mt-8">
        <AccountPanel email={user.email} />
      </div>
    </div>
  );
}
