import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, PageHeader } from "@/components/ui";
import NewMappingForm from "./NewMappingForm";
import MappingsTable from "./MappingsTable";

export const dynamic = "force-dynamic";

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
          <MappingsTable
            mappings={mappings.map((m) => ({
              id: m.id,
              clientName: m.client.companyName,
              optisignsPlaylistId: m.optisignsPlaylistId,
              optisignsPlaylistName: m.optisignsPlaylistName,
              optisignsScreenId: m.optisignsScreenId,
              optisignsScreenName: m.optisignsScreenName,
              canPublishDirectly: m.canPublishDirectly,
            }))}
          />
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Add mapping</h2>
          <NewMappingForm clients={clients.map((c) => ({ id: c.id, name: c.companyName }))} />
        </Card>
      </div>
    </div>
  );
}
