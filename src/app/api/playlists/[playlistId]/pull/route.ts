// POST /api/playlists/:playlistId/pull
//
// Client-facing endpoint. Refreshes the local DRAFT for a playlist by
// pulling the latest items from OptiSigns. The user must:
//   - Be signed in
//   - Have a non-VIEWER role
//   - Belong to the client that owns this mapping (admins bypass)
//
// If the current draft is PENDING_APPROVAL, we refuse — the admin needs
// to approve or reject it first. Otherwise the existing DRAFT (if any)
// is replaced with a fresh one mirroring OptiSigns.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertCanEdit, requireClientAccess } from "@/lib/rbac";
import { fail, handle, ok } from "@/lib/http";
import { importPlaylistFromOptiSigns } from "@/lib/import-playlist";

export async function POST(_req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireSession();
    assertCanEdit(session);

    const mapping = await prisma.optiSignsMapping.findFirst({
      where: { optisignsPlaylistId: params.playlistId },
    });
    if (!mapping) return fail(404, "Playlist mapping not found");
    await requireClientAccess(mapping.clientId);

    const pending = await prisma.playlistDraft.findFirst({
      where: {
        clientId: mapping.clientId,
        optisignsPlaylistId: params.playlistId,
        status: "PENDING_APPROVAL",
      },
      select: { id: true },
    });
    if (pending) {
      return fail(
        409,
        "A draft is currently awaiting admin approval — wait for it to be approved or rejected before pulling again."
      );
    }

    try {
      const result = await importPlaylistFromOptiSigns({
        clientId: mapping.clientId,
        optisignsPlaylistId: params.playlistId,
        byUserId: session.userId,
      });
      return ok({
        ok: true,
        itemCount: result.itemCount,
        assetsCreated: result.assetsCreated,
        playlistName: result.playlistName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OptiSigns request failed";
      return fail(502, `OptiSigns: ${msg}`);
    }
  });
}
