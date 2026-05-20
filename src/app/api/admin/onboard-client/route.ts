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
import { Playlists } from "@/lib/optisigns";

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

function inferType(raw?: string | null): "IMAGE" | "VIDEO" | "WEBSITE" | "URL" | "UNKNOWN" {
  if (!raw) return "UNKNOWN";
  const t = raw.toUpperCase();
  if (t.includes("IMAGE")) return "IMAGE";
  if (t.includes("VIDEO")) return "VIDEO";
  if (t.includes("WEB") || t.includes("URL")) return "WEBSITE";
  return "UNKNOWN";
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid input");
    const { client: cIn, user: uIn, mapping: mIn } = parsed.data;

    // Up-front uniqueness check on the user's email — done BEFORE we create
    // the client so we don't leave an orphan client row.
    if (uIn) {
      const existing = await prisma.user.findUnique({ where: { email: uIn.email } });
      if (existing) return fail(409, `A user with email ${uIn.email} already exists`);
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
        const remote = await Playlists.getPlaylist(result.mapping.optisignsPlaylistId);
        if (!remote) {
          importResult = { error: "OptiSigns has no playlist with that id" };
        } else {
          const items = remote.assets ?? [];
          let assetsCreated = 0;
          const seen = new Set<string>();
          for (const it of items) {
            const assetId = it.assetRootId ?? it._id;
            if (!assetId || seen.has(assetId)) continue;
            seen.add(assetId);
            const before = await prisma.assetReference.findUnique({
              where: { clientId_optisignsAssetId: { clientId: result.client.id, optisignsAssetId: assetId } },
            });
            await prisma.assetReference.upsert({
              where: { clientId_optisignsAssetId: { clientId: result.client.id, optisignsAssetId: assetId } },
              create: {
                clientId: result.client.id,
                optisignsAssetId: assetId,
                title: it.filename?.trim() || `Asset ${assetId}`,
                type: inferType(it.type),
                thumbnailUrl: it.thumbnail ?? null,
                sourceUrl: it.webLink ?? null,
                status: "APPROVED",
              },
              update: {},
            });
            if (!before) assetsCreated++;
          }
          const draft = await prisma.playlistDraft.create({
            data: {
              clientId: result.client.id,
              optisignsPlaylistId: result.mapping.optisignsPlaylistId,
              status: "DRAFT",
              items: {
                create: items
                  .map((it, idx) => {
                    const aid = it.assetRootId ?? it._id;
                    if (!aid) return null;
                    return {
                      clientId: result.client.id,
                      optisignsPlaylistId: result.mapping!.optisignsPlaylistId,
                      optisignsPlaylistItemId: it._id ?? null,
                      optisignsAssetId: aid,
                      title: it.filename?.trim() || `Asset ${aid}`,
                      type: inferType(it.type),
                      durationSeconds:
                        typeof it.duration === "number" && it.duration > 0 ? Math.round(it.duration) : 10,
                      sortOrder: idx,
                      status: "ACTIVE",
                    };
                  })
                  .filter((x): x is NonNullable<typeof x> => x !== null),
              },
            },
            include: { items: { select: { id: true } } },
          });
          importResult = { itemCount: draft.items.length, assetsCreated };
        }
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
