"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAssetForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    clientId: clients[0]?.id || "",
    optisignsAssetId: "",
    title: "",
    type: "IMAGE",
    thumbnailUrl: "",
    sourceUrl: "",
    status: "APPROVED",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.thumbnailUrl) delete payload.thumbnailUrl;
    if (!payload.sourceUrl) delete payload.sourceUrl;
    const res = await fetch("/api/admin/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed");
      return;
    }
    setForm({ ...form, optisignsAssetId: "", title: "", thumbnailUrl: "", sourceUrl: "" });
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
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">OptiSigns Asset ID</label>
        <input required value={form.optisignsAssetId} onChange={(e) => setForm({ ...form, optisignsAssetId: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Title</label>
        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Type</label>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
          {["IMAGE", "VIDEO", "WEBSITE", "URL", "UNKNOWN"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Thumbnail URL (optional)</label>
        <input value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Source URL (optional)</label>
        <input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm py-2 rounded">
        {busy ? "Saving…" : "Save asset"}
      </button>
    </form>
  );
}
