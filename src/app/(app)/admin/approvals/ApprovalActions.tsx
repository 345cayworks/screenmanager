"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalActions({ playlistId }: { playlistId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function call(path: string, body?: unknown) {
    setBusy(path);
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="border-t border-slate-100 pt-3 mt-3 flex flex-wrap items-center gap-2">
      <button
        onClick={() => call(`/api/admin/playlists/${playlistId}/approve`)}
        disabled={busy !== null}
        className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg font-medium"
      >
        {busy?.endsWith("/approve") ? "Approving…" : "Approve & Publish"}
      </button>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Rejection reason (optional)"
        className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[200px]"
      />
      <button
        onClick={() => call(`/api/admin/playlists/${playlistId}/reject`, { reason })}
        disabled={busy !== null}
        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-lg font-medium"
      >
        Reject
      </button>
      {error && <div className="text-xs text-red-600 w-full">{error}</div>}
    </div>
  );
}
