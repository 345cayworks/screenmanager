import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default function SetupPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token || "";
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 text-white font-bold text-xl">
            C
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Set your password</h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose a password to finish setting up your account.
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {token ? (
            <SetupForm token={token} />
          ) : (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              This page needs a valid invitation link. Ask your administrator to send you one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
