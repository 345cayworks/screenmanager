// POST /api/admin/settings/mode
//
// Toggle the portal between API mode and local-only mode. Admin-only.
// Body: { local: boolean }

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { setLocalOnly } from "@/lib/settings";

const schema = z.object({ local: z.boolean() });

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    await setLocalOnly(parsed.data.local);
    await audit({
      userId: session.userId,
      action: "OPERATING_MODE_CHANGED",
      entityType: "SystemSetting",
      after: { mode: parsed.data.local ? "local" : "api" },
    });
    return ok({ ok: true, local: parsed.data.local });
  });
}
