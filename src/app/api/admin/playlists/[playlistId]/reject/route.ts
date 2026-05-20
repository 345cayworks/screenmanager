import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

const schema = z.object({ reason: z.string().max(1000).optional() });

export async function POST(req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const body = schema.safeParse(await req.json().catch(() => ({})));
    const reason = body.success ? body.data.reason : undefined;

    const draft = await prisma.playlistDraft.findFirst({
      where: { optisignsPlaylistId: params.playlistId, status: "PENDING_APPROVAL" },
    });
    if (!draft) return fail(404, "No pending draft for this playlist");

    await prisma.playlistDraft.update({
      where: { id: draft.id },
      data: { status: "REJECTED", rejectionReason: reason, approvedByUserId: session.userId },
    });
    await audit({
      userId: session.userId,
      clientId: draft.clientId,
      action: "DRAFT_REJECTED",
      entityType: "PlaylistDraft",
      entityId: draft.id,
      after: { reason },
    });
    return ok({ ok: true });
  });
}
