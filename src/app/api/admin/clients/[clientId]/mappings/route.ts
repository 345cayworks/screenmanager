import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

const create = z.object({
  optisignsPlaylistId: z.string().min(1),
  optisignsPlaylistName: z.string().optional(),
  optisignsScreenId: z.string().optional(),
  optisignsScreenName: z.string().optional(),
  canPublishDirectly: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const body = create.safeParse(await req.json());
    if (!body.success) return fail(400, "Invalid input");
    const client = await prisma.client.findUnique({ where: { id: params.clientId } });
    if (!client) return fail(404, "Client not found");

    // Reject duplicates explicitly so the admin gets a clear message instead
    // of a P2002 stack trace. Upsert is still used so re-saving the SAME
    // (client, playlist) row remains an idempotent edit.
    const playlistInUse = await prisma.optiSignsMapping.findUnique({
      where: { optisignsPlaylistId: body.data.optisignsPlaylistId },
      include: { client: { select: { id: true, companyName: true } } },
    });
    if (playlistInUse && playlistInUse.clientId !== params.clientId) {
      return fail(
        409,
        `That OptiSigns playlist is already assigned to ${playlistInUse.client.companyName}.`
      );
    }
    if (body.data.optisignsScreenId) {
      const screenInUse = await prisma.optiSignsMapping.findUnique({
        where: { optisignsScreenId: body.data.optisignsScreenId },
        include: { client: { select: { id: true, companyName: true } } },
      });
      if (screenInUse && screenInUse.clientId !== params.clientId) {
        return fail(
          409,
          `That OptiSigns screen is already linked to ${screenInUse.client.companyName}.`
        );
      }
    }

    const mapping = await prisma.optiSignsMapping.upsert({
      where: {
        clientId_optisignsPlaylistId: {
          clientId: params.clientId,
          optisignsPlaylistId: body.data.optisignsPlaylistId,
        },
      },
      create: { clientId: params.clientId, ...body.data },
      update: body.data,
    });
    await audit({
      userId: session.userId,
      clientId: params.clientId,
      action: "MAPPING_UPSERTED",
      entityType: "OptiSignsMapping",
      entityId: mapping.id,
      after: mapping,
    });
    return ok(mapping);
  });
}
