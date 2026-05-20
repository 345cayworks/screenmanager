import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { PageHeader } from "@/components/ui";
import ClientsHub from "./ClientsHub";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const [clients, users] = await Promise.all([
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      include: { _count: { select: { mappings: true } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Clients & Users"
        subtitle="Onboard clients, invite their users, and edit either — all in one place."
      />
      <ClientsHub
        currentUserId={session.userId}
        clients={clients.map((c) => ({
          id: c.id,
          companyName: c.companyName,
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          phone: c.phone,
          status: c.status,
          approvalMode: c.approvalMode,
          mappings: c._count.mappings,
        }))}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status as "ACTIVE" | "INACTIVE",
          clientId: u.clientId,
          hasPassword: !!u.passwordHash,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
