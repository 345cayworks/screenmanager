import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default async function ActivityPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const where = isAdminRole(session.role) ? {} : { clientId: session.clientId ?? "__none__" };
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: true, client: true },
  });

  return (
    <div>
      <PageHeader title="Activity" subtitle="Recent actions taken on your account." />
      {logs.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left py-2 px-4">Time</th>
                <th className="text-left py-2 px-4">Action</th>
                <th className="text-left py-2 px-4">Entity</th>
                <th className="text-left py-2 px-4">User</th>
                {isAdminRole(session.role) && <th className="text-left py-2 px-4">Client</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 px-4 text-slate-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-4 font-medium text-slate-900">{l.action.replace(/_/g, " ")}</td>
                  <td className="py-2 px-4 text-slate-600">
                    {l.entityType}
                    {l.entityId ? <span className="text-slate-400 font-mono ml-1">{l.entityId.slice(0, 8)}</span> : null}
                  </td>
                  <td className="py-2 px-4 text-slate-600">{l.user?.name || "—"}</td>
                  {isAdminRole(session.role) && (
                    <td className="py-2 px-4 text-slate-600">{l.client?.companyName || "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
