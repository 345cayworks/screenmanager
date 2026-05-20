// GET /api/admin/users    — list all users (admin-only)
// POST /api/admin/users   — invite a new user (admin-only); response includes
//                           a one-time setupUrl path that the admin shares
//                           with the invitee out-of-band.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { issueSetupToken } from "@/lib/invitations";
import { ROLES } from "@/lib/enums";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, companyName: true } } },
    });
    return ok(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        hasPassword: !!u.passwordHash,
        pendingSetup: !u.passwordHash || !!u.setupTokenHash,
        setupTokenExpiresAt: u.setupTokenExpiresAt,
        client: u.client,
        createdAt: u.createdAt,
      }))
    );
  });
}

const create = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  role: z.enum(ROLES),
  clientId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = create.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const { name, email, role, clientId } = parsed.data;

    // Admin-level roles must NOT be attached to a client. Client-level roles
    // MUST be attached to a client (otherwise they have no data to see).
    const isAdminRole = role === "SUPERADMIN" || role === "ADMIN";
    if (isAdminRole && clientId) return fail(400, "Admin roles can't be tied to a client");
    if (!isAdminRole && !clientId) return fail(400, "Pick a client for this role");

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) return fail(404, "Client not found");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(409, "A user with that email already exists");

    const user = await prisma.user.create({
      data: { name, email, role, clientId: isAdminRole ? null : clientId!, status: "ACTIVE" },
    });
    const token = await issueSetupToken(user.id);

    await audit({
      userId: session.userId,
      clientId: user.clientId,
      action: "USER_INVITED",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, role: user.role },
    });

    return ok({
      user: { id: user.id, email: user.email, role: user.role, clientId: user.clientId, name: user.name },
      setupUrl: `/setup-password?token=${encodeURIComponent(token)}`,
    });
  });
}
