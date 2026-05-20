import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, PageHeader } from "@/components/ui";
import NewMappingForm from "./NewMappingForm";

export default async function MappingsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const [clients, mappings] = await Promise.all([
    prisma.client.findMany({ orderBy: { companyName: "asc" } }),
    prisma.optiSignsMapping.findMany({
      include: { client: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="OptiSigns Mappings" subtitle="Link clients to OptiSigns playlist & screen IDs." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left py-2 px-4">Client</th>
                <th className="text-left py-2 px-4">Playlist</th>
                <th className="text-left py-2 px-4">Screen</th>
                <th className="text-left py-2 px-4">Direct publish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 px-4 font-medium text-slate-900">{m.client.companyName}</td>
                  <td className="py-2 px-4">
                    <div className="text-slate-900">{m.optisignsPlaylistName || "—"}</div>
                    <div className="font-mono text-xs text-slate-500">{m.optisignsPlaylistId}</div>
                  </td>
                  <td className="py-2 px-4">
                    <div className="text-slate-900">{m.optisignsScreenName || "—"}</div>
                    <div className="font-mono text-xs text-slate-500">{m.optisignsScreenId || ""}</div>
                  </td>
                  <td className="py-2 px-4 text-slate-600">{m.canPublishDirectly ? "Yes" : "No"}</td>
                </tr>
              ))}
              {mappings.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">No mappings yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Add mapping</h2>
          <NewMappingForm clients={clients.map((c) => ({ id: c.id, name: c.companyName }))} />
        </Card>
      </div>
    </div>
  );
}
