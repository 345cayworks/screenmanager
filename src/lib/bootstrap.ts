// First-run bootstrap. Runs on any server render of /login (and is idempotent
// once a SUPERADMIN exists). Creates the bootstrap superadmin from env vars
// so you never need to touch bcrypt, the Prisma CLI, or the Neon SQL editor.
//
// Required env vars (set in Netlify):
//   SUPER_ADMIN_EMAIL
//   SUPERADMIN_MASTER_KEY    (the plaintext password — hashed here at rest)
// Optional:
//   SUPER_ADMIN_NAME         (default: "Super Admin")

import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

let memoizedDone = false;

export async function ensureSuperAdmin(): Promise<void> {
  if (memoizedDone) return;

  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const masterKey = process.env.SUPERADMIN_MASTER_KEY?.trim();
  if (!email || !masterKey) return; // not configured — nothing to do
  if (masterKey.length < 12) {
    console.warn("[bootstrap] SUPERADMIN_MASTER_KEY is shorter than 12 chars; refusing.");
    return;
  }

  try {
    const existing = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    if (existing > 0) {
      memoizedDone = true;
      return;
    }

    const passwordHash = await bcrypt.hash(masterKey, 10);
    const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: "SUPERADMIN", status: "ACTIVE", name },
      create: { email, name, passwordHash, role: "SUPERADMIN", status: "ACTIVE" },
    });

    console.log(`[bootstrap] Provisioned SUPERADMIN: ${email}`);
    memoizedDone = true;
  } catch (err) {
    // DB might not be reachable yet (e.g. schema not pushed). Don't memoize —
    // we'll retry on the next request. Surface the error to server logs.
    console.error(
      "[bootstrap] failed:",
      err instanceof Error ? err.message : err
    );
  }
}
