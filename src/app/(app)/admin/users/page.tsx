import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { PageHeader } from "@/components/ui";
import UsersBrowser from "./UsersBrowser";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Invite client owners, editors, and admins. Each invitation generates a one-time setup link you share out-of-band."
      />
      <UsersBrowser clients={clients.map((c) => ({ id: c.id, name: c.companyName }))} currentUserId={session.userId} />
    </div>
  );
}
