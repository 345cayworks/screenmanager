import Link from "next/link";
import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, EmptyState, PageHeader, Badge, statusTone } from "@/components/ui";

export default async function PlaylistsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const where = isAdminRole(session.role) ? {} : { clientId: session.clientId ?? "__none__" };
  const mappings = await prisma.optiSignsMapping.findMany({
    where,
    include: { client: true },
    orderBy: { updatedAt: "desc" },
  });

  const drafts = await prisma.playlistDraft.findMany({
    where: { optisignsPlaylistId: { in: mappings.map((m) => m.optisignsPlaylistId) } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Playlists" subtitle="Manage the playlist content shown on your screens." />

      {mappings.length === 0 ? (
        <EmptyState
          title="No playlists assigned"
          hint="An administrator will assign OptiSigns playlists to your account."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mappings.map((m) => {
            const latest = drafts.find((d) => d.optisignsPlaylistId === m.optisignsPlaylistId);
            return (
              <Card key={m.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {m.optisignsPlaylistName || "Untitled Playlist"}
                    </div>
                    {isAdminRole(session.role) && (
                      <div className="text-xs text-slate-500">{m.client.companyName}</div>
                    )}
                    <div className="text-xs text-slate-400 mt-1 font-mono">{m.optisignsPlaylistId}</div>
                  </div>
                  {latest ? (
                    <Badge tone={statusTone(latest.status)}>{latest.status.replace("_", " ")}</Badge>
                  ) : (
                    <Badge tone="slate">NO DRAFT</Badge>
                  )}
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Screen: {m.optisignsScreenName || "—"}
                </div>
                <div className="text-xs text-slate-500">
                  Direct publish: {m.canPublishDirectly ? "Allowed" : "Approval required"}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <Link
                    href={`/playlists/${m.optisignsPlaylistId}`}
                    className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Manage playlist →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
