import { NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(400, "Invalid input");
    const session = await login(parsed.data.email, parsed.data.password);
    if (!session) return fail(401, "Invalid email or password");
    await audit({
      userId: session.userId,
      clientId: session.clientId,
      action: "LOGIN",
      entityType: "User",
      entityId: session.userId,
    });
    return ok({ ok: true, user: session });
  });
}
