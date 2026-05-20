"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, statusTone } from "@/components/ui";
import OnboardModal from "./OnboardModal";

// ----- Types -----

type ClientRow = {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  status: string;
  approvalMode: string;
  mappings: number;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  clientId: string | null;
  hasPassword: boolean;
  createdAt: string;
};

type Props = {
  currentUserId: string;
  clients: ClientRow[];
  users: UserRow[];
};

const CLIENT_ROLES = ["CLIENT_OWNER", "CLIENT_EDITOR", "VIEWER"] as const;
const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"] as const;
const ALL_ROLES = [...ADMIN_ROLES, ...CLIENT_ROLES] as const;

// ----- Component -----

export default function ClientsHub({ currentUserId, clients, users }: Props) {
  const router = useRouter();
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [linkModal, setLinkModal] = useState<{ email: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const adminTeam = useMemo(() => users.filter((u) => !u.clientId), [users]);
  const usersByClient = useMemo(() => {
    const map = new Map<string, UserRow[]>();
    for (const u of users) {
      if (!u.clientId) continue;
      const arr = map.get(u.clientId) ?? [];
      arr.push(u);
      map.set(u.clientId, arr);
    }
    return map;
  }, [users]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ----- API actions -----

  async function call(label: string, url: string, init: RequestInit = {}): Promise<any | null> {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`);
        return null;
      }
      return body;
    } finally {
      setBusy(null);
    }
  }

  async function inviteUser(
    payload: { name: string; email: string; role: string; clientId: string | null }
  ): Promise<boolean> {
    const body = await call("invite", "/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!body) return false;
    const fullUrl = `${window.location.origin}${body.setupUrl}`;
    setLinkModal({ email: payload.email, url: fullUrl });
    router.refresh();
    return true;
  }

  async function resendSetup(u: UserRow) {
    const body = await call(`reset-${u.id}`, `/api/admin/users/${u.id}/reset`, {
      method: "POST",
    });
    if (!body) return;
    const fullUrl = `${window.location.origin}${body.setupUrl}`;
    setLinkModal({ email: u.email, url: fullUrl });
    router.refresh();
  }

  async function setUserStatus(u: UserRow, status: "ACTIVE" | "INACTIVE") {
    const ok = await call(`status-${u.id}`, `/api/admin/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (ok) router.refresh();
  }

  async function deleteUser(u: UserRow) {
    if (
      !window.confirm(
        `Permanently delete ${u.name} (${u.email})?\n\nThis can't be undone. Their historical drafts and audit log entries are preserved but no longer attributed to them.`
      )
    )
      return;
    const ok = await call(`delete-${u.id}`, `/api/admin/users/${u.id}`, { method: "DELETE" });
    if (ok) router.refresh();
  }

  async function saveClient(c: ClientRow) {
    const ok = await call(`client-${c.id}`, `/api/admin/clients/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        companyName: c.companyName,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        phone: c.phone,
        status: c.status,
      }),
    });
    if (ok) {
      setEditingClient(null);
      router.refresh();
    }
  }

  async function saveUser(u: UserRow) {
    const ok = await call(`user-${u.id}`, `/api/admin/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: u.name,
        role: u.role,
        status: u.status,
        clientId: u.clientId,
      }),
    });
    if (ok) {
      setEditingUser(null);
      router.refresh();
    }
  }

  // ----- Render -----

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Platform admin team */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Platform admins</h2>
            <p className="text-xs text-slate-500">Users with SUPERADMIN or ADMIN role; they aren&apos;t tied to a client.</p>
          </div>
          <InviteInline
            adminOnly
            clients={clients}
            disabled={busy !== null}
            onInvite={(p) => inviteUser(p)}
          />
        </div>
        <UserTable
          users={adminTeam}
          currentUserId={currentUserId}
          busy={busy}
          onEdit={(u) => setEditingUser(u)}
          onResend={resendSetup}
          onToggleStatus={(u) => setUserStatus(u, u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
          onDelete={deleteUser}
          emptyMessage="No admin team members yet."
        />
      </Card>

      {/* Clients */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{clients.length} client(s)</div>
        <button
          onClick={() => setOnboardOpen(true)}
          className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium"
        >
          + Onboard a client
        </button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="w-8" />
              <th className="text-left py-2 px-3">Company</th>
              <th className="text-left py-2 px-3">Contact</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Users</th>
              <th className="text-left py-2 px-3">Mappings</th>
              <th className="text-right py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  No clients yet. Click <strong>Onboard a client</strong> to add your first one.
                </td>
              </tr>
            )}
            {clients.map((c) => {
              const isOpen = expanded.has(c.id);
              const clientUsers = usersByClient.get(c.id) ?? [];
              return (
                <FragmentRow
                  key={c.id}
                  isOpen={isOpen}
                  onToggle={() => toggle(c.id)}
                  client={c}
                  users={clientUsers}
                  currentUserId={currentUserId}
                  clients={clients}
                  busy={busy}
                  onEditClient={() => setEditingClient(c)}
                  onEditUser={(u) => setEditingUser(u)}
                  onResend={resendSetup}
                  onToggleStatus={(u) => setUserStatus(u, u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                  onDeleteUser={deleteUser}
                  onInvite={(p) => inviteUser(p)}
                />
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Modals */}
      <OnboardModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onCompleted={() => router.refresh()}
      />

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onSave={saveClient}
          onClose={() => setEditingClient(null)}
          busy={busy === `client-${editingClient.id}`}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          clients={clients}
          isSelf={editingUser.id === currentUserId}
          onSave={saveUser}
          onClose={() => setEditingUser(null)}
          busy={busy === `user-${editingUser.id}`}
        />
      )}

      {linkModal && (
        <SetupLinkModal email={linkModal.email} url={linkModal.url} onClose={() => setLinkModal(null)} />
      )}
    </div>
  );
}

// ----- Sub-components -----

function FragmentRow(props: {
  isOpen: boolean;
  onToggle: () => void;
  client: ClientRow;
  users: UserRow[];
  currentUserId: string;
  clients: ClientRow[];
  busy: string | null;
  onEditClient: () => void;
  onEditUser: (u: UserRow) => void;
  onResend: (u: UserRow) => void;
  onToggleStatus: (u: UserRow) => void;
  onDeleteUser: (u: UserRow) => void;
  onInvite: (p: { name: string; email: string; role: string; clientId: string | null }) => Promise<boolean>;
}) {
  const { isOpen, onToggle, client: c, users } = props;
  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <td className="px-3 text-slate-400 select-none">{isOpen ? "▾" : "▸"}</td>
        <td className="py-2 px-3 font-medium text-slate-900">{c.companyName}</td>
        <td className="py-2 px-3 text-slate-600">
          <div>{c.contactName || "—"}</div>
          <div className="text-xs text-slate-500">{c.contactEmail || ""}</div>
        </td>
        <td className="py-2 px-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
        <td className="py-2 px-3 text-slate-600">{users.length}</td>
        <td className="py-2 px-3 text-slate-600">{c.mappings}</td>
        <td className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={props.onEditClient}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Edit client
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={7} className="bg-slate-50 p-0">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-900 text-sm">Users for {c.companyName}</h4>
                <InviteInline
                  forClientId={c.id}
                  clients={props.clients}
                  disabled={props.busy !== null}
                  onInvite={props.onInvite}
                />
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <UserTable
                  users={users}
                  currentUserId={props.currentUserId}
                  busy={props.busy}
                  onEdit={props.onEditUser}
                  onResend={props.onResend}
                  onToggleStatus={props.onToggleStatus}
                  onDelete={props.onDeleteUser}
                  emptyMessage="No users for this client yet. Invite the first one."
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function UserTable(props: {
  users: UserRow[];
  currentUserId: string;
  busy: string | null;
  onEdit: (u: UserRow) => void;
  onResend: (u: UserRow) => void;
  onToggleStatus: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
  emptyMessage: string;
}) {
  const { users, currentUserId, busy } = props;
  return (
    <table className="w-full text-sm">
      <thead className="bg-white text-slate-500 text-xs uppercase tracking-wide">
        <tr>
          <th className="text-left py-2 px-4">Name</th>
          <th className="text-left py-2 px-4">Email</th>
          <th className="text-left py-2 px-4">Role</th>
          <th className="text-left py-2 px-4">Status</th>
          <th className="text-right py-2 px-4">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {users.length === 0 && (
          <tr>
            <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
              {props.emptyMessage}
            </td>
          </tr>
        )}
        {users.map((u) => (
          <tr key={u.id}>
            <td className="py-2 px-4 font-medium text-slate-900">{u.name}</td>
            <td className="py-2 px-4 text-slate-600">{u.email}</td>
            <td className="py-2 px-4">
              <Badge tone="indigo">{u.role.replace("_", " ")}</Badge>
            </td>
            <td className="py-2 px-4 space-x-1">
              <Badge tone={statusTone(u.status)}>{u.status}</Badge>
              {!u.hasPassword && <Badge tone="amber">PENDING SETUP</Badge>}
            </td>
            <td className="py-2 px-4 text-right whitespace-nowrap">
              <button
                onClick={() => props.onEdit(u)}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium mr-3"
              >
                Edit
              </button>
              <button
                onClick={() => props.onResend(u)}
                disabled={busy === `reset-${u.id}` || u.status !== "ACTIVE"}
                className="text-xs text-brand-600 hover:text-brand-700 disabled:text-slate-300 font-medium mr-3"
              >
                {u.hasPassword ? "Reset password" : "Re-issue link"}
              </button>
              {u.id !== currentUserId && (
                <>
                  <button
                    onClick={() => props.onToggleStatus(u)}
                    disabled={busy === `status-${u.id}`}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium mr-3"
                  >
                    {u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                  </button>
                  <button
                    onClick={() => props.onDelete(u)}
                    disabled={busy === `delete-${u.id}`}
                    className="text-xs text-red-600 hover:text-red-700 disabled:text-slate-300 font-medium"
                  >
                    Delete
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InviteInline(props: {
  adminOnly?: boolean;
  forClientId?: string;
  clients: ClientRow[];
  disabled: boolean;
  onInvite: (p: { name: string; email: string; role: string; clientId: string | null }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const defaultRole = props.adminOnly ? "ADMIN" : "CLIENT_OWNER";
  const [role, setRole] = useState<string>(defaultRole);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await props.onInvite({
      name,
      email,
      role,
      clientId: props.adminOnly ? null : props.forClientId!,
    });
    if (ok) {
      setOpen(false);
      setName("");
      setEmail("");
      setRole(defaultRole);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={props.disabled}
        className="text-xs px-2.5 py-1 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white rounded font-medium"
      >
        + Invite user
      </button>
    );
  }

  const roleOptions = props.adminOnly ? ADMIN_ROLES : CLIENT_ROLES;

  return (
    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap">
      <input
        required
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs"
      />
      <input
        type="email"
        required
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 text-xs"
      >
        {roleOptions.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
      </select>
      <button
        type="submit"
        disabled={props.disabled}
        className="text-xs px-2.5 py-1 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white rounded font-medium"
      >
        Send invite
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded"
      >
        Cancel
      </button>
    </form>
  );
}

function EditClientModal(props: {
  client: ClientRow;
  onSave: (c: ClientRow) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<ClientRow>(props.client);
  return (
    <Modal onClose={props.onClose} title={`Edit ${props.client.companyName}`}>
      <div className="space-y-3">
        <Field label="Company name">
          <Input value={draft.companyName} onChange={(v) => setDraft({ ...draft, companyName: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact name">
            <Input value={draft.contactName ?? ""} onChange={(v) => setDraft({ ...draft, contactName: v || null })} />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              value={draft.contactEmail ?? ""}
              onChange={(v) => setDraft({ ...draft, contactEmail: v || null })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={draft.phone ?? ""} onChange={(v) => setDraft({ ...draft, phone: v || null })} />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(v) => setDraft({ ...draft, status: v })}
              options={["ACTIVE", "INACTIVE", "SUSPENDED"]}
            />
          </Field>
        </div>
      </div>
      <ModalFooter
        onClose={props.onClose}
        busy={props.busy}
        primaryLabel="Save changes"
        onPrimary={() => props.onSave(draft)}
      />
    </Modal>
  );
}

function EditUserModal(props: {
  user: UserRow;
  clients: ClientRow[];
  isSelf: boolean;
  onSave: (u: UserRow) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<UserRow>(props.user);
  const isAdminRole = draft.role === "SUPERADMIN" || draft.role === "ADMIN";
  return (
    <Modal onClose={props.onClose} title={`Edit ${props.user.name}`}>
      <div className="space-y-3">
        <Field label="Name">
          <Input value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
        </Field>
        <Field label="Email (read-only)">
          <Input value={draft.email} onChange={() => {}} disabled />
        </Field>
        <Field label="Role">
          <Select
            value={draft.role}
            onChange={(v) => {
              const next: UserRow = { ...draft, role: v };
              if (v === "SUPERADMIN" || v === "ADMIN") next.clientId = null;
              setDraft(next);
            }}
            options={[...ALL_ROLES]}
          />
        </Field>
        {!isAdminRole && (
          <Field label="Client">
            <Select
              value={draft.clientId ?? ""}
              onChange={(v) => setDraft({ ...draft, clientId: v || null })}
              options={props.clients.map((c) => ({ value: c.id, label: c.companyName }))}
            />
          </Field>
        )}
        <Field label="Status">
          <Select
            value={draft.status}
            onChange={(v) => setDraft({ ...draft, status: v as "ACTIVE" | "INACTIVE" })}
            options={["ACTIVE", "INACTIVE"]}
            disabled={props.isSelf}
          />
        </Field>
        {props.isSelf && (
          <p className="text-xs text-amber-700">You can&apos;t deactivate your own account.</p>
        )}
      </div>
      <ModalFooter
        onClose={props.onClose}
        busy={props.busy}
        primaryLabel="Save changes"
        onPrimary={() => props.onSave(draft)}
      />
    </Modal>
  );
}

function SetupLinkModal({ email, url, onClose }: { email: string; url: string; onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="Share this setup link">
      <p className="text-sm text-slate-500">
        Send the URL below to <span className="font-medium text-slate-900">{email}</span>. It expires in 7 days and is single-use.
      </p>
      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded font-mono text-xs break-all text-slate-900">
        {url}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => navigator.clipboard.writeText(url)}
          className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium"
        >
          Copy link
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium"
        >
          Done
        </button>
        <p className="text-xs text-amber-700 ml-auto">You won&apos;t see this link again.</p>
      </div>
    </Modal>
  );
}

// ----- Tiny UI primitives -----

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onPrimary,
  primaryLabel,
  busy,
}: {
  onClose: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-medium"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={busy}
        className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white rounded-lg font-medium"
      >
        {busy ? "Saving…" : primaryLabel}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T | "";
  onChange: (v: string) => void;
  options: readonly (T | { value: string; label: string })[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
    >
      {options.map((o) => {
        if (typeof o === "string") return <option key={o} value={o}>{o.replace("_", " ")}</option>;
        return <option key={o.value} value={o.value}>{o.label}</option>;
      })}
    </select>
  );
}
