import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, EmptyState, PageHeader, Badge, statusTone } from "@/components/ui";
import ApprovalActions from "./ApprovalActions";
import { isLocalOnly } from "@/lib/settings";
import { buildChangeReport, formatChangeReport } from "@/lib/change-report";
import LocalApprovedCard from "./LocalApprovedCard";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const localOnly = await isLocalOnly();

  // In local mode, drafts that admin approved but hasn't manually mirrored
  // yet sit in APPROVED status. Surface them here so they're not forgotten.
  const drafts = await prisma.playlistDraft.findMany({
    where: { status: { in: localOnly ? ["PENDING_APPROVAL", "APPROVED"] : ["PENDING_APPROVAL"] } },
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      submittedBy: true,
      approvedBy: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  // Pre-build change reports for the approved ones so the admin sees the
  // exact list to apply.
  const reports = await Promise.all(
    drafts
      .filter((d) => d.status === "APPROVED")
      .map(async (d) => ({ id: d.id, report: await buildChangeReport(d.id) }))
  );
  const reportById = new Map(reports.map((r) => [r.id, r.report]));

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={
          localOnly
            ? "Approve submitted drafts, then mirror approved changes into OptiSigns and mark as published."
            : "Review and approve playlist drafts submitted by clients."
        }
      />
      {drafts.length === 0 ? (
        <EmptyState title="Nothing to approve" hint="Submitted client drafts will appear here." />
      ) : (
        <div className="space-y-6">
          {drafts.map((d) => {
            const isApproved = d.status === "APPROVED";
            const report = reportById.get(d.id) ?? null;
            return (
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
                      {isApproved && d.approvedBy && (
                        <> · Approved by {d.approvedBy.name}</>
                      )}
                    </div>
                  </div>
                  <Badge tone={statusTone(d.status)}>{d.status.replace("_", " ")}</Badge>
                </div>

                {isApproved && report && localOnly ? (
                  <LocalApprovedCard
                    playlistId={d.optisignsPlaylistId}
                    reportText={formatChangeReport(report)}
                    report={report}
                  />
                ) : (
                  <>
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
                    <ApprovalActions playlistId={d.optisignsPlaylistId} localOnly={localOnly} />
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
