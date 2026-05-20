"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, PageHeader, EmptyState, statusTone } from "@/components/ui";
import { isAdminRole, type Role } from "@/lib/enums";

type Item = {
  id: string;
  optisignsAssetId: string;
  title: string;
  type: string;
  durationSeconds: number;
  sortOrder: number;
  status: string;
  optisignsPlaylistItemId: string | null;
};

type Asset = {
  id: string;
  optisignsAssetId: string;
  title: string;
  type: string;
  thumbnailUrl: string | null;
};

type Props = {
  session: { role: Role; userId: string; clientId: string | null };
  mapping: {
    id: string;
    clientId: string;
    clientName: string;
    approvalMode: string;
    canPublishDirectly: boolean;
    playlistId: string;
    playlistName: string | null;
    screenName: string | null;
  };
  draft: { id: string; status: string; items: Item[] };
  assets: Asset[];
};

export default function PlaylistEditor({ session, mapping, draft, assets }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(draft.items);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isViewer = session.role === "VIEWER";
  const isAdmin = isAdminRole(session.role);
  const isLocked = draft.status === "PENDING_APPROVAL" && !isAdmin;
  const canDirectPublish = isAdmin || (mapping.canPublishDirectly && session.role !== "CLIENT_EDITOR");

  function reorder(from: number, to: number) {
    if (isLocked || isViewer) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    next.forEach((it, idx) => (it.sortOrder = idx));
    setItems(next);
    setDirty(true);
  }

  function updateDuration(id: string, seconds: number) {
    if (seconds < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, durationSeconds: seconds } : i)));
    setDirty(true);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id).map((i, idx) => ({ ...i, sortOrder: idx })));
    setDirty(true);
  }

  function addAsset(a: Asset) {
    setItems((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        optisignsAssetId: a.optisignsAssetId,
        title: a.title,
        type: a.type,
        durationSeconds: 10,
        sortOrder: prev.length,
        status: "ACTIVE",
        optisignsPlaylistItemId: null,
      },
    ]);
    setDirty(true);
  }

  async function saveDraft() {
    setBusy("save");
    setError(null);
    const res = await fetch(`/api/playlists/${mapping.playlistId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          id: i.id.startsWith("new-") ? undefined : i.id,
          optisignsAssetId: i.optisignsAssetId,
          title: i.title,
          type: i.type,
          durationSeconds: i.durationSeconds,
          sortOrder: i.sortOrder,
          status: i.status,
        })),
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed to save");
      return;
    }
    setDirty(false);
    startTransition(() => router.refresh());
  }

  async function submitForApproval() {
    if (dirty) await saveDraft();
    setBusy("submit");
    setError(null);
    const res = await fetch(`/api/playlists/${mapping.playlistId}/submit`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed to submit");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function publishDirect() {
    if (dirty) await saveDraft();
    setBusy("publish");
    setError(null);
    const res = await fetch(`/api/admin/playlists/${mapping.playlistId}/publish`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed to publish");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <PageHeader
        title={mapping.playlistName || "Playlist"}
        subtitle={`${mapping.clientName} · ${mapping.screenName || "No screen"} · ${mapping.playlistId}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(draft.status)}>{draft.status.replace("_", " ")}</Badge>
            {dirty && <Badge tone="amber">UNSAVED</Badge>}
          </div>
        }
      />

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {isLocked && (
        <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This draft is awaiting admin approval. Editing is locked until it's approved or rejected.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items column */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Playlist Items</h2>
              <div className="text-xs text-slate-500">{items.length} items</div>
            </div>
            {items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Playlist is empty"
                  hint="Add approved assets from the panel on the right."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <li key={it.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="text-slate-400 font-mono text-xs w-6 text-right">{idx + 1}.</div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{it.title}</div>
                      <div className="text-xs text-slate-500">
                        {it.type} · Asset {it.optisignsAssetId}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-slate-500">Sec</label>
                      <input
                        type="number"
                        min={1}
                        value={it.durationSeconds}
                        disabled={isLocked || isViewer}
                        onChange={(e) => updateDuration(it.id, parseInt(e.target.value || "1", 10))}
                        className="w-16 border border-slate-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => reorder(idx, Math.max(0, idx - 1))}
                        disabled={isLocked || isViewer || idx === 0}
                        className="text-slate-500 hover:text-slate-900 disabled:opacity-30 px-2"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => reorder(idx, Math.min(items.length - 1, idx + 1))}
                        disabled={isLocked || isViewer || idx === items.length - 1}
                        className="text-slate-500 hover:text-slate-900 disabled:opacity-30 px-2"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        disabled={isLocked || isViewer}
                        className="text-red-600 hover:text-red-700 disabled:opacity-30 text-sm px-2"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={saveDraft}
              disabled={isLocked || isViewer || busy !== null || !dirty}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm rounded-lg font-medium"
            >
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={submitForApproval}
              disabled={isLocked || isViewer || busy !== null}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm rounded-lg font-medium"
            >
              {busy === "submit" ? "Submitting…" : "Submit for approval"}
            </button>
            {canDirectPublish && (
              <button
                onClick={publishDirect}
                disabled={isViewer || busy !== null || draft.status === "PUBLISHED"}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white text-sm rounded-lg font-medium"
              >
                {busy === "publish" ? "Publishing…" : "Publish to OptiSigns"}
              </button>
            )}
          </div>
        </div>

        {/* Assets column */}
        <div>
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Asset Library</h2>
              <p className="text-xs text-slate-500">Approved assets for your client</p>
            </div>
            {assets.length === 0 ? (
              <div className="p-4">
                <p className="text-sm text-slate-500">No approved assets yet. Ask your admin to add some.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {assets.map((a) => (
                  <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-slate-100 grid place-items-center text-slate-400 text-xs">
                      {a.type.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{a.title}</div>
                      <div className="text-xs text-slate-500 truncate">{a.optisignsAssetId}</div>
                    </div>
                    <button
                      onClick={() => addAsset(a)}
                      disabled={isLocked || isViewer}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-30"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
