/**
 * Seed script — provisions the SUPERADMIN account from environment variables
 * and (optionally) loads demo client/user/mapping/asset data so the UI has
 * something to render.
 *
 * Required env vars:
 *   SUPER_ADMIN_EMAIL      — email for the bootstrap superadmin account
 *   SUPERADMIN_MASTER_KEY  — the plaintext password (bcrypt-hashed at rest)
 *
 * Optional env vars:
 *   SUPER_ADMIN_NAME       — display name (default: "Super Admin")
 *   SEED_DEMO_DATA         — set to "true" to also create the Acme demo data
 *
 * Run:  npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`✗ Missing required env var: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

async function seedSuperAdmin() {
  const email = requireEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const masterKey = requireEnv("SUPERADMIN_MASTER_KEY");
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (masterKey.length < 12) {
    console.error("✗ SUPERADMIN_MASTER_KEY must be at least 12 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(masterKey, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "SUPERADMIN", status: "ACTIVE", name },
    create: { email, passwordHash, role: "SUPERADMIN", status: "ACTIVE", name },
  });

  console.log(`✓ SUPERADMIN ready: ${user.email}`);
}

async function seedDemoData() {
  const acme = await prisma.client.upsert({
    where: { id: "seed-client-acme" },
    update: {},
    create: {
      id: "seed-client-acme",
      companyName: "Acme Restaurants",
      contactName: "Jamie Rivera",
      contactEmail: "jamie@acme.example",
      phone: "+1 555 0100",
      approvalMode: "REQUIRES_APPROVAL",
    },
  });

  const demoHash = await bcrypt.hash("ChangeMe123!", 10);

  await prisma.user.upsert({
    where: { email: "owner@acme.example" },
    update: {},
    create: {
      name: "Acme Owner",
      email: "owner@acme.example",
      passwordHash: demoHash,
      role: "CLIENT_OWNER",
      clientId: acme.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "editor@acme.example" },
    update: {},
    create: {
      name: "Acme Editor",
      email: "editor@acme.example",
      passwordHash: demoHash,
      role: "CLIENT_EDITOR",
      clientId: acme.id,
    },
  });

  await prisma.optiSignsMapping.upsert({
    where: {
      clientId_optisignsPlaylistId: {
        clientId: acme.id,
        optisignsPlaylistId: "demo-playlist-acme-001",
      },
    },
    update: {},
    create: {
      clientId: acme.id,
      optisignsPlaylistId: "demo-playlist-acme-001",
      optisignsPlaylistName: "Acme Lobby Loop",
      optisignsScreenId: "demo-screen-acme-lobby",
      optisignsScreenName: "Lobby Screen",
      canPublishDirectly: false,
    },
  });

  const assets = [
    { id: "demo-asset-promo", title: "Spring Promo Banner", type: "IMAGE" },
    { id: "demo-asset-menu", title: "Daily Menu Video", type: "VIDEO" },
    { id: "demo-asset-website", title: "Acme Website Hero", type: "WEBSITE" },
  ];
  for (const a of assets) {
    await prisma.assetReference.upsert({
      where: { clientId_optisignsAssetId: { clientId: acme.id, optisignsAssetId: a.id } },
      update: {},
      create: {
        clientId: acme.id,
        optisignsAssetId: a.id,
        title: a.title,
        type: a.type,
        status: "APPROVED",
      },
    });
  }

  console.log("✓ Demo data loaded (Acme client + 2 users + 1 mapping + 3 assets)");
  console.log("  Demo logins (password: ChangeMe123!):");
  console.log("    owner@acme.example     CLIENT_OWNER");
  console.log("    editor@acme.example    CLIENT_EDITOR");
}

async function main() {
  await seedSuperAdmin();

  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoData();
  } else {
    console.log("· Skipping demo data (set SEED_DEMO_DATA=true to include it).");
  }

  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
