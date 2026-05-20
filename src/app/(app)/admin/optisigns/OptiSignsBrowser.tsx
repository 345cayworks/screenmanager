"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui";

type Client = { id: string; name: string };

type RemotePlaylist = {
  optisignsPlaylistId: string;
  name: string | null;
  itemCount: number;
  assignedClient: { id: string; name: string } | null;
  mappingId: string | null;
};

type RemoteScreen = {
  optisignsScreenId: string;
  name: string | null;
  currentType: string | null;
  currentAssetId: string | null;
  assignedClient: { id: string; name: string } | null;
  assignedPlaylistId: string | null;
};

export default function OptiSignsBrowser({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<RemotePlaylist[] | null>(null);
  const [screens, setScreens] = useState<RemoteScreen[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Per-row "pick a client" state
  const [pickedClient, setPickedClient] = useState<Record<string, string>>({});
  // Per-screen "pick a playlist to link to" state — defaults to whichever
  // mapping the picked client already has, if any.
  const [pickedPlaylist, setPickedPlaylist] = useState<Record<string, string>>({});

  async function refresh() {
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/admin/optisigns/playlists"),
        fetch("/api/admin/optisigns/screens"),
      ]);
      const pBody = await pRes.json();
      const sBody = await sRes.json();
      if (!pRes.ok) throw new Error(pBody.error || "Failed to fetch playlists");
      if (!sRes.ok) throw new Error(sBody.error || "Failed to fetch screens");
      setPlaylists(pBody.playlists);
      setScreens(sBody.screens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function unassignPlaylist(p: RemotePlaylist) {
    if (!p.mappingId || !p.assignedClient) return;
    if (
      !window.confirm(
        `Unassign "${p.name || p.optisignsPlaylistId}" from ${p.assignedClient.name}?\n\nThis removes the mapping plus any local drafts for it. Asset references are kept.`
      )
    )
      return;
    setBusyId(p.optisignsPlaylistId);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/mappings/${p.mappingId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unassign failed");
      setStatusMsg(`Unassigned from ${p.assignedClient.name}.`);
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unassign failed");
    }
    setBusyId(null);
  }

  async function importPlaylist(optisignsPlaylistId: string) {
    const clientId = pickedClient[optisignsPlaylistId];
    if (!clientId) {
      setError("Pick a client first");
      return;
    }
    setBusyId(optisignsPlaylistId);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/optisigns/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, optisignsPlaylistId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Import failed");
      setStatusMsg(
        `Imported "${body.playlistName || optisignsPlaylistId}" — ${body.itemCount} item(s), ${body.assetsCreated} new asset(s)`
      );
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
    setBusyId(null);
  }

  async function assignScreen(optisignsScreenId: string, screenName: string | null) {
    const clientId = pickedClient[optisignsScreenId];
    const playlistId = pickedPlaylist[optisignsScreenId];
    if (!clientId || !playlistId) {
      setError("Pick a client and a playlist for this screen");
      return;
    }
    setBusyId(optisignsScreenId);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/optisigns/assign-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          optisignsPlaylistId: playlistId,
          optisignsScreenId,
          optisignsScreenName: screenName ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Assign failed");
      setStatusMsg(
        body.remoteUpdated
          ? "Screen linked locally and updated on OptiSigns."
          : `Screen linked locally. OptiSigns update warning: ${body.remoteError || "skipped"}`
      );
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    }
    setBusyId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">
          {loading ? "Loading from OptiSigns…" : playlists && screens ? `${playlists.length} playlist(s) · ${screens.length} screen(s)` : ""}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg font-medium"
        >
          {loading ? "Refreshing…" : "Refresh from OptiSigns"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {statusMsg}
        </div>
      )}

      <Card className="p-0 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-900">Playlists</h2>
          <p className="text-xs text-slate-500">Assign a playlist to a client to pull its items into the portal.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left py-2 px-4">Name</th>
              <th className="text-left py-2 px-4">ID</th>
              <th className="text-left py-2 px-4">Items</th>
              <th className="text-left py-2 px-4">Assigned to</th>
              <th className="text-left py-2 px-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {playlists?.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">No playlists found on OptiSigns.</td></tr>
            )}
            {playlists?.map((p) => (
              <tr key={p.optisignsPlaylistId}>
                <td className="py-2 px-4 font-medium text-slate-900">{p.name || "—"}</td>
                <td className="py-2 px-4 font-mono text-xs text-slate-500">{p.optisignsPlaylistId}</td>
                <td className="py-2 px-4 text-slate-600">{p.itemCount}</td>
                <td className="py-2 px-4">
                  {p.assignedClient ? <Badge tone="green">{p.assignedClient.name}</Badge> : <Badge tone="slate">Unassigned</Badge>}
                </td>
                <td className="py-2 px-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={pickedClient[p.optisignsPlaylistId] ?? p.assignedClient?.id ?? ""}
                      onChange={(e) => setPickedClient({ ...pickedClient, [p.optisignsPlaylistId]: e.target.value })}
                      className="border border-slate-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="">— pick client —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      onClick={() => importPlaylist(p.optisignsPlaylistId)}
                      disabled={busyId === p.optisignsPlaylistId}
                      className="px-3 py-1 text-xs bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white rounded font-medium"
                    >
                      {busyId === p.optisignsPlaylistId ? "Importing…" : p.assignedClient ? "Re-import" : "Assign + Import"}
                    </button>
                    {p.assignedClient && p.mappingId && (
                      <button
                        onClick={() => unassignPlaylist(p)}
                        disabled={busyId === p.optisignsPlaylistId}
                        className="px-3 py-1 text-xs text-red-600 hover:text-red-700 disabled:text-slate-300 font-medium"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-900">Screens</h2>
          <p className="text-xs text-slate-500">
            Link a screen to a client and choose which playlist it should play. We update OptiSigns as well.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left py-2 px-4">Name</th>
              <th className="text-left py-2 px-4">ID</th>
              <th className="text-left py-2 px-4">Now playing</th>
              <th className="text-left py-2 px-4">Linked to</th>
              <th className="text-left py-2 px-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {screens?.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">No screens found on OptiSigns.</td></tr>
            )}
            {screens?.map((s) => {
              const clientPlaylists = playlists?.filter((p) =>
                p.assignedClient?.id && pickedClient[s.optisignsScreenId]
                  ? p.assignedClient.id === pickedClient[s.optisignsScreenId]
                  : false
              ) ?? [];
              return (
                <tr key={s.optisignsScreenId}>
                  <td className="py-2 px-4 font-medium text-slate-900">{s.name || "—"}</td>
                  <td className="py-2 px-4 font-mono text-xs text-slate-500">{s.optisignsScreenId}</td>
                  <td className="py-2 px-4 text-slate-600">
                    {s.currentType ? <span>{s.currentType}: <span className="font-mono text-xs">{s.currentAssetId}</span></span> : "—"}
                  </td>
                  <td className="py-2 px-4">
                    {s.assignedClient ? <Badge tone="green">{s.assignedClient.name}</Badge> : <Badge tone="slate">Unassigned</Badge>}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={pickedClient[s.optisignsScreenId] ?? s.assignedClient?.id ?? ""}
                        onChange={(e) => {
                          setPickedClient({ ...pickedClient, [s.optisignsScreenId]: e.target.value });
                          setPickedPlaylist({ ...pickedPlaylist, [s.optisignsScreenId]: "" });
                        }}
                        className="border border-slate-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="">— pick client —</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select
                        value={pickedPlaylist[s.optisignsScreenId] ?? s.assignedPlaylistId ?? ""}
                        onChange={(e) => setPickedPlaylist({ ...pickedPlaylist, [s.optisignsScreenId]: e.target.value })}
                        disabled={!pickedClient[s.optisignsScreenId] && !s.assignedClient}
                        className="border border-slate-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="">— pick playlist —</option>
                        {clientPlaylists.map((p) => (
                          <option key={p.optisignsPlaylistId} value={p.optisignsPlaylistId}>
                            {p.name || p.optisignsPlaylistId}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => assignScreen(s.optisignsScreenId, s.name)}
                        disabled={busyId === s.optisignsScreenId}
                        className="px-3 py-1 text-xs bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white rounded font-medium"
                      >
                        {busyId === s.optisignsScreenId ? "Linking…" : "Link + push"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-500 mt-4">
        Tip: the screen's playlist dropdown only shows playlists already imported to the chosen client.
        Import a playlist for that client first if the menu is empty.
      </p>
    </div>
  );
}
