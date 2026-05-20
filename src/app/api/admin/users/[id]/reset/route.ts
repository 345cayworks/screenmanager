// POST /api/admin/users/:id/reset
//
// Regenerate a one-time setup token for the user. Used for:
//   - Re-issuing an expired invitation
//   - Forgotten password (admin-mediated; we don't have email)
//
// Returns the new setup URL exactly once. The previous setup token is
// invalidated by the new hash.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { issueSetupToken } from "@/lib/invitations";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return fail(404, "User not found");
    if (user.status !== "ACTIVE") return fail(400, "User is not active");

    const token = await issueSetupToken(user.id);

    await audit({
      userId: session.userId,
      clientId: user.clientId,
      action: "USER_PASSWORD_RESET_ISSUED",
      entityType: "User",
      entityId: user.id,
    });

    return ok({ setupUrl: `/setup-password?token=${encodeURIComponent(token)}` });
  });
}
