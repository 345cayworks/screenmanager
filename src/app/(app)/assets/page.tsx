import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { Card, EmptyState, PageHeader, Badge, statusTone } from "@/components/ui";

export default async function AssetsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const where = isAdminRole(session.role)
    ? {}
    : { clientId: session.clientId ?? "__none__", status: "APPROVED" as const };

  const assets = await prisma.assetReference.findMany({ where, orderBy: { title: "asc" } });

  return (
    <div>
      <PageHeader title="Asset Library" subtitle="Approved OptiSigns assets available for your playlists." />
      {assets.length === 0 ? (
        <EmptyState
          title="No assets yet"
          hint="Ask an admin to add OptiSigns asset references for your client."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <div className="aspect-video bg-slate-100 grid place-items-center text-slate-400">
                {a.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.thumbnailUrl} alt={a.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">{a.type}</span>
                )}
              </div>
              <div className="p-3">
                <div className="font-medium text-slate-900 truncate">{a.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-slate-500 truncate font-mono">{a.optisignsAssetId}</div>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
