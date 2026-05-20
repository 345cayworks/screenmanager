// Generates a human-readable diff between a draft's items and the last
// PUBLISHED state for the same (client, playlist). Used in local-only mode
// so admins can see exactly what to mirror into the OptiSigns dashboard
// by hand.

import { prisma } from "./prisma";

export type ChangeReportRow = {
  sortOrder: number;
  optisignsAssetId: string;
  title: string;
  type: string;
  durationSeconds: number;
};

export type ChangeReport = {
  draftId: string;
  added: ChangeReportRow[];
  removed: ChangeReportRow[];
  changed: Array<{
    optisignsAssetId: string;
    title: string;
    type: string;
    before: { sortOrder: number; durationSeconds: number };
    after: { sortOrder: number; durationSeconds: number };
  }>;
  unchanged: ChangeReportRow[];
  finalOrder: ChangeReportRow[];
  hadPrevious: boolean;
};

export async function buildChangeReport(draftId: string): Promise<ChangeReport | null> {
  const draft = await prisma.playlistDraft.findUnique({
    where: { id: draftId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!draft) return null;

  // Last PUBLISHED draft for this same (client, playlist) — that's the state
  // the OptiSigns side should currently reflect.
  const previous = await prisma.playlistDraft.findFirst({
    where: {
      clientId: draft.clientId,
      optisignsPlaylistId: draft.optisignsPlaylistId,
      status: "PUBLISHED",
      id: { not: draft.id },
    },
    orderBy: { publishedAt: "desc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  const toRow = (i: {
    sortOrder: number;
    optisignsAssetId: string;
    title: string;
    type: string;
    durationSeconds: number;
  }): ChangeReportRow => ({
    sortOrder: i.sortOrder,
    optisignsAssetId: i.optisignsAssetId,
    title: i.title,
    type: i.type,
    durationSeconds: i.durationSeconds,
  });

  const currentByAsset = new Map(draft.items.map((i) => [i.optisignsAssetId, i]));
  const previousByAsset = new Map((previous?.items ?? []).map((i) => [i.optisignsAssetId, i]));

  const added: ChangeReportRow[] = [];
  const removed: ChangeReportRow[] = [];
  const changed: ChangeReport["changed"] = [];
  const unchanged: ChangeReportRow[] = [];

  for (const cur of draft.items) {
    const prev = previousByAsset.get(cur.optisignsAssetId);
    if (!prev) {
      added.push(toRow(cur));
    } else if (prev.sortOrder !== cur.sortOrder || prev.durationSeconds !== cur.durationSeconds) {
      changed.push({
        optisignsAssetId: cur.optisignsAssetId,
        title: cur.title,
        type: cur.type,
        before: { sortOrder: prev.sortOrder, durationSeconds: prev.durationSeconds },
        after: { sortOrder: cur.sortOrder, durationSeconds: cur.durationSeconds },
      });
    } else {
      unchanged.push(toRow(cur));
    }
  }
  for (const prev of previous?.items ?? []) {
    if (!currentByAsset.has(prev.optisignsAssetId)) removed.push(toRow(prev));
  }

  return {
    draftId: draft.id,
    added,
    removed,
    changed,
    unchanged,
    finalOrder: draft.items.map(toRow),
    hadPrevious: !!previous,
  };
}

/** Pretty-printed plain-text version for clipboard / email. */
export function formatChangeReport(r: ChangeReport): string {
  const lines: string[] = [];
  lines.push(`# Playlist change report`);
  if (!r.hadPrevious) {
    lines.push(`(No previous PUBLISHED state — every item is "added".)`);
  }
  lines.push("");

  lines.push(`## Add ${r.added.length} item(s)`);
  for (const a of r.added) {
    lines.push(`  + [pos ${a.sortOrder + 1}] ${a.title}  (asset ${a.optisignsAssetId}, ${a.type}, ${a.durationSeconds}s)`);
  }

  lines.push("");
  lines.push(`## Remove ${r.removed.length} item(s)`);
  for (const x of r.removed) {
    lines.push(`  - ${x.title}  (asset ${x.optisignsAssetId})`);
  }

  lines.push("");
  lines.push(`## Update ${r.changed.length} item(s)`);
  for (const c of r.changed) {
    const moved = c.before.sortOrder !== c.after.sortOrder;
    const dur = c.before.durationSeconds !== c.after.durationSeconds;
    const parts = [];
    if (moved) parts.push(`position ${c.before.sortOrder + 1} → ${c.after.sortOrder + 1}`);
    if (dur) parts.push(`duration ${c.before.durationSeconds}s → ${c.after.durationSeconds}s`);
    lines.push(`  ~ ${c.title}  (asset ${c.optisignsAssetId}): ${parts.join(", ")}`);
  }

  lines.push("");
  lines.push(`## Final playlist order (${r.finalOrder.length} item(s))`);
  for (const i of r.finalOrder) {
    lines.push(`  ${i.sortOrder + 1}. ${i.title}  (asset ${i.optisignsAssetId}, ${i.durationSeconds}s)`);
  }

  return lines.join("\n");
}
