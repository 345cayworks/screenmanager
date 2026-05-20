// POST /api/admin/onboard-client
//
// One-shot endpoint that creates everything needed to onboard a new client
// in a single transaction:
//   1. Client row
//   2. Primary user (optional) with a one-time setup token
//   3. OptiSignsMapping linking the client to a playlist + screen (optional)
//
// Returns:
//   { client, user, mapping, setupUrl }
// where setupUrl is the one-time path for the new user to finish setup.
//
// If `mapping.importNow` is true and the mapping was created, we also kick
// off the OptiSigns playlist pull (outside the transaction). Failures there
// don't roll back the rest — the admin can re-import later.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";
import { issueSetupToken } from "@/lib/invitations";
import { importPlaylistFromOptiSigns } from "@/lib/import-playlist";

const clientSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  approvalMode: z.enum(["AUTO_PUBLISH", "REQUIRES_APPROVAL"]).default("REQUIRES_APPROVAL"),
});

const userSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().transform((s) => s.toLowerCase().trim()),
    role: z.enum(["CLIENT_OWNER", "CLIENT_EDITOR", "VIEWER"]).default("CLIENT_OWNER"),
  })
  .nullable()
  .optional();

const mappingSchema = z
  .object({
    optisignsPlaylistId: z.string().min(1),
    optisignsPlaylistName: z.string().optional().nullable(),
    optisignsScreenId: z.string().optional().nullable(),
    optisignsScreenName: z.string().optional().nullable(),
    canPublishDirectly: z.boolean().default(false),
    importNow: z.boolean().default(false),
  })
  .nullable()
  .optional();

const bodySchema = z.object({
  client: clientSchema,
  user: userSchema,
  mapping: mappingSchema,
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const { client: cIn, user: uIn, mapping: mIn } = parsed.data;

    // Up-front uniqueness checks before we create the client so we don't
    // leave an orphan client row if a downstream insert collides.
    if (uIn) {
      const existing = await prisma.user.findUnique({ where: { email: uIn.email } });
      if (existing) return fail(409, `A user with email ${uIn.email} already exists`);
    }
    if (mIn) {
      const playlistInUse = await prisma.optiSignsMapping.findUnique({
        where: { optisignsPlaylistId: mIn.optisignsPlaylistId },
        include: { client: { select: { companyName: true } } },
      });
      if (playlistInUse) {
        return fail(
          409,
          `That OptiSigns playlist is already assigned to ${playlistInUse.client.companyName}. Unassign it from that client first.`
        );
      }
      if (mIn.optisignsScreenId) {
        const screenInUse = await prisma.optiSignsMapping.findUnique({
          where: { optisignsScreenId: mIn.optisignsScreenId },
          include: { client: { select: { companyName: true } } },
        });
        if (screenInUse) {
          return fail(
            409,
            `That OptiSigns screen is already linked to ${screenInUse.client.companyName}. Unassign it first.`
          );
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          companyName: cIn.companyName,
          contactName: cIn.contactName ?? null,
          contactEmail: cIn.contactEmail ?? null,
          phone: cIn.phone ?? null,
          approvalMode: cIn.approvalMode,
        },
      });

      let user = null as null | { id: string; email: string; name: string; role: string };
      if (uIn) {
        user = await tx.user.create({
          data: {
            name: uIn.name,
            email: uIn.email,
            role: uIn.role,
            status: "ACTIVE",
            clientId: client.id,
          },
          select: { id: true, email: true, name: true, role: true },
        });
      }

      let mapping = null as null | { id: string; optisignsPlaylistId: string };
      if (mIn) {
        mapping = await tx.optiSignsMapping.create({
          data: {
            clientId: client.id,
            optisignsPlaylistId: mIn.optisignsPlaylistId,
            optisignsPlaylistName: mIn.optisignsPlaylistName ?? null,
            optisignsScreenId: mIn.optisignsScreenId ?? null,
            optisignsScreenName: mIn.optisignsScreenName ?? null,
            canPublishDirectly: mIn.canPublishDirectly,
          },
          select: { id: true, optisignsPlaylistId: true },
        });
      }

      return { client, user, mapping };
    });

    // Setup token for the new user, outside the transaction (sha256 hashing
    // is fast but doesn't need to hold a DB lock).
    let setupUrl: string | null = null;
    if (result.user) {
      const token = await issueSetupToken(result.user.id);
      setupUrl = `/setup-password?token=${encodeURIComponent(token)}`;
    }

    // Optional: pull playlist content into a local DRAFT immediately.
    let importResult: { itemCount: number; assetsCreated: number } | { error: string } | null = null;
    if (result.mapping && mIn?.importNow) {
      try {
        const r = await importPlaylistFromOptiSigns({
          clientId: result.client.id,
          optisignsPlaylistId: result.mapping.optisignsPlaylistId,
          byUserId: session.userId,
        });
        importResult = { itemCount: r.itemCount, assetsCreated: r.assetsCreated };
      } catch (err) {
        importResult = { error: err instanceof Error ? err.message : "OptiSigns import failed" };
      }
    }

    await audit({
      userId: session.userId,
      clientId: result.client.id,
      action: "CLIENT_ONBOARDED",
      entityType: "Client",
      entityId: result.client.id,
      after: {
        client: result.client.companyName,
        user: result.user?.email ?? null,
        playlistId: result.mapping?.optisignsPlaylistId ?? null,
        importResult,
      },
    });

    return ok({
      client: result.client,
      user: result.user,
      mapping: result.mapping,
      setupUrl,
      importResult,
    });
  });
}
