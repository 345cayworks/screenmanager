// POST /api/admin/playlists/:playlistId/approve
//
// Approves a PENDING_APPROVAL draft.
//   - In API mode (default): immediately tries to push the changes to
//     OptiSigns and mark the draft PUBLISHED. On failure, rolls back to
//     PENDING_APPROVAL so the admin can retry.
//   - In local-only mode: just transitions the draft to APPROVED and
//     returns a change report the admin will mirror into OptiSigns
//     manually. The admin then hits /mark-published to close the loop.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { publishDraft } from "@/lib/publish";
import { isLocalOnly } from "@/lib/settings";
import { buildChangeReport } from "@/lib/change-report";

export async function POST(_req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const localOnly = await isLocalOnly();

    const draft = await prisma.playlistDraft.findFirst({
      where: { optisignsPlaylistId: params.playlistId, status: "PENDING_APPROVAL" },
    });
    if (!draft) return fail(404, "No pending draft for this playlist");

    await prisma.playlistDraft.update({
      where: { id: draft.id },
      data: { status: "APPROVED", approvedByUserId: session.userId },
    });
    await audit({
      userId: session.userId,
      clientId: draft.clientId,
      action: "DRAFT_APPROVED",
      entityType: "PlaylistDraft",
      entityId: draft.id,
    });

    if (localOnly) {
      const report = await buildChangeReport(draft.id);
      return ok({ ok: true, status: "APPROVED", mode: "local", report });
    }

    try {
      const published = await publishDraft(draft.id, session.userId);
      return ok({ ok: true, status: published.status, mode: "api" });
    } catch (err) {
      await prisma.playlistDraft.update({
        where: { id: draft.id },
        data: { status: "PENDING_APPROVAL" },
      });
      const msg = err instanceof Error ? err.message : "Publish failed";
      await audit({
        userId: session.userId,
        clientId: draft.clientId,
        action: "PUBLISH_FAILED",
        entityType: "PlaylistDraft",
        entityId: draft.id,
        after: { error: msg },
      });
      return fail(502, `OptiSigns publish failed: ${msg}`);
    }
  });
}
