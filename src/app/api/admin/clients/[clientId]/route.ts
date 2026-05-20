import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

const update = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  approvalMode: z.enum(["AUTO_PUBLISH", "REQUIRES_APPROVAL"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { clientId: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const body = update.safeParse(await req.json());
    if (!body.success) return fail(400, "Invalid input");
    const before = await prisma.client.findUnique({ where: { id: params.clientId } });
    if (!before) return fail(404, "Client not found");
    const client = await prisma.client.update({ where: { id: params.clientId }, data: body.data });
    await audit({
      userId: session.userId,
      clientId: client.id,
      action: "CLIENT_UPDATED",
      entityType: "Client",
      entityId: client.id,
      before,
      after: client,
    });
    return ok(client);
  });
}
