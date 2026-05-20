import Link from "next/link";
import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, EmptyState, PageHeader, StatCard, Badge, statusTone } from "@/components/ui";

export default async function Dashboard() {
  const session = await readSession();
  if (!session) redirect("/login");

  if (isAdminRole(session.role)) redirect("/admin");

  if (!session.clientId) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Your client account isn't fully set up yet." />
        <EmptyState
          title="No client assignment"
          hint="Your account isn't linked to a client yet. Contact your administrator."
        />
      </div>
    );
  }

  const [mappings, recentDrafts, pendingCount, recentActivity] = await Promise.all([
    prisma.optiSignsMapping.findMany({ where: { clientId: session.clientId } }),
    prisma.playlistDraft.findMany({
      where: { clientId: session.clientId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { _count: { select: { items: true } } },
    }),
    prisma.playlistDraft.count({
      where: { clientId: session.clientId, status: "PENDING_APPROVAL" },
    }),
    prisma.auditLog.findMany({
      where: { clientId: session.clientId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div>
      <PageHeader title={`Welcome back, ${session.name.split(" ")[0]}`} subtitle="Here's a snapshot of your screens and playlists." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Assigned Playlists" value={mappings.length} />
        <StatCard label="Screens / Devices" value={mappings.filter((m) => m.optisignsScreenId).length} />
        <StatCard label="Pending Approvals" value={pendingCount} />
        <StatCard label="Active Drafts" value={recentDrafts.filter((d) => d.status === "DRAFT").length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Your Playlists</h2>
            <Link href="/playlists" className="text-sm text-brand-600 hover:text-brand-700">View all →</Link>
          </div>
          {mappings.length === 0 ? (
            <EmptyState title="No playlists assigned yet" hint="An admin will assign your screens and playlists shortly." />
          ) : (
            <div className="divide-y divide-slate-100">
              {mappings.map((m) => {
                const draft = recentDrafts.find((d) => d.optisignsPlaylistId === m.optisignsPlaylistId);
                return (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {m.optisignsPlaylistName || "Untitled Playlist"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {m.optisignsScreenName ? `Screen: ${m.optisignsScreenName}` : "No screen linked"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {draft ? (
                        <Badge tone={statusTone(draft.status)}>{draft.status.replace("_", " ")}</Badge>
                      ) : (
                        <Badge tone="slate">NO DRAFT</Badge>
                      )}
                      <Link
                        href={`/playlists/${m.optisignsPlaylistId}`}
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Manage →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="text-slate-700 font-medium">{a.action.replace(/_/g, " ")}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(a.createdAt).toLocaleString()} · {a.entityType}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
