import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { fail, handle, ok } from "@/lib/http";
import { audit } from "@/lib/audit";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const clients = await prisma.client.findMany({
      orderBy: { companyName: "asc" },
      include: { _count: { select: { users: true, mappings: true } } },
    });
    return ok(clients);
  });
}

const create = z.object({
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  phone: z.string().optional(),
  approvalMode: z.enum(["AUTO_PUBLISH", "REQUIRES_APPROVAL"]).default("REQUIRES_APPROVAL"),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const body = create.safeParse(await req.json());
    if (!body.success) return fail(400, "Invalid input");
    const client = await prisma.client.create({ data: body.data });
    await audit({
      userId: session.userId,
      clientId: client.id,
      action: "CLIENT_CREATED",
      entityType: "Client",
      entityId: client.id,
      after: client,
    });
    return ok(client);
  });
}
