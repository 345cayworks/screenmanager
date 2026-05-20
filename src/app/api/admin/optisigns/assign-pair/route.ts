// POST /api/admin/optisigns/assign-pair
//
// One-shot "assign this screen and the playlist it's currently playing to
// this client". Body:
//   {
//     clientId: string,
//     optisignsScreenId: string,
//     optisignsScreenName?: string,
//     optisignsPlaylistId: string,             // inferred from screen.currentAssetId
//     optisignsPlaylistName?: string,
//     canPublishDirectly?: boolean,
//     pushToOptiSigns?: boolean                // also call updateDevice (default true)
//   }
//
// What it does, in order:
//   1. Validates the screen isn't already linked to another client.
//   2. Validates the playlist isn't already assigned to another client.
//   3. Upserts an OptiSignsMapping containing both screen + playlist.
//   4. Imports the playlist content (shared helper) — so the client sees the
//      real items immediately.
//   5. If pushToOptiSigns is true, calls updateDevice so the physical screen
//      actually plays the chosen playlist on OptiSigns. (Useful when binding
//      a freshly-paired screen.)

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { importPlaylistFromOptiSigns } from "@/lib/import-playlist";
import { Devices } from "@/lib/optisigns";

const schema = z.object({
  clientId: z.string().min(1),
  optisignsScreenId: z.string().min(1),
  optisignsScreenName: z.string().optional().nullable(),
  optisignsPlaylistId: z.string().min(1),
  optisignsPlaylistName: z.string().optional().nullable(),
  canPublishDirectly: z.boolean().optional().default(false),
  pushToOptiSigns: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const input = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) return fail(404, "Client not found");

    // Screen exclusivity (across whole DB — a screen can only be in one mapping).
    const screenTaken = await prisma.optiSignsMapping.findUnique({
      where: { optisignsScreenId: input.optisignsScreenId },
      include: { client: { select: { id: true, companyName: true } } },
    });
    if (screenTaken && screenTaken.clientId !== input.clientId) {
      return fail(409, `That screen is already linked to ${screenTaken.client.companyName}.`);
    }

    // Playlist exclusivity — same playlist can't be assigned to two clients.
    const playlistTaken = await prisma.optiSignsMapping.findUnique({
      where: { optisignsPlaylistId: input.optisignsPlaylistId },
      include: { client: { select: { id: true, companyName: true } } },
    });
    if (playlistTaken && playlistTaken.clientId !== input.clientId) {
      return fail(409, `That playlist is already assigned to ${playlistTaken.client.companyName}.`);
    }

    // Upsert the mapping: key is (clientId, optisignsPlaylistId).
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
          optisignsPlaylistName: input.optisignsPlaylistName ?? null,
          optisignsScreenId: input.optisignsScreenId,
          optisignsScreenName: input.optisignsScreenName ?? null,
          canPublishDirectly: input.canPublishDirectly,
        },
        update: {
          optisignsScreenId: input.optisignsScreenId,
          optisignsScreenName: input.optisignsScreenName ?? undefined,
          optisignsPlaylistName: input.optisignsPlaylistName ?? undefined,
          canPublishDirectly: input.canPublishDirectly,
        },
      });
    } catch (err) {
      return fail(409, "Couldn't create mapping — screen or playlist already linked elsewhere.");
    }

    // Import playlist content.
    let importResult: { itemCount: number; assetsCreated: number } | { error: string } | null = null;
    try {
      const r = await importPlaylistFromOptiSigns({
        clientId: input.clientId,
        optisignsPlaylistId: input.optisignsPlaylistId,
        byUserId: session.userId,
      });
      importResult = { itemCount: r.itemCount, assetsCreated: r.assetsCreated };
      // Backfill playlist name on the mapping if we just learned it.
      if (r.playlistName && !mapping.optisignsPlaylistName) {
        await prisma.optiSignsMapping.update({
          where: { id: mapping.id },
          data: { optisignsPlaylistName: r.playlistName },
        });
      }
    } catch (err) {
      importResult = { error: err instanceof Error ? err.message : "Import failed" };
    }

    // Push to OptiSigns: point the device at this playlist.
    let remoteUpdated = false;
    let remoteError: string | null = null;
    if (input.pushToOptiSigns) {
      try {
        await Devices.assignPlaylistToDevice(input.optisignsScreenId, input.optisignsPlaylistId);
        remoteUpdated = true;
      } catch (err) {
        remoteError = err instanceof Error ? err.message : "updateDevice failed";
      }
    }

    await audit({
      userId: session.userId,
      clientId: input.clientId,
      action: "SCREEN_PLAYLIST_PAIR_ASSIGNED",
      entityType: "OptiSignsMapping",
      entityId: mapping.id,
      after: {
        screen: input.optisignsScreenId,
        playlist: input.optisignsPlaylistId,
        importResult,
        remoteUpdated,
        remoteError,
      },
    });

    return ok({
      ok: true,
      mappingId: mapping.id,
      importResult,
      remoteUpdated,
      remoteError,
    });
  });
}
