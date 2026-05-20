// PATCH /api/admin/users/:id — update role/status/client/name. Admin-only.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { ROLES } from "@/lib/enums";

const update = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  clientId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = update.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const data = parsed.data;

    const before = await prisma.user.findUnique({ where: { id: params.id } });
    if (!before) return fail(404, "User not found");

    // A user cannot disable themselves — prevents lockout.
    if (data.status === "INACTIVE" && params.id === session.userId) {
      return fail(400, "You can't deactivate your own account");
    }

    // Keep role / clientId in sync.
    const nextRole = data.role ?? before.role;
    const adminRole = nextRole === "SUPERADMIN" || nextRole === "ADMIN";
    let nextClientId: string | null | undefined = data.clientId;
    if (adminRole) nextClientId = null;
    if (!adminRole && nextClientId === undefined) nextClientId = before.clientId;
    if (!adminRole && !nextClientId) return fail(400, "Pick a client for this role");

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: data.name,
        role: data.role,
        status: data.status,
        clientId: nextClientId,
      },
    });

    await audit({
      userId: session.userId,
      clientId: updated.clientId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: updated.id,
      before: { role: before.role, status: before.status, clientId: before.clientId, name: before.name },
      after: { role: updated.role, status: updated.status, clientId: updated.clientId, name: updated.name },
    });

    return ok({ ok: true });
  });
}
