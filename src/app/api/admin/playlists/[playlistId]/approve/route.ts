import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { publishDraft } from "@/lib/publish";

/**
 * Approve a PENDING_APPROVAL draft AND publish it to OptiSigns.
 * We intentionally combine approval + publish — there is no benefit to an
 * "approved but unpublished" state in the MVP.
 */
export async function POST(_req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
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

    try {
      const published = await publishDraft(draft.id, session.userId);
      return ok({ ok: true, status: published.status });
    } catch (err) {
      // Roll back to PENDING_APPROVAL so the admin can retry.
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
