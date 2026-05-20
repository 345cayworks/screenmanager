// Tiny helper around SystemSetting rows. Keeps reads cached per-process so
// the local-only flag doesn't add a DB hit to every render.

import { prisma } from "./prisma";

const memo = new Map<string, { v: string | null; expires: number }>();
const TTL_MS = 60_000;

async function get(key: string): Promise<string | null> {
  const hit = memo.get(key);
  if (hit && hit.expires > Date.now()) return hit.v;
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  memo.set(key, { v: row?.value ?? null, expires: Date.now() + TTL_MS });
  return row?.value ?? null;
}

export async function set(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  memo.delete(key);
}

const LOCAL_ONLY_KEY = "operatingMode"; // "local" | "api"

/**
 * True when admin has put the portal into local-only mode (no OptiSigns API
 * calls). Defaults to false. Cached for 60s per process.
 */
export async function isLocalOnly(): Promise<boolean> {
  return (await get(LOCAL_ONLY_KEY)) === "local";
}

export async function setLocalOnly(local: boolean): Promise<void> {
  await set(LOCAL_ONLY_KEY, local ? "local" : "api");
}
