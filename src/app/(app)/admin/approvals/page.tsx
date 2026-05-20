import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, EmptyState, PageHeader, Badge, statusTone } from "@/components/ui";
import ApprovalActions from "./ApprovalActions";

export default async function ApprovalsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const drafts = await prisma.playlistDraft.findMany({
    where: { status: "PENDING_APPROVAL" },
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      submittedBy: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle="Review and approve playlist drafts submitted by clients."
      />
      {drafts.length === 0 ? (
        <EmptyState title="Nothing to approve" hint="Submitted client drafts will appear here." />
      ) : (
        <div className="space-y-6">
          {drafts.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {d.client.companyName} ·{" "}
                    <span className="font-mono text-sm text-slate-500">{d.optisignsPlaylistId}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Submitted by {d.submittedBy?.name || "—"} ·{" "}
                    {new Date(d.updatedAt).toLocaleString()}
                  </div>
                </div>
                <Badge tone={statusTone(d.status)}>{d.status.replace("_", " ")}</Badge>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                  Proposed items ({d.items.length})
                </div>
                <ol className="space-y-1 text-sm">
                  {d.items.map((i, idx) => (
                    <li key={i.id} className="flex items-center gap-3">
                      <span className="text-slate-400 font-mono w-6 text-right">{idx + 1}.</span>
                      <span className="flex-1">{i.title}</span>
                      <span className="text-slate-500 text-xs">{i.durationSeconds}s</span>
                      <span className="text-slate-400 text-xs font-mono">{i.optisignsAssetId}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <ApprovalActions playlistId={d.optisignsPlaylistId} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
