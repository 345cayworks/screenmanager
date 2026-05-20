import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, PageHeader } from "@/components/ui";

export default async function AuditPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: true, client: true },
  });

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Full action history across all clients." />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left py-2 px-4">When</th>
              <th className="text-left py-2 px-4">Action</th>
              <th className="text-left py-2 px-4">Entity</th>
              <th className="text-left py-2 px-4">User</th>
              <th className="text-left py-2 px-4">Client</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="py-2 px-4 text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="py-2 px-4 font-medium text-slate-900">{l.action.replace(/_/g, " ")}</td>
                <td className="py-2 px-4 text-slate-600">{l.entityType}</td>
                <td className="py-2 px-4 text-slate-600">{l.user?.name || "—"}</td>
                <td className="py-2 px-4 text-slate-600">{l.client?.companyName || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
