"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mapping = {
  id: string;
  clientName: string;
  optisignsPlaylistId: string;
  optisignsPlaylistName: string | null;
  optisignsScreenId: string | null;
  optisignsScreenName: string | null;
  canPublishDirectly: boolean;
};

export default function MappingsTable({ mappings }: { mappings: Mapping[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unassign(m: Mapping) {
    const ok = window.confirm(
      `Unassign "${m.optisignsPlaylistName || m.optisignsPlaylistId}" from ${m.clientName}?\n\n` +
        `This removes the mapping plus any local drafts for it. Asset references are kept. The physical screen on OptiSigns is NOT changed — you'd retarget that separately if needed.`
    );
    if (!ok) return;
    setBusy(m.id);
    setError(null);
    const res = await fetch(`/api/admin/mappings/${m.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || `HTTP ${res.status}`);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error && (
        <div className="m-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left py-2 px-4">Client</th>
            <th className="text-left py-2 px-4">Playlist</th>
            <th className="text-left py-2 px-4">Screen</th>
            <th className="text-left py-2 px-4">Direct publish</th>
            <th className="text-right py-2 px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {mappings.map((m) => (
            <tr key={m.id}>
              <td className="py-2 px-4 font-medium text-slate-900">{m.clientName}</td>
              <td className="py-2 px-4">
                <div className="text-slate-900">{m.optisignsPlaylistName || "—"}</div>
                <div className="font-mono text-xs text-slate-500">{m.optisignsPlaylistId}</div>
              </td>
              <td className="py-2 px-4">
                <div className="text-slate-900">{m.optisignsScreenName || "—"}</div>
                <div className="font-mono text-xs text-slate-500">{m.optisignsScreenId || ""}</div>
              </td>
              <td className="py-2 px-4 text-slate-600">{m.canPublishDirectly ? "Yes" : "No"}</td>
              <td className="py-2 px-4 text-right">
                <button
                  onClick={() => unassign(m)}
                  disabled={busy === m.id}
                  className="text-xs text-red-600 hover:text-red-700 disabled:text-slate-300 font-medium"
                >
                  {busy === m.id ? "Unassigning…" : "Unassign"}
                </button>
              </td>
            </tr>
          ))}
          {mappings.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-8 text-slate-500">
                No mappings yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
