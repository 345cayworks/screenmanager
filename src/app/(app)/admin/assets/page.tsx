import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, PageHeader, Badge, statusTone } from "@/components/ui";
import NewAssetForm from "./NewAssetForm";

export default async function AdminAssetsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const [clients, assets] = await Promise.all([
    prisma.client.findMany({ orderBy: { companyName: "asc" } }),
    prisma.assetReference.findMany({
      include: { client: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Asset References" subtitle="Map OptiSigns assets to clients for playlist use." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left py-2 px-4">Client</th>
                <th className="text-left py-2 px-4">Title</th>
                <th className="text-left py-2 px-4">OptiSigns ID</th>
                <th className="text-left py-2 px-4">Type</th>
                <th className="text-left py-2 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 px-4">{a.client.companyName}</td>
                  <td className="py-2 px-4 font-medium text-slate-900">{a.title}</td>
                  <td className="py-2 px-4 font-mono text-xs text-slate-500">{a.optisignsAssetId}</td>
                  <td className="py-2 px-4">{a.type}</td>
                  <td className="py-2 px-4"><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No assets yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Add asset reference</h2>
          <NewAssetForm clients={clients.map((c) => ({ id: c.id, name: c.companyName }))} />
        </Card>
      </div>
    </div>
  );
}
