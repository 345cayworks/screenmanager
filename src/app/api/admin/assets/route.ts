import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/http";

const create = z.object({
  clientId: z.string().min(1),
  optisignsAssetId: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["IMAGE", "VIDEO", "WEBSITE", "URL", "UNKNOWN"]).default("UNKNOWN"),
  thumbnailUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  status: z.enum(["APPROVED", "PENDING", "REJECTED"]).default("APPROVED"),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAdmin();
    const body = create.safeParse(await req.json());
    if (!body.success) return fail(400, "Invalid input");
    const asset = await prisma.assetReference.upsert({
      where: {
        clientId_optisignsAssetId: {
          clientId: body.data.clientId,
          optisignsAssetId: body.data.optisignsAssetId,
        },
      },
      create: body.data,
      update: body.data,
    });
    await audit({
      userId: session.userId,
      clientId: body.data.clientId,
      action: "ASSET_UPSERTED",
      entityType: "AssetReference",
      entityId: asset.id,
      after: asset,
    });
    return ok(asset);
  });
}
