import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/enums";
import { handle, ok } from "@/lib/http";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const where = isAdminRole(session.role)
      ? { status: "APPROVED" as const }
      : { status: "APPROVED" as const, clientId: session.clientId ?? "__none__" };
    const assets = await prisma.assetReference.findMany({ where, orderBy: { title: "asc" } });
    return ok(assets);
  });
}
