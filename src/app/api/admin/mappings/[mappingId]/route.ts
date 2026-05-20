// DELETE /api/admin/mappings/:mappingId
//
// Unassigns a playlist from a client. Admin-only.
//
// Effects:
//   - Removes the OptiSignsMapping row.
//   - Deletes any PlaylistDrafts for (clientId, optisignsPlaylistId) — and
//     their PlaylistItems via cascade — so a future re-assignment starts
//     clean.
//   - Leaves AssetReference rows in place: they're per-client and cheap to
//     keep; the same assets reappear on re-import.
//   - Does NOT touch OptiSigns. The physical screen will keep playing
//     whatever it was playing until an admin explicitly retargets it.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

export async function DELETE(_req: NextRequest, { params }: { params: { mappingId: string } }) {
  return handle(async () => {
    const session = await requireAdmin();

    const mapping = await prisma.optiSignsMapping.findUnique({
      where: { id: params.mappingId },
      include: { client: { select: { id: true, companyName: true } } },
    });
    if (!mapping) return fail(404, "Mapping not found");

    // Wipe drafts for this (client, playlist). PlaylistItems cascade.
    const drafts = await prisma.playlistDraft.deleteMany({
      where: {
        clientId: mapping.clientId,
        optisignsPlaylistId: mapping.optisignsPlaylistId,
      },
    });

    await prisma.optiSignsMapping.delete({ where: { id: mapping.id } });

    await audit({
      userId: session.userId,
      clientId: mapping.clientId,
      action: "MAPPING_UNASSIGNED",
      entityType: "OptiSignsMapping",
      entityId: mapping.id,
      before: {
        client: mapping.client.companyName,
        playlistId: mapping.optisignsPlaylistId,
        playlistName: mapping.optisignsPlaylistName,
        screenId: mapping.optisignsScreenId,
      },
      after: { draftsRemoved: drafts.count },
    });

    return ok({ ok: true, draftsRemoved: drafts.count });
  });
}
