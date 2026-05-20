import { readSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/enums";
import PlaylistEditor from "./PlaylistEditor";
import { importPlaylistFromOptiSigns } from "@/lib/import-playlist";
import { isLocalOnly } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PlaylistPage({ params }: { params: { id: string } }) {
  const localOnly = await isLocalOnly();
  const session = await readSession();
  if (!session) redirect("/login");

  const optisignsPlaylistId = params.id;

  const mapping = await prisma.optiSignsMapping.findFirst({
    where: { optisignsPlaylistId },
    include: { client: true },
  });
  if (!mapping) notFound();

  if (!isAdminRole(session.role) && session.clientId !== mapping.clientId) {
    redirect("/playlists");
  }

  // Ensure a DRAFT exists for this client+playlist.
  let draft = await prisma.playlistDraft.findFirst({
    where: {
      clientId: mapping.clientId,
      optisignsPlaylistId,
      status: { in: ["DRAFT", "PENDING_APPROVAL"] },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  // First open: no DRAFT yet. In API mode, seed it from the live OptiSigns
  // playlist so the client lands on the real content. In local-only mode we
  // skip the network call and just create an empty DRAFT — assets are
  // managed manually.
  let autoImportError: string | null = null;
  if (!draft) {
    if (!localOnly) {
      try {
        const r = await importPlaylistFromOptiSigns({
          clientId: mapping.clientId,
          optisignsPlaylistId,
          byUserId: session.userId,
        });
        draft = await prisma.playlistDraft.findUnique({
          where: { id: r.draftId },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        });
      } catch (err) {
        autoImportError = err instanceof Error ? err.message : "OptiSigns import failed";
      }
    }
    if (!draft) {
      draft = await prisma.playlistDraft.create({
        data: {
          clientId: mapping.clientId,
          optisignsPlaylistId,
          status: "DRAFT",
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    }
  }

  const assets = await prisma.assetReference.findMany({
    where: { clientId: mapping.clientId, status: "APPROVED" },
    orderBy: { title: "asc" },
  });

  return (
    <PlaylistEditor
      session={session}
      mapping={{
        id: mapping.id,
        clientId: mapping.clientId,
        clientName: mapping.client.companyName,
        approvalMode: mapping.client.approvalMode,
        canPublishDirectly: mapping.canPublishDirectly,
        playlistId: mapping.optisignsPlaylistId,
        playlistName: mapping.optisignsPlaylistName,
        screenName: mapping.optisignsScreenName,
      }}
      draft={{
        id: draft.id,
        status: draft.status,
        items: draft.items.map((i) => ({
          id: i.id,
          optisignsAssetId: i.optisignsAssetId,
          title: i.title,
          type: i.type,
          durationSeconds: i.durationSeconds,
          sortOrder: i.sortOrder,
          status: i.status,
          optisignsPlaylistItemId: i.optisignsPlaylistItemId,
        })),
      }}
      assets={assets.map((a) => ({
        id: a.id,
        optisignsAssetId: a.optisignsAssetId,
        title: a.title,
        type: a.type,
        thumbnailUrl: a.thumbnailUrl,
      }))}
      autoImportError={autoImportError}
      localOnly={localOnly}
    />
  );
}
