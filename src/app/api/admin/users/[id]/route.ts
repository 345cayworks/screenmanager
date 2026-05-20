// PATCH  /api/admin/users/:id — update role/status/client/name.
// DELETE /api/admin/users/:id — hard-delete the user.
//
// Both admin-only. Self-protection: can't deactivate or delete yourself.
// Deleting the last active SUPERADMIN is refused to prevent lockout.
// User-referencing FKs on PlaylistDraft and AuditLog are now `SetNull`, so
// deleting a user preserves the historical audit / draft trail.

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await requireAdmin();

    if (params.id === session.userId) {
      return fail(400, "You can't delete your own account");
    }

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return fail(404, "User not found");

    if (target.role === "SUPERADMIN") {
      const remaining = await prisma.user.count({
        where: { role: "SUPERADMIN", status: "ACTIVE", id: { not: params.id } },
      });
      if (remaining === 0) {
        return fail(400, "Refusing to delete the last active SUPERADMIN — promote another user first.");
      }
    }

    await prisma.user.delete({ where: { id: params.id } });

    await audit({
      userId: session.userId,
      clientId: target.clientId,
      action: "USER_DELETED",
      entityType: "User",
      entityId: target.id,
      before: { email: target.email, role: target.role, status: target.status, clientId: target.clientId },
    });

    return ok({ ok: true });
  });
}
