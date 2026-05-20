// POST /api/admin/optisigns/import
//
// Pulls a playlist from OptiSigns into the local environment.
//
// Body: {
//   clientId: string,
//   optisignsPlaylistId: string,
//   optisignsScreenId?: string,
//   optisignsScreenName?: string,
//   canPublishDirectly?: boolean,
// }
//
// What it does:
//   1. Fetches the playlist from OptiSigns over GraphQL (no auth ever
//      leaves the server).
//   2. Upserts an OptiSignsMapping row for (client, playlist).
//   3. For each unique asset referenced by the playlist, upserts an
//      AssetReference row so the client can keep using those assets in
//      the editor.
//   4. Removes any existing local DRAFT for this (client, playlist)
//      and replaces it with a fresh DRAFT pre-loaded with every item.
//      Each item carries its `optisignsPlaylistItemId`, so the next
//      publish-diff will issue updates instead of duplicate adds.
//   5. Writes an audit log entry.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { Playlists } from "@/lib/optisigns";

const bodySchema = z.object({
  clientId: z.string().min(1),
  optisignsPlaylistId: z.string().min(1),
  optisignsScreenId: z.string().optional(),
  optisignsScreenName: z.string().optional(),
  canPublishDirectly: z.boolean().optional().default(false),
});

function inferType(raw?: string | null): "IMAGE" | "VIDEO" | "WEBSITE" | "URL" | "UNKNOWN" {
  if (!raw) return "UNKNOWN";
  const t = raw.toUpperCase();
  if (t.includes("IMAGE")) return "IMAGE";
  if (t.includes("VIDEO")) return "VIDEO";
  if (t.includes("WEB") || t.includes("URL")) return "WEBSITE";
  return "UNKNOWN";
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const input = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) return fail(404, "Client not found");

    // 1. Pull the playlist from OptiSigns. Any GraphQL error bubbles up to
    //    the user with the upstream message.
    let remote;
    try {
      remote = await Playlists.getPlaylist(input.optisignsPlaylistId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OptiSigns request failed";
      return fail(502, `OptiSigns: ${msg}`);
    }
    if (!remote) return fail(404, `OptiSigns has no playlist with id ${input.optisignsPlaylistId}`);

    const items = remote.items ?? [];

    // 2. Mapping
    const mapping = await prisma.optiSignsMapping.upsert({
      where: {
        clientId_optisignsPlaylistId: {
          clientId: input.clientId,
          optisignsPlaylistId: input.optisignsPlaylistId,
        },
      },
      create: {
        clientId: input.clientId,
        optisignsPlaylistId: input.optisignsPlaylistId,
        optisignsPlaylistName: remote.name ?? null,
        optisignsScreenId: input.optisignsScreenId,
        optisignsScreenName: input.optisignsScreenName,
        canPublishDirectly: input.canPublishDirectly,
      },
      update: {
        optisignsPlaylistName: remote.name ?? undefined,
        optisignsScreenId: input.optisignsScreenId ?? undefined,
        optisignsScreenName: input.optisignsScreenName ?? undefined,
        canPublishDirectly: input.canPublishDirectly,
      },
    });

    // 3. Asset references — upsert one per unique assetId.
    const seen = new Set<string>();
    let assetsCreated = 0;
    for (const item of items) {
      if (!item.assetId || seen.has(item.assetId)) continue;
      seen.add(item.assetId);
      const title = item.asset?.name?.trim() || `Asset ${item.assetId}`;
      const type = inferType(item.asset?.type);
      const before = await prisma.assetReference.findUnique({
        where: {
          clientId_optisignsAssetId: { clientId: input.clientId, optisignsAssetId: item.assetId },
        },
      });
      await prisma.assetReference.upsert({
        where: {
          clientId_optisignsAssetId: { clientId: input.clientId, optisignsAssetId: item.assetId },
        },
        create: {
          clientId: input.clientId,
          optisignsAssetId: item.assetId,
          title,
          type,
          thumbnailUrl: item.asset?.thumbnail ?? null,
          status: "APPROVED",
        },
        update: {
          // Only fill blanks — don't clobber admin-edited titles/thumbs.
          title: before?.title?.startsWith("Asset ") ? title : undefined,
          type: before?.type === "UNKNOWN" ? type : undefined,
          thumbnailUrl: before?.thumbnailUrl ? undefined : item.asset?.thumbnail ?? undefined,
        },
      });
      if (!before) assetsCreated++;
    }

    // 4. Replace any existing DRAFT.
    await prisma.playlistDraft.deleteMany({
      where: {
        clientId: input.clientId,
        optisignsPlaylistId: input.optisignsPlaylistId,
        status: "DRAFT",
      },
    });

    const draft = await prisma.playlistDraft.create({
      data: {
        clientId: input.clientId,
        optisignsPlaylistId: input.optisignsPlaylistId,
        status: "DRAFT",
        items: {
          create: items.map((it, idx) => ({
            clientId: input.clientId,
            optisignsPlaylistId: input.optisignsPlaylistId,
            optisignsPlaylistItemId: it._id ?? null,
            optisignsAssetId: it.assetId,
            title: it.asset?.name?.trim() || `Asset ${it.assetId}`,
            type: inferType(it.asset?.type),
            durationSeconds: typeof it.duration === "number" && it.duration > 0 ? it.duration : 10,
            sortOrder: idx,
            status: "ACTIVE",
          })),
        },
      },
      include: { items: true },
    });

    // 5. Audit
    await audit({
      userId: session.userId,
      clientId: input.clientId,
      action: "PLAYLIST_IMPORTED",
      entityType: "PlaylistDraft",
      entityId: draft.id,
      after: {
        optisignsPlaylistId: input.optisignsPlaylistId,
        playlistName: remote.name,
        itemCount: items.length,
        assetsCreated,
      },
    });

    return ok({
      ok: true,
      playlistName: remote.name ?? null,
      mappingId: mapping.id,
      draftId: draft.id,
      itemCount: items.length,
      assetsCreated,
      uniqueAssets: seen.size,
    });
  });
}
