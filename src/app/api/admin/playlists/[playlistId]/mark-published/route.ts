// POST /api/admin/playlists/:playlistId/mark-published
//
// Closes the local-only loop: admin has manually mirrored the approved
// draft into the OptiSigns dashboard, and clicks "Mark as published" to
// move the draft from APPROVED → PUBLISHED. Admin-only.
//
// We never call OptiSigns here — that's the whole point of local-only mode.
// Audit log records that the user attested to the manual publish.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireAdmin();

    const draft = await prisma.playlistDraft.findFirst({
      where: { optisignsPlaylistId: params.playlistId, status: "APPROVED" },
    });
    if (!draft) return fail(404, "No approved draft awaiting manual publish for this playlist");

    const published = await prisma.playlistDraft.update({
      where: { id: draft.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    await audit({
      userId: session.userId,
      clientId: draft.clientId,
      action: "PLAYLIST_MANUALLY_PUBLISHED",
      entityType: "PlaylistDraft",
      entityId: draft.id,
      after: { mode: "local" },
    });

    return ok({ ok: true, status: published.status });
  });
}
