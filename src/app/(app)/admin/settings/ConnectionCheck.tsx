"use client";

import { useState } from "react";

type Step = { ok: boolean; detail?: string };
type Field = { name: string; type: string };
type RootField = { name: string; returns: string };
type TypeInfo = { name: string; fields: Field[] };

type Result = {
  ok: boolean;
  endpoint: string;
  steps: { env: Step; reach: Step; auth: Step; dataAccess?: Step };
  queries: RootField[];
  mutations: RootField[];
  typesOfInterest: TypeInfo[];
};

export default function ConnectionCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/optisigns/check");
      const body = await res.json();
      if (!res.ok) setError(body.error || `HTTP ${res.status}`);
      else setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
    setBusy(false);
  }

  function copySchemaDump() {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`# Endpoint: ${result.endpoint}\n`);
    lines.push(`## Queries (${result.queries.length})`);
    result.queries.forEach((q) => lines.push(`  ${q.name}: ${q.returns}`));
    lines.push(`\n## Mutations (${result.mutations.length})`);
    result.mutations.forEach((m) => lines.push(`  ${m.name}: ${m.returns}`));
    lines.push(`\n## Relevant types`);
    result.typesOfInterest.forEach((t) => {
      lines.push(`\ntype ${t.name} {`);
      t.fields.forEach((f) => lines.push(`  ${f.name}: ${f.type}`));
      lines.push(`}`);
    });
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">OptiSigns connection</h3>
          <p className="text-xs text-slate-500">
            Verifies env vars, GraphQL reachability, and introspects the schema.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="px-3 py-1.5 text-sm bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg font-medium"
        >
          {busy ? "Testing…" : "Test connection"}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <StepLine label="Env vars" step={result.steps.env} />
          <StepLine label="Endpoint reachable" step={result.steps.reach} />
          <StepLine label="Schema accessible" step={result.steps.auth} />
          {result.steps.dataAccess && (
            <StepLine label="Data API enabled" step={result.steps.dataAccess} />
          )}
          <div className="text-xs text-slate-500 mt-2 font-mono">{result.endpoint}</div>

          {(result.queries.length > 0 || result.typesOfInterest.length > 0) && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {result.queries.length} queries · {result.mutations.length} mutations · {result.typesOfInterest.length} relevant types
                </div>
                <button
                  onClick={copySchemaDump}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Copy schema dump
                </button>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-slate-700 font-medium">Root queries</summary>
                <ul className="font-mono text-[11px] text-slate-700 mt-1 space-y-0.5 max-h-72 overflow-y-auto pl-4">
                  {result.queries.map((q) => (
                    <li key={q.name}>
                      <span className="text-slate-900">{q.name}</span>
                      <span className="text-slate-400">: {q.returns}</span>
                    </li>
                  ))}
                </ul>
              </details>

              <details className="text-xs">
                <summary className="cursor-pointer text-slate-700 font-medium">Mutations</summary>
                <ul className="font-mono text-[11px] text-slate-700 mt-1 space-y-0.5 max-h-72 overflow-y-auto pl-4">
                  {result.mutations.map((m) => (
                    <li key={m.name}>
                      <span className="text-slate-900">{m.name}</span>
                      <span className="text-slate-400">: {m.returns}</span>
                    </li>
                  ))}
                </ul>
              </details>

              <details className="text-xs" open>
                <summary className="cursor-pointer text-slate-700 font-medium">
                  Relevant types (Device/Playlist/Asset/*Response)
                </summary>
                <div className="space-y-2 mt-2">
                  {result.typesOfInterest.map((t) => (
                    <div key={t.name} className="border border-slate-200 rounded p-2 bg-slate-50">
                      <div className="font-mono text-[11px] text-slate-900 font-semibold">type {t.name}</div>
                      <ul className="font-mono text-[11px] text-slate-700 mt-1 space-y-0.5 pl-3">
                        {t.fields.map((f) => (
                          <li key={f.name}>
                            <span className="text-slate-900">{f.name}</span>
                            <span className="text-slate-400">: {f.type}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepLine({ label, step }: { label: string; step: Step }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={step.ok ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
        {step.ok ? "✓" : "✗"}
      </span>
      <span className="text-slate-700 font-medium w-44">{label}</span>
      <span className="text-slate-500 flex-1 break-all">{step.detail}</span>
    </div>
  );
}
