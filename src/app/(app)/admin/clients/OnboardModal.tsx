"use client";

import { useEffect, useState } from "react";

type RemotePlaylist = { optisignsPlaylistId: string; name: string | null; itemCount: number };
type RemoteScreen = { optisignsScreenId: string; name: string | null };

type Result = {
  client: { id: string; companyName: string };
  user: { id: string; email: string } | null;
  mapping: { id: string; optisignsPlaylistId: string } | null;
  setupUrl: string | null;
  importResult: { itemCount: number; assetsCreated: number } | { error: string } | null;
};

export default function OnboardModal({
  open,
  onClose,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}) {
  // --- Client section ---
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [approvalMode, setApprovalMode] = useState<"AUTO_PUBLISH" | "REQUIRES_APPROVAL">("REQUIRES_APPROVAL");

  // --- User section ---
  const [addUser, setAddUser] = useState(true);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"CLIENT_OWNER" | "CLIENT_EDITOR" | "VIEWER">("CLIENT_OWNER");

  // --- Mapping section ---
  const [addMapping, setAddMapping] = useState(false);
  const [playlistId, setPlaylistId] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [screenId, setScreenId] = useState("");
  const [screenName, setScreenName] = useState("");
  const [canPublishDirectly, setCanPublishDirectly] = useState(false);
  const [importNow, setImportNow] = useState(true);

  const [remotePlaylists, setRemotePlaylists] = useState<RemotePlaylist[] | null>(null);
  const [remoteScreens, setRemoteScreens] = useState<RemoteScreen[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // --- Submission ---
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Reset when modal opens.
  useEffect(() => {
    if (open) {
      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setPhone("");
      setApprovalMode("REQUIRES_APPROVAL");
      setAddUser(true);
      setUserName("");
      setUserEmail("");
      setUserRole("CLIENT_OWNER");
      setAddMapping(false);
      setPlaylistId("");
      setPlaylistName("");
      setScreenId("");
      setScreenName("");
      setCanPublishDirectly(false);
      setImportNow(true);
      setError(null);
      setResult(null);
    }
  }, [open]);

  // Lazy-load OptiSigns pickers the first time the mapping section is enabled.
  useEffect(() => {
    if (!addMapping || remotePlaylists !== null) return;
    setRemoteLoading(true);
    setRemoteError(null);
    Promise.all([
      fetch("/api/admin/optisigns/playlists").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/api/admin/optisigns/screens").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ])
      .then(([p, s]) => {
        setRemotePlaylists(p.playlists ?? []);
        setRemoteScreens(s.screens ?? []);
      })
      .catch((err) => setRemoteError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setRemoteLoading(false));
  }, [addMapping, remotePlaylists]);

  function pickPlaylist(id: string) {
    setPlaylistId(id);
    const p = remotePlaylists?.find((x) => x.optisignsPlaylistId === id);
    setPlaylistName(p?.name ?? "");
  }
  function pickScreen(id: string) {
    setScreenId(id);
    const s = remoteScreens?.find((x) => x.optisignsScreenId === id);
    setScreenName(s?.name ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      client: {
        companyName,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        phone: phone || null,
        approvalMode,
      },
      user: addUser ? { name: userName, email: userEmail, role: userRole } : null,
      mapping: addMapping
        ? {
            optisignsPlaylistId: playlistId,
            optisignsPlaylistName: playlistName || null,
            optisignsScreenId: screenId || null,
            optisignsScreenName: screenName || null,
            canPublishDirectly,
            importNow,
          }
        : null,
    };
    const res = await fetch("/api/admin/onboard-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Onboarding failed");
      return;
    }
    setResult(body);
    onCompleted();
  }

  if (!open) return null;

  // Success screen
  if (result) {
    const fullSetupUrl = result.setupUrl ? `${window.location.origin}${result.setupUrl}` : null;
    const importErr = result.importResult && "error" in result.importResult ? result.importResult.error : null;
    const importOk = result.importResult && "itemCount" in result.importResult ? result.importResult : null;
    return (
      <Modal onClose={onClose}>
        <h3 className="text-lg font-semibold text-slate-900">
          {result.client.companyName} is onboarded
        </h3>
        <p className="text-sm text-slate-500 mt-1">Here&apos;s what was created:</p>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>✓ Client <span className="font-medium">{result.client.companyName}</span></li>
          {result.user && <li>✓ Primary user <span className="font-medium">{result.user.email}</span></li>}
          {result.mapping && (
            <li>✓ Playlist mapping <span className="font-mono text-xs">{result.mapping.optisignsPlaylistId}</span></li>
          )}
          {importOk && (
            <li>
              ✓ Imported {importOk.itemCount} item(s) and created {importOk.assetsCreated} new asset reference(s)
            </li>
          )}
          {importErr && (
            <li className="text-amber-700">⚠ Playlist import skipped: {importErr} — you can retry from the OptiSigns Browser.</li>
          )}
        </ul>

        {fullSetupUrl && (
          <div className="mt-5">
            <div className="text-sm text-slate-700 font-medium">Setup link for {result.user?.email}</div>
            <div className="text-xs text-slate-500">
              Send this URL to them out-of-band. It expires in 7 days and is single-use.
            </div>
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded font-mono text-xs break-all text-slate-900">
              {fullSetupUrl}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(fullSetupUrl)}
                className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium"
              >
                Copy link
              </button>
              <p className="text-xs text-amber-700 ml-auto">You won&apos;t see this link again.</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 text-white rounded-lg font-medium"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Onboard a client</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Create the client, invite their primary user, and link an OptiSigns playlist — in one step.
          </p>
        </div>

        {/* Client */}
        <Section title="Client">
          <Field label="Company name" required>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Contact email">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Approval mode">
              <select
                value={approvalMode}
                onChange={(e) => setApprovalMode(e.target.value as typeof approvalMode)}
                className={inputCls}
              >
                <option value="REQUIRES_APPROVAL">Requires approval</option>
                <option value="AUTO_PUBLISH">Auto-publish</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* User */}
        <Section
          title="Primary user"
          toggle={
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={addUser} onChange={(e) => setAddUser(e.target.checked)} />
              Invite a user now
            </label>
          }
        >
          {addUser && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" required>
                  <input
                    required={addUser}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    required={addUser}
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Role">
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as typeof userRole)}
                  className={inputCls}
                >
                  <option value="CLIENT_OWNER">Client Owner</option>
                  <option value="CLIENT_EDITOR">Client Editor</option>
                  <option value="VIEWER">Viewer (read-only)</option>
                </select>
              </Field>
              <p className="text-xs text-slate-500">
                We&apos;ll generate a one-time setup link for them after you click <em>Onboard</em>.
              </p>
            </>
          )}
        </Section>

        {/* Mapping */}
        <Section
          title="OptiSigns mapping"
          toggle={
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={addMapping} onChange={(e) => setAddMapping(e.target.checked)} />
              Link a playlist now
            </label>
          }
        >
          {addMapping && (
            <>
              {remoteLoading && <p className="text-xs text-slate-500">Loading from OptiSigns…</p>}
              {remoteError && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  {remoteError}. You can still type the IDs manually below.
                </div>
              )}
              <Field label="Playlist" required>
                {remotePlaylists && remotePlaylists.length > 0 ? (
                  <select
                    required={addMapping}
                    value={playlistId}
                    onChange={(e) => pickPlaylist(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Pick an OptiSigns playlist —</option>
                    {remotePlaylists.map((p) => (
                      <option key={p.optisignsPlaylistId} value={p.optisignsPlaylistId}>
                        {p.name || "(unnamed)"} · {p.itemCount} item(s) · {p.optisignsPlaylistId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={addMapping}
                    placeholder="OptiSigns playlist ID"
                    value={playlistId}
                    onChange={(e) => setPlaylistId(e.target.value)}
                    className={inputCls}
                  />
                )}
              </Field>

              <Field label="Screen (optional)">
                {remoteScreens && remoteScreens.length > 0 ? (
                  <select
                    value={screenId}
                    onChange={(e) => pickScreen(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Pick a screen —</option>
                    {remoteScreens.map((s) => (
                      <option key={s.optisignsScreenId} value={s.optisignsScreenId}>
                        {s.name || "(unnamed)"} · {s.optisignsScreenId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder="OptiSigns screen ID"
                    value={screenId}
                    onChange={(e) => setScreenId(e.target.value)}
                    className={inputCls}
                  />
                )}
              </Field>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={canPublishDirectly}
                  onChange={(e) => setCanPublishDirectly(e.target.checked)}
                />
                Allow this client to publish directly to OptiSigns
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={importNow} onChange={(e) => setImportNow(e.target.checked)} />
                Pull the playlist&apos;s current items into the portal now
              </label>
            </>
          )}
        </Section>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white rounded-lg font-medium"
          >
            {busy ? "Onboarding…" : "Onboard"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Section({
  title,
  toggle,
  children,
}: {
  title: string;
  toggle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-900 text-sm">{title}</h4>
        {toggle}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
