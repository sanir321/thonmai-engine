import { AuthPanel } from "@/components/auth-panel";

export const metadata = { title: "Log in — Thonmai" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        {next ? "Log in to continue" : "Log in or create an account"}
      </h1>
      <p className="ta mt-1 text-lg text-clay-600">உள்ளே செல் அல்லது கணக்கு உருவாக்கு</p>
      <div className="mt-8">
        <AuthPanel initialMode={next ? "login" : "login"} next={next} />
      </div>
    </div>
  );
}
