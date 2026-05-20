/**
 * Seed script — populates the database with example users, a client, OptiSigns
 * mappings, asset references, and a starter draft so the UI has data to show.
 *
 * Run:    npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  // 1. Demo client
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

  // 2. Users
  await prisma.user.upsert({
    where: { email: "admin@cayworks.example" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@cayworks.example",
      passwordHash,
      role: "SUPERADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "owner@acme.example" },
    update: {},
    create: {
      name: "Acme Owner",
      email: "owner@acme.example",
      passwordHash,
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
      passwordHash,
      role: "CLIENT_EDITOR",
      clientId: acme.id,
    },
  });

  // 3. OptiSigns mapping (placeholder IDs — replace with real ones in admin UI)
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

  // 4. Asset references
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

  console.log("✓ Seed complete");
  console.log("  Login: admin@cayworks.example / ChangeMe123!");
  console.log("  Login: owner@acme.example     / ChangeMe123!");
  console.log("  Login: editor@acme.example    / ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
