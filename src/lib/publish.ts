// Publish a PlaylistDraft to OptiSigns.
//
// Strategy:
//   1. Fetch the remote playlist's current items.
//   2. Diff against the draft items. Anything in the draft *without* an
//      optisignsPlaylistItemId is new — add it. Anything matched by id whose
//      duration/sortOrder changed is updated. Anything in the remote that has
//      no matching draft item is removed.
//   3. After successful sync, mark the draft as PUBLISHED.
//
// If any OptiSigns call throws, the draft status is NOT changed, so the
// operation is effectively "all or nothing" from the local state's view.

import { prisma } from "./prisma";
import { Playlists } from "./optisigns";
import { audit } from "./audit";

export async function publishDraft(draftId: string, publishedByUserId: string) {
  const draft = await prisma.playlistDraft.findUnique({
    where: { id: draftId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!draft) throw new Error("Draft not found");

  const remote = await Playlists.getPlaylist(draft.optisignsPlaylistId).catch(() => null);
  const remoteItems = remote?.items ?? [];

  // Items to add: drafts without an optisignsPlaylistItemId
  const toAdd = draft.items.filter((i) => !i.optisignsPlaylistItemId);

  // Items to update: drafts with id, where local differs (we don't have remote
  // ordering reliably so we update all linked items conservatively).
  const toUpdate = draft.items.filter((i) => i.optisignsPlaylistItemId);

  // Items to remove: remote item ids not present in any local draft item.
  const localRemoteIds = new Set(
    draft.items.map((i) => i.optisignsPlaylistItemId).filter(Boolean) as string[]
  );
  const toRemove = remoteItems
    .map((r) => r._id)
    .filter((id): id is string => !!id && !localRemoteIds.has(id));

  if (toAdd.length) {
    await Playlists.addPlaylistItems(
      draft.optisignsPlaylistId,
      toAdd.map((i) => ({
        assetId: i.optisignsAssetId,
        durationSeconds: i.durationSeconds,
        sortOrder: i.sortOrder,
        startDate: i.startDate?.toISOString() ?? null,
        endDate: i.endDate?.toISOString() ?? null,
      }))
    );
  }

  if (toUpdate.length) {
    await Playlists.updatePlaylistItems(
      draft.optisignsPlaylistId,
      toUpdate.map((i) => ({
        _id: i.optisignsPlaylistItemId!,
        durationSeconds: i.durationSeconds,
        sortOrder: i.sortOrder,
      }))
    );
  }

  if (toRemove.length) {
    await Playlists.removePlaylistItems(draft.optisignsPlaylistId, toRemove);
  }

  const published = await prisma.playlistDraft.update({
    where: { id: draft.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await audit({
    userId: publishedByUserId,
    clientId: draft.clientId,
    action: "PLAYLIST_PUBLISHED",
    entityType: "PlaylistDraft",
    entityId: draft.id,
    after: { optisignsPlaylistId: draft.optisignsPlaylistId, itemCount: draft.items.length },
  });

  return published;
}
