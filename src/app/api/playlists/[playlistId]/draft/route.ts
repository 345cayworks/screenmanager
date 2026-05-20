import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertCanEdit, requireClientAccess } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { isAdminRole } from "@/lib/enums";

const itemSchema = z.object({
  id: z.string().optional(),
  optisignsAssetId: z.string().min(1),
  title: z.string().min(1),
  type: z.string().default("UNKNOWN"),
  durationSeconds: z.number().int().positive().max(86400),
  sortOrder: z.number().int().min(0),
  status: z.string().default("ACTIVE"),
});

const bodySchema = z.object({ items: z.array(itemSchema) });

/**
 * Save (replace) the current DRAFT for this playlist. Creates a DRAFT if one
 * doesn't exist. Will not modify drafts in PENDING_APPROVAL state.
 */
export async function POST(req: NextRequest, { params }: { params: { playlistId: string } }) {
  return handle(async () => {
    const session = await requireSession();
    assertCanEdit(session);

    const mapping = await prisma.optiSignsMapping.findFirst({
      where: { optisignsPlaylistId: params.playlistId },
      include: { client: true },
    });
    if (!mapping) return fail(404, "Playlist mapping not found");
    await requireClientAccess(mapping.clientId);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");

    // Validate every referenced asset belongs to this client and is approved
    // (admin/superadmin may use any approved asset).
    const assetIds = Array.from(new Set(parsed.data.items.map((i) => i.optisignsAssetId)));
    const allowedAssets = await prisma.assetReference.findMany({
      where: {
        optisignsAssetId: { in: assetIds },
        status: "APPROVED",
        ...(isAdminRole(session.role) ? {} : { clientId: mapping.clientId }),
      },
      select: { optisignsAssetId: true },
    });
    const allowedSet = new Set(allowedAssets.map((a) => a.optisignsAssetId));
    const disallowed = assetIds.filter((id) => !allowedSet.has(id));
    if (disallowed.length) return fail(400, `Unapproved or unknown asset(s): ${disallowed.join(", ")}`);

    let draft = await prisma.playlistDraft.findFirst({
      where: {
        clientId: mapping.clientId,
        optisignsPlaylistId: params.playlistId,
        status: { in: ["DRAFT", "PENDING_APPROVAL"] },
      },
      include: { items: true },
    });

    if (draft && draft.status === "PENDING_APPROVAL" && !isAdminRole(session.role)) {
      return fail(409, "Draft is locked for approval");
    }

    if (!draft) {
      draft = await prisma.playlistDraft.create({
        data: { clientId: mapping.clientId, optisignsPlaylistId: params.playlistId, status: "DRAFT" },
        include: { items: true },
      });
    }

    const before = { items: draft.items };

    // Strategy: simple full replace. Preserve optisignsPlaylistItemId where the
    // existing draft item is referenced again so subsequent publishes can map
    // updates back to the remote item.
    const existingById = new Map(draft.items.map((i) => [i.id, i]));
    const incoming = parsed.data.items;

    await prisma.$transaction(async (tx) => {
      await tx.playlistItem.deleteMany({ where: { playlistDraftId: draft!.id } });
      if (incoming.length) {
        await tx.playlistItem.createMany({
          data: incoming.map((i) => {
            const prev = i.id ? existingById.get(i.id) : null;
            return {
              playlistDraftId: draft!.id,
              clientId: mapping.clientId,
              optisignsPlaylistId: params.playlistId,
              optisignsPlaylistItemId: prev?.optisignsPlaylistItemId ?? null,
              optisignsAssetId: i.optisignsAssetId,
              title: i.title,
              type: i.type,
              durationSeconds: i.durationSeconds,
              sortOrder: i.sortOrder,
              status: i.status,
            };
          }),
        });
      }
      await tx.playlistDraft.update({
        where: { id: draft!.id },
        data: { status: "DRAFT", updatedAt: new Date() },
      });
    });

    await audit({
      userId: session.userId,
      clientId: mapping.clientId,
      action: "DRAFT_SAVED",
      entityType: "PlaylistDraft",
      entityId: draft.id,
      before,
      after: { items: incoming },
    });

    return ok({ ok: true, draftId: draft.id });
  });
}
