"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OperatingModeToggle({ initialLocal }: { initialLocal: boolean }) {
  const router = useRouter();
  const [local, setLocal] = useState(initialLocal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/settings/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ local: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || `HTTP ${res.status}`);
      return;
    }
    setLocal(next);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-900">
            {local ? "Local-only mode" : "OptiSigns API mode"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {local
              ? "OptiSigns API calls are disabled. Drafts are approved here; admins manually mirror approved playlists into the OptiSigns dashboard. Use this when your OptiSigns plan doesn't include API access."
              : "The portal will talk to OptiSigns directly to pull playlist content and push approved drafts."}
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={local}
            disabled={busy}
            onChange={(e) => toggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all relative peer-checked:bg-brand-600"></div>
          <span className="ml-2 text-xs font-medium text-slate-700">Local</span>
        </label>
      </div>
      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
