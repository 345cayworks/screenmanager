"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewClientForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    phone: "",
    approvalMode: "REQUIRES_APPROVAL",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed");
      return;
    }
    setForm({ companyName: "", contactName: "", contactEmail: "", phone: "", approvalMode: "REQUIRES_APPROVAL" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {(["companyName", "contactName", "contactEmail", "phone"] as const).map((k) => (
        <div key={k}>
          <label className="block text-xs font-medium text-slate-600 capitalize">{k.replace(/([A-Z])/g, " $1")}</label>
          <input
            value={form[k]}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            required={k === "companyName"}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
      ))}
      <div>
        <label className="block text-xs font-medium text-slate-600">Approval mode</label>
        <select
          value={form.approvalMode}
          onChange={(e) => setForm({ ...form, approvalMode: e.target.value })}
          className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="REQUIRES_APPROVAL">REQUIRES_APPROVAL</option>
          <option value="AUTO_PUBLISH">AUTO_PUBLISH</option>
        </select>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm py-2 rounded">
        {busy ? "Saving…" : "Create client"}
      </button>
    </form>
  );
}
