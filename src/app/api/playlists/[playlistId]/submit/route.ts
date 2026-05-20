import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertCanEdit, requireClientAccess } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { publishDraft } from "@/lib/publish";

/**
 * Submit a DRAFT for approval. If the client's approvalMode is AUTO_PUBLISH
 * AND the mapping allows direct publish, push immediately to OptiSigns and
 * mark as PUBLISHED. Otherwise the draft is marked PENDING_APPROVAL.
 */
export async function POST(_req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireSession();
    assertCanEdit(session);

    const mapping = await prisma.optiSignsMapping.findFirst({
      where: { optisignsPlaylistId: params.playlistId },
      include: { client: true },
    });
    if (!mapping) return fail(404, "Playlist mapping not found");
    await requireClientAccess(mapping.clientId);

    const draft = await prisma.playlistDraft.findFirst({
      where: {
        clientId: mapping.clientId,
        optisignsPlaylistId: params.playlistId,
        status: { in: ["DRAFT", "PENDING_APPROVAL"] },
      },
    });
    if (!draft) return fail(404, "No editable draft found");
    if (draft.status === "PENDING_APPROVAL") return fail(409, "Already pending approval");

    const autoPublish =
      mapping.client.approvalMode === "AUTO_PUBLISH" &&
      mapping.canPublishDirectly &&
      session.role !== "CLIENT_EDITOR";

    if (autoPublish) {
      try {
        const published = await publishDraft(draft.id, session.userId);
        return ok({ ok: true, status: published.status });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Publish failed";
        await audit({
          userId: session.userId,
          clientId: mapping.clientId,
          action: "PUBLISH_FAILED",
          entityType: "PlaylistDraft",
          entityId: draft.id,
          after: { error: msg },
        });
        return fail(502, `OptiSigns publish failed: ${msg}`);
      }
    }

    const updated = await prisma.playlistDraft.update({
      where: { id: draft.id },
      data: { status: "PENDING_APPROVAL", submittedByUserId: session.userId },
    });
    await audit({
      userId: session.userId,
      clientId: mapping.clientId,
      action: "DRAFT_SUBMITTED",
      entityType: "PlaylistDraft",
      entityId: draft.id,
    });
    return ok({ ok: true, status: updated.status });
  });
}
