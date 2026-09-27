import { AuthPanel } from "@/components/auth-panel";

export const metadata = { title: "Create an account — Thonmai" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
      <p className="ta mt-1 text-lg text-clay-600">கணக்கு உருவாக்கு</p>
      <div className="mt-8">
        <AuthPanel initialMode="register" />
      </div>
    </div>
  );
}
