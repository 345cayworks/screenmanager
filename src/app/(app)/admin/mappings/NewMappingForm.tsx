"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RemotePlaylist = {
  optisignsPlaylistId: string;
  name: string | null;
  itemCount: number;
  assignedClient: { id: string; name: string } | null;
};

type RemoteScreen = {
  optisignsScreenId: string;
  name: string | null;
  currentType: string | null;
  currentAssetId: string | null;
  assignedClient: { id: string; name: string } | null;
  assignedPlaylistId: string | null;
};

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

  // Live OptiSigns data
  const [playlists, setPlaylists] = useState<RemotePlaylist[] | null>(null);
  const [screens, setScreens] = useState<RemoteScreen[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Manual fallback — admin can opt in if their item doesn't appear in the
  // live lists for any reason.
  const [manualPlaylist, setManualPlaylist] = useState(false);
  const [manualScreen, setManualScreen] = useState(false);

  async function loadRemote() {
    setLoading(true);
    setRemoteError(null);
    try {
      const [p, s] = await Promise.all([
        fetch("/api/admin/optisigns/playlists").then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
        ),
        fetch("/api/admin/optisigns/screens").then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
        ),
      ]);
      setPlaylists(p.playlists ?? []);
      setScreens(s.screens ?? []);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : "Failed to load");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRemote();
  }, []);

  function pickPlaylist(id: string) {
    const p = playlists?.find((x) => x.optisignsPlaylistId === id);
    setForm({
      ...form,
      optisignsPlaylistId: id,
      optisignsPlaylistName: p?.name ?? "",
    });
  }

  function pickScreen(id: string) {
    const s = screens?.find((x) => x.optisignsScreenId === id);
    setForm({
      ...form,
      optisignsScreenId: id,
      optisignsScreenName: s?.name ?? "",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) {
      setError("Pick a client");
      return;
    }
    if (!form.optisignsPlaylistId) {
      setError("Pick a playlist");
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
    setForm({
      ...form,
      optisignsPlaylistId: "",
      optisignsPlaylistName: "",
      optisignsScreenId: "",
      optisignsScreenName: "",
    });
    router.refresh();
    // Refresh the OptiSigns lists so the new mapping appears as assigned.
    loadRemote();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Client */}
      <div>
        <label className="block text-xs font-medium text-slate-600">Client</label>
        <select
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
        >
          {clients.length === 0 && <option value="">— No clients —</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-xs text-slate-500">Loading from OptiSigns…</p>}
      {remoteError && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          OptiSigns: {remoteError}. Switch to manual entry below.
        </div>
      )}

      {/* Playlist */}
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-600">OptiSigns playlist</label>
          {playlists && playlists.length > 0 && (
            <button
              type="button"
              onClick={() => setManualPlaylist((v) => !v)}
              className="text-[11px] text-brand-600 hover:text-brand-700"
            >
              {manualPlaylist ? "Pick from list" : "Enter manually"}
            </button>
          )}
        </div>
        {!manualPlaylist && playlists && playlists.length > 0 ? (
          <select
            value={form.optisignsPlaylistId}
            onChange={(e) => pickPlaylist(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">— Pick a playlist —</option>
            {playlists.map((p) => {
              const taken = p.assignedClient && p.assignedClient.id !== form.clientId;
              return (
                <option
                  key={p.optisignsPlaylistId}
                  value={p.optisignsPlaylistId}
                  disabled={!!taken}
                >
                  {(p.name || "(unnamed)")} · {p.itemCount} item(s){taken ? ` — assigned to ${p.assignedClient!.name}` : ""}
                </option>
              );
            })}
          </select>
        ) : (
          <input
            placeholder="Playlist ID"
            required
            value={form.optisignsPlaylistId}
            onChange={(e) => setForm({ ...form, optisignsPlaylistId: e.target.value })}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono"
          />
        )}
        {manualPlaylist && (
          <input
            placeholder="Playlist name (optional)"
            value={form.optisignsPlaylistName}
            onChange={(e) => setForm({ ...form, optisignsPlaylistName: e.target.value })}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        )}
      </div>

      {/* Screen */}
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-600">Screen (optional)</label>
          {screens && screens.length > 0 && (
            <button
              type="button"
              onClick={() => setManualScreen((v) => !v)}
              className="text-[11px] text-brand-600 hover:text-brand-700"
            >
              {manualScreen ? "Pick from list" : "Enter manually"}
            </button>
          )}
        </div>
        {!manualScreen && screens && screens.length > 0 ? (
          <select
            value={form.optisignsScreenId}
            onChange={(e) => pickScreen(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">— No screen —</option>
            {screens.map((s) => {
              const taken = s.assignedClient && s.assignedClient.id !== form.clientId;
              return (
                <option
                  key={s.optisignsScreenId}
                  value={s.optisignsScreenId}
                  disabled={!!taken}
                >
                  {(s.name || "(unnamed)")}{taken ? ` — linked to ${s.assignedClient!.name}` : ""}
                </option>
              );
            })}
          </select>
        ) : (
          <input
            placeholder="Screen ID"
            value={form.optisignsScreenId}
            onChange={(e) => setForm({ ...form, optisignsScreenId: e.target.value })}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono"
          />
        )}
        {manualScreen && (
          <input
            placeholder="Screen name (optional)"
            value={form.optisignsScreenName}
            onChange={(e) => setForm({ ...form, optisignsScreenName: e.target.value })}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.canPublishDirectly}
          onChange={(e) => setForm({ ...form, canPublishDirectly: e.target.checked })}
        />
        Allow client to publish directly
      </label>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <button
        disabled={busy || loading}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm py-2 rounded font-medium"
      >
        {busy ? "Saving…" : "Save mapping"}
      </button>
    </form>
  );
}
