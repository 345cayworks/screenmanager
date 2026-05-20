import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const s = await readSession();
  if (s) redirect("/dashboard");
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 text-white font-bold text-xl">
            C
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            {process.env.NEXT_PUBLIC_APP_NAME || "Cayworks Display Manager"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage your screens & playlists.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <LoginForm />
        </div>
        <p className="text-xs text-slate-400 text-center mt-6">
          Need access? Contact your account administrator.
        </p>
      </div>
    </div>
  );
}
