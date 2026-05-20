// POST /api/admin/optisigns/import
//
// Pulls a playlist from OptiSigns into the local environment for a client.
// Upserts the OptiSignsMapping, creates AssetReference rows for every
// referenced asset, and seeds a local DRAFT (replacing any existing one)
// pre-linked via optisignsPlaylistItemId for clean publish-diffing.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { fail, handle, ok } from "@/lib/http";
import { importPlaylistFromOptiSigns } from "@/lib/import-playlist";

const bodySchema = z.object({
  clientId: z.string().min(1),
  optisignsPlaylistId: z.string().min(1),
  optisignsScreenId: z.string().optional(),
  optisignsScreenName: z.string().optional(),
  canPublishDirectly: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const input = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) return fail(404, "Client not found");

    // Refuse if this playlist is mapped to another client (unique constraint
    // would also catch it, but a friendly 409 is better than a 500).
    const playlistInUse = await prisma.optiSignsMapping.findUnique({
      where: { optisignsPlaylistId: input.optisignsPlaylistId },
      include: { client: { select: { id: true, companyName: true } } },
    });
    if (playlistInUse && playlistInUse.clientId !== input.clientId) {
      return fail(
        409,
        `That OptiSigns playlist is already assigned to ${playlistInUse.client.companyName}.`
      );
    }

    // 1. Upsert the mapping for (this client, this playlist).
    let mapping;
    try {
      mapping = await prisma.optiSignsMapping.upsert({
        where: {
          clientId_optisignsPlaylistId: {
            clientId: input.clientId,
            optisignsPlaylistId: input.optisignsPlaylistId,
          },
        },
        create: {
          clientId: input.clientId,
          optisignsPlaylistId: input.optisignsPlaylistId,
          optisignsScreenId: input.optisignsScreenId,
          optisignsScreenName: input.optisignsScreenName,
          canPublishDirectly: input.canPublishDirectly,
        },
        update: {
          optisignsScreenId: input.optisignsScreenId ?? undefined,
          optisignsScreenName: input.optisignsScreenName ?? undefined,
          canPublishDirectly: input.canPublishDirectly,
        },
      });
    } catch (err) {
      return fail(409, "OptiSigns playlist or screen is already linked elsewhere");
    }

    // 2. Pull the playlist content via the shared helper.
    let result;
    try {
      result = await importPlaylistFromOptiSigns({
        clientId: input.clientId,
        optisignsPlaylistId: input.optisignsPlaylistId,
        byUserId: session.userId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OptiSigns request failed";
      return fail(502, `OptiSigns: ${msg}`);
    }

    // 3. Backfill the playlist name on the mapping if we just learned it.
    if (result.playlistName && !mapping.optisignsPlaylistName) {
      await prisma.optiSignsMapping.update({
        where: { id: mapping.id },
        data: { optisignsPlaylistName: result.playlistName },
      });
    }

    return ok({
      ok: true,
      playlistName: result.playlistName,
      mappingId: mapping.id,
      draftId: result.draftId,
      itemCount: result.itemCount,
      assetsCreated: result.assetsCreated,
      uniqueAssets: result.uniqueAssets,
    });
  });
}
