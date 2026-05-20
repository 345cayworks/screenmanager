"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm({ token }: { token: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (pw !== pw2) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/setup-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: pw }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Setup failed");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">New password</label>
        <input
          type="password"
          required
          minLength={10}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          autoComplete="new-password"
        />
        <p className="text-xs text-slate-500 mt-1">At least 10 characters.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Confirm password</label>
        <input
          type="password"
          required
          minLength={10}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          autoComplete="new-password"
        />
      </div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-medium py-2.5 rounded-lg text-sm transition"
      >
        {loading ? "Setting password…" : "Set password & sign in"}
      </button>
    </form>
  );
}
