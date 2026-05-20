"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeReport } from "@/lib/change-report";

export default function LocalApprovedCard({
  playlistId,
  reportText,
  report,
}: {
  playlistId: string;
  reportText: string;
  report: ChangeReport;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function markPublished() {
    if (!window.confirm("Confirm you've applied these changes in the OptiSigns dashboard?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/playlists/${playlistId}/mark-published`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Failed");
      return;
    }
    router.refresh();
  }

  function copy() {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-t border-slate-100 pt-3 space-y-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
        Manual mirror checklist
      </div>

      {!report.hadPrevious && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          No previous published version — treat every item as a new add.
        </div>
      )}

      {report.added.length > 0 && (
        <Section title={`Add ${report.added.length} item(s)`} tone="green">
          {report.added.map((a) => (
            <Row key={a.optisignsAssetId} prefix={`+ pos ${a.sortOrder + 1}`}>
              <span className="font-medium">{a.title}</span>
              <Meta>{a.optisignsAssetId} · {a.type} · {a.durationSeconds}s</Meta>
            </Row>
          ))}
        </Section>
      )}

      {report.removed.length > 0 && (
        <Section title={`Remove ${report.removed.length} item(s)`} tone="red">
          {report.removed.map((a) => (
            <Row key={a.optisignsAssetId} prefix="-">
              <span className="font-medium">{a.title}</span>
              <Meta>{a.optisignsAssetId}</Meta>
            </Row>
          ))}
        </Section>
      )}

      {report.changed.length > 0 && (
        <Section title={`Update ${report.changed.length} item(s)`} tone="blue">
          {report.changed.map((c) => {
            const moved = c.before.sortOrder !== c.after.sortOrder;
            const dur = c.before.durationSeconds !== c.after.durationSeconds;
            return (
              <Row key={c.optisignsAssetId} prefix="~">
                <span className="font-medium">{c.title}</span>
                <Meta>
                  {moved && <>pos {c.before.sortOrder + 1} → {c.after.sortOrder + 1}</>}
                  {moved && dur && <> · </>}
                  {dur && <>{c.before.durationSeconds}s → {c.after.durationSeconds}s</>}
                </Meta>
              </Row>
            );
          })}
        </Section>
      )}

      <div className="border-t border-slate-100 pt-3">
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-600 font-medium">
            Final playlist order ({report.finalOrder.length})
          </summary>
          <ol className="mt-2 pl-4 space-y-0.5 text-slate-700">
            {report.finalOrder.map((i) => (
              <li key={i.optisignsAssetId}>
                {i.sortOrder + 1}. <span className="font-medium">{i.title}</span>{" "}
                <span className="text-slate-400 font-mono">{i.optisignsAssetId}</span>{" "}
                <span className="text-slate-500">({i.durationSeconds}s)</span>
              </li>
            ))}
          </ol>
        </details>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={copy}
          className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-900 rounded font-medium"
        >
          {copied ? "Copied ✓" : "Copy report"}
        </button>
        <button
          onClick={markPublished}
          disabled={busy}
          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded font-medium ml-auto"
        >
          {busy ? "Marking…" : "Mark as published"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "green" | "red" | "blue";
  children: React.ReactNode;
}) {
  const colors = {
    green: "border-green-200 bg-green-50/40",
    red: "border-red-200 bg-red-50/40",
    blue: "border-blue-200 bg-blue-50/40",
  } as const;
  return (
    <div className={`border ${colors[tone]} rounded-lg p-3`}>
      <div className="text-xs font-semibold text-slate-700 mb-2">{title}</div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function Row({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  return (
    <li className="text-sm flex items-center gap-2">
      <span className="font-mono text-xs text-slate-400 w-12 flex-shrink-0">{prefix}</span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="ml-2 text-xs text-slate-500">{children}</span>;
}
