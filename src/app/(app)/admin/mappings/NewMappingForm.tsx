"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewMappingForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    clientId: clients[0]?.id || "",
    optisignsPlaylistId: "",
    optisignsPlaylistName: "",
    optisignsScreenId: "",
    optisignsScreenName: "",
    canPublishDirectly: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) {
      setError("Pick a client");
      return;
    }
    setBusy(true);
    setError(null);
    const { clientId, ...body } = form;
    const res = await fetch(`/api/admin/clients/${clientId}/mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed");
      return;
    }
    setForm({ ...form, optisignsPlaylistId: "", optisignsPlaylistName: "", optisignsScreenId: "", optisignsScreenName: "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600">Client</label>
        <select
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
        >
          {clients.length === 0 && <option value="">— No clients —</option>}
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {[
        ["optisignsPlaylistId", "OptiSigns Playlist ID (required)"],
        ["optisignsPlaylistName", "Playlist name"],
        ["optisignsScreenId", "OptiSigns Screen / Device ID"],
        ["optisignsScreenName", "Screen name"],
      ].map(([key, label]) => (
        <div key={key}>
          <label className="block text-xs font-medium text-slate-600">{label}</label>
          <input
            value={(form as Record<string, string | boolean>)[key] as string}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            required={key === "optisignsPlaylistId"}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.canPublishDirectly}
          onChange={(e) => setForm({ ...form, canPublishDirectly: e.target.checked })}
        />
        Allow client to publish directly
      </label>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm py-2 rounded">
        {busy ? "Saving…" : "Save mapping"}
      </button>
    </form>
  );
}
