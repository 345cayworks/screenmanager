"use client";

import { useEffect, useState } from "react";
import { Card, Badge, statusTone } from "@/components/ui";

type Client = { id: string; name: string };

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  hasPassword: boolean;
  pendingSetup: boolean;
  setupTokenExpiresAt: string | null;
  client: { id: string; companyName: string } | null;
  createdAt: string;
};

const ROLE_OPTIONS = ["SUPERADMIN", "ADMIN", "CLIENT_OWNER", "CLIENT_EDITOR", "VIEWER"] as const;

export default function UsersBrowser({
  clients,
  currentUserId,
}: {
  clients: Client[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ email: string; url: string } | null>(null);

  // Invite form
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "CLIENT_OWNER" as (typeof ROLE_OPTIONS)[number],
    clientId: clients[0]?.id || "",
  });

  async function refresh() {
    setError(null);
    const res = await fetch("/api/admin/users");
    const body = await res.json();
    if (!res.ok) setError(body.error || "Failed to load users");
    else setUsers(body);
  }

  useEffect(() => {
    refresh();
  }, []);

  const isAdminRole = form.role === "SUPERADMIN" || form.role === "ADMIN";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy("invite");
    setError(null);
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      clientId: isAdminRole ? null : form.clientId,
    };
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Invite failed");
      return;
    }
    const fullUrl = `${window.location.origin}${body.setupUrl}`;
    setLinkModal({ email: form.email, url: fullUrl });
    setForm({ ...form, name: "", email: "" });
    refresh();
  }

  async function resendSetup(id: string, email: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}/reset`, { method: "POST" });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Reset failed");
      return;
    }
    const fullUrl = `${window.location.origin}${body.setupUrl}`;
    setLinkModal({ email, url: fullUrl });
    refresh();
  }

  async function setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Update failed");
      return;
    }
    refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-900">All users</h2>
        </div>
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{error}</div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-white text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left py-2 px-4">Name</th>
              <th className="text-left py-2 px-4">Email</th>
              <th className="text-left py-2 px-4">Role</th>
              <th className="text-left py-2 px-4">Client</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-right py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users === null && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {users?.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">No users yet.</td></tr>
            )}
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="py-2 px-4 font-medium text-slate-900">{u.name}</td>
                <td className="py-2 px-4 text-slate-600">{u.email}</td>
                <td className="py-2 px-4">
                  <Badge tone="indigo">{u.role.replace("_", " ")}</Badge>
                </td>
                <td className="py-2 px-4 text-slate-600">{u.client?.companyName || "—"}</td>
                <td className="py-2 px-4 space-x-1">
                  <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                  {!u.hasPassword && <Badge tone="amber">PENDING SETUP</Badge>}
                </td>
                <td className="py-2 px-4 text-right whitespace-nowrap">
                  <button
                    onClick={() => resendSetup(u.id, u.email)}
                    disabled={busy === u.id || u.status !== "ACTIVE"}
                    className="text-xs text-brand-600 hover:text-brand-700 disabled:text-slate-300 font-medium mr-3"
                  >
                    {u.hasPassword ? "Reset password" : "Re-issue link"}
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => setStatus(u.id, u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                      disabled={busy === u.id}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                    >
                      {u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5 h-fit">
        <h2 className="font-semibold text-slate-900 mb-3">Invite a user</h2>
        <form onSubmit={invite} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as (typeof ROLE_OPTIONS)[number] })}
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
          </div>
          {!isAdminRole && (
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
          )}
          <button
            disabled={busy === "invite" || (!isAdminRole && !form.clientId)}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm py-2 rounded font-medium"
          >
            {busy === "invite" ? "Inviting…" : "Send invite"}
          </button>
          <p className="text-xs text-slate-500">
            We'll generate a one-time setup link you can copy and send to the user.
          </p>
        </form>
      </Card>

      {linkModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50"
          onClick={() => setLinkModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900 text-lg">Share this setup link</h3>
            <p className="text-sm text-slate-500 mt-1">
              Send the URL below to <span className="font-medium text-slate-900">{linkModal.email}</span>.
              It expires in 7 days and can only be used once.
            </p>
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded font-mono text-xs break-all text-slate-900">
              {linkModal.url}
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => navigator.clipboard.writeText(linkModal.url)}
                className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium"
              >
                Copy link
              </button>
              <button
                onClick={() => setLinkModal(null)}
                className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium"
              >
                Done
              </button>
              <p className="text-xs text-amber-700 ml-auto">
                You won't see this link again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
