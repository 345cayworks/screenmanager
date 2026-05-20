import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertCanPublish, requireClientAccess } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { publishDraft } from "@/lib/publish";

/**
 * Force-publish the current DRAFT for this playlist directly to OptiSigns.
 * Allowed for admins, or for client users when the mapping has
 * canPublishDirectly = true and the user has owner-level permissions.
 */
export async function POST(_req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireSession();

    const mapping = await prisma.optiSignsMapping.findFirst({
      where: { optisignsPlaylistId: params.playlistId },
    });
    if (!mapping) return fail(404, "Playlist mapping not found");
    await requireClientAccess(mapping.clientId);
    assertCanPublish(session, mapping.canPublishDirectly);

    const draft = await prisma.playlistDraft.findFirst({
      where: {
        optisignsPlaylistId: params.playlistId,
        clientId: mapping.clientId,
        status: { in: ["DRAFT", "APPROVED", "PENDING_APPROVAL"] },
      },
    });
    if (!draft) return fail(404, "No publishable draft found");

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
  });
}
