import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, PageHeader, Badge, statusTone } from "@/components/ui";
import NewClientForm from "./NewClientForm";

export default async function AdminClientsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
    include: { _count: { select: { users: true, mappings: true } } },
  });

  return (
    <div>
      <PageHeader title="Clients" subtitle="Manage client accounts and approval modes." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left py-2 px-4">Company</th>
                <th className="text-left py-2 px-4">Contact</th>
                <th className="text-left py-2 px-4">Approval</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-left py-2 px-4">Users</th>
                <th className="text-left py-2 px-4">Mappings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 px-4 font-medium text-slate-900">{c.companyName}</td>
                  <td className="py-2 px-4 text-slate-600">{c.contactEmail || "—"}</td>
                  <td className="py-2 px-4"><Badge tone={c.approvalMode === "AUTO_PUBLISH" ? "green" : "amber"}>{c.approvalMode}</Badge></td>
                  <td className="py-2 px-4"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                  <td className="py-2 px-4 text-slate-600">{c._count.users}</td>
                  <td className="py-2 px-4 text-slate-600">{c._count.mappings}</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">No clients yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Add client</h2>
          <NewClientForm />
        </Card>
      </div>
    </div>
  );
}
