// POST /api/admin/optisigns/assign-screen
//
// Links an OptiSigns screen/device to a client's playlist mapping. If the
// mapping already exists, its screen fields are updated; otherwise a new
// mapping row is created. After the local link is saved we call
// updateDevice() on OptiSigns to actually point the device at the playlist.
//
// Body: {
//   clientId: string,
//   optisignsPlaylistId: string,
//   optisignsScreenId: string,
//   optisignsScreenName?: string,
//   pushToOptiSigns?: boolean   // default true
// }

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { Devices } from "@/lib/optisigns";

const schema = z.object({
  clientId: z.string().min(1),
  optisignsPlaylistId: z.string().min(1),
  optisignsScreenId: z.string().min(1),
  optisignsScreenName: z.string().optional(),
  pushToOptiSigns: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const input = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) return fail(404, "Client not found");

    // Refuse if this screen is already linked to a different client/mapping.
    const screenInUse = await prisma.optiSignsMapping.findUnique({
      where: { optisignsScreenId: input.optisignsScreenId },
      include: { client: { select: { id: true, companyName: true } } },
    });
    if (
      screenInUse &&
      (screenInUse.clientId !== input.clientId ||
        screenInUse.optisignsPlaylistId !== input.optisignsPlaylistId)
    ) {
      return fail(
        409,
        `That screen is already linked to ${screenInUse.client.companyName}.`
      );
    }

    const mapping = await prisma.optiSignsMapping.upsert({
      where: {
        clientId_optisignsPlaylistId: {
          clientId: input.clientId,
          optisignsPlaylistId: input.optisignsPlaylistId,
        },
      },
      create: {
        clientId: input.clientId,
        optisignsPlaylistId: input.optisignsPlaylistId,
        optisignsScreenId: input.optisignsScreenId,
        optisignsScreenName: input.optisignsScreenName,
      },
      update: {
        optisignsScreenId: input.optisignsScreenId,
        optisignsScreenName: input.optisignsScreenName ?? undefined,
      },
    });

    let remoteUpdated = false;
    let remoteError: string | null = null;
    if (input.pushToOptiSigns) {
      try {
        await Devices.assignPlaylistToDevice(input.optisignsScreenId, input.optisignsPlaylistId);
        remoteUpdated = true;
      } catch (err) {
        remoteError = err instanceof Error ? err.message : "OptiSigns updateDevice failed";
      }
    }

    await audit({
      userId: session.userId,
      clientId: input.clientId,
      action: "SCREEN_ASSIGNED",
      entityType: "OptiSignsMapping",
      entityId: mapping.id,
      after: {
        screen: input.optisignsScreenId,
        playlist: input.optisignsPlaylistId,
        remoteUpdated,
        remoteError,
      },
    });

    return ok({ ok: true, mappingId: mapping.id, remoteUpdated, remoteError });
  });
}
