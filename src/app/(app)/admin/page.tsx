import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, PageHeader, StatCard, Badge, statusTone } from "@/components/ui";
import Link from "next/link";

export default async function AdminDashboard() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const [clients, mappings, pending, recent] = await Promise.all([
    prisma.client.count(),
    prisma.optiSignsMapping.count(),
    prisma.playlistDraft.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: true, client: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Operational overview across all clients." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Clients" value={clients} />
        <StatCard label="OptiSigns Mappings" value={mappings} />
        <StatCard label="Pending Approvals" value={pending} />
        <StatCard label="Audit events (recent)" value={recent.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Quick links</h2>
          </div>
          <ul className="space-y-2 text-sm">
            <li><Link href="/admin/clients" className="text-brand-600 hover:text-brand-700">Manage clients →</Link></li>
            <li><Link href="/admin/mappings" className="text-brand-600 hover:text-brand-700">OptiSigns mappings →</Link></li>
            <li><Link href="/admin/approvals" className="text-brand-600 hover:text-brand-700">Approval queue ({pending}) →</Link></li>
            <li><Link href="/admin/assets" className="text-brand-600 hover:text-brand-700">Asset references →</Link></li>
            <li><Link href="/admin/audit" className="text-brand-600 hover:text-brand-700">Audit log →</Link></li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-3">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-medium">{a.action.replace(/_/g, " ")}</span>
                    <Badge tone="slate">{a.entityType}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(a.createdAt).toLocaleString()} · {a.user?.name || "system"} · {a.client?.companyName || "—"}
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
