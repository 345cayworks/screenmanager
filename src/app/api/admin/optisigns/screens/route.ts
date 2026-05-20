// GET /api/admin/optisigns/screens
//
// Returns every screen/device the OptiSigns account exposes, plus which
// client (if any) already has it linked locally. Admin-only.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { handle, ok, fail } from "@/lib/http";
import { Devices } from "@/lib/optisigns";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    let devices;
    try {
      devices = await Devices.getDevices();
    } catch (err) {
      return fail(502, `OptiSigns: ${err instanceof Error ? err.message : "request failed"}`);
    }

    const ids = devices.map((d) => d._id);
    const mappings = await prisma.optiSignsMapping.findMany({
      where: { optisignsScreenId: { in: ids } },
      include: { client: { select: { id: true, companyName: true } } },
    });
    const byScreen = new Map(mappings.map((m) => [m.optisignsScreenId!, m]));

    return ok({
      screens: devices.map((d) => {
        const m = byScreen.get(d._id);
        return {
          optisignsScreenId: d._id,
          name: d.deviceName ?? null,
          currentType: d.currentType ?? null,
          currentAssetId: d.currentAssetId ?? null,
          assignedClient: m?.client
            ? { id: m.client.id, name: m.client.companyName }
            : null,
          assignedPlaylistId: m?.optisignsPlaylistId ?? null,
        };
      }),
    });
  });
}
