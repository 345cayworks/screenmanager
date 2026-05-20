import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import { PageHeader } from "@/components/ui";
import OptiSignsBrowser from "./OptiSignsBrowser";

export const dynamic = "force-dynamic";

export default async function OptiSignsBrowsePage() {
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
        title="OptiSigns Browser"
        subtitle="Pull playlists and screens from your OptiSigns account and assign them to clients."
      />
      <OptiSignsBrowser clients={clients.map((c) => ({ id: c.id, name: c.companyName }))} />
    </div>
  );
}
