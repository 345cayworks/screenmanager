// GET /api/admin/optisigns/playlists
//
// Returns every playlist OptiSigns knows about, plus which client (if any)
// already has it mapped locally. Admin-only.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { handle, ok, fail } from "@/lib/http";
import { Playlists } from "@/lib/optisigns";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    let remote;
    try {
      remote = await Playlists.listPlaylists();
    } catch (err) {
      return fail(502, `OptiSigns: ${err instanceof Error ? err.message : "request failed"}`);
    }

    const ids = remote.map((p) => p._id);
    const mappings = await prisma.optiSignsMapping.findMany({
      where: { optisignsPlaylistId: { in: ids } },
      include: { client: { select: { id: true, companyName: true } } },
    });
    const byPlaylist = new Map(mappings.map((m) => [m.optisignsPlaylistId, m]));

    return ok({
      playlists: remote.map((p) => {
        const m = byPlaylist.get(p._id);
        return {
          optisignsPlaylistId: p._id,
          name: p.name ?? null,
          itemCount: p.itemCount,
          assignedClient: m?.client
            ? { id: m.client.id, name: m.client.companyName }
            : null,
          mappingId: m?.id ?? null,
        };
      }),
    });
  });
}
