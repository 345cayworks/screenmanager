import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { PageHeader } from "@/components/ui";
import ClientsView from "./ClientsView";

export const dynamic = "force-dynamic";

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
      <PageHeader
        title="Clients"
        subtitle="Each onboarding step — client, primary user, and OptiSigns mapping — happens in one flow."
      />
      <ClientsView
        clients={clients.map((c) => ({
          id: c.id,
          companyName: c.companyName,
          contactEmail: c.contactEmail,
          approvalMode: c.approvalMode,
          status: c.status,
          users: c._count.users,
          mappings: c._count.mappings,
        }))}
      />
    </div>
  );
}
