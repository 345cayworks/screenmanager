// Shared "pull a playlist from OptiSigns into the local portal" routine.
//
// Used by:
//   - POST /api/admin/optisigns/import         (admin browse → import)
//   - POST /api/admin/onboard-client           (one-shot onboarding)
//   - POST /api/playlists/:playlistId/pull     (client-driven refresh)
//   - server render of the playlist editor     (auto-import on first open)
//
// Behaviour:
//   1. Calls Playlists.getPlaylist() to fetch the remote playlist.
//   2. For each unique source asset (assetRootId, or _id if missing),
//      upserts an AssetReference row so the client can use those assets
//      in the editor.
//   3. Deletes any existing DRAFT for (clientId, playlistId) and creates
//      a fresh DRAFT with the remote items, each pre-linked via
//      optisignsPlaylistItemId so a later publish diffs cleanly.
//
// Throws on OptiSigns errors so callers can decide how to surface them.

import { prisma } from "./prisma";
import { Playlists } from "./optisigns";
import { audit } from "./audit";

function inferType(raw?: string | null): "IMAGE" | "VIDEO" | "WEBSITE" | "URL" | "UNKNOWN" {
  if (!raw) return "UNKNOWN";
  const t = raw.toUpperCase();
  if (t.includes("IMAGE")) return "IMAGE";
  if (t.includes("VIDEO")) return "VIDEO";
  if (t.includes("WEB") || t.includes("URL")) return "WEBSITE";
  return "UNKNOWN";
}

export type ImportResult = {
  playlistName: string | null;
  itemCount: number;
  assetsCreated: number;
  uniqueAssets: number;
  draftId: string;
};

export async function importPlaylistFromOptiSigns(opts: {
  clientId: string;
  optisignsPlaylistId: string;
  /** If provided, audit the action under this user. */
  byUserId?: string | null;
}): Promise<ImportResult> {
  const remote = await Playlists.getPlaylist(opts.optisignsPlaylistId);
  if (!remote) {
    throw new Error(`OptiSigns has no playlist with id ${opts.optisignsPlaylistId}`);
  }
  const items = remote.assets ?? [];

  // 1. AssetReference upserts (one per unique source asset).
  const seen = new Set<string>();
  let assetsCreated = 0;
  for (const it of items) {
    const assetId = it.assetRootId ?? it._id;
    if (!assetId || seen.has(assetId)) continue;
    seen.add(assetId);
    const title = it.filename?.trim() || `Asset ${assetId}`;
    const type = inferType(it.type);
    const before = await prisma.assetReference.findUnique({
      where: { clientId_optisignsAssetId: { clientId: opts.clientId, optisignsAssetId: assetId } },
    });
    await prisma.assetReference.upsert({
      where: { clientId_optisignsAssetId: { clientId: opts.clientId, optisignsAssetId: assetId } },
      create: {
        clientId: opts.clientId,
        optisignsAssetId: assetId,
        title,
        type,
        thumbnailUrl: it.thumbnail ?? null,
        sourceUrl: it.webLink ?? null,
        status: "APPROVED",
      },
      update: {
        // Only fill blanks — don't clobber admin-edited titles/thumbs.
        title: before?.title?.startsWith("Asset ") ? title : undefined,
        type: before?.type === "UNKNOWN" ? type : undefined,
        thumbnailUrl: before?.thumbnailUrl ? undefined : it.thumbnail ?? undefined,
        sourceUrl: before?.sourceUrl ? undefined : it.webLink ?? undefined,
      },
    });
    if (!before) assetsCreated++;
  }

  // 2. Replace any existing DRAFT for this (client, playlist).
  await prisma.playlistDraft.deleteMany({
    where: {
      clientId: opts.clientId,
      optisignsPlaylistId: opts.optisignsPlaylistId,
      status: "DRAFT",
    },
  });

  const draft = await prisma.playlistDraft.create({
    data: {
      clientId: opts.clientId,
      optisignsPlaylistId: opts.optisignsPlaylistId,
      status: "DRAFT",
      items: {
        create: items
          .map((it, idx) => {
            const aid = it.assetRootId ?? it._id;
            if (!aid) return null;
            return {
              clientId: opts.clientId,
              optisignsPlaylistId: opts.optisignsPlaylistId,
              optisignsPlaylistItemId: it._id ?? null,
              optisignsAssetId: aid,
              title: it.filename?.trim() || `Asset ${aid}`,
              type: inferType(it.type),
              durationSeconds:
                typeof it.duration === "number" && it.duration > 0 ? Math.round(it.duration) : 10,
              sortOrder: idx,
              status: "ACTIVE",
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      },
    },
    include: { items: { select: { id: true } } },
  });

  await audit({
    userId: opts.byUserId ?? null,
    clientId: opts.clientId,
    action: "PLAYLIST_IMPORTED",
    entityType: "PlaylistDraft",
    entityId: draft.id,
    after: {
      optisignsPlaylistId: opts.optisignsPlaylistId,
      playlistName: remote.name ?? null,
      itemCount: draft.items.length,
      assetsCreated,
    },
  });

  return {
    playlistName: remote.name ?? null,
    itemCount: draft.items.length,
    assetsCreated,
    uniqueAssets: seen.size,
    draftId: draft.id,
  };
}
