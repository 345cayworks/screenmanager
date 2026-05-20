// POST /api/auth/setup-password
//
// Public endpoint. Consumes a setup token and sets the user's password.
// Body: { token: string, password: string }
//
// On success, the user is signed in and a session cookie is issued.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findUserBySetupToken } from "@/lib/invitations";
import { hashPassword, signInUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

const schema = z.object({
  token: z.string().min(10),
  // Match a reasonable minimum; UI also enforces this.
  password: z.string().min(10).max(200),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Password must be at least 10 characters");

    const match = await findUserBySetupToken(parsed.data.token);
    if (!match) return fail(400, "This setup link is invalid or expired. Ask your administrator for a new one.");

    const passwordHash = await hashPassword(parsed.data.password);

    await prisma.user.update({
      where: { id: match.id },
      data: {
        passwordHash,
        setupTokenHash: null,
        setupTokenExpiresAt: null,
      },
    });

    const session = await signInUser(match.id);
    if (!session) return fail(500, "Could not sign in after password setup");

    await audit({
      userId: session.userId,
      clientId: session.clientId,
      action: "USER_PASSWORD_SET",
      entityType: "User",
      entityId: session.userId,
    });

    return ok({ ok: true });
  });
}
